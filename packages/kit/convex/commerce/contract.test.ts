import { describe, expect, it } from "vitest";

import {
  COMMERCE_EVENT_SCHEMA_VERSION,
  COMMERCE_EVENT_TYPES,
  MAX_EXTENSION_ENTRIES,
  MAX_EXTENSION_VALUE_LENGTH,
  commerceEventTypeForTransition,
  sanitizeExtensions,
  type LifecycleTransition,
} from "./contract";
import {
  PROVIDER_CAPABILITIES,
  storesWithLifecycleEvents,
} from "./capabilities";

describe("commerceEventTypeForTransition", () => {
  it("maps every state-machine transition except Ignored", () => {
    const transitions: LifecycleTransition[] = [
      "Started",
      "Renewed",
      "Recovered",
      "EnteredGracePeriod",
      "EnteredBillingRetry",
      "Expired",
      "Canceled",
      "Uncanceled",
      "Revoked",
      "Refunded",
      "ProductChanged",
      "PriceChanged",
      "Paused",
      "Resumed",
    ];
    for (const transition of transitions) {
      expect(commerceEventTypeForTransition(transition)).not.toBeNull();
    }
  });

  it("does not emit an event for a no-op transition", () => {
    expect(commerceEventTypeForTransition("Ignored")).toBeNull();
    expect(commerceEventTypeForTransition(null)).toBeNull();
  });

  it("only produces types declared in the public list", () => {
    const mapped = commerceEventTypeForTransition("Renewed");
    expect(COMMERCE_EVENT_TYPES).toContain(mapped);
  });

  it("pins the schema version so consumers can pin on the major", () => {
    expect(COMMERCE_EVENT_SCHEMA_VERSION).toBe("1.0");
  });
});

describe("sanitizeExtensions", () => {
  it("passes through a small flat map", () => {
    expect(sanitizeExtensions({ campaign: "spring" })).toEqual({
      campaign: "spring",
    });
  });

  it("returns undefined for empty input", () => {
    expect(sanitizeExtensions(undefined)).toBeUndefined();
    expect(sanitizeExtensions({})).toBeUndefined();
  });

  it("bounds the entry count", () => {
    const oversized = Object.fromEntries(
      Array.from({ length: MAX_EXTENSION_ENTRIES + 10 }, (_, i) => [
        `k${i}`,
        "v",
      ]),
    );
    expect(Object.keys(sanitizeExtensions(oversized) ?? {})).toHaveLength(
      MAX_EXTENSION_ENTRIES,
    );
  });

  it("truncates oversized values instead of dropping the key", () => {
    const long = "x".repeat(MAX_EXTENSION_VALUE_LENGTH + 50);
    const result = sanitizeExtensions({ note: long });
    expect(result?.note).toHaveLength(MAX_EXTENSION_VALUE_LENGTH);
  });

  it("drops non-string values that slipped past the type", () => {
    const dirty = { good: "ok", bad: 42 } as unknown as Record<string, string>;
    expect(sanitizeExtensions(dirty)).toEqual({ good: "ok" });
  });
});

describe("provider capabilities", () => {
  it("only claims lifecycle events for stores with server notifications", () => {
    for (const [store, caps] of Object.entries(PROVIDER_CAPABILITIES)) {
      if (caps.supportsSubscriptions) {
        expect(
          caps.supportsServerNotifications,
          `${store} claims subscriptions without notifications`,
        ).toBe(true);
      }
    }
  });

  it("records Meta/Horizon as verification-only", () => {
    const horizon = PROVIDER_CAPABILITIES.horizon;
    expect(horizon.supportsInitialValidation).toBe(true);
    expect(horizon.supportsServerNotifications).toBe(false);
    expect(horizon.supportsSubscriptions).toBe(false);
    expect(horizon.supportsRenewalEvents).toBe(false);
    expect(horizon.supportsRevenueAmount).toBe(false);
  });

  it("records Amazon as validated-and-reconciled but not subscription-capable", () => {
    const amazon = PROVIDER_CAPABILITIES.amazon;
    expect(amazon.supportsInitialValidation).toBe(true);
    expect(amazon.supportsReconciliation).toBe(true);
    expect(amazon.supportsSubscriptions).toBe(false);
  });

  it("does not claim reconciliation for Apple or Google, which have no cron", () => {
    expect(PROVIDER_CAPABILITIES.apple.supportsReconciliation).toBe(false);
    expect(PROVIDER_CAPABILITIES.google.supportsReconciliation).toBe(false);
  });

  it("explains every unsupported capability", () => {
    for (const caps of Object.values(PROVIDER_CAPABILITIES)) {
      expect(caps.notes.length).toBeGreaterThan(20);
    }
  });

  it("lists exactly the stores that emit lifecycle events", () => {
    expect(storesWithLifecycleEvents().sort()).toEqual(["apple", "google"]);
  });
});
