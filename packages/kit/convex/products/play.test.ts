import { describe, expect, it } from "vitest";

import { basePlanIdForPeriod, moneyToMicros } from "./play";

describe("moneyToMicros", () => {
  it("returns undefined when input is missing or has no units", () => {
    expect(moneyToMicros(undefined)).toBeUndefined();
    expect(moneyToMicros({ currencyCode: "USD" })).toBeUndefined();
  });

  it("converts whole dollars (units only) to micros", () => {
    expect(moneyToMicros({ currencyCode: "USD", units: "9", nanos: 0 })).toBe(
      9_000_000,
    );
  });

  it("converts units + nanos combination correctly", () => {
    // $9.99 = units 9 + nanos 990_000_000 → 9_990_000 micros
    expect(
      moneyToMicros({ currencyCode: "USD", units: "9", nanos: 990_000_000 }),
    ).toBe(9_990_000);
  });

  it("rounds nanos / 1000 conversion (Google's nanos resolution → kit micros)", () => {
    // 999_999_999 nanos / 1000 = 999_999.999 → rounds to 1_000_000 micros from nanos,
    // plus 0 units = 1_000_000 micros total. Verifies we don't truncate.
    expect(
      moneyToMicros({ currencyCode: "USD", units: "0", nanos: 999_999_999 }),
    ).toBe(1_000_000);
  });

  it("uses BigInt math to preserve precision up to Number.MAX_SAFE_INTEGER", () => {
    // 9_007_199_254 KRW is the largest unit value that, multiplied by
    // 1_000_000 (micros), stays at or below Number.MAX_SAFE_INTEGER
    // (9_007_199_254_740_992). Beyond this the new guard correctly
    // returns undefined to avoid silent IEEE 754 truncation.
    expect(
      moneyToMicros({ currencyCode: "KRW", units: "9007199254", nanos: 0 }),
    ).toBe(9_007_199_254_000_000);
  });

  it("returns undefined when the converted micros exceed Number.MAX_SAFE_INTEGER", () => {
    // 1e10 KRW * 1_000_000 micros > 2^53 — the schema stores
    // priceAmountMicros as a JS number (double), so anything past
    // the safe range would silently round-trip to a corrupted value.
    // The guard surfaces "price unknown" so the dashboard can show
    // an affordance instead of a wrong number.
    expect(
      moneyToMicros({ currencyCode: "KRW", units: "10000000000", nanos: 0 }),
    ).toBeUndefined();
  });

  it("returns undefined when units is not a parseable BigInt string", () => {
    expect(
      moneyToMicros({ currencyCode: "USD", units: "abc", nanos: 0 }),
    ).toBeUndefined();
  });
});

describe("basePlanIdForPeriod", () => {
  it.each([
    ["P1W", "weekly"],
    ["P1M", "monthly"],
    ["P2M", "bimonthly"],
    ["P3M", "quarterly"],
    ["P6M", "semiannual"],
    ["P1Y", "yearly"],
  ])("maps %s → %s", (iso, label) => {
    expect(basePlanIdForPeriod(iso)).toBe(label);
  });

  it("falls back to monthly for undefined / unknown periods", () => {
    expect(basePlanIdForPeriod(undefined)).toBe("monthly");
    expect(basePlanIdForPeriod("P9X")).toBe("monthly");
  });
});
