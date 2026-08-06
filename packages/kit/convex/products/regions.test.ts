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

// CodeRabbit round 4: the format check alone accepted reserved codes
// like ZZ, which upsertProduct stored and the Android sync then silently
// dropped.
describe("assigned-region validation", () => {
  it("accepts real territories, including ones in reserved ranges CLDR names", () => {
    expect(normalizeProductRegions(["QA", "XK", "GB"])).toEqual([
      "GB",
      "QA",
      "XK",
    ]);
  });

  it("rejects reserved and unassigned codes", () => {
    for (const code of ["ZZ", "AA", "QQ", "QM", "XA"]) {
      expect(() => normalizeProductRegions([code])).toThrow(
        /Invalid sales region/,
      );
    }
  });
});

// Round 6: the reserved-range branch returned early for QA–QL, waving
// unassigned codes past the CLDR check that would have caught them.
describe("reserved-range handling", () => {
  it("still rejects unassigned codes below the reserved span", () => {
    for (const code of ["QB", "QL"]) {
      expect(() => normalizeProductRegions([code])).toThrow(
        /Invalid sales region/,
      );
    }
  });

  it("keeps QA, which is Qatar", () => {
    expect(normalizeProductRegions(["QA"])).toEqual(["QA"]);
  });
});
