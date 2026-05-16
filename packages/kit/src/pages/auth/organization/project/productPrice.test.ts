import { describe, expect, it } from "vitest";

import { usdPriceToMicros } from "./productPrice";

describe("usdPriceToMicros", () => {
  it("converts decimal USD strings to micros", () => {
    expect(usdPriceToMicros("9")).toBe(9_000_000);
    expect(usdPriceToMicros("9.99")).toBe(9_990_000);
    expect(usdPriceToMicros(" 0.000001 ")).toBe(1);
  });

  it("returns undefined for empty, zero, malformed, and unsafe prices", () => {
    expect(usdPriceToMicros("")).toBeUndefined();
    expect(usdPriceToMicros("0")).toBeUndefined();
    expect(usdPriceToMicros("12abc")).toBeUndefined();
    expect(usdPriceToMicros("1e2")).toBeUndefined();
    expect(usdPriceToMicros("1.1234567")).toBeUndefined();
    expect(usdPriceToMicros(String(Number.MAX_SAFE_INTEGER))).toBeUndefined();
  });
});
