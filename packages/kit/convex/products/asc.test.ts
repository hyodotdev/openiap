import { describe, expect, it } from "vitest";

import {
  mapAscOfferDurationToIso,
  mapAscOfferKind,
  mapBillingPeriodToAsc,
  parseIntroOffers,
  pickActivePriceRow,
  pickPricePointIdMatching,
} from "./asc";

describe("pickPricePointIdMatching", () => {
  const list = {
    data: [
      {
        id: "tier-29",
        type: "inAppPurchasePricePoints" as const,
        attributes: { customerPrice: "0.29" },
      },
      {
        id: "tier-99",
        type: "inAppPurchasePricePoints" as const,
        attributes: { customerPrice: "0.99" },
      },
      {
        id: "tier-999",
        type: "inAppPurchasePricePoints" as const,
        attributes: { customerPrice: "9.99" },
      },
      {
        id: "tier-9999",
        type: "inAppPurchasePricePoints" as const,
        attributes: { customerPrice: "99.99" },
      },
      {
        id: "tier-malformed",
        type: "inAppPurchasePricePoints" as const,
        attributes: { customerPrice: "abc" },
      },
      {
        id: "tier-empty",
        type: "inAppPurchasePricePoints" as const,
        attributes: {},
      },
    ],
  };

  it("returns null when the catalog response is null", () => {
    expect(pickPricePointIdMatching(null, 9_990_000)).toBeNull();
  });

  it("returns null when no tier matches the requested USD amount", () => {
    expect(pickPricePointIdMatching(list, 1_500_000)).toBeNull();
  });

  it("matches an exact tier on the cent boundary", () => {
    expect(pickPricePointIdMatching(list, 9_990_000)).toBe("tier-999");
    expect(pickPricePointIdMatching(list, 290_000)).toBe("tier-29");
    expect(pickPricePointIdMatching(list, 99_990_000)).toBe("tier-9999");
  });

  it("absorbs one-cent floating-point drift in the requested amount", () => {
    expect(pickPricePointIdMatching(list, 9_989_999)).toBe("tier-999");
    expect(pickPricePointIdMatching(list, 9_985_000)).toBe("tier-999");
  });

  it("skips malformed and missing customerPrice rows", () => {
    expect(pickPricePointIdMatching(list, 0)).toBeNull();
  });
});

describe("mapBillingPeriodToAsc", () => {
  it.each([
    ["P1W", "ONE_WEEK"],
    ["P1M", "ONE_MONTH"],
    ["P2M", "TWO_MONTHS"],
    ["P3M", "THREE_MONTHS"],
    ["P6M", "SIX_MONTHS"],
    ["P1Y", "ONE_YEAR"],
  ] as const)("maps %s → %s", (iso, asc) => {
    expect(mapBillingPeriodToAsc(iso)).toBe(asc);
  });

  it("defaults undefined / unknown periods to ONE_MONTH so push doesn't silently drop the picker", () => {
    expect(mapBillingPeriodToAsc(undefined)).toBe("ONE_MONTH");
    // Unknown periods throw — silently coercing to ONE_MONTH used
    // to provision the wrong subscription duration in ASC, which is
    // much harder to unwind than a failed sync. The throw is caught
    // inside processOneDraft and recorded as a per-row failure.
    const wider = mapBillingPeriodToAsc as (
      period: string | undefined,
    ) => string;
    expect(() => wider("P9X")).toThrow(/Invalid billing period/);
  });
});

describe("mapAscOfferDurationToIso", () => {
  it.each([
    ["THREE_DAYS", "P3D"],
    ["ONE_WEEK", "P1W"],
    ["TWO_WEEKS", "P2W"],
    ["ONE_MONTH", "P1M"],
    ["TWO_MONTHS", "P2M"],
    ["THREE_MONTHS", "P3M"],
    ["SIX_MONTHS", "P6M"],
    ["ONE_YEAR", "P1Y"],
  ])("normalizes ASC enum %s → ISO %s", (asc, iso) => {
    expect(mapAscOfferDurationToIso(asc)).toBe(iso);
  });

  it("returns undefined when no input", () => {
    expect(mapAscOfferDurationToIso(undefined)).toBeUndefined();
  });

  it("passes unknown enum values through unchanged so future Apple values still render", () => {
    expect(mapAscOfferDurationToIso("FOUR_MOONS")).toBe("FOUR_MOONS");
  });
});

describe("mapAscOfferKind", () => {
  it.each([
    ["FREE_TRIAL", "FreeTrial"],
    ["PAY_UP_FRONT", "IntroPayUpFront"],
    ["PAY_AS_YOU_GO", "IntroPayAsYouGo"],
  ] as const)("maps %s → %s", (mode, kind) => {
    expect(mapAscOfferKind(mode)).toBe(kind);
  });

  it("falls back to FreeTrial for unknown / undefined modes", () => {
    expect(mapAscOfferKind(undefined)).toBe("FreeTrial");
    expect(mapAscOfferKind("UNKNOWN")).toBe("FreeTrial");
  });
});

describe("pickActivePriceRow", () => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  it("returns null for empty input", () => {
    expect(pickActivePriceRow([])).toBeNull();
  });

  it("picks the row whose date window covers today", () => {
    const rows = [
      { id: "future", attributes: { startDate: tomorrow, endDate: null } },
      { id: "active", attributes: { startDate: yesterday, endDate: null } },
    ];
    expect(pickActivePriceRow(rows)?.id).toBe("active");
  });

  it("treats null start / end as open bounds", () => {
    const rows = [
      { id: "open", attributes: { startDate: null, endDate: null } },
    ];
    expect(pickActivePriceRow(rows)?.id).toBe("open");
  });

  it("rejects rows whose endDate has already passed", () => {
    const rows = [
      {
        id: "expired",
        attributes: { startDate: yesterday, endDate: yesterday },
      },
      { id: "active", attributes: { startDate: yesterday, endDate: tomorrow } },
    ];
    expect(pickActivePriceRow(rows)?.id).toBe("active");
  });

  it("falls back to the first row when no window covers today (defensive default)", () => {
    const rows = [
      { id: "future-a", attributes: { startDate: tomorrow, endDate: null } },
      { id: "future-b", attributes: { startDate: tomorrow, endDate: null } },
    ];
    expect(pickActivePriceRow(rows)?.id).toBe("future-a");
  });

  it("accepts a row whose startDate equals today (only strictly-future startDates are rejected)", () => {
    const rows = [
      { id: "starts-today", attributes: { startDate: today, endDate: null } },
    ];
    expect(pickActivePriceRow(rows)?.id).toBe("starts-today");
  });
});

describe("parseIntroOffers", () => {
  const today = new Date().toISOString().slice(0, 10);

  it("returns [] when no response or empty data", () => {
    expect(parseIntroOffers(null)).toEqual([]);
    expect(parseIntroOffers({ data: [] })).toEqual([]);
  });

  it("parses a free-trial offer (no pricePoint, just duration)", () => {
    const out = parseIntroOffers({
      data: [
        {
          id: "offer-free",
          type: "subscriptionIntroductoryOffers" as const,
          attributes: {
            offerMode: "FREE_TRIAL",
            duration: "ONE_WEEK",
            numberOfPeriods: 1,
            startDate: today,
            endDate: null,
          },
          relationships: {},
        },
      ],
    });
    expect(out).toEqual([
      {
        id: "offer-free",
        kind: "FreeTrial",
        duration: "P1W",
        numberOfPeriods: 1,
        priceAmountMicros: undefined,
        currency: undefined,
      },
    ]);
  });

  it("parses a pay-up-front intro with included pricePoint", () => {
    const out = parseIntroOffers({
      data: [
        {
          id: "offer-paid",
          type: "subscriptionIntroductoryOffers" as const,
          attributes: {
            offerMode: "PAY_UP_FRONT",
            duration: "THREE_MONTHS",
            numberOfPeriods: 1,
          },
          relationships: {
            subscriptionPricePoint: {
              data: { id: "pp-99" },
            },
          },
        },
      ],
      included: [
        {
          id: "pp-99",
          type: "subscriptionPricePoints" as const,
          attributes: { customerPrice: "0.99" },
        },
      ],
    });
    expect(out).toEqual([
      {
        id: "offer-paid",
        kind: "IntroPayUpFront",
        duration: "P3M",
        numberOfPeriods: 1,
        priceAmountMicros: 990_000,
        currency: "USD",
      },
    ]);
  });

  it("filters out offers whose date window doesn't cover today", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const out = parseIntroOffers({
      data: [
        {
          id: "offer-future",
          type: "subscriptionIntroductoryOffers" as const,
          attributes: {
            offerMode: "FREE_TRIAL",
            duration: "ONE_WEEK",
            startDate: future,
            endDate: null,
          },
        },
      ],
    });
    expect(out).toEqual([]);
  });
});
