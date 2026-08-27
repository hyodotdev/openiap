// Management of outbound destinations.
//
// Admin-only: a destination holds a signing secret and names an endpoint IAPKit
// will POST to, so member-level access is not enough. Secrets are write-only —
// no query in this module returns one.

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { getWritableProject } from "../projects/writable";
import { COMMERCE_EVENT_TYPES } from "./contract";
import { COMMERCE_EVENT_RETENTION_MS, checkDestinationUrl } from "./signing";

const SECRET_BYTES = 32;
/** Window during which a rotated-out secret still signs alongside the new one. */
const ROTATION_GRACE_MS = 24 * 60 * 60 * 1000;
const MAX_DESTINATIONS_PER_PROJECT = 10;
const DESTINATION_DELETION_PAGE = 100;

function generateSecret(): string {
  const bytes = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return `whsec_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function assertProjectAdmin(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<void> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not authenticated");
  const project = await getWritableProject(ctx, projectId);
  if (!project) throw new ConvexError("Project not found");
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_and_user", (q) =>
      q.eq("organizationId", project.organizationId).eq("userId", userId),
    )
    .first();
  if (!membership || membership.role === "member") {
    throw new ConvexError("Insufficient permissions to manage destinations");
  }
}

function assertEventTypes(eventTypes: string[] | undefined): void {
  if (!eventTypes) return;
  const unknown = eventTypes.filter(
    (type) => !(COMMERCE_EVENT_TYPES as readonly string[]).includes(type),
  );
  if (unknown.length > 0) {
    throw new ConvexError(`Unknown event types: ${unknown.join(", ")}`);
  }
}

/** Never leaks `secret` / `previousSecret`. */
function publicView(destination: Doc<"outboundDestinations">) {
  return {
    _id: destination._id,
    url: destination.url,
    enabled: destination.enabled,
    eventTypes: destination.eventTypes,
    description: destination.description,
    disabledReason: destination.disabledReason,
    consecutiveFailures: destination.consecutiveFailures ?? 0,
    lastSuccessAt: destination.lastSuccessAt,
    lastFailureAt: destination.lastFailureAt,
    createdAt: destination.createdAt,
    updatedAt: destination.updatedAt,
  };
}

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => listHandler(ctx, args.projectId),
});

export async function listHandler(
  ctx: QueryCtx,
  projectId: Id<"projects">,
): Promise<ReturnType<typeof publicView>[]> {
  {
    const args = { projectId };
    await assertProjectAdmin(ctx, args.projectId);
    const rows = await ctx.db
      .query("outboundDestinations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return rows.filter((row) => !row.pendingDeletion).map(publicView);
  }
}

/** Returns the secret exactly once, at creation. It is never readable again. */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    url: v.string(),
    description: v.optional(v.string()),
    eventTypes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => createHandler(ctx, args),
});

export type CreateDestinationArgs = {
  projectId: Id<"projects">;
  url: string;
  description?: string;
  eventTypes?: string[];
};

export async function createHandler(
  ctx: MutationCtx,
  args: CreateDestinationArgs,
): Promise<{ destinationId: Id<"outboundDestinations">; secret: string }> {
  {
    await assertProjectAdmin(ctx, args.projectId);
    const check = checkDestinationUrl(args.url);
    if (!check.ok) {
      throw new ConvexError(`Destination URL rejected: ${check.reason}`);
    }
    assertEventTypes(args.eventTypes);

    const existing = await ctx.db
      .query("outboundDestinations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    if (
      existing.filter((destination) => !destination.pendingDeletion).length >=
      MAX_DESTINATIONS_PER_PROJECT
    ) {
      throw new ConvexError(
        `A project may have at most ${MAX_DESTINATIONS_PER_PROJECT} destinations`,
      );
    }

    const secret = generateSecret();
    const now = Date.now();
    const destinationId = await ctx.db.insert("outboundDestinations", {
      projectId: args.projectId,
      url: check.url.toString(),
      secret,
      enabled: true,
      ...(args.eventTypes ? { eventTypes: args.eventTypes } : {}),
      ...(args.description ? { description: args.description } : {}),
      consecutiveFailures: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { destinationId, secret };
  }
}

export const update = mutation({
  args: {
    destinationId: v.id("outboundDestinations"),
    url: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    eventTypes: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => updateHandler(ctx, args),
});

export type UpdateDestinationArgs = {
  destinationId: Id<"outboundDestinations">;
  url?: string;
  enabled?: boolean;
  eventTypes?: string[];
  description?: string;
};

export async function updateHandler(
  ctx: MutationCtx,
  args: UpdateDestinationArgs,
): Promise<null> {
  {
    const destination = await ctx.db.get(args.destinationId);
    if (!destination || destination.pendingDeletion) {
      throw new ConvexError("Destination not found");
    }
    await assertProjectAdmin(ctx, destination.projectId);
    assertEventTypes(args.eventTypes);

    let url: string | undefined;
    if (args.url !== undefined) {
      const check = checkDestinationUrl(args.url);
      if (!check.ok) {
        throw new ConvexError(`Destination URL rejected: ${check.reason}`);
      }
      url = check.url.toString();
    }

    await ctx.db.patch(destination._id, {
      ...(url ? { url } : {}),
      ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
      ...(args.eventTypes ? { eventTypes: args.eventTypes } : {}),
      ...(args.description !== undefined
        ? { description: args.description }
        : {}),
      // Re-enabling clears the breaker so the next tick actually retries.
      ...(args.enabled === true
        ? { consecutiveFailures: 0, disabledReason: undefined }
        : {}),
      updatedAt: Date.now(),
    });
    return null;
  }
}

/** Issues a new secret and keeps the old one valid for the grace window. */
export const rotateSecret = mutation({
  args: { destinationId: v.id("outboundDestinations") },
  handler: async (ctx, args) => rotateSecretHandler(ctx, args.destinationId),
});

export async function rotateSecretHandler(
  ctx: MutationCtx,
  destinationId: Id<"outboundDestinations">,
): Promise<{ secret: string; previousSecretExpiresAt: number }> {
  {
    const args = { destinationId };
    const destination = await ctx.db.get(args.destinationId);
    if (!destination || destination.pendingDeletion) {
      throw new ConvexError("Destination not found");
    }
    await assertProjectAdmin(ctx, destination.projectId);

    const secret = generateSecret();
    const now = Date.now();
    await ctx.db.patch(destination._id, {
      secret,
      previousSecret: destination.secret,
      previousSecretExpiresAt: now + ROTATION_GRACE_MS,
      updatedAt: now,
    });
    return { secret, previousSecretExpiresAt: now + ROTATION_GRACE_MS };
  }
}

export const remove = mutation({
  args: { destinationId: v.id("outboundDestinations") },
  handler: async (ctx, args) => removeHandler(ctx, args.destinationId),
});

export async function removeHandler(
  ctx: MutationCtx,
  destinationId: Id<"outboundDestinations">,
): Promise<null> {
  {
    const args = { destinationId };
    const destination = await ctx.db.get(args.destinationId);
    if (!destination || destination.pendingDeletion) {
      throw new ConvexError("Destination not found");
    }
    await assertProjectAdmin(ctx, destination.projectId);
    await ctx.db.patch(destination._id, {
      enabled: false,
      pendingDeletion: true,
      updatedAt: Date.now(),
    });
    await continueDestinationRemovalHandler(ctx, destination._id);
    return null;
  }
}

export const continueDestinationRemoval = internalMutation({
  args: { destinationId: v.id("outboundDestinations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await continueDestinationRemovalHandler(ctx, args.destinationId);
    return null;
  },
});

export async function continueDestinationRemovalHandler(
  ctx: MutationCtx,
  destinationId: Id<"outboundDestinations">,
): Promise<void> {
  const destination = await ctx.db.get(destinationId);
  if (!destination || !destination.pendingDeletion) return;
  const deliveries = await ctx.db
    .query("outboundDeliveries")
    .withIndex("by_destination", (q) => q.eq("destinationId", destinationId))
    .take(DESTINATION_DELETION_PAGE);
  for (const delivery of deliveries) await ctx.db.delete(delivery._id);
  for (const eventId of new Set(deliveries.map((row) => row.eventId))) {
    const remaining = await ctx.db
      .query("outboundDeliveries")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    if (remaining.every((row) => row.status === "delivered")) {
      const event = await ctx.db.get(eventId);
      if (event && event.prunableAt === undefined) {
        await ctx.db.patch(event._id, {
          prunableAt: Date.now() + COMMERCE_EVENT_RETENTION_MS,
        });
      }
    }
  }
  if (deliveries.length === DESTINATION_DELETION_PAGE) {
    await ctx.scheduler.runAfter(
      0,
      internal.commerce.destinations.continueDestinationRemoval,
      { destinationId },
    );
    return;
  }
  await ctx.db.delete(destinationId);
}
