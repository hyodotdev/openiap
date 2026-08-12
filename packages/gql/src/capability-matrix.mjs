/**
 * Store capability matrix — SSOT for behavior that differs by store.
 *
 * The schema defines what the API is; this defines which stores must implement
 * each behavior, so "Amazon does not emit SubscriptionBillingIssue" is
 * machine-checkable data instead of prose in a docstring.
 *
 * Levels: `required` (MUST), `optional` (MAY), `unsupported` (CANNOT — the
 * documented no-op is asserted, so a half-implementation fails too).
 *
 * `capability-matrix.test.ts` requires every IapStore member to appear in every
 * entry, so adding a store without deciding its capabilities fails CI.
 */

/** @typedef {'required' | 'optional' | 'unsupported'} CapabilityLevel */

export const CAPABILITY_LEVELS = Object.freeze([
  'required',
  'optional',
  'unsupported',
]);

/**
 * Stores that participate in the capability matrix.
 * Mirrors `IapStore` minus `Unknown`, which is a fallback discriminator rather
 * than an implementation.
 */
export const CAPABILITY_STORES = Object.freeze([
  'Apple',
  'Google',
  'Amazon',
  'Horizon',
]);

/**
 * Behavior -> per-store level.
 *
 * `evidence` points at the code or docs that justify a non-`required` level, so
 * a reviewer can check the claim rather than trust it.
 */
export const CAPABILITY_MATRIX = Object.freeze({
  fetchProducts: {
    description: 'Fetch products and subscriptions from the store.',
    stores: { Apple: 'required', Google: 'required', Amazon: 'required', Horizon: 'required' },
  },

  requestPurchase: {
    description: 'Initiate a purchase or subscription flow.',
    stores: { Apple: 'required', Google: 'required', Amazon: 'required', Horizon: 'required' },
  },

  finishTransaction: {
    description: 'Complete a transaction after verification.',
    stores: { Apple: 'required', Google: 'required', Amazon: 'required', Horizon: 'required' },
  },

  getAvailablePurchases: {
    description: 'List restorable/active purchases for the current user.',
    stores: { Apple: 'required', Google: 'required', Amazon: 'required', Horizon: 'required' },
  },

  getActiveSubscriptions: {
    description:
      'Report active subscriptions. A purchase that is not in the Purchased state is never an active entitlement.',
    stores: { Apple: 'required', Google: 'required', Amazon: 'required', Horizon: 'required' },
  },

  pendingPurchases: {
    description:
      'Represent a deferred/unpaid purchase, and never treat one as an active entitlement.',
    stores: {
      Apple: 'required',
      Google: 'required',
      Amazon: 'required',
      Horizon: 'required',
    },
    notes: {
      Apple:
        'Shape differs: StoreKit surfaces Product.PurchaseResult.pending as an ErrorCode.DeferredPayment error (packages/apple/Sources/OpenIapModule.swift), whereas Android delivers a Purchase carrying PurchaseState.Pending.',
    },
    evidence: {
      Amazon:
        'packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt — pending purchases are enabled and PurchaseResponse.RequestStatus.PENDING maps to DeferredPurchase.',
    },
  },

  subscriptionBillingIssue: {
    description:
      'Emit IapEvent.SubscriptionBillingIssue when a subscription enters a billing-retry/suspended state.',
    stores: {
      Apple: 'required',
      Google: 'required',
      Amazon: 'unsupported',
      Horizon: 'unsupported',
    },
    evidence: {
      Amazon:
        'packages/gql/src/type.graphql (IapEvent.SubscriptionBillingIssue) — Amazon Appstore exposes no suspension signal.',
      Horizon:
        'Horizon Billing Compatibility SDK implements Play Billing 7.0, which predates isSuspended.',
    },
  },

  offerCodeRedemption: {
    description: 'Expose an offer-code redemption entry point.',
    stores: {
      Apple: 'required',
      Google: 'required',
      Amazon: 'unsupported',
      Horizon: 'unsupported',
    },
    evidence: {
      Amazon:
        'packages/google/openiap/src/testAmazon/java/dev/hyo/openiap/OpenRedeemOfferCodeAmazonNoOpTest.kt',
      Horizon:
        'packages/google/openiap/src/testHorizon/java/dev/hyo/openiap/OpenRedeemOfferCodeHorizonNoOpTest.kt',
    },
  },

  alreadyOwnedError: {
    description:
      'Surface ErrorCode.AlreadyOwned when a purchase is attempted for an item the user already owns.',
    stores: {
      Apple: 'unsupported',
      Google: 'required',
      Amazon: 'required',
      Horizon: 'required',
    },
    evidence: {
      Apple:
        'StoreKit has no already-owned failure: re-purchasing an owned non-consumable succeeds and returns the existing transaction. See packages/apple/Sources/Models/OpenIapError.swift (errorCode(for:)).',
    },
  },

  billingServiceLifecycleErrors: {
    description:
      'Surface ErrorCode.BillingUnavailable / ServiceDisconnected / ServiceTimeout for billing-service lifecycle failures.',
    stores: {
      Apple: 'unsupported',
      Google: 'required',
      Amazon: 'required',
      Horizon: 'required',
    },
    evidence: {
      Apple:
        'StoreKit exposes no long-lived billing-service connection, so these conditions do not arise. See packages/apple/Sources/Models/OpenIapError.swift (errorCode(for:)).',
    },
  },

  storeWebhookLifecycle: {
    description:
      'Deliver server-side lifecycle notifications that IAPKit normalizes into subscription state transitions.',
    stores: {
      Apple: 'required',
      Google: 'required',
      Amazon: 'optional',
      Horizon: 'unsupported',
    },
    evidence: {
      Amazon:
        'packages/kit/convex/purchases/amazon.ts (reconcileAmazonPurchases) — reconciliation by polling rather than push notifications.',
      Horizon:
        'packages/kit/convex/purchases/horizon.ts — verification only; Meta exposes no subscription notification stream.',
    },
  },
});

/**
 * @param {string} behavior
 * @param {string} store
 * @returns {CapabilityLevel}
 */
export function capabilityLevel(behavior, store) {
  const entry = CAPABILITY_MATRIX[behavior];
  if (!entry) throw new Error(`Unknown capability behavior: ${behavior}`);
  const level = entry.stores[store];
  if (!level) throw new Error(`Capability ${behavior} has no entry for store ${store}`);
  return level;
}

/** Behaviors a given store must implement. */
export function requiredBehaviors(store) {
  return Object.keys(CAPABILITY_MATRIX).filter(
    (behavior) => CAPABILITY_MATRIX[behavior].stores[store] === 'required',
  );
}

/** Behaviors a given store must NOT implement. */
export function unsupportedBehaviors(store) {
  return Object.keys(CAPABILITY_MATRIX).filter(
    (behavior) => CAPABILITY_MATRIX[behavior].stores[store] === 'unsupported',
  );
}
