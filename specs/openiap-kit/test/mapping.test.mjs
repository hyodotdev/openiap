// The store mapping is the artifact an implementer follows instead of
// reverse-engineering a backend. These tests check it is complete, internally
// consistent, and honest about the stores that can produce nothing.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Ajv from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import {
  KNOWN_COMMERCE_EVENT_TYPES,
  KNOWN_STORES,
  SUBSCRIPTION_STATES,
  bundleSchema,
} from "../src/index.mjs";

const mapping = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../examples/store-event-mapping.json", import.meta.url),
    ),
    "utf8",
  ),
);

const validator = () => {
  const ajv = new Ajv({ strict: true, allErrors: true });
  ajv.addSchema(bundleSchema, "bundle");
  return ajv.getSchema("bundle#/$defs/StoreEventMapping");
};

const allMappings = Object.values(mapping.stores).flatMap((s) => s.mappings);
const wireKey = (row) =>
  `${row.storeNotificationCode ?? row.storeNotification}|${row.storeSubtype ?? ""}`;
const groupByWireKey = (entry) => {
  const groups = {};
  for (const row of entry.mappings) {
    (groups[wireKey(row)] ??= []).push(row);
  }
  return groups;
};

describe("store event mapping", () => {
  it("validates against the schema, offline", () => {
    const validate = validator();
    const ok = validate(mapping);
    expect(validate.errors ?? [], JSON.stringify(validate.errors)).toEqual([]);
    expect(ok).toBe(true);
  });

  const reject = (mutate) => {
    const doc = JSON.parse(JSON.stringify(mapping));
    mutate(doc);
    const validate = validator();
    expect(validate(doc)).toBe(false);
  };

  it("rejects a row that is both conditional on history and on prior state", () => {
    // The two conditions are mutually exclusive: the first says there is no
    // history to have a state in.
    reject((doc) => {
      doc.stores.apple.mappings[0].whenPreviousState = ["Active"];
    });
  });

  it("rejects whenNoPriorStoreEvent set to false rather than omitted", () => {
    reject((doc) => {
      doc.stores.apple.mappings[0].whenNoPriorStoreEvent = false;
    });
  });

  it("rejects an event that is not a namespaced token", () => {
    reject((doc) => {
      doc.stores.apple.mappings[0].event = "Started";
    });
  });

  it("rejects a member the row schema does not declare", () => {
    reject((doc) => {
      doc.stores.apple.mappings[0].whenTuesday = true;
    });
  });

  it("rejects a derivable event that is not a known token shape", () => {
    reject((doc) => {
      doc.stores.horizon.derivableByPolling = ["Granted"];
    });
  });

  it("rejects an empty mapping table with no explanation", () => {
    reject((doc) => {
      doc.stores.horizon = { notificationChannel: null, mappings: [] };
    });
  });

  it("covers every store this version names", () => {
    expect(Object.keys(mapping.stores).sort()).toEqual(
      [...KNOWN_STORES].sort(),
    );
  });

  it("emits only event types the specification declares", () => {
    for (const m of allMappings) {
      if (m.event === null) continue;
      expect(KNOWN_COMMERCE_EVENT_TYPES, m.storeNotification).toContain(
        m.event,
      );
    }
  });

  it("gives every subscription event type at least one store that produces it", () => {
    const produced = new Set(allMappings.map((m) => m.event).filter(Boolean));
    const unreachable = KNOWN_COMMERCE_EVENT_TYPES.filter(
      (t) => t.startsWith("subscription.") && !produced.has(t),
    );
    // An event type no store can ever produce is a taxonomy that outran reality.
    expect(unreachable).toEqual([]);
  });

  it("does not claim entitlement events come from a store notification", () => {
    // Entitlement events are derived from the gate flipping, never mapped 1:1
    // from a store notification.
    for (const m of allMappings) {
      expect(m.event ?? "").not.toMatch(/^entitlement\./);
    }
  });

  // The example is validated above, so the rule only needs its rejection: a
  // third party's table must carry a reason too, not just ours.
  it("rejects mapped notifications on a store that publishes none", () => {
    const table = structuredClone(mapping);
    const store = Object.keys(table.stores)[0];
    table.stores[store] = {
      notificationChannel: null,
      notes: "no channel",
      mappings: [
        { storeNotification: "X", event: "subscription.renewed", notes: "y" },
      ],
    };
    expect(validator()(table)).toBe(false);
  });

  it("rejects a lifecycle event claimed as derivable by polling", () => {
    const table = structuredClone(mapping);
    const store = Object.keys(table.stores)[0];
    table.stores[store].derivableByPolling = ["subscription.renewed"];
    expect(validator()(table)).toBe(false);
  });

  it("rejects a row that emits nothing without saying why", () => {
    const row = allMappings.find((m) => m.event === null);
    expect(row, "no null-event row to test with").toBeTruthy();
    const { notes: _dropped, ...withoutReason } = row;
    const table = structuredClone(mapping);
    table.stores[Object.keys(table.stores)[0]].mappings = [withoutReason];
    expect(validator()(table)).toBe(false);
  });

  it("explains every store that has no notification channel", () => {
    for (const [store, entry] of Object.entries(mapping.stores)) {
      if (entry.notificationChannel === null) {
        expect(entry.mappings, `${store} cannot map anything`).toEqual([]);
      }
    }
  });

  it("uses a subtype wherever one type maps to two different outcomes", () => {
    for (const entry of Object.values(mapping.stores)) {
      // Selection is by the actual wire value and subtype; a prior-state
      // condition then refines within that pair.
      const byType = groupByWireKey(entry);
      for (const [type, list] of Object.entries(byType)) {
        if (list.length > 1) {
          // Two rows for one notification type are only unambiguous when
          // something separates them: a store subtype, or the prior state.
          const keys = new Set(
            list.map(
              (m) =>
                `${m.whenNoPriorStoreEvent ? "no-history" : ""}|${(m.whenPreviousState ?? []).join(",")}`,
            ),
          );
          expect(keys.size, `${type} rows must be distinguishable`).toBe(
            list.length,
          );
          const defaults = list.filter(
            (m) => !m.whenPreviousState && !m.whenNoPriorStoreEvent,
          );
          expect(
            defaults.length,
            `${type} may have at most one unconditional row`,
          ).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("orders conditional rows before the unconditional one they refine", () => {
    for (const entry of Object.values(mapping.stores)) {
      // Ordering is per (notification, subtype): one notification can carry
      // several subtypes, each with its own conditional and default rows.
      const seenDefault = new Set();
      for (const m of entry.mappings) {
        const key = wireKey(m);
        if (!m.whenPreviousState && !m.whenNoPriorStoreEvent) {
          seenDefault.add(key);
        } else {
          expect(
            seenDefault.has(key),
            `${key}: the conditional row must come first`,
          ).toBe(false);
        }
      }
    }
  });

  it("describes history conditions as store history, not record existence", () => {
    for (const row of allMappings) {
      expect(row.notes ?? "", row.storeNotification).not.toMatch(
        /(?:no|existing|retained) record|record that is still there/i,
      );
    }
  });

  it("detects duplicate wire codes even when their documentation labels differ", () => {
    const google = structuredClone(mapping.stores.google);
    const renewed = google.mappings.find(
      (row) => row.storeNotification === "SUBSCRIPTION_RENEWED",
    );
    renewed.storeNotificationCode = "4";

    const duplicated = groupByWireKey(google)["4|"];
    expect(duplicated).toHaveLength(3);
    expect(
      duplicated.filter(
        (row) => !row.whenPreviousState && !row.whenNoPriorStoreEvent,
      ),
    ).toHaveLength(2);
  });

  it("maps only subscription voids, not one-time Google purchases", () => {
    const voided = mapping.stores.google.mappings.filter(
      (row) => row.storeNotification === "voidedPurchaseNotification",
    );
    expect(voided).toEqual([
      expect.objectContaining({
        storeSubtype: "1",
        event: "subscription.refunded",
      }),
    ]);
    expect(voided.some((row) => row.storeSubtype == null)).toBe(false);
    expect(voided.some((row) => row.storeSubtype === "2")).toBe(false);
  });

  it("uses only declared subscription states in a condition", () => {
    for (const m of allMappings) {
      for (const state of m.whenPreviousState ?? []) {
        expect(SUBSCRIPTION_STATES).toContain(state);
      }
    }
  });

  it("names no implementation's internal vocabulary", () => {
    const raw = JSON.stringify(mapping);
    for (const internal of [
      "SubscriptionStarted",
      "SubscriptionRenewed",
      "SubscriptionInGracePeriod",
      "MetaHorizonReconciler",
    ]) {
      expect(raw).not.toContain(internal);
    }
  });

  it("says what a store with no notification channel can still derive", () => {
    for (const [store, entry] of Object.entries(mapping.stores)) {
      if (entry.notificationChannel !== null) continue;
      // A store that pushes nothing is not automatically a store with no
      // possible signal. Saying which is which is the honest part.
      expect(entry.derivableByPolling, `${store}`).toBeDefined();
      for (const event of entry.derivableByPolling) {
        expect(KNOWN_COMMERCE_EVENT_TYPES, `${store}: ${event}`).toContain(
          event,
        );
      }
    }
  });

  it("never claims a subscription lifecycle event is derivable by polling", () => {
    // Polling reveals that access changed, never which lifecycle transition
    // caused it. Claiming otherwise would invent semantics the store never gave.
    for (const entry of Object.values(mapping.stores)) {
      for (const event of entry.derivableByPolling ?? []) {
        expect(event.startsWith("entitlement.")).toBe(true);
      }
    }
  });
});
