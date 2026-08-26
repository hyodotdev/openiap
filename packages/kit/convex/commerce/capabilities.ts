// Per-provider capability declarations.
//
// These describe what IAPKit *actually implements today*, not what a store's
// API theoretically allows. Consumers branch on this instead of assuming every
// store behaves like Apple, and support can answer "why is there no renewal
// event for Meta" without reading provider code.
//
// Keep in sync with the provider modules; `capabilities.test.ts` pins the
// claims that have a concrete implementation behind them.

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
      "retry window is not self-healing; re-verifying the receipt repairs it.",
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
      "upgrade/downgrade, and the linkedPurchaseToken chain is only readable " +
      "through a follow-up Play Developer API call the receiver deliberately " +
      "does not make, so one logical subscription can split across rows until " +
      "a reconciliation pass merges them. That pass is not implemented.",
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
      "check that the viewer owns the SKU. Meta exposes no server " +
      "notifications to IAPKit, so there is no renewal, expiration or refund " +
      "signal and no canonical subscription record. Entitlement is answerable " +
      "only at the moment it is asked.",
  },
  amazon: {
    supportsInitialValidation: true,
    supportsServerNotifications: false,
    supportsSubscriptions: false,
    supportsRenewalEvents: false,
    supportsRefundEvents: false,
    supportsExpiration: false,
    supportsReconciliation: true,
    supportsEntitlements: false,
    supportsRevenueAmount: false,
    notes:
      "RVS validates receipts and a five-minute cron re-checks active ones, " +
      "which catches cancellation after the fact. RVS alone does not carry " +
      "enough lifecycle detail for a canonical subscription record, so no " +
      "subscription rows or lifecycle events are produced.",
  },
};

/** Stores that can produce normalized subscription lifecycle events today. */
export function storesWithLifecycleEvents(): CommerceStore[] {
  return (Object.keys(PROVIDER_CAPABILITIES) as CommerceStore[]).filter(
    (store) => PROVIDER_CAPABILITIES[store].supportsSubscriptions,
  );
}
