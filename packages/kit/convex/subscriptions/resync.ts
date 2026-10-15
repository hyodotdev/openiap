// Persistence half of "Re-sync from store". The HTTP half in `action.ts`
// reads Apple or Google and hands the observed state here.
//
// A re-sync sees current state, not the lifecycle events in between, so it
// emits only the entitlement delta and never invents a lifecycle event. It
// stamps `resyncedAt`, not the store-event ordering: a notification it
// overtook cannot roll the state back and is reported only when it names that
// state, and a verify that cannot prove it is newer asks the store again.
// It never binds, unbinds or moves an owner: `persistSubscriptionSnapshot`
// keeps the row's `userId`.

import { ConvexError, v, type Infer } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "../_generated/server";
import { emitCommerceEvent, storeOf } from "../commerce/internal";
import { assertProjectWritable } from "../projects/writable";
import { savePurchaseInternal } from "../purchases/internal";
import { harmonizedPurchaseStateValidator } from "../purchases/purchaseState";
import { purchaseRequestDataValidator } from "../schema";
import {
  cancellationReasonValidator,
  receiptEnvironmentValidator,
  subscriptionStateValidator,
} from "../utils/validation";
import { recordWebhookEventHandler } from "../webhooks/internal";
import { appleExpirationIntentReason } from "../webhooks/shared";
import {
  findSubscriptionByToken,
  mergeVerifiedSubscriptionSnapshot,
  persistSubscriptionSnapshot,
  reportedEntitlement,
  type VerifiedSubscriptionSnapshot,
} from "./internal";
import { entitlementActive, type CurrentSubscription } from "./stateMachine";

export const storeSnapshotValidator = v.object({
  productId: v.string(),
  state: subscriptionStateValidator,
  expiresAt: v.optional(v.number()),
  renewsAt: v.optional(v.number()),
  willRenew: v.optional(v.boolean()),
  cancellationReason: v.optional(cancellationReasonValidator),
  clearCancellationReason: v.optional(v.boolean()),
  currency: v.optional(v.string()),
  priceAmountMicros: v.optional(v.number()),
});

const storeContextValidator = v.object({
  environment: receiptEnvironmentValidator,
  applicationId: v.optional(v.string()),
  transactionId: v.optional(v.string()),
  originalTransactionId: v.optional(v.string()),
});

export const resyncOutcomeValidator = v.object({
  status: v.union(
    v.literal("updated"),
    v.literal("unchanged"),
    v.literal("superseded"),
  ),
  subscriptionId: v.optional(v.id("subscriptions")),
  state: v.optional(subscriptionStateValidator),
  productId: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  willRenew: v.optional(v.boolean()),
  emittedEvents: v.number(),
});
export type ResyncOutcome = Infer<typeof resyncOutcomeValidator>;

export const purchaseResyncOutcomeValidator = v.object({
  id: v.id("purchases"),
  state: v.string(),
  isValid: v.boolean(),
  changed: v.boolean(),
});

/** App Store Server API subscription status: 1 active ... 5 revoked. */
export function appleStatusSnapshot(input: {
  status: number | undefined;
  transaction: {
    productId?: string;
    expiresDate?: number;
    revocationReason?: number;
    currency?: string;
    price?: number;
  };
  renewal?: {
    autoRenewStatus?: number;
    renewalDate?: number;
    gracePeriodExpiresDate?: number;
    expirationIntent?: number;
  } | null;
}): VerifiedSubscriptionSnapshot | null {
  const { transaction, renewal } = input;
  if (!transaction.productId) return null;
  const willRenew =
    renewal?.autoRenewStatus === 1
      ? true
      : renewal?.autoRenewStatus === 0
        ? false
        : undefined;
  const base = {
    productId: transaction.productId,
    expiresAt: transaction.expiresDate,
    willRenew,
    renewsAt:
      willRenew === true
        ? (renewal?.renewalDate ?? transaction.expiresDate)
        : undefined,
    currency: transaction.currency,
    // Apple prices are milliunits.
    priceAmountMicros:
      typeof transaction.price === "number"
        ? transaction.price * 1000
        : undefined,
  };
  const expiredReason = appleExpirationIntentReason(renewal?.expirationIntent);
  switch (input.status) {
    case 1:
      return {
        ...base,
        state: "Active",
        ...(willRenew === true ? { clearCancellationReason: true } : {}),
      };
    case 2:
      return {
        ...base,
        state: "Expired",
        willRenew: false,
        ...(expiredReason ? { cancellationReason: expiredReason } : {}),
      };
    case 3:
      return {
        ...base,
        state: "InBillingRetry",
        ...(expiredReason ? { cancellationReason: expiredReason } : {}),
      };
    case 4:
      // Without Apple's grace deadline, the elapsed period end would revoke
      // access mid-grace, so the expiry stays unknown.
      return {
        ...base,
        state: "InGracePeriod",
        expiresAt: renewal?.gracePeriodExpiresDate,
        clearCancellationReason: true,
      };
    case 5:
      // Only revocationReason 1 is a refund, stored as the REFUND webhook
      // stores it; 0 also covers Family Sharing.
      return transaction.revocationReason === 1
        ? {
            ...base,
            state: "Refunded",
            willRenew: false,
            cancellationReason: "Refunded",
          }
        : {
            ...base,
            state: "Revoked",
            willRenew: false,
            clearCancellationReason: true,
          };
    default:
      return null;
  }
}

const RESYNC_COMPARED_FIELDS = [
  "state",
  "productId",
  "expiresAt",
  "renewsAt",
  "willRenew",
  "cancellationReason",
  "currency",
  "priceAmountMicros",
] as const;

/** What the re-sync resolves a purchase or subscription id to. */
export const getResyncTarget = internalQuery({
  args: {
    projectId: v.id("projects"),
    purchaseId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      kind: v.literal("purchase"),
      purchaseId: v.id("purchases"),
      store: v.union(v.literal("apple"), v.literal("google")),
      requestData: purchaseRequestDataValidator,
      remoteResponse: v.optional(v.string()),
      productId: v.optional(v.string()),
    }),
    v.object({
      kind: v.literal("subscription"),
      subscriptionId: v.id("subscriptions"),
      store: v.union(v.literal("apple"), v.literal("google")),
      purchaseToken: v.string(),
      productId: v.string(),
      environment: v.optional(receiptEnvironmentValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const notFound = new ConvexError({
      code: "NOT_FOUND",
      message: "Purchase or subscription not found in this project",
    });
    if (args.purchaseId !== undefined) {
      const purchaseId = ctx.db.normalizeId("purchases", args.purchaseId);
      const purchase = purchaseId ? await ctx.db.get(purchaseId) : null;
      if (!purchase || purchase.projectId !== args.projectId) throw notFound;
      if (purchase.store !== "apple" && purchase.store !== "google") {
        throw unsupportedStore(purchase.store);
      }
      if (!purchase.remoteId) {
        throw new ConvexError({
          code: "NOT_RESYNCABLE",
          message: "This purchase has no store identifier to re-sync.",
        });
      }
      return {
        kind: "purchase" as const,
        purchaseId: purchase._id,
        store: purchase.store,
        requestData: purchase.requestData,
        ...(purchase.remoteResponse
          ? { remoteResponse: purchase.remoteResponse }
          : {}),
        ...(purchase.productId ? { productId: purchase.productId } : {}),
      };
    }
    const subscriptionId =
      args.subscriptionId === undefined
        ? null
        : ctx.db.normalizeId("subscriptions", args.subscriptionId);
    const subscription = subscriptionId
      ? await ctx.db.get(subscriptionId)
      : null;
    if (!subscription || subscription.projectId !== args.projectId) {
      throw notFound;
    }
    const store = storeOf(subscription);
    if (store !== "apple" && store !== "google") throw unsupportedStore(store);
    // Rows from before the column fall back to their last store event.
    const environment =
      subscription.environment ?? subscription.lastEventSource?.environment;
    return {
      kind: "subscription" as const,
      subscriptionId: subscription._id,
      store,
      purchaseToken: subscription.purchaseToken,
      productId: subscription.productId,
      ...(environment
        ? {
            environment:
              environment === "Production"
                ? ("Production" as const)
                : ("Sandbox" as const),
          }
        : {}),
    };
  },
});

function unsupportedStore(store: string): ConvexError<{
  code: string;
  message: string;
}> {
  return new ConvexError({
    code: "UNSUPPORTED_STORE",
    message:
      store === "amazon"
        ? "Amazon purchases are rechecked automatically through RVS."
        : `Re-sync supports Apple and Google; ${store} has no lifecycle API.`,
  });
}

const applyPurchaseResyncArgs = v.object({
  projectId: v.id("projects"),
  purchaseId: v.id("purchases"),
  // When the store was asked; a verdict saved after it is newer and kept.
  observedAt: v.number(),
  applicationId: v.string(),
  remoteResponse: v.string(),
  state: harmonizedPurchaseStateValidator,
  isValid: v.boolean(),
});

/** Saves a purchase row's re-read through the verification save path. */
export const applyPurchaseResync = internalMutation({
  args: applyPurchaseResyncArgs.fields,
  returns: purchaseResyncOutcomeValidator,
  handler: applyPurchaseResyncHandler,
});

export async function applyPurchaseResyncHandler(
  ctx: MutationCtx,
  args: Infer<typeof applyPurchaseResyncArgs>,
): Promise<Infer<typeof purchaseResyncOutcomeValidator>> {
  const purchase = await ctx.db.get(args.purchaseId);
  if (!purchase?.remoteId || purchase.projectId !== args.projectId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Purchase or subscription not found in this project",
    });
  }
  const stored = {
    id: purchase._id,
    state: purchase.state,
    isValid: purchase.isValid ?? false,
  };
  // A verify saved while the store was being read is at least as new.
  if ((purchase.updatedAt ?? 0) > args.observedAt) {
    return { ...stored, changed: false };
  }
  await savePurchaseInternal({
    ctx,
    projectId: args.projectId,
    store: purchase.store,
    applicationId: args.applicationId,
    remoteId: purchase.remoteId,
    requestData: purchase.requestData,
    remoteResponse: args.remoteResponse,
    state: args.state,
    isValid: args.isValid,
    persistIfChanged: true,
  });
  return {
    ...stored,
    state: args.state,
    isValid: args.isValid,
    changed: stored.state !== args.state || stored.isValid !== args.isValid,
  };
}

const applyStoreResyncArgs = v.object({
  projectId: v.id("projects"),
  platform: v.union(v.literal("IOS"), v.literal("Android")),
  store: v.union(v.literal("apple"), v.literal("google")),
  purchaseToken: v.string(),
  // When the store was asked; a store event stamped later still applies.
  observedAt: v.number(),
  snapshot: storeSnapshotValidator,
  context: storeContextValidator,
});

export const applyStoreResync = internalMutation({
  args: applyStoreResyncArgs.fields,
  returns: resyncOutcomeValidator,
  handler: applyStoreResyncHandler,
});

export async function applyStoreResyncHandler(
  ctx: MutationCtx,
  args: Infer<typeof applyStoreResyncArgs>,
): Promise<ResyncOutcome> {
  await assertProjectWritable(ctx, args.projectId);
  // A replaced Google token is history; its successor owns current state.
  const alias = await ctx.db
    .query("subscriptionTokenAliases")
    .withIndex("by_project_and_token", (q) =>
      q.eq("projectId", args.projectId).eq("purchaseToken", args.purchaseToken),
    )
    .first();
  if (alias) return { status: "superseded", emittedEvents: 0 };

  const existing = await findSubscriptionByToken(
    ctx,
    args.projectId,
    args.purchaseToken,
  );
  const merged = mergeVerifiedSubscriptionSnapshot(existing, args.snapshot);
  const next: NonNullable<CurrentSubscription> = {
    state: merged.state,
    productId: merged.productId,
    expiresAt:
      merged.state === "InGracePeriod"
        ? args.snapshot.expiresAt
        : merged.expiresAt,
    renewsAt: merged.renewsAt,
    willRenew: merged.willRenew,
    cancellationReason: merged.cancellationReason,
    currency: merged.currency,
    priceAmountMicros: merged.priceAmountMicros,
  };
  const outcome = (
    status: ResyncOutcome["status"],
    row: Pick<
      Doc<"subscriptions">,
      "_id" | "state" | "productId" | "expiresAt" | "willRenew"
    > | null,
    emittedEvents: number,
  ): ResyncOutcome => ({
    status,
    ...(row
      ? {
          subscriptionId: row._id,
          state: row.state,
          productId: row.productId,
          ...(row.expiresAt !== undefined ? { expiresAt: row.expiresAt } : {}),
          ...(row.willRenew !== undefined ? { willRenew: row.willRenew } : {}),
        }
      : {}),
    emittedEvents,
  });

  const newerRead = Math.max(
    existing?.lastEventOccurredAt ?? 0,
    existing?.resyncedAt ?? 0,
  );
  const changed =
    !existing ||
    RESYNC_COMPARED_FIELDS.some((field) => next[field] !== existing[field]);
  if (newerRead > args.observedAt || !changed) {
    return outcome("unchanged", existing, 0);
  }

  // The id is synthetic: a re-sync has no store notification. Repeats are
  // idempotent because the diff above runs inside this transaction.
  const recorded = await recordWebhookEventHandler(ctx, {
    projectId: args.projectId,
    source: "store-resync",
    sourceNotificationId: `resync:${crypto.randomUUID()}`,
    event: {
      type: "ReceiptRechecked",
      sourceFull: "StoreResync",
      platform: args.platform,
      store: args.store,
      environment: args.context.environment,
      purchaseToken: args.purchaseToken,
      ...(args.context.transactionId
        ? { transactionId: args.context.transactionId }
        : {}),
      ...(args.context.originalTransactionId
        ? { originalTransactionId: args.context.originalTransactionId }
        : {}),
      ...(args.context.applicationId
        ? { applicationId: args.context.applicationId }
        : {}),
      productKind: "subscription",
      productId: next.productId,
      subscriptionState: next.state,
      expiresAt: next.expiresAt,
      renewsAt: next.renewsAt,
      willRenew: next.willRenew,
      cancellationReason: next.cancellationReason,
      currency: next.currency,
      priceAmountMicros: next.priceAmountMicros,
      ...(args.snapshot.priceAmountMicros !== undefined
        ? { amountProvenance: "store" as const }
        : {}),
      occurredAt: args.observedAt,
    },
  });
  const event = await ctx.db.get(recorded.eventId);
  if (!event) throw new Error("Re-sync event was not persisted");

  const now = Date.now();
  const previouslyActive = reportedEntitlement(existing) ?? false;
  const subscriptionId: Id<"subscriptions"> = await persistSubscriptionSnapshot(
    ctx,
    {
      projectId: args.projectId,
      platform: args.platform,
      purchaseToken: args.purchaseToken,
      existing,
      next,
      now,
      environment: args.context.environment,
      resyncedAt: args.observedAt,
    },
  );
  const active = entitlementActive(next, now);
  // The delta below tells the owner, so a later store event compares with it.
  if (existing?.userId) {
    await ctx.db.patch(subscriptionId, { resyncReportedActive: active });
  }
  await ctx.db.patch(event._id, { appliedAt: now });
  // The row's id is IAPKit's own, so it must not pose as a store
  // notification id (Commerce Protocol SPEC 9.3).
  const { sourceNotificationId: _resyncId, ...sourceEvent } = event;
  const emitted = await emitCommerceEvent(ctx, {
    projectId: args.projectId,
    transition: null,
    active,
    previouslyActive,
    sourceEvent,
    subscriptionId,
    subscription: {
      ...next,
      ...(existing?.userId ? { userId: existing.userId } : {}),
    },
  });
  return outcome("updated", await ctx.db.get(subscriptionId), emitted.length);
}
