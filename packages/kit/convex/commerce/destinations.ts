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
import { resolveProjectByIdForCurrentUserFromDb } from "../projects/helpers";
import { COMMERCE_EVENT_TYPES } from "./contract";
import { COMMERCE_EVENT_RETENTION_MS, checkDestinationUrl } from "./signing";

const SECRET_BYTES = 32;
/** Window during which a rotated-out secret still signs alongside the new one. */
const ROTATION_GRACE_MS = 24 * 60 * 60 * 1000;
const MAX_DESTINATIONS_PER_PROJECT = 10;
const DESTINATION_DELETION_PAGE = 100;
export const MAX_DESTINATION_URL_LENGTH = 2_048;
export const MAX_DESTINATION_DESCRIPTION_LENGTH = 512;

function generateSecret(): string {
  const bytes = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return `whsec_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function assertProjectAdmin(
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

function normalizeEventTypes(
  eventTypes: string[] | undefined,
): string[] | undefined {
  if (!eventTypes) return undefined;
  const unknown = eventTypes.filter(
    (type) => !(COMMERCE_EVENT_TYPES as readonly string[]).includes(type),
  );
  if (unknown.length > 0) {
    throw new ConvexError(`Unknown event types: ${unknown.join(", ")}`);
  }
  return [...new Set(eventTypes)];
}

function assertDestinationMetadata(url: string, description?: string): void {
  if (url.length > MAX_DESTINATION_URL_LENGTH) {
    throw new ConvexError(
      `Destination URL must be at most ${MAX_DESTINATION_URL_LENGTH} characters`,
    );
  }
  if (
    description !== undefined &&
    description.length > MAX_DESTINATION_DESCRIPTION_LENGTH
  ) {
    throw new ConvexError(
      `Description must be at most ${MAX_DESTINATION_DESCRIPTION_LENGTH} characters`,
    );
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

export const canManage = query({
  args: { projectId: v.id("projects") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const resolved = await resolveProjectByIdForCurrentUserFromDb(
      ctx,
      args.projectId,
    );
    return resolved !== null && resolved.role !== "member";
  },
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
    assertDestinationMetadata(args.url, args.description);
    const check = checkDestinationUrl(args.url);
    if (!check.ok) {
      throw new ConvexError(`Destination URL rejected: ${check.reason}`);
    }
    const eventTypes = normalizeEventTypes(args.eventTypes);

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
      ...(eventTypes ? { eventTypes } : {}),
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
    assertDestinationMetadata(args.url ?? destination.url, args.description);
    const eventTypes = normalizeEventTypes(args.eventTypes);

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
      ...(args.eventTypes !== undefined ? { eventTypes } : {}),
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

/** Issues a new secret with an optional emergency revocation of both old keys. */
export const rotateSecret = mutation({
  args: {
    destinationId: v.id("outboundDestinations"),
    revokePrevious: v.optional(v.boolean()),
  },
  handler: async (ctx, args) =>
    rotateSecretHandler(ctx, args.destinationId, args.revokePrevious ?? false),
});

export async function rotateSecretHandler(
  ctx: MutationCtx,
  destinationId: Id<"outboundDestinations">,
  revokePrevious = false,
): Promise<{ secret: string; previousSecretExpiresAt: number | null }> {
  {
    const args = { destinationId };
    const destination = await ctx.db.get(args.destinationId);
    if (!destination || destination.pendingDeletion) {
      throw new ConvexError("Destination not found");
    }
    await assertProjectAdmin(ctx, destination.projectId);
    const now = Date.now();
    if (
      !revokePrevious &&
      destination.previousSecret &&
      (destination.previousSecretExpiresAt ?? 0) > now
    ) {
      throw new ConvexError(
        "Wait for the current 24-hour secret rotation window to end.",
      );
    }

    const secret = generateSecret();
    const previousSecretExpiresAt = revokePrevious
      ? null
      : now + ROTATION_GRACE_MS;
    await ctx.db.patch(destination._id, {
      secret,
      previousSecret: revokePrevious ? undefined : destination.secret,
      previousSecretExpiresAt: previousSecretExpiresAt ?? undefined,
      updatedAt: now,
    });
    return { secret, previousSecretExpiresAt };
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
    if (!destination) {
      throw new ConvexError("Destination not found");
    }
    await assertProjectAdmin(ctx, destination.projectId);
    if (destination.pendingDeletion) {
      await continueDestinationRemovalHandler(ctx, destination._id);
      return null;
    }
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

/** Resumes one deletion whose scheduled continuation was lost. */
export const resumePendingDestinationRemoval = internalMutation({
  args: {},
  returns: v.union(v.id("outboundDestinations"), v.null()),
  handler: async (ctx) => resumePendingDestinationRemovalHandler(ctx),
});

export async function resumePendingDestinationRemovalHandler(
  ctx: MutationCtx,
): Promise<Id<"outboundDestinations"> | null> {
  const destination = await ctx.db
    .query("outboundDestinations")
    .withIndex("by_pending_deletion", (q) => q.eq("pendingDeletion", true))
    .first();
  if (!destination) return null;
  await continueDestinationRemovalHandler(ctx, destination._id);
  return destination._id;
}

/** Erases rotated-out credentials after their overlap window closes. */
export const pruneExpiredPreviousSecrets = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => pruneExpiredPreviousSecretsHandler(ctx),
});

export async function pruneExpiredPreviousSecretsHandler(
  ctx: MutationCtx,
): Promise<number> {
  const now = Date.now();
  const expired = await ctx.db
    .query("outboundDestinations")
    .withIndex("by_previous_secret_expiry", (q) =>
      q
        .gt("previousSecretExpiresAt", undefined)
        .lte("previousSecretExpiresAt", now),
    )
    .take(DESTINATION_DELETION_PAGE);
  for (const destination of expired) {
    await ctx.db.patch(destination._id, {
      previousSecret: undefined,
      previousSecretExpiresAt: undefined,
      updatedAt: now,
    });
  }
  if (expired.length === DESTINATION_DELETION_PAGE) {
    await ctx.scheduler.runAfter(
      0,
      internal.commerce.destinations.pruneExpiredPreviousSecrets,
      {},
    );
  }
  return expired.length;
}
