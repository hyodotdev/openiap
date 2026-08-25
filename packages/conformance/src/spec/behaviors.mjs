/**
 * OpenIAP conformance behaviors — the versioned behavioral contract.
 *
 * The GraphQL schema says what the API is. The capability matrix says which
 * stores must implement each behavior. This file says what each behavior must
 * *do*, as data an implementation in any language can be checked against.
 *
 * Behavior ids are permanent public identifiers: they appear in conformance
 * reports and in the Kotlin/Swift/TypeScript suites. Renaming one is a breaking
 * change to the suite. Retire instead (`status: 'retired'`) and add a new id.
 *
 * `level` follows RFC 2119:
 *   MUST   — a conforming implementation fails without it.
 *   SHOULD — recommended; reported as a warning, not a failure.
 *
 * `capability` names an entry in packages/gql/src/capability-matrix.mjs. A
 * behavior gated on a capability is only required of stores whose level for it
 * is `required`; for `unsupported` stores the runner asserts the documented
 * absence instead. Ungated behaviors apply to every implementation.
 */

export const BEHAVIOR_CATEGORIES = Object.freeze([
  'products',
  'purchases',
  'completion',
  'restoration',
  'subscriptions',
  'lifecycle',
  'errors',
  'verification',
  'identifiers',
  'capabilities',
]);

export const BEHAVIOR_LEVELS = Object.freeze(['MUST', 'SHOULD']);

/** @type {ReadonlyArray<import('./types.mjs').Behavior>} */
export const BEHAVIORS = Object.freeze([
  // --- products ----------------------------------------------------------
  {
    id: 'products.fetch-returns-requested-skus',
    category: 'products',
    level: 'MUST',
    capability: 'fetchProducts',
    statement:
      'fetchProducts returns one product per requested sku that the store recognizes, and omits unknown skus rather than emitting placeholders.',
  },
  {
    id: 'products.fetch-normalizes-required-fields',
    category: 'products',
    level: 'MUST',
    capability: 'fetchProducts',
    statement:
      'Every returned product carries a non-empty id, title, currency, and displayPrice.',
  },
  {
    id: 'products.fetch-empty-sku-list-is-an-error',
    category: 'products',
    level: 'MUST',
    capability: 'fetchProducts',
    statement:
      'fetchProducts with an empty sku list fails with ErrorCode.EmptySkuList rather than returning an empty result.',
  },
  {
    id: 'products.fetch-separates-in-app-and-subscription-types',
    category: 'products',
    level: 'MUST',
    capability: 'fetchProducts',
    statement:
      'A fetch scoped to one ProductType returns only products of that type.',
  },

  // --- purchases ---------------------------------------------------------
  {
    id: 'purchases.request-emits-purchase-updated-on-success',
    category: 'purchases',
    level: 'MUST',
    capability: 'requestPurchase',
    statement:
      'A successful purchase delivers the transaction to the purchase-updated listener.',
  },
  {
    id: 'purchases.request-emits-error-on-user-cancel',
    category: 'purchases',
    level: 'MUST',
    capability: 'requestPurchase',
    statement:
      'A user-cancelled purchase surfaces ErrorCode.UserCancelled and delivers no purchase-updated event.',
  },
  {
    id: 'purchases.already-owned-surfaces-already-owned-error',
    category: 'purchases',
    level: 'MUST',
    capability: 'alreadyOwnedError',
    statement:
      'Purchasing an item the user already owns surfaces ErrorCode.AlreadyOwned.',
  },
  {
    id: 'purchases.pending-purchase-is-not-delivered-as-purchased',
    category: 'purchases',
    level: 'MUST',
    capability: 'pendingPurchases',
    statement:
      'A deferred/pending purchase is never delivered with PurchaseState.Purchased.',
  },
  {
    id: 'purchases.unknown-sku-surfaces-sku-not-found',
    category: 'purchases',
    level: 'MUST',
    capability: 'requestPurchase',
    statement:
      'Requesting a purchase for an unknown sku fails rather than resolving successfully.',
  },

  // --- completion --------------------------------------------------------
  {
    id: 'completion.finish-removes-transaction-from-pending',
    category: 'completion',
    level: 'MUST',
    capability: 'finishTransaction',
    statement:
      'Finishing a transaction removes it from the set of unfinished transactions.',
  },
  {
    id: 'completion.finish-is-idempotent',
    category: 'completion',
    level: 'MUST',
    capability: 'finishTransaction',
    statement:
      'Finishing an already-finished transaction does not corrupt state or throw an unmapped error.',
  },
  {
    id: 'completion.unfinished-purchase-remains-available',
    category: 'completion',
    level: 'MUST',
    capability: 'finishTransaction',
    statement:
      'A purchase that has not been finished is still reported by getAvailablePurchases so entitlement can be re-granted after a crash.',
  },

  // --- restoration -------------------------------------------------------
  {
    id: 'restoration.available-purchases-returns-owned-items',
    category: 'restoration',
    level: 'MUST',
    capability: 'getAvailablePurchases',
    statement:
      'getAvailablePurchases returns every non-consumable and active subscription the user owns.',
  },
  {
    id: 'restoration.available-purchases-excludes-consumed-items',
    category: 'restoration',
    level: 'MUST',
    capability: 'getAvailablePurchases',
    statement:
      'A consumed consumable is not reported by getAvailablePurchases.',
  },
  {
    id: 'restoration.available-purchases-is-empty-for-new-user',
    category: 'restoration',
    level: 'MUST',
    capability: 'getAvailablePurchases',
    statement:
      'getAvailablePurchases returns an empty list — not an error — for a user who owns nothing.',
  },

  // --- subscriptions -----------------------------------------------------
  {
    id: 'subscriptions.active-subscription-is-reported-active',
    category: 'subscriptions',
    level: 'MUST',
    capability: 'getActiveSubscriptions',
    statement:
      'A purchased, non-expired subscription is reported with isActive true.',
  },
  {
    id: 'subscriptions.pending-subscription-is-not-active',
    category: 'subscriptions',
    level: 'MUST',
    capability: 'getActiveSubscriptions',
    statement:
      'A subscription whose purchase is not in the Purchased state is never reported as an active entitlement.',
  },
  {
    id: 'subscriptions.unknown-state-subscription-is-not-active',
    category: 'subscriptions',
    level: 'MUST',
    capability: 'getActiveSubscriptions',
    statement:
      'A subscription in an Unknown purchase state is never reported as an active entitlement.',
  },
  {
    id: 'subscriptions.groups-keep-independent-identifiers',
    category: 'subscriptions',
    level: 'MUST',
    capability: 'getActiveSubscriptions',
    statement:
      'Concurrent subscriptions in different groups retain their own productId, currentPlanId, and purchase token.',
  },
  {
    id: 'subscriptions.has-active-agrees-with-get-active',
    category: 'subscriptions',
    level: 'MUST',
    capability: 'getActiveSubscriptions',
    statement:
      'hasActiveSubscriptions is true exactly when getActiveSubscriptions reports at least one active entitlement.',
  },

  // --- lifecycle (server-side subscription state) ------------------------
  {
    id: 'lifecycle.purchase-starts-active-entitlement',
    category: 'lifecycle',
    level: 'MUST',
    capability: 'storeWebhookLifecycle',
    statement: 'An initial purchase produces an Active, entitled subscription.',
  },
  {
    id: 'lifecycle.expiry-ends-entitlement',
    category: 'lifecycle',
    level: 'MUST',
    capability: 'storeWebhookLifecycle',
    statement: 'Expiry moves the subscription to Expired and removes entitlement.',
  },
  {
    id: 'lifecycle.grace-period-retains-entitlement',
    category: 'lifecycle',
    level: 'MUST',
    capability: 'storeWebhookLifecycle',
    statement:
      'A billing failure inside the grace period retains entitlement while marking InGracePeriod.',
  },
  {
    id: 'lifecycle.billing-retry-suspends-entitlement',
    category: 'lifecycle',
    level: 'MUST',
    capability: 'storeWebhookLifecycle',
    statement:
      'A billing retry / on-hold state removes entitlement while the subscription is recoverable.',
  },
  {
    id: 'lifecycle.refund-ends-entitlement',
    category: 'lifecycle',
    level: 'MUST',
    capability: 'storeWebhookLifecycle',
    statement: 'A refund moves the subscription to Refunded and removes entitlement.',
  },
  {
    id: 'lifecycle.revoke-ends-entitlement',
    category: 'lifecycle',
    level: 'MUST',
    capability: 'storeWebhookLifecycle',
    statement: 'A revocation moves the subscription to Revoked and removes entitlement.',
  },
  {
    id: 'lifecycle.cancel-retains-entitlement-until-expiry',
    category: 'lifecycle',
    level: 'MUST',
    capability: 'storeWebhookLifecycle',
    statement:
      'Disabling auto-renew keeps the entitlement active until the paid period ends.',
  },

  // --- errors ------------------------------------------------------------
  {
    id: 'errors.store-codes-normalize-to-spec-error-codes',
    category: 'errors',
    level: 'MUST',
    statement:
      'Store-native failure codes normalize to the ErrorCode the specification assigns them.',
  },
  {
    id: 'errors.unrecognized-store-code-normalizes-to-unknown',
    category: 'errors',
    level: 'MUST',
    statement:
      'A store failure code the implementation does not recognize normalizes to ErrorCode.Unknown rather than being dropped or guessed.',
  },
  {
    id: 'errors.unsupported-codes-are-not-synthesized',
    category: 'errors',
    level: 'MUST',
    statement:
      'An implementation never produces an ErrorCode its store cannot actually reach, per the capability matrix.',
  },

  // --- verification ------------------------------------------------------
  // Trust-boundary behaviors are evidence-backed: client-only validation is a
  // measured failure mode (mulliner2014virtualswindle, yang2017showme in
  // knowledge/research/bibliography.md; backlog R2).
  {
    id: 'verification.result-exposes-uniform-validity',
    category: 'verification',
    level: 'MUST',
    statement:
      'Every VerifyPurchaseResult variant exposes isValid, so a caller can gate entitlement without inspecting the concrete platform variant.',
  },
  {
    id: 'verification.forged-token-is-invalid',
    category: 'verification',
    level: 'MUST',
    statement:
      'A purchase token the store never issued verifies with isValid false; verification consults store state rather than trusting the token shape.',
  },
  {
    id: 'verification.infrastructure-error-is-not-a-verdict',
    category: 'verification',
    level: 'MUST',
    statement:
      'A verification attempt that fails for infrastructure reasons surfaces ErrorCode.ServiceError or ErrorCode.NetworkError; it never resolves to an isValid verdict in either direction.',
  },

  // --- identifiers -------------------------------------------------------
  {
    id: 'identifiers.purchase-carries-a-concrete-store',
    category: 'identifiers',
    level: 'MUST',
    statement: 'Every purchase declares a concrete IapStore, never Unknown.',
  },
  {
    id: 'identifiers.purchase-token-is-stable-across-reads',
    category: 'identifiers',
    level: 'MUST',
    statement:
      'The same purchase reports the same purchase token across repeated reads.',
  },

  // --- capabilities ------------------------------------------------------
  {
    id: 'capabilities.unsupported-operations-degrade-predictably',
    category: 'capabilities',
    level: 'MUST',
    statement:
      'An operation the store does not support returns its documented no-op result instead of throwing an unmapped error.',
  },
  {
    id: 'capabilities.declared-capabilities-match-the-matrix',
    category: 'capabilities',
    level: 'MUST',
    statement:
      "An implementation's declared capabilities match the specification's capability matrix for its store.",
  },
]);

/** @param {string} id */
export function behaviorById(id) {
  const behavior = BEHAVIORS.find((item) => item.id === id);
  if (!behavior) throw new Error(`Unknown conformance behavior: ${id}`);
  return behavior;
}

/** @param {string} category */
export function behaviorsByCategory(category) {
  return BEHAVIORS.filter((behavior) => behavior.category === category);
}

export function behaviorIds() {
  return BEHAVIORS.map((behavior) => behavior.id);
}
