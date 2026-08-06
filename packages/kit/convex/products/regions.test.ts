import { describe, expect, it } from "vitest";

import { normalizeProductRegions } from "./regions";

describe("normalizeProductRegions", () => {
  it("upper-cases, trims, de-duplicates, and sorts", () => {
    expect(normalizeProductRegions([" kr ", "us", "KR", "jp"])).toEqual([
      "JP",
      "KR",
      "US",
    ]);
  });

  it("treats absent or empty as unset — the sell-everywhere default", () => {
    expect(normalizeProductRegions(undefined)).toBeUndefined();
    expect(normalizeProductRegions([])).toBeUndefined();
  });

  it("rejects anything that is not an ISO 3166-1 alpha-2 code", () => {
    for (const code of ["USA", "u", "", "12", "en-US", "K R"]) {
      expect(() => normalizeProductRegions([code])).toThrow(
        /Invalid sales region/,
      );
    }
  });
});
