// Canonical normalized commerce event contract.
//
// This is the consumer-facing surface: analytics pipelines, SaaS platforms and
// custom backends read these events and must never need to parse an Apple ASN
// or a Google RTDN payload to learn what happened.
//
// The vocabulary deliberately reuses the lifecycle transitions the subscription
// state machine already produces (`subscriptions/stateMachine.ts`) instead of
// inventing a parallel taxonomy — one semantic model, two spellings would drift.
//
// Store-specific detail lives under `extensions`, never in the canonical fields.

import type { SubscriptionState } from "../webhooks/shared";

/**
 * Bumped only when a field changes meaning or disappears. Additive optional
 * fields keep the same major version, so consumers can pin on the major and
 * still receive new data.
 */
export const COMMERCE_EVENT_SCHEMA_VERSION = "1.0" as const;

export type CommerceEventType =
  | "subscription.started"
  | "subscription.renewed"
  | "subscription.recovered"
  | "subscription.entered_grace_period"
  | "subscription.entered_billing_retry"
  | "subscription.expired"
  | "subscription.canceled"
  | "subscription.uncanceled"
  | "subscription.revoked"
  | "subscription.refunded"
  | "subscription.product_changed"
  | "subscription.price_changed"
  | "subscription.paused"
  | "subscription.resumed"
  | "entitlement.granted"
  | "entitlement.revoked";

export const COMMERCE_EVENT_TYPES: readonly CommerceEventType[] = [
  "subscription.started",
  "subscription.renewed",
  "subscription.recovered",
  "subscription.entered_grace_period",
  "subscription.entered_billing_retry",
  "subscription.expired",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.revoked",
  "subscription.refunded",
  "subscription.product_changed",
  "subscription.price_changed",
  "subscription.paused",
  "subscription.resumed",
  "entitlement.granted",
  "entitlement.revoked",
] as const;

/** Lifecycle transition kinds emitted by the subscription state machine. */
export type LifecycleTransition =
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
  | "Ignored";

const TRANSITION_TO_EVENT: Record<
  LifecycleTransition,
  CommerceEventType | null
> = {
  Started: "subscription.started",
  Renewed: "subscription.renewed",
  Recovered: "subscription.recovered",
  EnteredGracePeriod: "subscription.entered_grace_period",
  EnteredBillingRetry: "subscription.entered_billing_retry",
  Expired: "subscription.expired",
  Canceled: "subscription.canceled",
  Uncanceled: "subscription.uncanceled",
  Revoked: "subscription.revoked",
  Refunded: "subscription.refunded",
  ProductChanged: "subscription.product_changed",
  PriceChanged: "subscription.price_changed",
  Paused: "subscription.paused",
  Resumed: "subscription.resumed",
  // Recorded for audit but semantically a no-op; emitting it would make
  // consumers count redeliveries as lifecycle activity.
  Ignored: null,
};

export function commerceEventTypeForTransition(
  transition: LifecycleTransition | null,
): CommerceEventType | null {
  if (!transition) return null;
  return TRANSITION_TO_EVENT[transition] ?? null;
}

/** Where a monetary or temporal value came from. Never mix these silently. */
export type DataProvenance =
  | "store" // the store asserted it in a signed notification or API response
  | "catalog" // resolved from the project's own product catalog
  | "inferred"; // derived by IAPKit from other fields

export type CommerceMoney = {
  currency: string;
  amountMicros: number;
  provenance: DataProvenance;
};

export type CommerceStore = "apple" | "google" | "horizon" | "amazon";

export type CommerceEnvironment = "production" | "sandbox" | "xcode";

export type CommerceSubscriptionSnapshot = {
  state: SubscriptionState;
  productId: string;
  expiresAt?: number;
  renewsAt?: number;
  willRenew?: boolean;
  cancellationReason?: string;
  /** Entitlement gate after this event. The single field consumers should read. */
  active: boolean;
};

export type CommerceEvent = {
  eventId: string;
  eventType: CommerceEventType;
  eventVersion: typeof COMMERCE_EVENT_SCHEMA_VERSION;
  occurredAt: number;
  processedAt: number;

  store: CommerceStore;
  environment: CommerceEnvironment;

  projectId: string;
  applicationId?: string;
  userId?: string;

  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;

  subscription?: CommerceSubscriptionSnapshot;
  price?: CommerceMoney;

  /** Store notification this event was derived from, for support triage. */
  sourceStoreEventId?: string;

  /**
   * Provider-specific fields that have no canonical equivalent. Bounded and
   * string-valued so the payload stays predictable for downstream consumers.
   */
  extensions?: Record<string, string>;
};

/** Extensions are attacker-influenced in the limit; keep them small and flat. */
export const MAX_EXTENSION_ENTRIES = 24;
export const MAX_EXTENSION_VALUE_LENGTH = 512;

export function sanitizeExtensions(
  input: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!input) return undefined;
  const entries = Object.entries(input)
    .filter(([key, value]) => key.length > 0 && typeof value === "string")
    .slice(0, MAX_EXTENSION_ENTRIES)
    .map(
      ([key, value]) =>
        [key, value.slice(0, MAX_EXTENSION_VALUE_LENGTH)] as const,
    );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
