import { SUITE_VERSION } from "./suite-version.mjs";

/** Required assertions for the Apple and Android provider reports. */
const commonV4 = Object.freeze({
  mapping: [
    "subscriptions.active-subscription-is-reported-active",
    "subscriptions.pending-subscription-is-not-active",
    "subscriptions.unknown-state-subscription-is-not-active",
    "subscriptions.groups-keep-independent-identifiers",
    "errors.store-codes-normalize-to-spec-error-codes",
    "errors.unrecognized-store-code-normalizes-to-unknown",
    "identifiers.purchase-carries-a-concrete-store",
    "capabilities.declared-capabilities-match-the-matrix",
    "capabilities.unsupported-operations-degrade-predictably",
  ],
  runtime: [
    "products.fetch-returns-requested-skus",
    "purchases.request-emits-purchase-updated-on-success",
    "restoration.available-purchases-returns-owned-items",
    "identifiers.purchase-token-is-stable-across-reads",
    "completion.finish-is-idempotent",
  ],
  capabilities: {
    pendingPurchases:
      "purchases.pending-purchase-is-not-delivered-as-purchased",
    subscriptionBillingIssue: "provider.subscription-billing-issue",
    offerCodeRedemption: "provider.offer-code-redemption",
  },
});

const profiles = new Map([[4, commonV4]]);
export const PROVIDER_PROFILE = profiles.get(
  Number(SUITE_VERSION.split(".")[0]),
);
if (!PROVIDER_PROFILE)
  throw new Error(`Missing provider profile for suite ${SUITE_VERSION}`);

export function providerProfile(
  platform,
  major = Number(SUITE_VERSION.split(".")[0]),
) {
  const profile = profiles.get(major);
  if (!profile) throw new Error(`Unsupported provider suite major: ${major}`);
  if (!["android", "ios"].includes(platform))
    throw new Error(`Unknown provider platform: ${platform}`);
  const prefix = platform === "ios" ? "apple-provider" : "android-provider";
  return {
    ...profile,
    capabilities: {
      ...profile.capabilities,
      subscriptionBillingIssue: `${prefix}.subscription-billing-issue`,
      offerCodeRedemption: `${prefix}.offer-code-redemption`,
    },
  };
}

export function requiredProviderBehaviors(
  capabilities,
  major = Number(SUITE_VERSION.split(".")[0]),
  platform = "android",
) {
  const profile = providerProfile(platform, major);
  return [
    ...profile.mapping,
    ...profile.runtime,
    ...capabilities.map((capability) => {
      const id = profile.capabilities[capability];
      if (!id) throw new Error(`Unknown provider capability: ${capability}`);
      return id;
    }),
  ];
}
