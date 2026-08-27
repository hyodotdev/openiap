import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  COMMERCE_EVENT_SCHEMA_VERSION,
  COMMERCE_EVENT_TYPES,
  MAX_EXTENSION_ENTRIES,
  MAX_EXTENSION_KEY_LENGTH,
  MAX_EXTENSION_VALUE_LENGTH,
  commerceEventTypeForTransition,
  sanitizeExtensions,
  type LifecycleTransition,
} from "./contract";
import {
  PROVIDER_CAPABILITIES,
  storesWithLifecycleEvents,
} from "./capabilities";
import { SIGNATURE_TOLERANCE_SECONDS } from "./signing";

describe("commerceEventTypeForTransition", () => {
  it("keeps every public receiver vocabulary in sync", () => {
    const contractSections = [
      sectionBetween(
        readFileSync(
          new URL("../../COMMERCE-EVENTS.md", import.meta.url),
          "utf8",
        ),
        "The event types are",
        "For an Apple",
      ),
      sectionBetween(
        readFileSync(
          new URL(
            "../../src/pages/docs/sections/webhooks.tsx",
            import.meta.url,
          ),
          "utf8",
        ),
        "Supported event types are:",
        "See the",
      ),
      sectionBetween(
        readFileSync(
          new URL("../../../docs/src/pages/docs/webhooks.tsx", import.meta.url),
          "utf8",
        ),
        "Event types are:",
        "Read the",
      ),
    ];

    for (const section of contractSections) {
      const eventTypes =
        section.match(/\b(?:subscription|entitlement)\.[a-z_]+\b/g) ?? [];
      expect(new Set(eventTypes).size).toBe(eventTypes.length);
      expect([...eventTypes].sort()).toEqual([...COMMERCE_EVENT_TYPES].sort());
    }
  });

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
      "Deferred",
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

  it("keeps the receiver timestamp window aligned with signing policy", () => {
    const publicContracts = [
      new URL("../../COMMERCE-EVENTS.md", import.meta.url),
      new URL("../../src/pages/docs/sections/webhooks.tsx", import.meta.url),
      new URL("../../../docs/src/pages/docs/webhooks.tsx", import.meta.url),
    ].map((url) => readFileSync(url, "utf8"));
    const tolerance = new RegExp(
      `(?:<=|&lt;=|>)\\s*${SIGNATURE_TOLERANCE_SECONDS}\\b`,
    );

    for (const contract of publicContracts) {
      expect(contract).toMatch(tolerance);
    }
  });
});

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Missing public contract markers: ${start} -> ${end}`);
  }
  return source.slice(startIndex, endIndex);
}

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

  it("drops invalid entries that slipped past the type", () => {
    const dirty = {
      good: "ok",
      "": "empty-key",
      ["x".repeat(MAX_EXTENSION_KEY_LENGTH + 1)]: "oversized-key",
      bad: 42,
    } as unknown as Record<string, string>;
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
    expect(amazon.supportsEntitlements).toBe(true);
    expect(amazon.notes).toContain("48 hours");
    expect(amazon.notes).toContain("every five minutes");
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
