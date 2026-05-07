import { describe, expect, it } from "vitest";

import { formatMicros, normalizeCurrencyCode } from "./utils";

describe("normalizeCurrencyCode", () => {
  it("trims and uppercases valid ISO currency codes", () => {
    expect(normalizeCurrencyCode(" usd ")).toBe("USD");
  });

  it("falls back when the currency code is invalid", () => {
    expect(normalizeCurrencyCode("usdollar", "EUR")).toBe("EUR");
  });
});

describe("formatMicros", () => {
  it("formats zero as a currency amount in non-compact mode", () => {
    expect(formatMicros(0, { currency: "USD" })).toBe("USD 0.00");
  });

  it("can hide zero values when a metric is empty", () => {
    expect(formatMicros(0, { currency: "USD", emptyWhenZero: true })).toBe("—");
  });

  it("keeps compact formatting for chart axes", () => {
    expect(formatMicros(1_200_000_000, { compact: true })).toBe("1.2k");
  });
});
