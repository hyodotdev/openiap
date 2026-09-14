// The store axis is a claim about a third party's product, so nothing in this
// repository can verify it. What these tests can do is make it exist in one
// place, force every copy of it to agree, and make a negative claim expensive
// enough to be deliberate.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Ajv from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import { KNOWN_STORES, bundleSchema } from "../src/index.mjs";

const example = (name) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../examples/${name}`, import.meta.url)),
    ),
  );

const facts = example("store-facts.json");
const capabilities = example("provider-capabilities.json");
const mapping = example("store-event-mapping.json");

const validator = (root) => {
  const ajv = new Ajv({ strict: true, allErrors: true });
  ajv.addSchema(bundleSchema, "bundle");
  return ajv.getSchema(`bundle#/$defs/${root}`);
};

const AXES = Object.keys(bundleSchema.$defs.FactsStoreFact.properties);

const reject = (mutate) => {
  const doc = structuredClone(facts);
  mutate(doc);
  expect(validator("StoreFacts")(doc)).toBe(false);
};

describe("store facts", () => {
  it("validates against its own schema", () => {
    expect(validator("StoreFacts")(facts)).toBe(true);
  });

  it("covers every store this version names", () => {
    expect(Object.keys(facts.stores).sort()).toEqual([...KNOWN_STORES].sort());
  });

  it("answers every axis for every store", () => {
    for (const [store, entry] of Object.entries(facts.stores)) {
      expect(Object.keys(entry).sort(), store).toEqual([...AXES].sort());
    }
  });

  it("rejects a surface that qualifies an unavailable capability", () => {
    reject((doc) => {
      doc.stores.horizon.refundEvents.surface = "Get X";
    });
  });

  it("rejects a fact whose availability and delivery disagree", () => {
    reject((doc) => {
      doc.stores.apple.expiration = {
        available: false,
        delivery: "push",
        notes: "x",
      };
    });
    reject((doc) => {
      doc.stores.apple.expiration = {
        available: true,
        delivery: "none",
        surface: "x",
      };
    });
  });

  it("rejects an available capability with no surface", () => {
    reject((doc) => {
      delete doc.stores.apple.expiration.surface;
    });
  });

  it("rejects an unavailable capability with no explanation", () => {
    reject((doc) => {
      doc.stores.apple.expiration = { available: false, delivery: "none" };
    });
  });

  it("accepts a store this version does not name, since the space is open", () => {
    const doc = structuredClone(facts);
    doc.stores.nintendo = doc.stores.apple;
    expect(validator("StoreFacts")(doc)).toBe(true);
  });
});

describe("the store axis has one source", () => {
  it("gives the capability descriptor the same axes", () => {
    // Adding an axis to one document and not the other would leave a descriptor
    // asserting a store fact this table never stated.
    const declared = Object.keys(
      bundleSchema.$defs.CapabilitiesStoreCapabilities.properties,
    );
    expect([...declared].sort()).toEqual([...AXES].sort());
  });

  it("matches every provider value in the capability descriptor", () => {
    // `provider` answers the same question as `available`. A descriptor is free
    // to say what it implements; it is not free to invent what a store offers.
    for (const [store, entry] of Object.entries(capabilities.stores)) {
      expect(facts.stores, `${store} has no store-facts entry`).toHaveProperty(
        store,
      );
      for (const [axis, support] of Object.entries(entry)) {
        expect(
          support.provider,
          `${store}.${axis}: descriptor disagrees with store-facts.json`,
        ).toBe(facts.stores[store][axis].available);
      }
    }
  });

  it("matches the notification channel the mapping table names", () => {
    for (const [store, entry] of Object.entries(mapping.stores)) {
      expect(facts.stores, `${store} has no store-facts entry`).toHaveProperty(
        store,
      );
      const fact = facts.stores[store].serverNotifications;
      expect(
        entry.notificationChannel,
        `${store}: mapping disagrees with store-facts.json`,
      ).toBe(fact.available ? fact.surface : null);
    }
  });
});
