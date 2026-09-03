// Guards the architectural constraint that this specification places no
// operational dependency on the OpenIAP project. Each test fails on a concrete
// regression, not on a claim in prose.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Ajv from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import { KNOWN_STORES, bundleSchema, schemas } from "../src/index.mjs";

const at = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const readExample = (n) =>
  JSON.parse(readFileSync(`${at("examples")}/${n}`, "utf8"));

/** A validator given ONLY the bundle. No sibling file, no network resolver. */
function offlineValidator(pointer) {
  const ajv = new Ajv({
    strict: true,
    allErrors: true,
    loadSchema: () => {
      throw new Error("remote schema resolution attempted");
    },
  });
  ajv.addSchema(bundleSchema, "bundle");
  return ajv.getSchema(`bundle#/$defs/${pointer}`);
}

describe("validation works offline", () => {
  it("the bundle contains no external reference", () => {
    const refs = JSON.stringify(bundleSchema).match(/"\$ref":"[^"]*"/g) ?? [];
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref, `${ref} must be local`).toMatch(/"\$ref":"#\//);
    }
  });

  it("validates a full event given only the bundle", () => {
    const validate = offlineValidator("CommerceEvent");
    expect(validate(readExample("subscription-renewed.json"))).toBe(true);
  });

  it("validates a capability document given only the bundle", () => {
    const validate = offlineValidator("ProviderCapabilities");
    expect(validate(readExample("provider-capabilities.json"))).toBe(true);
  });

  it("still rejects invalid documents when offline, so the bundle is not a weaker check", () => {
    const validate = offlineValidator("CommerceEvent");
    const bad = readExample("subscription-renewed.json");
    delete bad.projectId;
    expect(validate(bad)).toBe(false);
  });

  it("names no host other than as a schema identifier", () => {
    for (const schema of [...schemas, bundleSchema]) {
      const withoutId = { ...schema, $id: undefined };
      expect(JSON.stringify(withoutId)).not.toContain("openiap.dev");
    }
  });
});

describe("no central registry is required", () => {
  const validate = () => offlineValidator("CommerceEvent");

  it("accepts a store this version does not name, so adoption is not gated on a release", () => {
    const event = readExample("subscription-renewed.json");
    event.store = "a_store_openiap_has_never_heard_of";
    expect(validate()(event)).toBe(true);
  });

  it("still constrains the store token shape", () => {
    const event = readExample("subscription-renewed.json");
    event.store = "Not A Token";
    expect(validate()(event)).toBe(false);
  });

  it("names the four stores this version knows, without closing the space", () => {
    expect([...KNOWN_STORES].sort()).toEqual([
      "amazon",
      "apple",
      "google",
      "horizon",
    ]);
  });

  it("accepts a single-scope emitter using one constant scope", () => {
    const event = readExample("subscription-renewed.json");
    event.projectId = "default";
    delete event.applicationId;
    expect(validate()(event)).toBe(true);
  });

  it("accepts an event with no user binding at all", () => {
    const event = readExample("subscription-renewed.json");
    delete event.userId;
    expect(validate()(event)).toBe(true);
  });

  it("constrains no identifier to a registry-issued format", () => {
    const event = readExample("subscription-renewed.json");
    Object.assign(event, {
      eventId: "1",
      projectId: "x",
      userId: "urn:acme:customer:42",
    });
    expect(validate()(event)).toBe(true);
  });
});

describe("the published text makes no central claim", () => {
  const docs = ["SPEC.md", "README.md", "CONVENTION.md"].map((f) => [
    f,
    readFileSync(at(f), "utf8"),
  ]);

  it.each(docs)(
    "%s requires no hosted service or issued credential",
    (_f, text) => {
      // Prose is not a contract, but a rule stated nowhere is a rule nobody keeps.
      expect(text).not.toMatch(/must (register|sign up|obtain an api key)/i);
      expect(text).not.toMatch(/kit\.openiap\.dev/);
    },
  );

  // The monorepo sponsor block leaked in here once. sync-sponsors enrolls a
  // specification README only when it carries the block markers, and a spec
  // that names two of the four stores it specifies as its funders is not
  // vendor-neutral, so this test keeps both the markers and the prose out.
  it.each(docs)("%s carries no funding or sponsor content", (_f, text) => {
    expect(text).not.toMatch(/sponsor|backer|opencollective|paypal|@hyo\.dev/i);
  });

  it("SPEC.md states the guarantee normatively", () => {
    const spec = readFileSync(at("SPEC.md"), "utf8");
    expect(spec).toContain("## No central dependency");
    // Whitespace-insensitive: the guarantee is the sentence, not Prettier's
    // wrap column.
    expect(spec.replace(/\s+/gu, " ")).toContain(
      "no network request to infrastructure operated by the OpenIAP project",
    );
  });

  it("every example is free of anything an adopter would have to be issued", () => {
    for (const file of readdirSync(at("examples"))) {
      const raw = readFileSync(`${at("examples")}/${file}`, "utf8");
      expect(raw).not.toMatch(/whsec_|openiap-kit_(pk|sk)_/);
    }
  });
});
