// Read side of inbound store notifications, for operators. Not `query.ts`:
// that module name belonged to the removed outbound stream, and the parity
// audit keeps it out of the generated API.
//
// Raw signed payloads never leave this module; a SHA-256 prefix identifies one.

import {
  paginationOptsValidator,
  paginationResultValidator,
  type PaginationOptions,
  type PaginationResult,
} from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import {
  resolveOperatorProject,
  type OperatorProjectArgs,
} from "../projects/helpers";
import { purchaseStoreValidator } from "../schema";
import { sha256Hex } from "../utils/sha256";

const MAX_NOTIFICATION_PAGE_SIZE = 100;
const FINGERPRINT_LENGTH = 16;

const inboundNotificationValidator = v.object({
  _id: v.id("webhookEvents"),
  source: v.string(),
  store: purchaseStoreValidator,
  type: v.string(),
  environment: v.string(),
  sourceNotificationId: v.string(),
  productId: v.optional(v.string()),
  transactionId: v.optional(v.string()),
  originalTransactionId: v.optional(v.string()),
  userId: v.optional(v.string()),
  payloadFingerprint: v.optional(v.string()),
  occurredAt: v.number(),
  receivedAt: v.number(),
  appliedAt: v.optional(v.number()),
  // A store retry shares the first row's dedup key, so it never adds a row.
  status: v.union(v.literal("applied"), v.literal("pending")),
});
export type InboundNotification = Infer<typeof inboundNotificationValidator>;

/** Newest first; members and secret keys may read it. */
export const listInboundNotifications = query({
  args: {
    projectId: v.optional(v.id("projects")),
    apiKey: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(inboundNotificationValidator),
  handler: async (ctx, args) => listInboundNotificationsHandler(ctx, args),
});

export async function listInboundNotificationsHandler(
  ctx: QueryCtx,
  args: OperatorProjectArgs & { paginationOpts: PaginationOptions },
): Promise<PaginationResult<InboundNotification>> {
  const project = await resolveOperatorProject(ctx, args, "read");
  if (args.paginationOpts.numItems > MAX_NOTIFICATION_PAGE_SIZE) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: `A page holds at most ${MAX_NOTIFICATION_PAGE_SIZE} notifications.`,
    });
  }
  const rows = await ctx.db
    .query("webhookEvents")
    .withIndex("by_project_and_received", (q) => q.eq("projectId", project._id))
    .order("desc")
    .paginate(args.paginationOpts);
  const page = await Promise.all(
    rows.page.map((event) => toInboundNotification(ctx, event)),
  );
  return { ...rows, page };
}

async function toInboundNotification(
  ctx: QueryCtx,
  event: Doc<"webhookEvents">,
): Promise<InboundNotification> {
  const userId = event.purchaseToken
    ? await boundUserFor(ctx, event, event.purchaseToken)
    : undefined;
  return {
    _id: event._id,
    source: event.source,
    store: event.store ?? (event.platform === "IOS" ? "apple" : "google"),
    type: event.type,
    environment: event.environment,
    sourceNotificationId: event.sourceNotificationId,
    ...(event.productId ? { productId: event.productId } : {}),
    ...(event.transactionId ? { transactionId: event.transactionId } : {}),
    ...(event.originalTransactionId
      ? { originalTransactionId: event.originalTransactionId }
      : {}),
    ...(userId ? { userId } : {}),
    ...(event.rawSignedPayload
      ? {
          payloadFingerprint: (await sha256Hex(event.rawSignedPayload)).slice(
            0,
            FINGERPRINT_LENGTH,
          ),
        }
      : {}),
    occurredAt: event.occurredAt,
    receivedAt: event.receivedAt,
    ...(event.appliedAt !== undefined ? { appliedAt: event.appliedAt } : {}),
    status: event.appliedAt !== undefined ? "applied" : "pending",
  };
}

/** The purchase token itself is a Play credential, so only the owner is shown. */
async function boundUserFor(
  ctx: QueryCtx,
  event: Doc<"webhookEvents">,
  purchaseToken: string,
): Promise<string | undefined> {
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_project_and_token", (q) =>
      q.eq("projectId", event.projectId).eq("purchaseToken", purchaseToken),
    )
    .unique();
  if (subscription?.userId) return subscription.userId;
  const purchase = await ctx.db
    .query("purchases")
    .withIndex("by_project_and_remote", (q) =>
      q.eq("projectId", event.projectId).eq("remoteId", purchaseToken),
    )
    .first();
  return purchase?.appUserId;
}
