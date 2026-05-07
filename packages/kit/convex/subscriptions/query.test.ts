import { describe, expect, it } from "vitest";

import { selectReportingMrr } from "./query";

describe("selectReportingMrr", () => {
  it("uses only the reporting currency for the headline MRR", () => {
    const result = selectReportingMrr(
      [
        { currency: "EUR", mrrMicros: 8_500_000 },
        { currency: "USD", mrrMicros: 9_990_000 },
        { currency: "HUF", mrrMicros: 12_000_000 },
      ],
      "USD",
    );

    expect(result).toEqual({
      currency: "USD",
      mrrMicros: 9_990_000,
      excludedMrrByCurrency: [
        { currency: "EUR", mrrMicros: 8_500_000 },
        { currency: "HUF", mrrMicros: 12_000_000 },
      ],
    });
  });

  it("returns zero when the reporting currency has no matching MRR", () => {
    const result = selectReportingMrr(
      [
        { currency: "EUR", mrrMicros: 8_500_000 },
        { currency: "HUF", mrrMicros: 12_000_000 },
      ],
      "USD",
    );

    expect(result).toEqual({
      currency: "USD",
      mrrMicros: 0,
      excludedMrrByCurrency: [
        { currency: "EUR", mrrMicros: 8_500_000 },
        { currency: "HUF", mrrMicros: 12_000_000 },
      ],
    });
  });

  it("falls back to USD for invalid reporting currency input", () => {
    const result = selectReportingMrr(
      [
        { currency: "USD", mrrMicros: 9_990_000 },
        { currency: "EUR", mrrMicros: 8_500_000 },
      ],
      "US",
    );

    expect(result).toEqual({
      currency: "USD",
      mrrMicros: 9_990_000,
      excludedMrrByCurrency: [{ currency: "EUR", mrrMicros: 8_500_000 }],
    });
  });
});
