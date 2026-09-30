/** Required assertions for the scoped Kotlin Android provider report. */
export const ANDROID_PROVIDER_PROFILE = Object.freeze({
  mapping: [
    'subscriptions.active-subscription-is-reported-active',
    'subscriptions.pending-subscription-is-not-active',
    'subscriptions.unknown-state-subscription-is-not-active',
    'subscriptions.groups-keep-independent-identifiers',
    'errors.store-codes-normalize-to-spec-error-codes',
    'errors.unrecognized-store-code-normalizes-to-unknown',
    'identifiers.purchase-carries-a-concrete-store',
    'capabilities.declared-capabilities-match-the-matrix',
    'capabilities.unsupported-operations-degrade-predictably',
  ],
  runtime: [
    'products.fetch-returns-requested-skus',
    'purchases.request-emits-purchase-updated-on-success',
    'restoration.available-purchases-returns-owned-items',
    'identifiers.purchase-token-is-stable-across-reads',
    'completion.finish-is-idempotent',
  ],
  capabilities: {
    pendingPurchases: 'purchases.pending-purchase-is-not-delivered-as-purchased',
    subscriptionBillingIssue: 'android-provider.subscription-billing-issue',
    offerCodeRedemption: 'android-provider.offer-code-redemption',
  },
});

export const requiredProviderBehaviors = (capabilities) => [
  ...ANDROID_PROVIDER_PROFILE.mapping,
  ...ANDROID_PROVIDER_PROFILE.runtime,
  ...capabilities.map((capability) => {
    const id = ANDROID_PROVIDER_PROFILE.capabilities[capability];
    if (!id) throw new Error(`Unknown provider capability: ${capability}`);
    return id;
  }),
];
