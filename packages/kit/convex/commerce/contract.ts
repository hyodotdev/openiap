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
import type { SubscriptionTransitionKind } from "../subscriptions/stateMachine";

/**
 * Bumped only when a field changes meaning or disappears. Additive optional
 * fields keep the same major version, so consumers can pin on the major and
 * still receive new data.
 */
export const COMMERCE_EVENT_SCHEMA_VERSION = "1.0" as const;

export const COMMERCE_EVENT_TYPES = [
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
  "subscription.deferred",
  "subscription.paused",
  "subscription.resumed",
  "entitlement.granted",
  "entitlement.revoked",
] as const;

export type CommerceEventType = (typeof COMMERCE_EVENT_TYPES)[number];

/** Lifecycle transition kinds emitted by the subscription state machine. */
export type LifecycleTransition = SubscriptionTransitionKind;

export const TRANSITION_TO_EVENT: Record<
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
  Deferred: "subscription.deferred",
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

/**
 * SPEC.md §9.1 emission rule as a pure decision, so the mutation that fans out
 * events and the conformance adapter that certifies the rule share one source.
 * The lifecycle event (if any) comes first; an entitlement event follows only
 * when the gate actually flips and a bound user exists to grant or revoke it.
 * At first binding (§2.4) the caller passes `previouslyActive: false` — the
 * unbound baseline is not entitled — so a currently-open gate yields exactly
 * one `entitlement.granted`.
 */
export function commerceEventTypesToEmit(args: {
  lifecycleType: CommerceEventType | null;
  active: boolean;
  previouslyActive: boolean;
  hasBoundUser: boolean;
}): CommerceEventType[] {
  const entitlementType: CommerceEventType | null =
    args.active === args.previouslyActive || !args.hasBoundUser
      ? null
      : args.active
        ? "entitlement.granted"
        : "entitlement.revoked";
  return [args.lifecycleType, entitlementType].filter(
    (type): type is CommerceEventType => type !== null,
  );
}

/** Where a monetary or temporal value came from. Never mix these silently. */
export const DATA_PROVENANCE_VALUES = [
  "store", // the store asserted it in a signed notification or API response
  "catalog", // resolved from the project's own product catalog
  "inferred", // derived by IAPKit from other fields
] as const;
export type DataProvenance = (typeof DATA_PROVENANCE_VALUES)[number];

export type CommerceMoney = {
  currency: string;
  amountMicros: number;
  provenance: DataProvenance;
};

export const COMMERCE_STORES = [
  "apple",
  "google",
  "horizon",
  "amazon",
] as const;
export type CommerceStore = (typeof COMMERCE_STORES)[number];

export const COMMERCE_ENVIRONMENTS = [
  "production",
  "sandbox",
  "xcode",
] as const;
export type CommerceEnvironment = (typeof COMMERCE_ENVIRONMENTS)[number];

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
  /** Previous canonical product when this lifecycle event applies a SKU switch. */
  previousProductId?: string;
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
export const MAX_EXTENSION_KEY_LENGTH = 64;
export const MAX_EXTENSION_VALUE_LENGTH = 512;

export function sanitizeExtensions(
  input: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!input) return undefined;
  const entries = Object.entries(input)
    .filter(
      ([key, value]) =>
        key.length > 0 &&
        key.length <= MAX_EXTENSION_KEY_LENGTH &&
        typeof value === "string",
    )
    .slice(0, MAX_EXTENSION_ENTRIES)
    .map(
      ([key, value]) =>
        [key, value.slice(0, MAX_EXTENSION_VALUE_LENGTH)] as const,
    );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
