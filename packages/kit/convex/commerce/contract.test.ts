import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  COMMERCE_EVENT_SCHEMA_VERSION,
  COMMERCE_EVENT_TYPES,
  MAX_EXTENSION_ENTRIES,
  MAX_EXTENSION_KEY_LENGTH,
  MAX_EXTENSION_VALUE_LENGTH,
  sanitizeExtensions,
} from "./contract";
import {
  PROVIDER_CAPABILITIES,
  storesWithLifecycleEvents,
} from "./capabilities";
import {
  CONTENT_TYPE,
  DELIVERY_ID_HEADER,
  EVENT_ID_HEADER,
  SIGNATURE_HEADER,
  SIGNATURE_PREFIX,
  SIGNATURE_TOLERANCE_SECONDS,
  TIMESTAMP_HEADER,
} from "./signing";

describe("the public receiver contract stays in sync", () => {
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
    ];

    for (const section of contractSections) {
      const eventTypes =
        section.match(/\b(?:subscription|entitlement)\.[a-z_]+\b/g) ?? [];
      expect(new Set(eventTypes).size).toBe(eventTypes.length);
      expect([...eventTypes].sort()).toEqual([...COMMERCE_EVENT_TYPES].sort());
    }
  });

  it("pins the schema version so consumers can pin on the major", () => {
    expect(COMMERCE_EVENT_SCHEMA_VERSION).toBe("1.0");
  });

  it("pins the wire identities deployed receivers already decode", () => {
    // These names are derived from the protocol's transport record, so nothing
    // here restates them in shipped code. This golden is the record of what
    // receivers were told, and a protocol rename must fail it on purpose:
    // decide the migration — dual-emit, new destinations only, cutover — and
    // then move the pin. spec.conformance.test.ts covers the other direction.
    expect({
      signature: SIGNATURE_HEADER,
      timestamp: TIMESTAMP_HEADER,
      eventId: EVENT_ID_HEADER,
      deliveryId: DELIVERY_ID_HEADER,
      contentType: CONTENT_TYPE,
    }).toEqual({
      signature: "openiap-signature",
      timestamp: "openiap-timestamp",
      eventId: "openiap-event-id",
      deliveryId: "openiap-delivery-id",
      contentType: "application/json",
    });
  });

  it("pins the signature prefix, the protocol's algorithm marker", () => {
    // SPEC.md 9.4.2 makes the prefix the algorithm-agility marker and receivers
    // compare whole `v1=` values, so moving to `v2=` is a migration.
    expect(SIGNATURE_PREFIX).toBe("v1=");
  });

  it("keeps the receiver timestamp window aligned with signing policy", () => {
    const tolerance = new RegExp(
      `(?:<=|&lt;=|>)\\s*${SIGNATURE_TOLERANCE_SECONDS}\\b`,
    );

    for (const contract of publicReceiverContracts()) {
      expect(contract).toMatch(tolerance);
    }
  });

  it("teaches receivers the header names and prefix kit actually sends", () => {
    // These documents tell an integrator what to verify. Without this they
    // keep teaching the old spelling after a rename, and the reader's
    // signature check fails against a kit that already moved.
    for (const contract of publicReceiverContracts()) {
      for (const name of [
        SIGNATURE_HEADER,
        TIMESTAMP_HEADER,
        EVENT_ID_HEADER,
        DELIVERY_ID_HEADER,
      ]) {
        expect(contract, `${name} is undocumented`).toContain(name);
      }
      expect(contract).toContain(SIGNATURE_PREFIX);
    }
  });
});

/** The documents that tell an integrator how to verify a delivery. */
function publicReceiverContracts(): string[] {
  return [
    new URL("../../COMMERCE-EVENTS.md", import.meta.url),
    new URL("../../src/pages/docs/sections/webhooks.tsx", import.meta.url),
    new URL(
      "../../../docs/src/pages/commerce-protocol/webhooks.tsx",
      import.meta.url,
    ),
  ].map((url) => readFileSync(url, "utf8"));
}

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
