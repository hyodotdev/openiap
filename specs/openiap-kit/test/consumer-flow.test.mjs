// The walkthrough in SPEC.md §11 makes claims about the example payloads. If an
// example changes, the prose must stop being true loudly rather than quietly.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Ajv from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import { bundleSchema } from "../src/index.mjs";

const at = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const example = (n) => JSON.parse(readFileSync(at(`examples/${n}`), "utf8"));
const spec = readFileSync(at("SPEC.md"), "utf8");

describe("the walkthrough matches the examples it cites", () => {
  it("the renewal is store-authoritative revenue", () => {
    const e = example("subscription-renewed.json");
    expect(e.eventType).toBe("subscription.renewed");
    expect(e.price.provenance).toBe("store");
    expect(e.price.amountMicros).toBe(9_990_000);
    expect(e.price.currency).toBe("USD");
    // The three fences in SPEC.md 9.5 narrate one subscription; the prose reasons
    // on both members and nothing else pinned them.
    expect(e.subscription.active).toBe(true);
    expect(e.subscription.expiresAt).toBe(
      example("subscription-canceled.json").subscription.expiresAt,
    );
  });

  it("the cancellation keeps the customer entitled", () => {
    const e = example("subscription-canceled.json");
    expect(e.eventType).toBe("subscription.canceled");
    // The whole point of the section: canceled, still Active, still entitled.
    expect(e.subscription.state).toBe("Active");
    expect(e.subscription.active).toBe(true);
    expect(e.subscription.willRenew).toBe(false);
  });

  it("the cancellation is still inside its paid window when it was derived", () => {
    // SPEC.md 2.3 evaluates the predicate at processedAt, so that is the
    // instant `active: true` has to be true at — not occurredAt.
    const e = example("subscription-canceled.json");
    expect(e.subscription.expiresAt).toBeGreaterThan(e.processedAt);
    expect(e.subscription.active).toBe(true);
  });

  it("the revocation is where access actually ends", () => {
    const e = example("entitlement-revoked.json");
    expect(e.eventType).toBe("entitlement.revoked");
    expect(e.subscription.active).toBe(false);
    expect(e.subscription.state).toBe("Expired");
  });

  it("the three events describe one subscription in order", () => {
    const [renewed, canceled, revoked] = [
      "subscription-renewed.json",
      "subscription-canceled.json",
      "entitlement-revoked.json",
    ].map(example);
    for (const e of [renewed, canceled, revoked]) {
      expect(e.productId).toBe("premium.monthly");
      expect(e.userId).toBe("user_5e91a7");
      expect(e.projectId).toBe("proj_7f3a9c");
      // One subscription cannot change store mid-life. Omitting this let the
      // walkthrough narrate an Apple renewal followed by a Google cancellation.
      expect(e.store).toBe("apple");
      expect(e.originalTransactionId).toBe(renewed.originalTransactionId);
    }
    expect(renewed.occurredAt).toBeLessThan(canceled.occurredAt);
    expect(canceled.occurredAt).toBeLessThan(revoked.occurredAt);
  });

  it("revocation happens at the expiry the cancellation announced", () => {
    const canceled = example("subscription-canceled.json");
    const revoked = example("entitlement-revoked.json");
    expect(revoked.occurredAt).toBe(canceled.subscription.expiresAt);
  });

  it("the section cites every example it shows", () => {
    for (const file of [
      "examples/subscription-renewed.json",
      "examples/subscription-canceled.json",
      "examples/entitlement-revoked.json",
    ]) {
      expect(spec).toContain(file);
    }
  });
});

describe("a store with no canonical subscription record", () => {
  // SPEC.md 10 and 9.5 both hinge on this shape, and every other example carries
  // a subscription member — so the shape the prose depends on had no fixture.
  const event = example("entitlement-granted-no-subscription.json");

  it("still decides access, through the event type", () => {
    // Only an entitlement event carries the decision this way; a lifecycle
    // event without a snapshot would carry none, which is why the fixture is
    // an entitlement one.
    expect(event.eventType).toBe("entitlement.granted");
    expect(event.subscription).toBeUndefined();
  });

  it("carries no price, because the store asserts none", () => {
    expect(event.price).toBeUndefined();
  });

  it("names a store the capability matrix declares has no subscriptions", () => {
    const caps = JSON.parse(
      readFileSync(`${at("examples")}/provider-capabilities.json`, "utf8"),
    );
    expect(caps.stores[event.store].subscriptions.implementation).toBe(false);
  });

  it("is the shape SPEC.md describes, and validates as one", () => {
    expect(spec).toContain("no `subscription` member");
    // The prose is only worth anything if the shape it describes is legal.
    const ajv = new Ajv({ strict: true, allErrors: true });
    ajv.addSchema(bundleSchema, "bundle");
    const validate = ajv.getSchema("bundle#/$defs/CommerceEvent");
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
  });
});
