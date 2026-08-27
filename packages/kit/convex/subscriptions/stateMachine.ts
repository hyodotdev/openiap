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
  willRenew?: boolean;
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
    | "Deferred"
    | "Paused"
    | "Resumed"
    | "Ignored"
    | null;
};

export type SubscriptionTransitionKind = NonNullable<
  SubscriptionTransition["transition"]
>;

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

  const carryForward = (
    overrides: Partial<NonNullable<CurrentSubscription>>,
    options: {
      clearCancellationReason?: boolean;
      clearRenewsAt?: boolean;
    } = {},
  ) =>
    ({
      state: overrides.state ?? current?.state ?? "Unknown",
      productId,
      expiresAt: overrides.expiresAt ?? current?.expiresAt,
      renewsAt: options.clearRenewsAt
        ? undefined
        : (overrides.renewsAt ?? current?.renewsAt),
      willRenew: overrides.willRenew ?? current?.willRenew,
      cancellationReason: options.clearCancellationReason
        ? undefined
        : (overrides.cancellationReason ?? current?.cancellationReason),
      currency: overrides.currency ?? current?.currency,
      priceAmountMicros:
        overrides.priceAmountMicros ?? current?.priceAmountMicros,
    }) as NonNullable<CurrentSubscription>;

  switch (event.type) {
    case "SubscriptionStarted": {
      const next = carryForward(
        {
          state: "Active",
          expiresAt: event.expiresAt,
          renewsAt: event.renewsAt,
          willRenew: event.willRenew ?? true,
          currency: event.currency,
          priceAmountMicros: event.priceAmountMicros,
        },
        {
          clearCancellationReason: true,
          clearRenewsAt: event.willRenew === false,
        },
      );
      return {
        next,
        active: entitlementActive(next),
        transition: current ? "Recovered" : "Started",
      };
    }
    case "SubscriptionRenewed": {
      const next = carryForward(
        {
          state: "Active",
          expiresAt: event.expiresAt,
          renewsAt: event.renewsAt,
          willRenew: event.willRenew ?? true,
          currency: event.currency ?? current?.currency,
          priceAmountMicros:
            event.priceAmountMicros ?? current?.priceAmountMicros,
        },
        {
          clearCancellationReason: true,
          clearRenewsAt: event.willRenew === false,
        },
      );
      return {
        next,
        active: entitlementActive(next),
        transition: "Renewed",
      };
    }
    case "SubscriptionRecovered":
    case "SubscriptionResumed": {
      const next = carryForward(
        {
          state: "Active",
          expiresAt: event.expiresAt,
          renewsAt: event.renewsAt,
          willRenew: event.willRenew ?? true,
        },
        {
          clearCancellationReason: true,
          clearRenewsAt: event.willRenew === false,
        },
      );
      return {
        next,
        active: entitlementActive(next),
        transition:
          event.type === "SubscriptionResumed" || current?.state === "Paused"
            ? "Resumed"
            : "Recovered",
      };
    }
    case "SubscriptionInGracePeriod": {
      const next = carryForward(
        {
          state: "InGracePeriod",
          expiresAt: event.expiresAt,
          renewsAt: event.renewsAt,
          willRenew: event.willRenew,
        },
        { clearRenewsAt: event.willRenew === false },
      );
      return {
        next,
        active: entitlementActive(next),
        transition: "EnteredGracePeriod",
      };
    }
    case "SubscriptionInBillingRetry": {
      const next = carryForward(
        {
          state: "InBillingRetry",
          expiresAt: event.expiresAt,
          renewsAt: event.renewsAt,
          willRenew: event.willRenew,
        },
        { clearRenewsAt: event.willRenew === false },
      );
      return {
        next,
        active: false,
        transition: "EnteredBillingRetry",
      };
    }
    case "SubscriptionExpired":
      return {
        next: carryForward(
          {
            state: "Expired",
            willRenew: false,
            cancellationReason:
              event.cancellationReason ?? current?.cancellationReason,
          },
          { clearRenewsAt: true },
        ),
        active: false,
        transition: "Expired",
      };
    case "SubscriptionCanceled": {
      // User turned off auto-renew; preserve any existing entitlement state and
      // update the renewal flag and store-supplied period boundary.
      const next = carryForward(
        {
          // Turning off renewal does not repair billing, revocation, pause, or
          // expiry state. Trust the current row when one already exists.
          state: current?.state ?? event.subscriptionState ?? "Active",
          expiresAt: event.expiresAt,
          willRenew: false,
          cancellationReason: event.cancellationReason ?? "UserCanceled",
        },
        { clearRenewsAt: true },
      );
      return {
        next,
        active: entitlementActive(next),
        transition: "Canceled",
      };
    }
    case "SubscriptionUncanceled": {
      const next = carryForward(
        {
          state: current?.state ?? event.subscriptionState ?? "Active",
          expiresAt: event.expiresAt,
          renewsAt: event.renewsAt,
          willRenew: true,
        },
        { clearCancellationReason: true },
      );
      return {
        next,
        active: entitlementActive(next),
        transition: "Uncanceled",
      };
    }
    case "SubscriptionRevoked":
      return {
        next: carryForward(
          {
            state: "Revoked",
            willRenew: false,
            cancellationReason: "Refunded",
          },
          { clearRenewsAt: true },
        ),
        active: false,
        transition: "Revoked",
      };
    case "PurchaseRefunded":
      return {
        next: carryForward(
          {
            state: "Refunded",
            willRenew: false,
            cancellationReason: "Refunded",
          },
          { clearRenewsAt: true },
        ),
        active: false,
        transition: "Refunded",
      };
    case "SubscriptionProductChanged": {
      const next = carryForward(
        {
          state: event.subscriptionState ?? current?.state ?? "Active",
          expiresAt: event.expiresAt,
          renewsAt: event.renewsAt,
          willRenew: event.willRenew,
          cancellationReason: event.cancellationReason,
          currency: event.currency,
          priceAmountMicros: event.priceAmountMicros,
        },
        {
          clearCancellationReason: event.willRenew === true,
          clearRenewsAt: event.willRenew === false,
        },
      );
      return {
        next,
        active: entitlementActive(next),
        transition: "ProductChanged",
      };
    }
    case "SubscriptionPriceChange": {
      if (!current) {
        return { next: null, active: false, transition: "Ignored" };
      }
      return {
        next: current,
        active: entitlementActive(current),
        transition: "PriceChanged",
      };
    }
    case "SubscriptionDeferred": {
      if (!current) {
        return { next: null, active: false, transition: "Ignored" };
      }
      const next = carryForward(
        {
          expiresAt: event.expiresAt,
          renewsAt: event.renewsAt,
          willRenew: event.willRenew,
          cancellationReason: event.cancellationReason,
        },
        {
          clearCancellationReason: event.willRenew === true,
          clearRenewsAt: event.willRenew === false,
        },
      );
      return {
        next,
        active: entitlementActive(next),
        transition: "Deferred",
      };
    }
    case "SubscriptionPauseScheduleChanged":
    case "SubscriptionPendingPurchaseCanceled":
    case "SubscriptionPriceStepUpConsentChanged":
      return {
        next: current,
        active: current ? entitlementActive(current) : false,
        transition: "Ignored",
      };
    case "SubscriptionPaused":
      return {
        next: carryForward(
          { state: "Paused", willRenew: false },
          { clearRenewsAt: true },
        ),
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
