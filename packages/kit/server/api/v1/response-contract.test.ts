import { describe, expect, test } from "vitest";
import * as v from "valibot";

import { enforceVerifyResponseContract } from "./response-contract";
import { verifyPurchaseSuccessResponseSchema } from "./route-response-schemas";

const ENTITLED = {
  store: "apple",
  isValid: true,
  state: "ENTITLED",
  productId: "premium.monthly",
} as const;

function assertMatchesPublishedSchema(response: unknown) {
  expect(
    v.safeParse(verifyPurchaseSuccessResponseSchema, response).success,
  ).toBe(true);
}

describe("enforceVerifyResponseContract", () => {
  test("passes a contract-valid response through untouched", () => {
    const result = enforceVerifyResponseContract({ ...ENTITLED });

    expect(result).toEqual({
      ok: true,
      response: { ...ENTITLED },
      violations: [],
    });
  });

  test("keeps every documented optional field", () => {
    const full = {
      ...ENTITLED,
      environment: "Sandbox",
      clientPayload: {
        format: "toml",
        body: 'tier = "gold"',
        version: 3,
        updatedAt: 1_700_000_000_000,
      },
    };

    const result = enforceVerifyResponseContract(full);

    expect(result.ok).toBe(true);
    expect(result.ok && result.response).toEqual(full);
    expect(result.violations).toEqual([]);
  });

  test("degrades an unpublished state to UNKNOWN without touching the verdict", () => {
    const result = enforceVerifyResponseContract({
      ...ENTITLED,
      state: "REFUNDED",
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual(["state"]);
    expect(result.ok && result.response.state).toBe("UNKNOWN");
    // The entitlement survives the metadata drift.
    expect(result.ok && result.response.isValid).toBe(true);
    assertMatchesPublishedSchema(result.ok && result.response);
  });

  test("drops an environment the SDK parsers reject", () => {
    // Apple's App Store Server API also reports `Xcode` and `LocalTesting`;
    // shipped SDKs fail the whole receipt on anything but Sandbox/Production.
    const result = enforceVerifyResponseContract({
      ...ENTITLED,
      environment: "Xcode",
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual(["environment"]);
    expect(result.ok && result.response).not.toHaveProperty("environment");
    assertMatchesPublishedSchema(result.ok && result.response);
  });

  test("drops a client payload format the SDKs cannot decode", () => {
    const result = enforceVerifyResponseContract({
      ...ENTITLED,
      clientPayload: {
        format: "yaml",
        body: "tier: gold",
        version: 1,
        updatedAt: 1_700_000_000_000,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual(["clientPayload"]);
    expect(result.ok && result.response).not.toHaveProperty("clientPayload");
    assertMatchesPublishedSchema(result.ok && result.response);
  });

  test("drops a non-string productId", () => {
    const result = enforceVerifyResponseContract({
      ...ENTITLED,
      productId: 42,
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual(["productId"]);
    expect(result.ok && result.response).not.toHaveProperty("productId");
  });

  test("reports every drifted field at once", () => {
    const result = enforceVerifyResponseContract({
      ...ENTITLED,
      state: "REFUNDED",
      environment: "Xcode",
      clientPayload: { format: "yaml", body: "", version: 1, updatedAt: 0 },
    });

    expect(result.violations).toEqual([
      "state",
      "environment",
      "clientPayload",
    ]);
    assertMatchesPublishedSchema(result.ok && result.response);
  });

  test("refuses to publish a malformed verdict", () => {
    // Neither field can drift from metadata changes — only a server defect
    // produces this, and a response no SDK can trust must not reach a client.
    for (const broken of [
      { ...ENTITLED, isValid: "true" },
      { ...ENTITLED, store: "steam" },
    ]) {
      const result = enforceVerifyResponseContract(broken);
      expect(result.ok).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    }
  });
});
