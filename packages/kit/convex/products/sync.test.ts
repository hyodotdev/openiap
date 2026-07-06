import { describe, expect, it } from "vitest";

import {
  isSafePriceAmountMicros,
  shouldPreserveKitRemovedDuringPull,
} from "./sync";

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

describe("shouldPreserveKitRemovedDuringPull", () => {
  it("preserves kit-authored Removed rows so direction=both can delete them upstream", () => {
    expect(
      shouldPreserveKitRemovedDuringPull({
        state: "Removed",
        origin: "kit",
      }),
    ).toBe(true);
  });

  it("does not preserve store-authored or active rows", () => {
    expect(
      shouldPreserveKitRemovedDuringPull({
        state: "Removed",
        origin: "store",
      }),
    ).toBe(false);
    expect(
      shouldPreserveKitRemovedDuringPull({
        state: "Ready",
        origin: "kit",
      }),
    ).toBe(false);
  });
});
