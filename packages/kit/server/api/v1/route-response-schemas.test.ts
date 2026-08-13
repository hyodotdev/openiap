import { describe, expect, test } from "vitest";
import * as v from "valibot";

import { verifyPurchaseSuccessResponseSchema } from "./route-response-schemas";

function parse(input: unknown) {
  return v.safeParse(verifyPurchaseSuccessResponseSchema, input);
}

describe("verifyPurchaseSuccessResponseSchema", () => {
  test("requires the verified store in successful responses", () => {
    const result = parse({
      store: "amazon",
      isValid: true,
      state: "ENTITLED",
    });

    expect(result.success).toBe(true);
  });

  test("rejects legacy responses without store", () => {
    const result = parse({
      isValid: true,
      state: "ENTITLED",
    });

    expect(result.success).toBe(false);
  });

  test("rejects unknown stores", () => {
    const result = parse({
      store: "play-store",
      isValid: true,
      state: "ENTITLED",
    });

    expect(result.success).toBe(false);
  });

  test("accepts store environment strings opaquely", () => {
    for (const environment of [
      "Sandbox",
      "Production",
      "Xcode",
      "LocalTesting",
      "AppTester",
    ]) {
      expect(
        parse({
          store: "amazon",
          isValid: true,
          state: "ENTITLED",
          environment,
        }).success,
      ).toBe(true);
    }
    expect(
      parse({
        store: "amazon",
        isValid: true,
        state: "ENTITLED",
        environment: 42,
      }).success,
    ).toBe(false);
  });

  test("accepts the complete optional client payload", () => {
    const result = parse({
      store: "google",
      isValid: true,
      state: "ENTITLED",
      productId: "premium.monthly",
      clientPayload: {
        format: "toml",
        body: 'tier = "premium"',
        version: 2,
        updatedAt: 123,
      },
    });

    expect(result.success).toBe(true);
  });

  test("rejects malformed client payload responses", () => {
    for (const clientPayload of [
      { format: "yaml", body: "tier: premium", version: 1, updatedAt: 1 },
      { format: "text", body: "premium", updatedAt: 1 },
      { format: "json", body: {}, version: 1, updatedAt: 1 },
    ]) {
      expect(
        parse({
          store: "apple",
          isValid: true,
          state: "ENTITLED",
          clientPayload,
        }).success,
      ).toBe(false);
    }
  });
});
