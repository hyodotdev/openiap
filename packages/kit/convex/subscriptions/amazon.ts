import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  parseAmazonReceiptResponse,
  type AmazonReceiptData,
} from "../purchases/amazonReceipt";
import type { AmazonLifecycleNotice } from "../webhooks/amazonShared";
import { recordWebhookEventHandler } from "../webhooks/internal";
import { emitCommerceEvent } from "../commerce/internal";
import {
  findSubscriptionByToken,
  persistSubscriptionSnapshot,
  bindSubscriptionToUserHandler,
} from "./internal";
import {
  entitlementActive,
  type CurrentSubscription,
  type SubscriptionTransition,
} from "./stateMachine";
import type { WebhookEventType } from "../webhooks/shared";

export function amazonSubscriptionToken(remoteId: string): string {
  return `amazon:${remoteId}`;
}

export function amazonSubscriptionSnapshot(
  purchase: Pick<Doc<"purchases">, "isValid" | "productId">,
  receipt: AmazonReceiptData | undefined,
  existing: (NonNullable<CurrentSubscription> & { updatedAt?: number }) | null,
  notice: AmazonLifecycleNotice | undefined,
  now: number,
): {
  next: NonNullable<CurrentSubscription>;
  type: WebhookEventType;
  transition: SubscriptionTransition["transition"];
} | null {
  const productId =
    receipt?.productId ?? purchase.productId ?? existing?.productId;
  if (!productId || (!existing && receipt?.productType !== "SUBSCRIPTION"))
    return null;
  const valid = purchase.isValid === true;
  const graceEnd = receipt?.gracePeriodEndDate;
  const state = !valid
    ? notice?.notificationType === "SUBSCRIPTION_EXPIRED"
      ? "Expired"
      : "Revoked"
    : graceEnd != null && graceEnd > now
      ? "InGracePeriod"
      : "Active";
  const next: NonNullable<CurrentSubscription> = {
    productId,
    state,
    expiresAt: state === "InGracePeriod" ? (graceEnd ?? undefined) : undefined,
    renewsAt: receipt?.renewalDate ?? undefined,
    willRenew: valid ? (receipt?.autoRenewing ?? existing?.willRenew) : false,
    cancellationReason: !valid
      ? "Other"
      : receipt?.autoRenewing === false
        ? "Other"
        : undefined,
  };
  if (!existing && valid)
    return { next, type: "SubscriptionStarted", transition: "Started" };
  if (
    !valid &&
    (!existing || entitlementActive(existing, existing.updatedAt ?? now))
  )
    return {
      next,
      type: state === "Expired" ? "SubscriptionExpired" : "SubscriptionRevoked",
      transition: state === "Expired" ? "Expired" : "Revoked",
    };
  if (!existing) return null;
  if (valid && !entitlementActive(existing, existing.updatedAt ?? now))
    return { next, type: "SubscriptionRecovered", transition: "Recovered" };
  if (valid && state === "InGracePeriod" && existing.state !== state)
    return {
      next,
      type: "SubscriptionInGracePeriod",
      transition: "EnteredGracePeriod",
    };
  if (valid && existing.state === "InGracePeriod" && state === "Active")
    return { next, type: "SubscriptionRecovered", transition: "Recovered" };
  if (valid && next.willRenew === false && existing.willRenew !== false)
    return { next, type: "SubscriptionCanceled", transition: "Canceled" };
  if (valid && next.willRenew === true && existing.willRenew === false)
    return { next, type: "SubscriptionUncanceled", transition: "Uncanceled" };
  if (valid && notice?.notificationType === "SUBSCRIPTION_RENEWED")
    return { next, type: "SubscriptionRenewed", transition: "Renewed" };
  return { next, type: "ReceiptRechecked", transition: null };
}

export async function syncAmazonSubscription(
  ctx: MutationCtx,
  purchase: Doc<"purchases">,
  notice?: AmazonLifecycleNotice,
): Promise<void> {
  if (
    purchase.store !== "amazon" ||
    !purchase.remoteId ||
    purchase.accountErased
  )
    return;
  const token = amazonSubscriptionToken(purchase.remoteId);
  const existing = await findSubscriptionByToken(
    ctx,
    purchase.projectId,
    token,
  );
  if (existing?.accountErased) return;
  let receipt: AmazonReceiptData | undefined;
  try {
    receipt = parseAmazonReceiptResponse(
      JSON.parse(purchase.remoteResponse ?? "null") as unknown,
    );
  } catch {
    /* Invalid RVS verdicts have no receipt body. */
  }
  const now = Date.now();
  const currentNotice =
    notice && notice.occurredAt >= (existing?.lastAmazonNotificationAt ?? 0)
      ? notice
      : undefined;
  const snapshot = amazonSubscriptionSnapshot(
    purchase,
    receipt,
    existing,
    currentNotice,
    now,
  );
  if (!snapshot) return;
  const changed =
    !existing ||
    (
      [
        "state",
        "productId",
        "expiresAt",
        "renewsAt",
        "willRenew",
        "cancellationReason",
      ] as const
    ).some((key) => snapshot.next[key] !== existing[key]);
  if (!changed && !notice) return;
  const recorded = await recordWebhookEventHandler(ctx, {
    projectId: purchase.projectId,
    source: notice ? "amazon" : "amazon-rvs",
    sourceNotificationId:
      notice?.messageId ??
      `rvs:${purchase.lastAmazonRvsSequence ?? purchase.updatedAt ?? purchase._creationTime}`,
    event: {
      type: snapshot.type,
      sourceFull: notice
        ? "AmazonRealTimeNotifications"
        : "AmazonRvsReconciliation",
      platform: "Android",
      store: "amazon",
      environment: purchase.environment ?? "Production",
      purchaseToken: token,
      productKind: "subscription",
      productId: snapshot.next.productId,
      applicationId: purchase.applicationId,
      subscriptionState: snapshot.next.state,
      willRenew: snapshot.next.willRenew,
      expiresAt: snapshot.next.expiresAt,
      renewsAt: snapshot.next.renewsAt,
      cancellationReason: snapshot.next.cancellationReason,
      occurredAt: notice?.occurredAt ?? now,
      rawSignedPayload: notice?.rawSignedPayload,
    },
  });
  if (recorded.deduped) return;
  const event = await ctx.db.get(recorded.eventId);
  if (!event) throw new Error("Amazon lifecycle event was not persisted");
  const previouslyActive = existing
    ? entitlementActive(existing, existing.updatedAt)
    : false;
  const subscriptionId = await persistSubscriptionSnapshot(ctx, {
    projectId: purchase.projectId,
    platform: "Android",
    store: "amazon",
    purchaseToken: token,
    existing,
    next: snapshot.next,
    now,
    lastEvent: event,
  });
  if (currentNotice)
    await ctx.db.patch(subscriptionId, {
      lastAmazonNotificationAt: currentNotice.occurredAt,
    });
  await ctx.db.patch(event._id, { appliedAt: now });
  await emitCommerceEvent(ctx, {
    projectId: purchase.projectId,
    transition: snapshot.transition,
    previouslyActive,
    active: entitlementActive(snapshot.next, now),
    sourceEvent: event,
    subscriptionId,
    subscription: { ...snapshot.next, userId: existing?.userId },
  });
  if (purchase.appUserId && !existing?.userId)
    await bindSubscriptionToUserHandler(ctx, {
      projectId: purchase.projectId,
      purchaseToken: token,
      userId: purchase.appUserId,
    });
}
