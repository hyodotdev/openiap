// Per-subscription analytics facts, folded in once per applied store event.
// Every rule is order independent (earliest timestamp wins, money adds up), so
// late, out-of-order and replayed notifications converge to the same facts.
// Nothing here is read by verification, restore or entitlement code.

import type { Infer } from "convex/values";

import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { receiptEnvironmentValidator } from "../utils/validation";

export type SubscriptionAnalytics = NonNullable<
  Doc<"subscriptions">["analytics"]
>;
export type PaidStart = NonNullable<Doc<"webhookEvents">["paidStart"]>;
export type AnalyticsEnvironment = Infer<typeof receiptEnvironmentValidator>;

type FactEvent = Pick<
  Doc<"webhookEvents">,
  | "_id"
  | "type"
  | "occurredAt"
  | "freeTrial"
  | "refundReversal"
  | "resubscribe"
  | "paidStart"
  | "cancellationReason"
  | "currency"
  | "priceAmountMicros"
  | "linkedPurchaseToken"
  | "replacementCharged"
>;

type PaidChargeType = NonNullable<SubscriptionAnalytics["firstPaidEventType"]>;

function isPaidChargeType(type: string): type is PaidChargeType {
  return (
    type === "SubscriptionStarted" ||
    type === "SubscriptionRenewed" ||
    type === "SubscriptionRecovered"
  );
}

// A Google replacement (upgrade, downgrade, re-signup or prepaid top-up) names
// the token it replaces. It continues that subscription, so it is no new start.
export function isPlanChange(event: FactEvent): boolean {
  return (
    event.type === "SubscriptionStarted" &&
    event.linkedPurchaseToken !== undefined
  );
}

// A store charge: a paid start, renewal or billing recovery, or a replacement
// Play charged at once. A free period (a trial, or a free offer the store
// prices at 0) and a refund reversal are not charges.
export function isPaidCharge(event: FactEvent): boolean {
  return (
    isPaidChargeType(event.type) &&
    event.freeTrial !== true &&
    event.priceAmountMicros !== 0 &&
    event.refundReversal !== true &&
    (!isPlanChange(event) || event.replacementCharged === true)
  );
}

// A start that begins a subscription. A Google replacement and an Apple
// resubscribe continue an earlier one, except the resubscribe marked as the
// direct paid start after a lapsed trial (see `paidStartKind`).
export function startsSubscription(event: FactEvent): boolean {
  return (
    event.type === "SubscriptionStarted" &&
    event.refundReversal !== true &&
    !isPlanChange(event) &&
    (event.resubscribe !== true || event.paidStart === "direct")
  );
}

export function isTrialStart(event: FactEvent): boolean {
  return startsSubscription(event) && event.freeTrial === true;
}

// Money returned to the buyer: Apple REFUND or Play's voided purchase. A
// revocation is never counted: Apple REVOKE is a Family Sharing removal, and
// Play sends SUBSCRIPTION_REVOKED alongside the voided purchase of the same
// refund.
export function isRefund(event: FactEvent): boolean {
  return (
    event.type === "PurchaseRefunded" && event.cancellationReason === "Refunded"
  );
}

export function analyticsEnvironment(
  environment: Doc<"webhookEvents">["environment"] | undefined,
): AnalyticsEnvironment {
  return environment === undefined || environment === "Production"
    ? "Production"
    : "Sandbox";
}

// Rows written before `environment` existed fall back to their last store
// event, then to production.
export function subscriptionEnvironment(
  sub: Pick<Doc<"subscriptions">, "environment" | "lastEventSource">,
): AnalyticsEnvironment {
  return analyticsEnvironment(
    sub.environment ?? sub.lastEventSource?.environment,
  );
}

// How the first paid charge began. A trial converts only through the renewal
// that ends it; a paid start after a lapsed trial is a new direct start, which
// on Apple arrives as a resubscribe. Undefined when the subscription started
// paying before IAPKit saw it: a plain renewal, or a resubscribe with no trial
// before it, so its start is unknown.
export function paidStartKind(
  facts: SubscriptionAnalytics | undefined,
): PaidStart | undefined {
  if (facts?.firstPaidAt === undefined) return undefined;
  const afterTrial =
    facts.trialStartedAt !== undefined &&
    facts.trialStartedAt <= facts.firstPaidAt;
  if (facts.firstPaidEventType === "SubscriptionStarted") {
    return facts.firstPaidResubscribe && !afterTrial ? undefined : "direct";
  }
  return afterTrial ? "trial_conversion" : undefined;
}

export function isInTrialAt(
  facts: SubscriptionAnalytics | undefined,
  at: number,
): boolean {
  return (
    facts?.trialStartedAt !== undefined &&
    facts.trialStartedAt <= at &&
    (facts.firstPaidAt === undefined || facts.firstPaidAt > at)
  );
}

// An expiry that ends a free period is not churn. Apple flags a free trial and
// prices a free offer at 0; Play does neither, so the facts decide.
export function endedInFreePeriod(
  event: Pick<
    Doc<"webhookEvents">,
    "freeTrial" | "priceAmountMicros" | "occurredAt"
  >,
  facts: SubscriptionAnalytics | undefined,
): boolean {
  if (event.priceAmountMicros === 0) return true;
  return event.freeTrial ?? isInTrialAt(facts, event.occurredAt);
}

// Null when the event changes nothing.
export function nextAnalyticsFacts(
  current: SubscriptionAnalytics | undefined,
  event: FactEvent,
): SubscriptionAnalytics | null {
  const next: SubscriptionAnalytics = current
    ? { ...current }
    : { paidMicros: 0, refundedMicros: 0 };
  let changed = false;

  // A trial starts before the first paid charge, in whichever order they
  // arrive.
  if (
    isTrialStart(event) &&
    event.occurredAt < (next.trialStartedAt ?? Infinity) &&
    event.occurredAt <= (next.firstPaidAt ?? Infinity)
  ) {
    next.trialStartedAt = event.occurredAt;
    changed = true;
  }

  if (isPaidCharge(event) && isPaidChargeType(event.type)) {
    // A replacement continues a subscription, so it never starts its cohort.
    if (
      !isPlanChange(event) &&
      event.occurredAt < (next.firstPaidAt ?? Infinity)
    ) {
      next.firstPaidAt = event.occurredAt;
      next.firstPaidEventId = event._id;
      next.firstPaidEventType = event.type;
      if (event.resubscribe === true) next.firstPaidResubscribe = true;
      else delete next.firstPaidResubscribe;
      if ((next.trialStartedAt ?? -Infinity) > event.occurredAt) {
        delete next.trialStartedAt;
      }
      changed = true;
    }
    changed = addMoney(next, "paidMicros", event, 1) || changed;
  }

  if (isRefund(event)) {
    changed = addMoney(next, "refundedMicros", event, 1) || changed;
  }
  if (event.refundReversal === true) {
    changed = addMoney(next, "refundedMicros", event, -1) || changed;
  }

  return changed ? next : null;
}

function addMoney(
  facts: SubscriptionAnalytics,
  field: "paidMicros" | "refundedMicros",
  event: FactEvent,
  sign: 1 | -1,
): boolean {
  if (typeof event.priceAmountMicros !== "number" || !event.currency) {
    return false;
  }
  if (facts.currency === undefined) facts.currency = event.currency;
  if (facts.currency !== event.currency) return false;
  facts[field] += sign * event.priceAmountMicros;
  return true;
}

// Folds both facts when a Google replacement merges two rows.
export function mergeAnalyticsFacts(
  a: SubscriptionAnalytics | undefined,
  b: SubscriptionAnalytics | undefined,
): SubscriptionAnalytics | undefined {
  if (!a || !b) return a ?? b;
  const firstPaid =
    b.firstPaidAt !== undefined &&
    (a.firstPaidAt === undefined || b.firstPaidAt < a.firstPaidAt)
      ? b
      : a;
  const trialStartedAt = Math.min(
    a.trialStartedAt ?? Infinity,
    b.trialStartedAt ?? Infinity,
  );
  const trialBeforePaid =
    Number.isFinite(trialStartedAt) &&
    trialStartedAt <= (firstPaid.firstPaidAt ?? Infinity);
  const currency = a.currency ?? b.currency;
  const sameCurrency =
    a.currency === undefined ||
    b.currency === undefined ||
    a.currency === b.currency;
  return {
    ...(trialBeforePaid ? { trialStartedAt } : {}),
    ...(firstPaid.firstPaidAt !== undefined
      ? {
          firstPaidAt: firstPaid.firstPaidAt,
          firstPaidEventId: firstPaid.firstPaidEventId,
          firstPaidEventType: firstPaid.firstPaidEventType,
          ...(firstPaid.firstPaidResubscribe
            ? { firstPaidResubscribe: true }
            : {}),
        }
      : {}),
    ...(currency !== undefined ? { currency } : {}),
    paidMicros: a.paidMicros + (sameCurrency ? b.paidMicros : 0),
    refundedMicros: a.refundedMicros + (sameCurrency ? b.refundedMicros : 0),
  };
}

// Applies one event's facts to its subscription and keeps the `paidStart`
// marker on whichever event is now the first paid charge. Failures are logged
// and swallowed: analytics must never block a lifecycle transition.
export async function recordSubscriptionAnalyticsFacts(
  ctx: Pick<MutationCtx, "db">,
  subscriptionId: Id<"subscriptions">,
  event: FactEvent,
): Promise<void> {
  try {
    const sub = await ctx.db.get(subscriptionId);
    if (!sub) return;
    const next = nextAnalyticsFacts(sub.analytics, event);
    if (!next) return;
    await ctx.db.patch(subscriptionId, { analytics: next });
    await reconcilePaidStart(ctx, [sub.analytics], next);
  } catch (error) {
    console.error(
      "[analyticsFacts] skipped",
      error instanceof Error ? error.name : typeof error,
    );
  }
}

/** Keeps event markers in step with facts, including linked-token row merges. */
export async function reconcilePaidStart(
  ctx: Pick<MutationCtx, "db">,
  previous: readonly (SubscriptionAnalytics | undefined)[],
  next: SubscriptionAnalytics | undefined,
): Promise<void> {
  try {
    const selected = next?.firstPaidEventId;
    const superseded = new Set(
      previous.map((facts) => facts?.firstPaidEventId),
    );
    for (const eventId of superseded) {
      if (eventId && eventId !== selected)
        await markPaidStart(ctx, eventId, undefined);
    }
    if (selected) await markPaidStart(ctx, selected, paidStartKind(next));
  } catch (error) {
    console.error(
      "[analyticsFacts] skipped",
      error instanceof Error ? error.name : typeof error,
    );
  }
}

async function markPaidStart(
  ctx: Pick<MutationCtx, "db">,
  eventId: Id<"webhookEvents">,
  paidStart: PaidStart | undefined,
): Promise<void> {
  // The marked event may already be pruned; its rollup day is then final.
  const event = await ctx.db.get(eventId);
  if (!event || event.paidStart === paidStart) return;
  await ctx.db.patch(eventId, { paidStart });
}
