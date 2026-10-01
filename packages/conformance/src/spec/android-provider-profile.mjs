import {SUITE_VERSION} from './suite-version.mjs';

/** Required assertions for the scoped Kotlin Android provider report. */
const profileV4 = Object.freeze({
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

// Retain each published major's profile so historical reports remain verifiable.
const profiles = new Map([[4, profileV4]]);
export const ANDROID_PROVIDER_PROFILE = profiles.get(Number(SUITE_VERSION.split('.')[0]));
if (!ANDROID_PROVIDER_PROFILE) throw new Error(`Missing Android provider profile for suite ${SUITE_VERSION}`);

export const requiredProviderBehaviors = (capabilities, major = Number(SUITE_VERSION.split('.')[0])) => {
  const profile = profiles.get(major);
  if (!profile) throw new Error(`Unsupported Android provider suite major: ${major}`);
  return [
    ...profile.mapping,
    ...profile.runtime,
    ...capabilities.map((capability) => {
      const id = profile.capabilities[capability];
      if (!id) throw new Error(`Unknown provider capability: ${capability}`);
      return id;
    }),
  ];
};
