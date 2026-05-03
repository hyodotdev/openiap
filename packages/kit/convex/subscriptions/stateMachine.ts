// Pure state-machine that derives the next `subscriptions` row from a
// webhook event. Used by `applySubscriptionEvent` (the convex mutation
// driven by the webhook receiver) and unit-tested in isolation here so
// transition semantics aren't hidden behind ctx.db / Apple-SDK shims.

import type {
  WebhookEventType,
  SubscriptionState,
  WebhookCancellationReason,
} from "../webhooks/shared";

export type CurrentSubscription = {
  state: SubscriptionState;
  productId: string;
  expiresAt?: number;
  renewsAt?: number;
  willRenew?: boolean;
  cancellationReason?: WebhookCancellationReason;
  currency?: string;
  priceAmountMicros?: number;
} | null;

export type SubscriptionEventInput = {
  type: WebhookEventType;
  productId?: string;
  subscriptionState?: SubscriptionState;
  expiresAt?: number;
  renewsAt?: number;
  cancellationReason?: WebhookCancellationReason;
  currency?: string;
  priceAmountMicros?: number;
};

export type SubscriptionTransition = {
  // The next persistent state; null means "no record yet — this event
  // does not create one" (e.g. an orphan REFUND with no prior purchase).
  next: NonNullable<CurrentSubscription> | null;
  // Whether the entitlement should be considered active for gating after
  // applying this event. Mirrors the rule used by `/v1/subscriptions/status`.
  active: boolean;
  // Stable kind of transition for analytics (drives `revenueMetricsDaily`).
  // `null` means "no-op" — the event was recorded but didn't change state.
  transition:
    | "Started"
    | "Renewed"
    | "Recovered"
    | "EnteredGracePeriod"
    | "EnteredBillingRetry"
    | "Expired"
    | "Canceled"
    | "Uncanceled"
    | "Revoked"
    | "Refunded"
    | "ProductChanged"
    | "PriceChanged"
    | "Paused"
    | "Resumed"
    | "Ignored"
    | null;
};

const ENTITLED_STATES: ReadonlySet<SubscriptionState> = new Set([
  "Active",
  "InGracePeriod",
]);

export function applySubscriptionTransition(
  current: CurrentSubscription,
  event: SubscriptionEventInput,
): SubscriptionTransition {
  // Events that don't carry any subscription identity (TestNotification,
  // PurchaseConsumptionRequest) never mutate the row.
  if (
    event.type === "TestNotification" ||
    event.type === "PurchaseConsumptionRequest"
  ) {
    return {
      next: current,
      active: current ? entitlementActive(current) : false,
      transition: null,
    };
  }

  // PurchaseRefunded for one-time products without an existing record is
  // an orphan — record it but don't conjure a subscription row.
  if (event.type === "PurchaseRefunded" && !current) {
    return { next: null, active: false, transition: "Refunded" };
  }

  const productId = event.productId ?? current?.productId;
  if (!productId) {
    // No way to bind the event to a subscription; leave state untouched.
    return {
      next: current,
      active: current ? entitlementActive(current) : false,
      transition: "Ignored",
    };
  }

  const carryForward = (overrides: Partial<NonNullable<CurrentSubscription>>) =>
    ({
      state: overrides.state ?? current?.state ?? "Unknown",
      productId,
      expiresAt: overrides.expiresAt ?? current?.expiresAt,
      renewsAt: overrides.renewsAt ?? current?.renewsAt,
      willRenew: overrides.willRenew ?? current?.willRenew,
      cancellationReason:
        overrides.cancellationReason ?? current?.cancellationReason,
      currency: overrides.currency ?? current?.currency,
      priceAmountMicros:
        overrides.priceAmountMicros ?? current?.priceAmountMicros,
    }) as NonNullable<CurrentSubscription>;

  switch (event.type) {
    case "SubscriptionStarted": {
      const next = carryForward({
        state: "Active",
        expiresAt: event.expiresAt,
        renewsAt: event.renewsAt,
        willRenew: true,
        cancellationReason: undefined,
        currency: event.currency,
        priceAmountMicros: event.priceAmountMicros,
      });
      return {
        next,
        active: true,
        transition: current ? "Recovered" : "Started",
      };
    }
    case "SubscriptionRenewed":
      return {
        next: carryForward({
          state: "Active",
          expiresAt: event.expiresAt,
          renewsAt: event.renewsAt,
          willRenew: true,
          cancellationReason: undefined,
          currency: event.currency ?? current?.currency,
          priceAmountMicros:
            event.priceAmountMicros ?? current?.priceAmountMicros,
        }),
        active: true,
        transition: "Renewed",
      };
    case "SubscriptionRecovered":
    case "SubscriptionResumed":
      return {
        next: carryForward({
          state: "Active",
          expiresAt: event.expiresAt,
          renewsAt: event.renewsAt,
          willRenew: true,
          cancellationReason: undefined,
        }),
        active: true,
        transition:
          event.type === "SubscriptionResumed" ? "Resumed" : "Recovered",
      };
    case "SubscriptionInGracePeriod":
      return {
        next: carryForward({
          state: "InGracePeriod",
          expiresAt: event.expiresAt ?? current?.expiresAt,
        }),
        active: true,
        transition: "EnteredGracePeriod",
      };
    case "SubscriptionInBillingRetry":
      return {
        next: carryForward({ state: "InBillingRetry" }),
        active: false,
        transition: "EnteredBillingRetry",
      };
    case "SubscriptionExpired":
      return {
        next: carryForward({
          state: "Expired",
          willRenew: false,
          cancellationReason:
            event.cancellationReason ?? current?.cancellationReason,
        }),
        active: false,
        transition: "Expired",
      };
    case "SubscriptionCanceled":
      // User turned off auto-renew but access continues until expiry.
      // We keep `state: "Active"` (matches the spec note in
      // `webhook.graphql` and onesub's behavior) and just flip willRenew.
      return {
        next: carryForward({
          state:
            current && current.state === "Active" ? "Active" : current?.state,
          willRenew: false,
          cancellationReason: event.cancellationReason ?? "UserCanceled",
        }),
        active: current
          ? entitlementActive({ ...current, willRenew: false })
          : false,
        transition: "Canceled",
      };
    case "SubscriptionUncanceled":
      return {
        next: carryForward({
          willRenew: true,
          cancellationReason: undefined,
        }),
        active: current
          ? entitlementActive({ ...current, willRenew: true })
          : false,
        transition: "Uncanceled",
      };
    case "SubscriptionRevoked":
      return {
        next: carryForward({
          state: "Revoked",
          willRenew: false,
          cancellationReason: "Refunded",
        }),
        active: false,
        transition: "Revoked",
      };
    case "PurchaseRefunded":
      return {
        next: carryForward({
          state: "Refunded",
          willRenew: false,
          cancellationReason: "Refunded",
        }),
        active: false,
        transition: "Refunded",
      };
    case "SubscriptionProductChanged":
      return {
        next: carryForward({
          // The event itself doesn't include the new productId in its
          // typed surface; receivers will overwrite when they have it.
          // Until then we keep the old productId but mark Active.
          state: "Active",
        }),
        active: true,
        transition: "ProductChanged",
      };
    case "SubscriptionPriceChange":
      return {
        next: carryForward({
          currency: event.currency,
          priceAmountMicros: event.priceAmountMicros,
        }),
        active: current ? entitlementActive(current) : true,
        transition: "PriceChanged",
      };
    case "SubscriptionPaused":
      return {
        next: carryForward({ state: "Paused", willRenew: false }),
        active: false,
        transition: "Paused",
      };
    default:
      return {
        next: current,
        active: current ? entitlementActive(current) : false,
        transition: "Ignored",
      };
  }
}

// Entitlement rule: status grants access AND the period hasn't expired.
// Matches onesub's `/onesub/status` collapse — see
// packages/server/src/routes/status.ts:46-62 in onesub for the same
// `statusAllows && notYetExpired` pattern.
export function entitlementActive(
  sub: NonNullable<CurrentSubscription>,
  now: number = Date.now(),
): boolean {
  if (!ENTITLED_STATES.has(sub.state)) return false;
  if (sub.expiresAt != null && sub.expiresAt <= now) return false;
  return true;
}
