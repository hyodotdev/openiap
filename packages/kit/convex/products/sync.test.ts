import { describe, expect, it } from "vitest";

import { isSafePriceAmountMicros } from "./sync";

describe("isSafePriceAmountMicros", () => {
  it("accepts missing and non-negative safe integer prices", () => {
    expect(isSafePriceAmountMicros(undefined)).toBe(true);
    expect(isSafePriceAmountMicros(0)).toBe(true);
    expect(isSafePriceAmountMicros(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it("rejects negative, fractional, and unsafe prices", () => {
    expect(isSafePriceAmountMicros(-1)).toBe(false);
    expect(isSafePriceAmountMicros(1.5)).toBe(false);
    expect(isSafePriceAmountMicros(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });
});
