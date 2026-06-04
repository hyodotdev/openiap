import { describe, expect, test } from "vitest";
import * as v from "valibot";

import { verifyPurchaseInputSchema } from "./route-input-schemas";

function parse(input: unknown) {
  return v.safeParse(verifyPurchaseInputSchema, input);
}

// Shape-valid fixtures for the tightened schema: Apple JWS must be a
// 3-segment base64url string ≥ 100 chars; Google purchaseToken must be
// a URL-safe blob ≥ 20 chars.
const VALID_APPLE_JWS = `${"a".repeat(40)}.${"b".repeat(40)}.${"c".repeat(40)}`;
const VALID_GOOGLE_TOKEN = "a".repeat(40);

describe("verifyPurchaseInputSchema", () => {
  test("accepts a well-formed Apple payload", () => {
    const result = parse({
      store: "apple",
      jws: VALID_APPLE_JWS,
      expectedProductId: "premium.monthly",
    });
    expect(result.success).toBe(true);
  });

  test("accepts a well-formed Google payload", () => {
    const result = parse({
      store: "google",
      purchaseToken: VALID_GOOGLE_TOKEN,
      expectedProductId: "premium.monthly",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an empty Apple jws", () => {
    const result = parse({ store: "apple", jws: "" });
    expect(result.success).toBe(false);
  });

  test("rejects an empty Google purchaseToken", () => {
    const result = parse({ store: "google", purchaseToken: "" });
    expect(result.success).toBe(false);
  });

  test("rejects an Apple jws longer than the 16k ceiling", () => {
    const big = "a".repeat(16_001);
    const result = parse({ store: "apple", jws: big });
    expect(result.success).toBe(false);
  });

  test("rejects a Google purchaseToken longer than the 2k ceiling", () => {
    const big = "a".repeat(2_001);
    const result = parse({ store: "google", purchaseToken: big });
    expect(result.success).toBe(false);
  });

  test("accepts an Apple jws at exactly the 16k ceiling", () => {
    // 5332 + "." + 5333 + "." + 5333 = 16000 chars total, still
    // a valid 3-segment base64url string.
    const atLimit = `${"a".repeat(5_332)}.${"a".repeat(5_333)}.${"a".repeat(5_333)}`;
    expect(atLimit.length).toBe(16_000);
    const result = parse({ store: "apple", jws: atLimit });
    expect(result.success).toBe(true);
  });

  test("accepts a Google purchaseToken at exactly the 2k ceiling", () => {
    const atLimit = "a".repeat(2_000);
    const result = parse({ store: "google", purchaseToken: atLimit });
    expect(result.success).toBe(true);
  });

  test("accepts a well-formed Horizon payload", () => {
    const result = parse({
      store: "horizon",
      userId: "1234567890",
      sku: "coin_pack_100",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty Horizon userId / sku", () => {
    expect(
      parse({ store: "horizon", userId: "", sku: "coin_pack_100" }).success,
    ).toBe(false);
    expect(
      parse({ store: "horizon", userId: "1234567890", sku: "" }).success,
    ).toBe(false);
  });

  test("rejects Horizon payloads past the 256-char ceiling", () => {
    expect(
      parse({
        store: "horizon",
        userId: "a".repeat(257),
        sku: "coin_pack_100",
      }).success,
    ).toBe(false);
    expect(
      parse({
        store: "horizon",
        userId: "1234567890",
        sku: "a".repeat(257),
      }).success,
    ).toBe(false);
  });

  // Format-gate tests — these are what keeps garbage traffic from
  // reaching the monthly quota counter and the upstream Apple / Google
  // / Meta APIs. Anything rejected here never costs the org a
  // verification.
  test("rejects an Apple jws that isn't a 3-segment base64url blob", () => {
    // Single segment (no dots).
    expect(parse({ store: "apple", jws: "a".repeat(200) }).success).toBe(false);
    // Two segments.
    expect(
      parse({ store: "apple", jws: `${"a".repeat(100)}.${"b".repeat(100)}` })
        .success,
    ).toBe(false);
    // Segment with a non-base64url char.
    expect(
      parse({
        store: "apple",
        jws: `${"a".repeat(40)}.bb!bb.${"c".repeat(40)}`,
      }).success,
    ).toBe(false);
  });

  test("rejects a sub-threshold-length Apple jws", () => {
    // Three segments but under 100 chars total — guaranteed not a
    // real signed transaction.
    expect(parse({ store: "apple", jws: "a.b.c" }).success).toBe(false);
  });

  test("rejects a Google purchaseToken with invalid characters", () => {
    expect(
      parse({ store: "google", purchaseToken: "a".repeat(25) + " leak" })
        .success,
    ).toBe(false);
    expect(
      parse({ store: "google", purchaseToken: "<script>alert(1)</script>" })
        .success,
    ).toBe(false);
  });

  test("rejects malformed expectedProductId values", () => {
    expect(
      parse({
        store: "google",
        purchaseToken: VALID_GOOGLE_TOKEN,
        expectedProductId: "",
      }).success,
    ).toBe(false);
    expect(
      parse({
        store: "google",
        purchaseToken: VALID_GOOGLE_TOKEN,
        expectedProductId: "bad product",
      }).success,
    ).toBe(false);
    expect(
      parse({
        store: "apple",
        jws: VALID_APPLE_JWS,
        expectedProductId: "p".repeat(257),
      }).success,
    ).toBe(false);
  });

  test("rejects a Horizon userId / sku with invalid characters", () => {
    expect(
      parse({
        store: "horizon",
        userId: "1234 5678",
        sku: "coin_pack_100",
      }).success,
    ).toBe(false);
    expect(
      parse({
        store: "horizon",
        userId: "1234567890",
        sku: "bad sku",
      }).success,
    ).toBe(false);
  });
});
