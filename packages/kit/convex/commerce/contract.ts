// Canonical normalized commerce event contract. Consumers (analytics
// pipelines, SaaS platforms, custom backends) read these events and never
// need to parse an Apple ASN or Google RTDN payload.
//
// Event types reuse the transitions in `subscriptions/stateMachine.ts`; a
// parallel taxonomy would drift. Store-specific detail goes under
// `extensions`, never in the canonical fields.
//
// Contract values are imported from the protocol, never restated. Values a
// receiver decodes are pinned as goldens in kit's tests, so a protocol rename
// fails on purpose.

import { $defs } from "@hyodotdev/openiap-commerce-protocol/generated/schemas/primitives.schema.json";

import type { SubscriptionState } from "../webhooks/shared";
import type { SubscriptionTransitionKind } from "../subscriptions/stateMachine";

/**
 * Version of the emitted body; consumers pin on the major. The one contract
 * value kept as a literal, because its type narrows CommerceEvent.eventVersion.
 * A protocol bump fails spec.conformance.test.ts until this moves.
 */
export const COMMERCE_EVENT_SCHEMA_VERSION = "1.0" as const;

/** Event types IAPKit emits today; the protocol's own list is open. */
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
 * SPEC.md §9.1 emission rule, kept pure so the fan-out mutation and the
 * conformance adapter share one source. The lifecycle event (if any) comes
 * first; an entitlement event follows only when the gate flips and a user is
 * bound. At first binding (§2.4) the caller passes `previouslyActive: false`,
 * since the unbound baseline is not entitled, so an open gate yields exactly
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

/** The protocol's closed provenance enumeration. Never mix these silently. */
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

/** Stores IAPKit integrates; the protocol's store space is open. */
export const COMMERCE_STORES = [
  "apple",
  "google",
  "horizon",
  "amazon",
] as const;
export type CommerceStore = (typeof COMMERCE_STORES)[number];

/** Environments IAPKit's receivers observe; the protocol's space is open. */
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

// Extensions can be attacker-influenced. These bounds only limit the sanitizer
// and no receiver decodes them, so they follow the protocol: kit stays
// schema-valid whichever way the protocol moves them.
const extensionBounds = $defs.Extensions;
export const MAX_EXTENSION_ENTRIES = extensionBounds.maxProperties;
export const MAX_EXTENSION_KEY_LENGTH = extensionBounds.propertyNames.maxLength;
export const MAX_EXTENSION_VALUE_LENGTH =
  extensionBounds.additionalProperties.maxLength;

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
