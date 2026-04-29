import { internalMutation, MutationCtx } from "../_generated/server";
import { v, ConvexError, Infer } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  purchaseRequestDataValidator,
  purchaseStoreValidator,
} from "../schema";
import {
  harmonizedPurchaseStateValidator,
  HarmonizedPurchaseState,
} from "./purchaseState";
import { recordVerificationUsageForOrganization } from "../organizations/internal";
import {
  applyPurchaseStatsDelta,
  deltaForInsert,
  deltaForUpdate,
  type PurchaseStatsDelta,
} from "./stats";
import {
  extractOrderIdFromRemoteResponse,
  extractProductIdFromRemoteResponse,
} from "./shared";

type PurchaseStore = Infer<typeof purchaseStoreValidator>;
type PurchaseRequestData = Infer<typeof purchaseRequestDataValidator>;

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
  requestIp?: string;
  verificationDurationMs?: number;
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
  requestIp,
  verificationDurationMs,
}: SavePurchaseArgs) {
  const now = Date.now();
  const productId = extractProductIdFromRemoteResponse(store, remoteResponse);
  const orderId = extractOrderIdFromRemoteResponse(store, remoteResponse);

  // Primary dedup: exact (projectId, remoteId) match. Most Apple and
  // Horizon flows — plus Google flows where the client replays the
  // same `purchaseToken` — hit this branch and stay on one row.
  if (remoteId) {
    const existing = await ctx.db
      .query("purchases")
      .withIndex("by_project_and_remote", (q) =>
        q.eq("projectId", projectId).eq("remoteId", remoteId),
      )
      .first();

    if (existing) {
      // Defensive orderId-conflict resolution:
      //
      // If this patch transitions the row from "no orderId" (or a
      // different orderId) to `orderId`, we must make sure no OTHER
      // row in the same (projectId, applicationId) already owns that
      // orderId — otherwise the invariant "at most one row per
      // (projectId, applicationId, orderId)" would break and downstream
      // `googleOrders` maintenance via `deltaForUpdate` would drift.
      //
      // This can happen in a narrow race: token `T1` first verified
      // pre-ack (no orderId); Google later reissues to `T2` for the
      // same logical order; a third call arrives with `T2` carrying
      // `orderId=O1` and inserts a second row; then somehow a client
      // replay with `T1` comes through and Google still resolves it
      // with `orderId=O1`. Primary dedup hits the original pre-ack
      // row, and without this guard we'd end up with two rows both
      // claiming `O1`.
      let conflictDelta: PurchaseStatsDelta = {};
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
          conflictDelta = await collapseConflictingOrderIdRow(ctx, conflict);
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
          productId,
          orderId,
          verificationDurationMs,
          requestIp,
        },
        conflictDelta,
      );
      // A retry after a transient Google / Apple failure can flip
      // `isValid` from false to true on an existing row — same
      // activation signal as a fresh insert, so fire the Mixpanel
      // event here too.
      await maybeEmitFirstReceiptEvent(ctx, projectId, store, result);
      return existing._id;
    }
  }

  // Secondary dedup (Google only): same (projectId, applicationId,
  // orderId) where `orderId` is Google's stable per-transaction id.
  // This is the path that collapses the 3x inflation Adam reported —
  // Google reissues `purchaseToken` for the same logical order on
  // re-validation / state transitions, so primary dedup misses even
  // though it's the same purchase. When the response hasn't reached a
  // state where Google assigns an `orderId` (e.g. pending
  // acknowledgement), this block is skipped and we fall through to
  // insert, matching pre-fix behavior for those rows. Non-Google
  // stores already use stable identifiers as `remoteId`, so the
  // secondary key is gated on `store === "google"` to avoid
  // accidentally collapsing Apple or Horizon receipts.
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
          // Advance `remoteId` to the newest `purchaseToken` so any
          // future replay by the client hits the primary dedup branch
          // above instead of landing here again.
          remoteId,
          requestData,
          remoteResponse,
          state,
          isValid,
          updatedAt: now,
          productId,
          orderId,
          verificationDurationMs,
          requestIp,
        },
      );
      await maybeEmitFirstReceiptEvent(ctx, projectId, store, result);
      return existingByOrder._id;
    }
  }

  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new ConvexError("Project not found");
  }

  const organization = await ctx.db.get(project.organizationId);
  if (!organization) {
    throw new ConvexError("Organization not found for project");
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
    // Mark as already counted so the `backfillPurchaseStatsFromPurchases`
    // migration skips rows inserted after the counter table went live.
    statsCounted: true,
    ...(productId !== null ? { productId } : {}),
    ...(orderId !== null ? { orderId } : {}),
    ...(verificationDurationMs !== undefined ? { verificationDurationMs } : {}),
    ...(requestIp !== undefined ? { requestIp } : {}),
  });

  // `applyPurchaseStatsDelta` returns `wasFirstValidTransition` so we
  // can detect the "project just booked its first valid receipt"
  // activation moment without doing a second read of the stats row.
  // `maybeEmitFirstReceiptEvent` schedules the Mixpanel emit with
  // `runAfter(0, ...)` so Mixpanel latency / outage never extends or
  // fails the verify call.
  const result = await applyPurchaseStatsDelta(
    ctx,
    projectId,
    deltaForInsert(store, isValid, orderId !== null),
  );
  await maybeEmitFirstReceiptEvent(ctx, projectId, store, result);

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
  productId: string | null;
  orderId: string | null;
  verificationDurationMs?: number;
  requestIp?: string;
};

/**
 * Drop a purchase row whose `orderId` conflicts with another row that
 * we're about to patch to own the same orderId, and roll the stats
 * counters back to match.
 *
 * Called only from the primary-dedup branch, so `row` is guaranteed
 * not to be the one we're keeping. We don't fight about which row
 * survives — the caller has already chosen the primary-dedup hit as
 * the survivor. This helper only cleans up the stranded duplicate.
 */
function deltaForConflictingRowRemoval(
  row: Doc<"purchases">,
): PurchaseStatsDelta {
  const isValid = row.isValid ?? false;
  // Align with `extractOrderIdFromRemoteResponse`, the backfill, and
  // `markReceiptInvalid`: an empty-string `orderId` never represented
  // a real Google order and must not count toward `googleOrders`.
  const hadOrderId = typeof row.orderId === "string" && row.orderId.length > 0;
  return {
    total: -1,
    apple: row.store === "apple" ? -1 : 0,
    google: row.store === "google" ? -1 : 0,
    googleOrders: row.store === "google" && hadOrderId ? -1 : 0,
    valid: isValid ? -1 : 0,
    invalid: isValid ? 0 : -1,
  };
}

/**
 * Drop a purchase row whose `orderId` conflicts with another row that
 * we're about to patch to own the same orderId, and return the stats
 * delta to fold into the subsequent patch call.
 *
 * Called only from the primary-dedup branch, so `row` is guaranteed
 * not to be the one we're keeping. We don't fight about which row
 * survives — the caller has already chosen the primary-dedup hit as
 * the survivor. This helper only cleans up the stranded duplicate
 * and hands the caller a delta it can merge with the patch's own
 * delta, so we touch the `purchaseStats` row once instead of twice.
 */
async function collapseConflictingOrderIdRow(
  ctx: MutationCtx,
  row: Doc<"purchases">,
): Promise<PurchaseStatsDelta> {
  await ctx.db.delete(row._id);
  return deltaForConflictingRowRemoval(row);
}

function mergeStatsDeltas(
  a: PurchaseStatsDelta,
  b: PurchaseStatsDelta,
): PurchaseStatsDelta {
  const keys: (keyof PurchaseStatsDelta)[] = [
    "total",
    "apple",
    "google",
    "googleOrders",
    "valid",
    "invalid",
  ];
  const out: PurchaseStatsDelta = {};
  for (const k of keys) {
    const av = a[k] ?? 0;
    const bv = b[k] ?? 0;
    if (av + bv !== 0) {
      out[k] = av + bv;
    }
  }
  return out;
}

async function patchExistingPurchase(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  existing: {
    _id: Id<"purchases">;
    store: PurchaseStore;
    isValid?: boolean;
    orderId?: string;
  },
  args: PurchasePatchArgs,
  extraDelta: PurchaseStatsDelta = {},
): Promise<{ wasFirstValidTransition: boolean }> {
  const prevStore = existing.store;
  const prevIsValid = existing.isValid ?? false;
  // Align with the extractor and the backfill: an empty-string
  // `orderId` isn't a real Google order identifier. Treating it as
  // "present" here would mis-decrement `googleOrders` on a later
  // patch that brings in a real orderId.
  const prevHasOrderId =
    typeof existing.orderId === "string" && existing.orderId.length > 0;
  // The patch below only WRITES `orderId` when a new value is present
  // (`args.orderId !== null`). A subsequent re-verify that comes back
  // without an orderId — e.g. an error body persisted by
  // `persistFailedGoogleReceipt`, or a pending-acknowledgement probe
  // on a previously acked token — leaves the stored `orderId` column
  // untouched. `nextHasOrderId` must mirror that persisted state so
  // `deltaForUpdate` doesn't decrement `googleOrders` for a row whose
  // orderId hasn't actually gone away.
  const nextHasOrderId = prevHasOrderId || args.orderId !== null;
  await ctx.db.patch(existing._id, {
    store: args.store,
    applicationId: args.applicationId,
    ...(args.remoteId !== undefined ? { remoteId: args.remoteId } : {}),
    requestData: args.requestData,
    remoteResponse: args.remoteResponse,
    state: args.state,
    isValid: args.isValid,
    updatedAt: args.updatedAt,
    ...(args.productId !== null ? { productId: args.productId } : {}),
    ...(args.orderId !== null ? { orderId: args.orderId } : {}),
    ...(args.verificationDurationMs !== undefined
      ? { verificationDurationMs: args.verificationDurationMs }
      : {}),
    ...(args.requestIp !== undefined ? { requestIp: args.requestIp } : {}),
  });
  // Fold the patch's own delta together with any extra delta the
  // caller passed (currently used by the primary-dedup orderId
  // conflict resolver) so the `purchaseStats` row is read + written
  // once per save, not once per sub-operation.
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
    mergeStatsDeltas(patchDelta, extraDelta),
  );
}

/**
 * Schedule the `first_receipt_verified` Mixpanel emit when a save
 * flipped the project's `valid` counter from 0 to >0. Shared between
 * the insert and update paths so an invalid→valid re-verify (retry
 * after a transient Google / Apple failure) gets the same activation
 * signal as a fresh successful verify. Uses `ctx.scheduler.runAfter`
 * so Mixpanel latency / outages never extend or fail the customer's
 * verify call.
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
    requestIp: v.optional(v.string()),
    verificationDurationMs: v.optional(v.number()),
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
      requestIp: args.requestIp,
      verificationDurationMs: args.verificationDurationMs,
    });
  },
});
