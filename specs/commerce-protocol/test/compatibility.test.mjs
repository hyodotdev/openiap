import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  findCompatibilityChanges,
  protocolMajor,
} from "../scripts/audit-compatibility.mjs";

const read = (file) =>
  readFileSync(new URL(`../generated/${file}`, import.meta.url), "utf8");
const baseline = {
  bundle: JSON.parse(read("schemas/commerce-protocol.bundle.schema.json")),
  http: JSON.parse(read("bindings/http-binding.json")),
  graphql: read("bindings/operations.graphql"),
  spec: readFileSync(new URL("../SPEC.md", import.meta.url), "utf8"),
  signatures: JSON.parse(
    readFileSync(
      new URL("../vectors/signatures.json", import.meta.url),
      "utf8",
    ),
  ),
};

describe("Commerce compatibility against the base revision", () => {
  it("allows additive operations and optional members on open objects", () => {
    const next = structuredClone(baseline);
    const event = next.bundle.$defs.CommerceEvent;
    event.properties.note = { type: "string" };
    event.properties.eventType.examples.push("subscription.example");
    event.description = "Updated prose";
    const input = next.bundle.$defs.VerifyPurchaseInput;
    input.properties.note = { type: "string" };
    next.http.operations.push({
      ...next.http.operations[0],
      name: "newOperation",
    });
    next.http.operations[0].errors.push("ANOTHER_ERROR");
    next.http.errorStatus.ANOTHER_ERROR = 400;
    expect(findCompatibilityChanges(baseline, next)).toEqual([]);
  });

  it("rejects a renamed required member within the same protocol", () => {
    const next = structuredClone(baseline);
    const descriptor = next.bundle.$defs.ProviderCapabilities;
    descriptor.properties.specVersion =
      descriptor.properties.commerceProtocolVersion;
    delete descriptor.properties.commerceProtocolVersion;
    descriptor.required = descriptor.required.map((key) =>
      key === "commerceProtocolVersion" ? "specVersion" : key,
    );
    expect(findCompatibilityChanges(baseline, next)).toContain(
      "ProviderCapabilities.commerceProtocolVersion was removed",
    );
  });

  it("rejects new fields on closed objects and changes to constraints", () => {
    const next = structuredClone(baseline);
    next.bundle.$defs.ProtocolError.properties.detail = { type: "string" };
    next.bundle.$defs.Extensions.additionalProperties.maxLength -= 1;
    const states = next.bundle.$defs.SubscriptionState;
    states.enum = ["New", "Closed"];
    expect(findCompatibilityChanges(baseline, next)).toEqual(
      expect.arrayContaining([
        "ProtocolError.detail was added to a restricted object",
        "Extensions.additionalProperties changed maxLength",
        "SubscriptionState changed enum",
      ]),
    );
  });

  it("rejects HTTP operation and error drift even when schemas are unchanged", () => {
    const next = structuredClone(baseline);
    const operation = next.http.operations[0];
    operation.auth = "server";
    operation.path += "/new";
    operation.successStatus = 201;
    next.http.errorStatus.RATE_LIMITED = 400;
    expect(findCompatibilityChanges(baseline, next)).toEqual(
      expect.arrayContaining([
        `Operation ${operation.name} changed auth`,
        `Operation ${operation.name} changed path`,
        `Operation ${operation.name} changed successStatus`,
        "Error RATE_LIMITED changed HTTP status or was removed",
      ]),
    );
  });

  it("checks the executable GraphQL binding", () => {
    const next = structuredClone(baseline);
    next.graphql = next.graphql.replace(
      /^(\s+)providerCapabilities:/m,
      "$1capabilities:",
    );
    expect(findCompatibilityChanges(baseline, next)).toContain(
      "GraphQL: Query.providerCapabilities was removed.",
    );
  });
  it("reports optional member removal, requiredness changes, and signature drift", () => {
    const next = structuredClone(baseline);
    const event = next.bundle.$defs.CommerceEvent;
    delete event.properties.extensions;
    event.required = event.required.filter((field) => field !== "eventId");
    const tolerance = next.signatures.toleranceSeconds;
    next.signatures.toleranceSeconds += 1;
    next.spec = next.spec.replace(
      `|now - timestamp| > ${tolerance}`,
      `|now - timestamp| > ${tolerance + 1}`,
    );
    expect(findCompatibilityChanges(baseline, next)).toEqual(
      expect.arrayContaining([
        "CommerceEvent.extensions was removed",
        "CommerceEvent changed required",
        "Webhook signature changed toleranceSeconds",
      ]),
    );
  });

  it("rejects a changed signature boundary even when the wire artifacts are identical", () => {
    const next = structuredClone(baseline);
    next.spec = next.spec.replace(
      "|now - timestamp| >",
      "|now - timestamp| >=",
    );
    expect(findCompatibilityChanges(baseline, next)).toContain(
      "Webhook signature changed the timestamp boundary",
    );
  });

  it("rejects invalid versions before using a major bump to admit breaks", () => {
    expect(protocolMajor("1.0")).toBe(1n);
    for (const version of [
      "latest",
      "1",
      "1.0.0",
      "01.0",
      ["1.0"],
      undefined,
    ]) {
      expect(() => protocolMajor(version)).toThrow(/Invalid protocol version/);
    }
  });
});
