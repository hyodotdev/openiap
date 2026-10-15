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
  | "cancellationReason"
  | "currency"
  | "priceAmountMicros"
  | "linkedPurchaseToken"
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
// the token it replaces. It continues that subscription, so it is no new
// start, and Play prorates it, so it is no list-price charge either.
function isPlanChange(event: FactEvent): boolean {
  return (
    event.type === "SubscriptionStarted" &&
    event.linkedPurchaseToken !== undefined
  );
}

// A store charge: a paid start, renewal or billing recovery. Free trial
// periods, refund reversals and plan changes are not charges.
export function isPaidCharge(event: FactEvent): boolean {
  return (
    isPaidChargeType(event.type) &&
    event.freeTrial !== true &&
    event.refundReversal !== true &&
    !isPlanChange(event)
  );
}

export function isTrialStart(event: FactEvent): boolean {
  return (
    event.type === "SubscriptionStarted" &&
    event.freeTrial === true &&
    event.refundReversal !== true &&
    !isPlanChange(event)
  );
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
// that ends it; a paid start after a lapsed trial is a new direct start.
// Undefined for a plain renewal: the subscription started paying before IAPKit
// saw it, so its start is unknown.
export function paidStartKind(
  facts: SubscriptionAnalytics | undefined,
): PaidStart | undefined {
  if (facts?.firstPaidAt === undefined) return undefined;
  if (facts.firstPaidEventType === "SubscriptionStarted") return "direct";
  return facts.trialStartedAt !== undefined &&
    facts.trialStartedAt <= facts.firstPaidAt
    ? "trial_conversion"
    : undefined;
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

// An expiry that ends a free trial with no paid charge is not churn. Apple
// flags the period that ended; Play does not, so the facts decide.
export function endedInFreeTrial(
  event: Pick<Doc<"webhookEvents">, "freeTrial" | "occurredAt">,
  facts: SubscriptionAnalytics | undefined,
): boolean {
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

  if (
    isTrialStart(event) &&
    (next.trialStartedAt === undefined ||
      event.occurredAt < next.trialStartedAt)
  ) {
    next.trialStartedAt = event.occurredAt;
    changed = true;
  }

  if (isPaidCharge(event) && isPaidChargeType(event.type)) {
    if (next.firstPaidAt === undefined || event.occurredAt < next.firstPaidAt) {
      next.firstPaidAt = event.occurredAt;
      next.firstPaidEventId = event._id;
      next.firstPaidEventType = event.type;
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
  const currency = a.currency ?? b.currency;
  const sameCurrency =
    a.currency === undefined ||
    b.currency === undefined ||
    a.currency === b.currency;
  return {
    ...(Number.isFinite(trialStartedAt) ? { trialStartedAt } : {}),
    ...(firstPaid.firstPaidAt !== undefined
      ? {
          firstPaidAt: firstPaid.firstPaidAt,
          firstPaidEventId: firstPaid.firstPaidEventId,
          firstPaidEventType: firstPaid.firstPaidEventType,
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
    const before = {
      eventId: sub.analytics?.firstPaidEventId,
      kind: paidStartKind(sub.analytics),
    };
    await ctx.db.patch(subscriptionId, { analytics: next });

    const after = {
      eventId: next.firstPaidEventId,
      kind: paidStartKind(next),
    };
    if (before.eventId && before.eventId !== after.eventId && before.kind) {
      await markPaidStart(ctx, before.eventId, undefined);
    }
    if (
      after.eventId &&
      (after.eventId !== before.eventId || after.kind !== before.kind)
    ) {
      await markPaidStart(ctx, after.eventId, after.kind);
    }
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
