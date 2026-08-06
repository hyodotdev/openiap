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

  it("treats absent or empty as the unset inheritance mode", () => {
    expect(normalizeProductRegions(undefined)).toBeUndefined();
    expect(normalizeProductRegions([])).toBeUndefined();
  });

  it('preserves the explicit "all" expansion mode', () => {
    expect(normalizeProductRegions("all")).toBe("all");
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
  it("accepts current ISO territories plus XK", () => {
    expect(normalizeProductRegions(["QA", "XK", "GB"])).toEqual([
      "GB",
      "QA",
      "XK",
    ]);
  });

  it("rejects macroregions and CLDR compatibility aliases", () => {
    for (const code of ["EU", "EZ", "UN", "UK"]) {
      expect(() => normalizeProductRegions([code])).toThrow(
        /Invalid sales region/,
      );
    }
  });

  it("rejects deleted country assignments", () => {
    for (const code of ["AN", "BU", "CS", "SU", "TP", "YU", "ZR"]) {
      expect(() => normalizeProductRegions([code])).toThrow(
        /Invalid sales region/,
      );
    }
  });

  it("rejects CLDR pseudo-regions", () => {
    for (const code of ["AC", "CP", "DG", "EA", "IC", "TA"]) {
      expect(() => normalizeProductRegions([code])).toThrow(
        /Invalid sales region/,
      );
    }
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
