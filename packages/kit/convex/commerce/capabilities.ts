// Per-provider capabilities: what IAPKit implements today, not what a store's
// API allows. Consumers branch on this instead of assuming every store behaves
// like Apple, and support can answer "why no renewal event for Meta?" without
// reading provider code.
//
// Keep in sync with the provider modules; `contract.test.ts` pins the claims
// that have a concrete implementation behind them.

import type { CommerceStore } from "./contract";

export type ProviderCapabilities = {
  /** Server-side receipt/token validation on demand. */
  supportsInitialValidation: boolean;
  /** Store pushes lifecycle notifications to IAPKit. */
  supportsServerNotifications: boolean;
  /** IAPKit keeps a canonical subscription record for this store. */
  supportsSubscriptions: boolean;
  /** Renewal is observable as a distinct lifecycle event. */
  supportsRenewalEvents: boolean;
  /** Refund or revocation is observable as a distinct lifecycle event. */
  supportsRefundEvents: boolean;
  /** Expiration is observable rather than only inferred from a timestamp. */
  supportsExpiration: boolean;
  /** A scheduled pass re-reads authoritative store state. */
  supportsReconciliation: boolean;
  /** Entitlement state is derivable for gating. */
  supportsEntitlements: boolean;
  /** The store asserts an amount IAPKit can attribute to revenue. */
  supportsRevenueAmount: boolean;
  /** Human-readable reason for every false above. */
  notes: string;
};

export const PROVIDER_CAPABILITIES: Record<
  CommerceStore,
  ProviderCapabilities
> = {
  apple: {
    supportsInitialValidation: true,
    supportsServerNotifications: true,
    supportsSubscriptions: true,
    supportsRenewalEvents: true,
    supportsRefundEvents: true,
    supportsExpiration: true,
    supportsReconciliation: false,
    supportsEntitlements: true,
    supportsRevenueAmount: true,
    notes:
      "App Store Server Notifications V2 drive the lifecycle. No scheduled " +
      "reconciliation pass exists yet, so a notification lost past Apple's " +
      "retry window is not self-healing. Receipt verification bootstraps a " +
      "token only before its first store event and cannot recreate a missed " +
      "commerce event.",
  },
  google: {
    supportsInitialValidation: true,
    supportsServerNotifications: true,
    supportsSubscriptions: true,
    supportsRenewalEvents: true,
    supportsRefundEvents: true,
    supportsExpiration: true,
    supportsReconciliation: false,
    supportsEntitlements: true,
    supportsRevenueAmount: true,
    notes:
      "RTDN drives the lifecycle. Google reissues purchaseToken across " +
      "upgrade/downgrade. The receiver requires subscriptionsv2 enrichment " +
      "for non-terminal lifecycle events and uses linkedPurchaseToken to move " +
      "the canonical row onto the replacement token. No scheduled " +
      "reconciliation pass exists, and receipt verification cannot recreate " +
      "a missed commerce event.",
  },
  horizon: {
    supportsInitialValidation: true,
    supportsServerNotifications: false,
    supportsSubscriptions: false,
    supportsRenewalEvents: false,
    supportsRefundEvents: false,
    supportsExpiration: false,
    supportsReconciliation: false,
    supportsEntitlements: true,
    supportsRevenueAmount: false,
    notes:
      "Only the Graph verify_entitlement endpoint is integrated: a one-shot " +
      "check that the viewer owns the SKU. Meta publishes subscription and " +
      "order webhook fields and a subscriptions read API; IAPKit uses " +
      "neither, so it sees no renewal or expiration signal and keeps no " +
      "canonical subscription record. Entitlement is answerable only at the " +
      "moment it is asked.",
  },
  amazon: {
    supportsInitialValidation: true,
    supportsServerNotifications: true,
    supportsSubscriptions: true,
    supportsRenewalEvents: true,
    supportsRefundEvents: true,
    supportsExpiration: true,
    supportsReconciliation: true,
    supportsEntitlements: true,
    supportsRevenueAmount: false,
    notes:
      "Signed Amazon RTN notifications trigger fresh RVS verification and " +
      "update canonical subscriptions and commerce events. Rechecks become " +
      "due every 48 hours; a bounded worker runs every five minutes, so " +
      "backlog and retries can extend that interval. renewalDate is not expiry, " +
      "and auto-renew off retains access until RVS removes it. RVS supplies " +
      "no authoritative charge amount. App Tester does not exercise RTN; " +
      "live subscription lifecycle certification remains separate.",
  },
};

/** Stores that can produce normalized subscription lifecycle events today. */
export function storesWithLifecycleEvents(): CommerceStore[] {
  return (Object.keys(PROVIDER_CAPABILITIES) as CommerceStore[]).filter(
    (store) => PROVIDER_CAPABILITIES[store].supportsSubscriptions,
  );
}
