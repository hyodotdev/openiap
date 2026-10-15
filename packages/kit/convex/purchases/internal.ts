import {
  internalMutation,
  internalQuery,
  MutationCtx,
} from "../_generated/server";
import { v, ConvexError, Infer } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import schema from "../schema";
import { assertProjectWritable } from "../projects/writable";
import {
  syncAmazonSubscription,
  amazonSubscriptionToken,
} from "../subscriptions/amazon";
import {
  bindSubscriptionToUserHandler,
  findSubscriptionByToken,
} from "../subscriptions/internal";
import {
  findWebhookEventByDedupKey,
  recordWebhookEventHandler,
} from "../webhooks/internal";
import {
  amazonLifecycleNoticeValidator,
  type AmazonLifecycleNotice,
} from "../webhooks/amazonShared";
import { receiptResponseValidator } from "./shared";
import {
  isValidSubscriptionUserId,
  MAX_BOUND_PURCHASES_PER_USER,
} from "../subscriptions/limits";
import { isUserErasureRequested } from "../subscriptions/erasure";
import { recheckedBoundPurchases } from "./binding";
import {
  purchaseRequestDataValidator,
  purchaseStoreValidator,
} from "../schema";
import { receiptEnvironmentValidator } from "../utils/validation";
import {
  harmonizedPurchaseStateValidator,
  HarmonizedPurchaseState,
} from "./purchaseState";
import { recordVerificationUsageForOrganization } from "../organizations/internal";
import { correlationIdOrUndefined } from "../utils/correlationId";
import {
  applyPurchaseStatsDelta,
  deltaForCountedPurchaseRemoval,
  deltaForInsert,
  deltaForMissingPurchaseStats,
  deltaForUpdate,
  mergePurchaseStatsDeltas,
  type PurchaseStatsDelta,
} from "./stats";
import {
  AMAZON_RECONCILE_BATCH_LIMIT,
  AMAZON_RECONCILE_INTERVAL_MS,
  AMAZON_RECONCILE_LEASE_MS,
  AMAZON_RECONCILE_RETRY_MS,
  extractOrderIdFromRemoteResponse,
  extractProductIdFromRemoteResponse,
  isValidState,
} from "./shared";

type PurchaseStore = Infer<typeof purchaseStoreValidator>;
type PurchaseRequestData = Infer<typeof purchaseRequestDataValidator>;
type ReceiptEnvironment = Infer<typeof receiptEnvironmentValidator>;

export type SavePurchaseArgs = {
  ctx: MutationCtx;
  projectId: Id<"projects">;
  store: PurchaseStore;
  applicationId: string;
  remoteId?: string;
  requestData: PurchaseRequestData;
  remoteResponse?: string;
  state: HarmonizedPurchaseState;
  isValid: boolean;
  environment?: ReceiptEnvironment;
  requestIp?: string;
  verificationDurationMs?: number;
  persistIfChanged?: boolean;
  amazonRvsSequence?: number;
  amazonNotice?: AmazonLifecycleNotice;
  correlationId?: string;
};

export async function savePurchaseInternal({
  ctx,
  projectId,
  store,
  applicationId,
  remoteId,
  requestData,
  remoteResponse,
  state,
  isValid,
  environment,
  requestIp,
  verificationDurationMs,
  persistIfChanged,
  amazonRvsSequence,
  amazonNotice,
  correlationId: requestCorrelationId,
}: SavePurchaseArgs) {
  // Verification can outlive the request that resolved its API key. Recheck
  // deletion here so a late write cannot recreate purchases the project or
  // account deletion cascade already drained.
  const project = await ctx.db.get(projectId);
  if (!project || project.pendingDeletion) {
    throw new ConvexError("Project not found");
  }
  const organization = await ctx.db.get(project.organizationId);
  if (!organization || organization.pendingDeletion) {
    throw new ConvexError("Organization not found for project");
  }

  const now = Date.now();
  const correlationId = correlationIdOrUndefined(requestCorrelationId);
  const nextAmazonReconcileAt =
    store === "amazon" && isValid
      ? now + AMAZON_RECONCILE_INTERVAL_MS
      : undefined;
  const expectedProductId =
    requestData.store === "google" ? requestData.expectedProductId : undefined;
  const productId = extractProductIdFromRemoteResponse(
    store,
    remoteResponse,
    expectedProductId,
  );
  const orderId = extractOrderIdFromRemoteResponse(
    store,
    remoteResponse,
    expectedProductId,
  );

  // Primary dedup on (projectId, remoteId): most Apple and Horizon flows, and
  // Google replays of the same purchaseToken, stay on one row here.
  if (remoteId) {
    const existing = await ctx.db
      .query("purchases")
      .withIndex("by_project_and_remote", (q) =>
        q.eq("projectId", projectId).eq("remoteId", remoteId),
      )
      .filter((q) => q.eq(q.field("store"), store))
      .first();

    if (existing) {
      if (
        store === "amazon" &&
        amazonRvsSequence !== undefined &&
        (existing.lastAmazonRvsSequence ?? 0) >= amazonRvsSequence
      )
        return existing._id;
      // Amazon rechecks also refresh lifecycle metadata, such as auto-renew.
      if (
        persistIfChanged &&
        store !== "amazon" &&
        existing.state === state &&
        (existing.isValid ?? false) === isValid &&
        (existing.productId ?? null) === productId
      )
        return existing._id;
      // At most one row may own an orderId per (projectId, applicationId), or
      // googleOrders drifts. The race: token T1 is saved pre-ack without an
      // orderId, Google reissues it as T2 and that call inserts a row with O1,
      // then a T1 replay also resolves to O1.
      let conflictDelta: PurchaseStatsDelta = {};
      let savedOrderId = orderId;
      if (
        store === "google" &&
        orderId !== null &&
        existing.orderId !== orderId
      ) {
        const conflict = await ctx.db
          .query("purchases")
          .withIndex("by_project_app_orderId", (q) =>
            q
              .eq("projectId", projectId)
              .eq("applicationId", applicationId)
              .eq("orderId", orderId),
          )
          .first();
        if (conflict && conflict._id !== existing._id) {
          if (
            conflict.appUserId &&
            existing.appUserId &&
            conflict.appUserId !== existing.appUserId
          ) {
            // Two owners: deleting either row would drop a link, so the
            // order stays on the row that holds it.
            savedOrderId = null;
          } else {
            conflictDelta = await collapseConflictingOrderIdRow(
              ctx,
              conflict,
              existing,
            );
          }
        }
      }

      const result = await patchExistingPurchase(
        ctx,
        projectId,
        existing,
        {
          store,
          applicationId,
          remoteId,
          requestData,
          remoteResponse,
          state,
          isValid,
          updatedAt: now,
          environment:
            store === "amazon" && !isValid
              ? (existing.environment ?? environment)
              : environment,
          nextAmazonReconcileAt,
          amazonRvsSequence,
          productId,
          orderId: savedOrderId,
          verificationDurationMs,
          requestIp,
          correlationId,
        },
        conflictDelta,
      );
      await maybeEmitFirstReceiptEvent(ctx, projectId, store, result);
      if (store === "amazon")
        await syncAmazonSubscription(
          ctx,
          (await ctx.db.get(existing._id))!,
          amazonNotice,
        );
      return existing._id;
    }
  }

  // Secondary dedup (Google only): Google reissues purchaseToken for the same
  // order on re-validation and state changes, so match its stable orderId.
  // Before Google assigns one (e.g. pending acknowledgement) this falls
  // through to insert. Other stores already use a stable remoteId.
  if (store === "google" && orderId) {
    const existingByOrder = await ctx.db
      .query("purchases")
      .withIndex("by_project_app_orderId", (q) =>
        q
          .eq("projectId", projectId)
          .eq("applicationId", applicationId)
          .eq("orderId", orderId),
      )
      .first();

    if (existingByOrder) {
      const result = await patchExistingPurchase(
        ctx,
        projectId,
        existingByOrder,
        {
          store,
          applicationId,
          // Newest purchaseToken, so a later replay hits primary dedup.
          remoteId,
          requestData,
          remoteResponse,
          state,
          isValid,
          updatedAt: now,
          environment,
          nextAmazonReconcileAt,
          productId,
          orderId,
          verificationDurationMs,
          requestIp,
          correlationId,
        },
      );
      await maybeEmitFirstReceiptEvent(ctx, projectId, store, result);
      return existingByOrder._id;
    }
  }

  await recordVerificationUsageForOrganization(ctx, organization);

  const inserted = await ctx.db.insert("purchases", {
    projectId,
    store,
    applicationId,
    remoteId,
    requestData,
    remoteResponse,
    state,
    isValid,
    ...(environment !== undefined ? { environment } : {}),
    ...(nextAmazonReconcileAt !== undefined ? { nextAmazonReconcileAt } : {}),
    ...(amazonRvsSequence !== undefined
      ? { lastAmazonRvsSequence: amazonRvsSequence }
      : {}),
    // Mark as already counted so the `backfillPurchaseStatsFromPurchases`
    // migration skips rows inserted after the counter table went live.
    statsCounted: true,
    // The hot path below updates every store bucket, so the later bounded
    // Horizon/Amazon backfill must never replay this row.
    storeStatsCounted: true,
    ...(productId !== null ? { productId } : {}),
    ...(orderId !== null ? { orderId } : {}),
    ...(verificationDurationMs !== undefined ? { verificationDurationMs } : {}),
    ...(requestIp !== undefined ? { requestIp } : {}),
    ...(correlationId !== undefined ? { correlationId } : {}),
  });

  const result = await applyPurchaseStatsDelta(
    ctx,
    projectId,
    deltaForInsert(store, isValid, orderId !== null),
  );
  await maybeEmitFirstReceiptEvent(ctx, projectId, store, result);

  if (store === "amazon")
    await syncAmazonSubscription(
      ctx,
      (await ctx.db.get(inserted))!,
      amazonNotice,
    );
  return inserted;
}

type PurchasePatchArgs = {
  store: PurchaseStore;
  applicationId: string;
  remoteId?: string;
  requestData: PurchaseRequestData;
  remoteResponse?: string;
  state: HarmonizedPurchaseState;
  isValid: boolean;
  updatedAt: number;
  environment?: ReceiptEnvironment;
  nextAmazonReconcileAt?: number;
  amazonRvsSequence?: number;
  productId: string | null;
  orderId: string | null;
  verificationDurationMs?: number;
  requestIp?: string;
  correlationId?: string;
};

/** Stats rollback for the row collapseConflictingOrderIdRow deletes. */
function deltaForConflictingRowRemoval(
  row: Doc<"purchases">,
): PurchaseStatsDelta {
  const isValid = row.isValid ?? false;
  // An empty orderId is not a real Google order, so it never counts toward
  // googleOrders; the extractor, backfill, and markReceiptInvalid agree.
  const hadOrderId = typeof row.orderId === "string" && row.orderId.length > 0;
  return deltaForCountedPurchaseRemoval(
    row.store,
    isValid,
    hadOrderId,
    row.statsCounted === true,
    row.storeStatsCounted === true,
  );
}

/**
 * Delete the row that already owns the orderId being patched onto the
 * primary-dedup hit, which always survives and inherits the deleted row's
 * owner. Returns the stats delta to merge into that patch, so `purchaseStats`
 * is written once.
 */
async function collapseConflictingOrderIdRow(
  ctx: MutationCtx,
  row: Doc<"purchases">,
  survivor: Doc<"purchases">,
): Promise<PurchaseStatsDelta> {
  // As in the subscription merge: a live owner wins, and the erasure marker
  // carries only when neither row has one.
  if (!survivor.appUserId && row.appUserId) {
    await ctx.db.patch(survivor._id, {
      appUserId: row.appUserId,
      accountErased: undefined,
    });
  } else if (!survivor.appUserId && row.accountErased) {
    await ctx.db.patch(survivor._id, { accountErased: true });
  }
  await ctx.db.delete(row._id);
  return deltaForConflictingRowRemoval(row);
}

async function patchExistingPurchase(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  existing: {
    _id: Id<"purchases">;
    store: PurchaseStore;
    isValid?: boolean;
    orderId?: string;
    statsCounted?: boolean;
    storeStatsCounted?: boolean;
  },
  args: PurchasePatchArgs,
  extraDelta: PurchaseStatsDelta = {},
): Promise<{ wasFirstValidTransition: boolean }> {
  const prevStore = existing.store;
  const prevIsValid = existing.isValid ?? false;
  // An empty orderId is not a real Google order; counting it as present would
  // mis-decrement googleOrders when a later patch brings a real one.
  const prevHasOrderId =
    typeof existing.orderId === "string" && existing.orderId.length > 0;
  // The patch below writes orderId only when one is present. A re-verify
  // without one (an error body from persistFailedGoogleReceipt, a pending-ack
  // probe on an acked token) keeps the stored orderId, so it stays counted.
  const nextHasOrderId = prevHasOrderId || args.orderId !== null;
  // A legacy row may be reverified while the store-bucket migration is in
  // flight. Claim its original contribution in this same transaction before
  // applying a possible store transition. Convex retries either this mutation
  // or the migration on conflict, and the sentinel prevents a second claim.
  const legacyStatsDelta = deltaForMissingPurchaseStats(
    prevStore,
    prevIsValid,
    prevHasOrderId,
    existing.statsCounted === true,
    existing.storeStatsCounted === true,
  );
  await ctx.db.patch(existing._id, {
    store: args.store,
    applicationId: args.applicationId,
    ...(args.remoteId !== undefined ? { remoteId: args.remoteId } : {}),
    requestData: args.requestData,
    remoteResponse: args.remoteResponse,
    state: args.state,
    isValid: args.isValid,
    statsCounted: true,
    storeStatsCounted: true,
    updatedAt: args.updatedAt,
    ...(args.environment !== undefined
      ? { environment: args.environment }
      : {}),
    ...(args.nextAmazonReconcileAt !== undefined
      ? { nextAmazonReconcileAt: args.nextAmazonReconcileAt }
      : {}),
    ...(args.amazonRvsSequence !== undefined
      ? { lastAmazonRvsSequence: args.amazonRvsSequence }
      : {}),
    ...(args.productId !== null ? { productId: args.productId } : {}),
    ...(args.orderId !== null ? { orderId: args.orderId } : {}),
    ...(args.verificationDurationMs !== undefined
      ? { verificationDurationMs: args.verificationDurationMs }
      : {}),
    ...(args.requestIp !== undefined ? { requestIp: args.requestIp } : {}),
    ...(args.correlationId !== undefined
      ? { correlationId: args.correlationId }
      : {}),
  });
  // Merge every delta so purchaseStats is read and written once per save.
  const patchDelta = deltaForUpdate(
    prevStore,
    prevIsValid,
    args.store,
    args.isValid,
    prevHasOrderId,
    nextHasOrderId,
  );
  return await applyPurchaseStatsDelta(
    ctx,
    projectId,
    mergePurchaseStatsDeltas(legacyStatsDelta, patchDelta, extraDelta),
  );
}

/**
 * Schedule the `first_receipt_verified` Mixpanel event when a save takes the
 * project's `valid` count from 0 to above 0. Updates count too: a retry after
 * a transient Google / Apple failure can turn a row valid. Scheduled, so a
 * Mixpanel outage never slows or fails the verify call.
 */
async function maybeEmitFirstReceiptEvent(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  store: PurchaseStore,
  result: { wasFirstValidTransition: boolean },
): Promise<void> {
  if (!result.wasFirstValidTransition) return;
  const project = await ctx.db.get(projectId);
  if (!project) return;
  await ctx.scheduler.runAfter(
    0,
    internal.analytics.action.trackFirstReceiptVerified,
    {
      projectId,
      organizationId: project.organizationId,
      store,
    },
  );
}

function assertStoreMatchesRequest(
  expected: PurchaseStore,
  requestData: PurchaseRequestData,
) {
  if (requestData.store !== expected) {
    throw new ConvexError(
      `Purchase request store mismatch: expected ${expected}, received ${requestData.store}`,
    );
  }
}

export async function reserveAmazonRvsSequenceHandler(
  ctx: MutationCtx,
  args: { projectId: Id<"projects"> },
): Promise<number> {
  const project = await assertProjectWritable(ctx, args.projectId);
  const sequence = (project.amazonRvsSequence ?? 0) + 1;
  if (!Number.isSafeInteger(sequence))
    throw new Error("Amazon verification sequence exhausted");
  await ctx.db.patch(project._id, { amazonRvsSequence: sequence });
  return sequence;
}

export const reserveAmazonRvsSequence = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.number(),
  handler: reserveAmazonRvsSequenceHandler,
});

const amazonVerdictArgs = v.object({
  projectId: v.id("projects"),
  applicationId: v.string(),
  remoteId: v.string(),
  requestData: purchaseRequestDataValidator,
  remoteResponse: v.string(),
  state: harmonizedPurchaseStateValidator,
  environment: receiptEnvironmentValidator,
  amazonRvsSequence: v.number(),
  amazonNotice: v.optional(amazonLifecycleNoticeValidator),
  requestIp: v.optional(v.string()),
  verificationDurationMs: v.optional(v.number()),
  correlationId: v.optional(v.string()),
});

export async function saveAmazonVerdictHandler(
  ctx: MutationCtx,
  args: Infer<typeof amazonVerdictArgs>,
) {
  assertStoreMatchesRequest("amazon", args.requestData);
  const id = await savePurchaseInternal({
    ctx,
    ...args,
    store: "amazon",
    isValid: isValidState(args.state),
  });
  const row = await ctx.db.get(id);
  if (!row) throw new Error("Amazon purchase was not persisted");
  return {
    isValid: row.isValid === true,
    state: row.state,
    environment: row.environment ?? "Production",
    ...(row.productId ? { productId: row.productId } : {}),
  };
}

export const saveAmazonVerdict = internalMutation({
  args: amazonVerdictArgs.fields,
  returns: receiptResponseValidator,
  handler: saveAmazonVerdictHandler,
});

const amazonRtnVerdictArgs = amazonVerdictArgs.omit("amazonNotice").extend({
  amazonNotice: amazonLifecycleNoticeValidator,
  relatedReceipt: v.optional(amazonVerdictArgs.omit("amazonNotice")),
});

export async function applyAmazonRtnVerdictHandler(
  ctx: MutationCtx,
  args: Infer<typeof amazonRtnVerdictArgs>,
): Promise<{ type: string; deduped: boolean }> {
  await assertProjectWritable(ctx, args.projectId);
  const duplicate = await findWebhookEventByDedupKey(ctx.db, {
    projectId: args.projectId,
    source: "AmazonRealTimeNotifications",
    sourceNotificationId: args.amazonNotice.messageId,
  });
  if (duplicate) return { type: duplicate.type, deduped: true };
  const { relatedReceipt, ...verdict } = args;
  let previousOwner: string | undefined;
  let previousPurchaseId: Id<"purchases"> | undefined;
  if (relatedReceipt) {
    if (
      relatedReceipt.projectId !== args.projectId ||
      relatedReceipt.applicationId !== args.applicationId ||
      relatedReceipt.requestData.store !== "amazon" ||
      args.requestData.store !== "amazon" ||
      relatedReceipt.requestData.userId !== args.requestData.userId ||
      relatedReceipt.remoteId === args.remoteId
    )
      throw new Error("Amazon related receipt identity mismatch");
    await saveAmazonVerdictHandler(ctx, relatedReceipt);
    const previous = await ctx.db
      .query("purchases")
      .withIndex("by_project_and_remote", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("remoteId", relatedReceipt.remoteId),
      )
      .filter((q) => q.eq(q.field("store"), "amazon"))
      .first();
    if (
      previous &&
      !previous.isValid &&
      !previous.accountErased &&
      previous.lastAmazonRvsSequence !== undefined &&
      previous.lastAmazonRvsSequence >= relatedReceipt.amazonRvsSequence
    ) {
      previousOwner = previous.appUserId;
      previousPurchaseId = previous._id;
    }
  }
  await saveAmazonVerdictHandler(ctx, verdict);
  const purchase = await ctx.db
    .query("purchases")
    .withIndex("by_project_and_remote", (q) =>
      q.eq("projectId", args.projectId).eq("remoteId", args.remoteId),
    )
    .filter((q) => q.eq(q.field("store"), "amazon"))
    .first();
  if (!purchase) throw new Error("Amazon RTN purchase was not persisted");
  if (
    previousOwner &&
    purchase.isValid &&
    !purchase.accountErased &&
    !purchase.appUserId &&
    purchase.lastAmazonRvsSequence === args.amazonRvsSequence
  ) {
    const bound = await bindSubscriptionToUserHandler(ctx, {
      projectId: args.projectId,
      purchaseToken: amazonSubscriptionToken(args.remoteId),
      userId: previousOwner,
    });
    if (bound && previousPurchaseId) {
      await ctx.db.patch(previousPurchaseId, { appUserId: undefined });
      await ctx.db.patch(purchase._id, { appUserId: previousOwner });
    }
  }
  let event = await findWebhookEventByDedupKey(ctx.db, {
    projectId: args.projectId,
    source: "AmazonRealTimeNotifications",
    sourceNotificationId: args.amazonNotice.messageId,
  });
  // Non-subscription and superseded verdicts still need a durable retry receipt.
  if (!event) {
    const token = amazonSubscriptionToken(args.remoteId);
    const subscription = await findSubscriptionByToken(
      ctx,
      args.projectId,
      token,
    );
    const recorded = await recordWebhookEventHandler(ctx, {
      projectId: args.projectId,
      source: "amazon",
      sourceNotificationId: args.amazonNotice.messageId,
      event: {
        type: "ReceiptRechecked",
        sourceFull: "AmazonRealTimeNotifications",
        platform: "Android",
        store: "amazon",
        environment: purchase.environment ?? "Production",
        productId: purchase.productId,
        applicationId: args.applicationId,
        productKind: subscription ? "subscription" : "one_time",
        ...(subscription ? { purchaseToken: token } : {}),
        occurredAt: args.amazonNotice.occurredAt,
        rawSignedPayload: args.amazonNotice.rawSignedPayload,
      },
    });
    event = await ctx.db.get(recorded.eventId);
    if (event) await ctx.db.patch(event._id, { appliedAt: Date.now() });
  }
  if (!event) throw new Error("Amazon RTN event was not persisted");
  return { type: event.type, deduped: false };
}

export const applyAmazonRtnVerdict = internalMutation({
  args: amazonRtnVerdictArgs.fields,
  returns: v.object({ type: v.string(), deduped: v.boolean() }),
  handler: applyAmazonRtnVerdictHandler,
});

// Internal mutation to save purchases from API actions
export const saveReceiptInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    store: purchaseStoreValidator,
    applicationId: v.string(),
    remoteId: v.optional(v.string()),
    requestData: purchaseRequestDataValidator,
    remoteResponse: v.optional(v.string()),
    state: harmonizedPurchaseStateValidator,
    isValid: v.boolean(),
    environment: v.optional(receiptEnvironmentValidator),
    requestIp: v.optional(v.string()),
    verificationDurationMs: v.optional(v.number()),
    persistIfChanged: v.optional(v.boolean()),
    correlationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertStoreMatchesRequest(args.store, args.requestData);

    return await savePurchaseInternal({
      ctx,
      projectId: args.projectId,
      store: args.store,
      applicationId: args.applicationId,
      remoteId: args.remoteId,
      requestData: args.requestData,
      remoteResponse: args.remoteResponse,
      state: args.state,
      isValid: args.isValid,
      environment: args.environment,
      requestIp: args.requestIp,
      verificationDurationMs: args.verificationDurationMs,
      persistIfChanged: args.persistIfChanged,
      correlationId: args.correlationId,
    });
  },
});

/**
 * Atomically claim a bounded page of due Amazon purchase snapshots.
 *
 * `nextAmazonReconcileAt` doubles as the lease deadline. Convex mutations are
 * serializable, so advancing it before returning prevents overlapping cron
 * actions from receiving the same row. If the worker crashes, the row becomes
 * due again when the lease expires.
 */
export const claimAmazonPurchasesForReconciliation = internalMutation({
  args: {
    limit: v.optional(v.number()),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const requestedLimit = Math.trunc(
      args.limit ?? AMAZON_RECONCILE_BATCH_LIMIT,
    );
    const limit = Math.min(
      Math.max(requestedLimit, 1),
      AMAZON_RECONCILE_BATCH_LIMIT,
    );
    const leaseUntil = now + AMAZON_RECONCILE_LEASE_MS;
    const due = await ctx.db
      .query("purchases")
      .withIndex("by_store_isValid_nextAmazonReconcileAt", (q) =>
        q
          .eq("store", "amazon")
          .eq("isValid", true)
          .lte("nextAmazonReconcileAt", now),
      )
      .order("asc")
      .take(limit);

    const claimed = [];
    for (const purchase of due) {
      const requestData = purchase.requestData;
      const project = await ctx.db.get(purchase.projectId);
      if (
        requestData.store !== "amazon" ||
        !purchase.remoteId ||
        !project ||
        project.pendingDeletion
      ) {
        // Keep a malformed legacy row from monopolizing the front of the due
        // index while project deletion or an operator repair catches up.
        await ctx.db.patch(purchase._id, {
          nextAmazonReconcileAt: now + AMAZON_RECONCILE_RETRY_MS,
        });
        continue;
      }

      await ctx.db.patch(purchase._id, { nextAmazonReconcileAt: leaseUntil });
      claimed.push({
        purchaseId: purchase._id,
        projectId: purchase.projectId,
        requestData,
        leaseUntil,
        amazonSandboxEnabled: project.amazonSandboxEnabled === true,
        ...(typeof project.amazonSharedSecret === "string"
          ? { amazonSharedSecret: project.amazonSharedSecret }
          : {}),
      });
    }

    return claimed;
  },
});

/**
 * Move a failed claim to its retry slot without racing a newer foreground
 * verification. A public verify or another authoritative write changes the
 * schedule, making this compare-and-set a no-op.
 */
export const rescheduleAmazonPurchaseReconciliation = internalMutation({
  args: {
    purchaseId: v.id("purchases"),
    claimedLeaseUntil: v.number(),
    retryAt: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const purchase = await ctx.db.get(args.purchaseId);
    if (
      !purchase ||
      purchase.store !== "amazon" ||
      purchase.isValid !== true ||
      purchase.nextAmazonReconcileAt !== args.claimedLeaseUntil
    ) {
      return false;
    }

    await ctx.db.patch(purchase._id, {
      nextAmazonReconcileAt: args.retryAt,
    });
    return true;
  },
});

/**
 * Apply an RVS verdict only while this worker still owns the claimed row.
 * The lease comparison and purchase upsert run in one serializable mutation,
 * so a newer foreground verification wins instead of being overwritten by a
 * slower background response. A deleted row also stays deleted.
 */
export const applyAmazonReconciliationVerdict = internalMutation({
  args: {
    purchaseId: v.id("purchases"),
    claimedLeaseUntil: v.number(),
    remoteResponse: v.string(),
    amazonRvsSequence: v.optional(v.number()),
    environment: v.optional(receiptEnvironmentValidator),
    state: harmonizedPurchaseStateValidator,
    verificationDurationMs: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const purchase = await ctx.db.get(args.purchaseId);
    if (
      !purchase ||
      purchase.store !== "amazon" ||
      purchase.isValid !== true ||
      purchase.nextAmazonReconcileAt !== args.claimedLeaseUntil ||
      purchase.requestData.store !== "amazon" ||
      !purchase.remoteId ||
      (args.amazonRvsSequence !== undefined &&
        (purchase.lastAmazonRvsSequence ?? 0) >= args.amazonRvsSequence)
    ) {
      return false;
    }

    await savePurchaseInternal({
      ctx,
      projectId: purchase.projectId,
      store: "amazon",
      applicationId: purchase.applicationId,
      remoteId: purchase.remoteId,
      requestData: purchase.requestData,
      remoteResponse: args.remoteResponse,
      state: args.state,
      isValid: isValidState(args.state),
      environment:
        args.environment ??
        purchase.environment ??
        (purchase.requestData.sandbox === true ? "Sandbox" : "Production"),
      amazonRvsSequence: args.amazonRvsSequence,
      verificationDurationMs: args.verificationDurationMs,
    });
    return true;
  },
});

export const boundPurchasesForUser = internalQuery({
  args: { projectId: v.id("projects"), userId: v.string() },
  returns: v.array(schema.doc("purchases")),
  handler: async (ctx, args) => {
    if (!isValidSubscriptionUserId(args.userId))
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Invalid user identity",
      });
    const project = await ctx.db.get(args.projectId);
    if (!project || project.pendingDeletion)
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Project unavailable",
      });
    if (await isUserErasureRequested(ctx, project, args.userId)) return [];
    const rows = await recheckedBoundPurchases(
      ctx,
      args.projectId,
      args.userId,
      MAX_BOUND_PURCHASES_PER_USER + 1,
    );
    // Binding enforces the cap, so passing it here means the stored rows drifted.
    // That is ours, not the caller's: never answer INVALID_REQUEST for it.
    if (rows.length > MAX_BOUND_PURCHASES_PER_USER)
      throw new ConvexError({
        code: "INTERNAL_ERROR",
        message: "Bound purchase read limit exceeded",
      });
    return rows.filter((row) => !row.accountErased);
  },
});
