import { google, type Common } from "googleapis";
import { describe, expect, it } from "vitest";

import {
  basePlanIdForPeriod,
  mapModernPlayOneTimeState,
  moneyToMicros,
  playPriceMicrosToNumber,
  shouldFallbackToLegacyOneTimeProduct,
  upsertModernAndroidOneTimeProduct,
} from "./play";

describe("mapModernPlayOneTimeState", () => {
  it("maps the modern purchase-option lifecycle without assuming availability", () => {
    expect(mapModernPlayOneTimeState([{ state: "DRAFT" }])).toBe("Draft");
    expect(mapModernPlayOneTimeState([{ state: "INACTIVE" }])).toBe("Removed");
    expect(mapModernPlayOneTimeState([{ state: "INACTIVE_PUBLISHED" }])).toBe(
      "Removed",
    );
    expect(mapModernPlayOneTimeState(undefined)).toBe("Removed");
    expect(mapModernPlayOneTimeState(null)).toBe("Removed");
    expect(mapModernPlayOneTimeState([])).toBe("Removed");
    expect(mapModernPlayOneTimeState([{ state: "STATE_UNSPECIFIED" }])).toBe(
      "Removed",
    );
    expect(mapModernPlayOneTimeState([{ state: "FUTURE_STATE" }])).toBe(
      "Removed",
    );
  });

  it("keeps a product active when any purchase option remains active", () => {
    expect(
      mapModernPlayOneTimeState([{ state: "INACTIVE" }, { state: "ACTIVE" }]),
    ).toBe("Active");
  });

  it("treats mixed inactive and draft options as unavailable", () => {
    expect(
      mapModernPlayOneTimeState([{ state: "DRAFT" }, { state: "INACTIVE" }]),
    ).toBe("Removed");
  });
});

describe("upsertModernAndroidOneTimeProduct", () => {
  it("uses the generated lowercase one-time-product PATCH route", async () => {
    let capturedRequest: Common.GaxiosOptions | undefined;
    const androidpublisher = google.androidpublisher({
      version: "v3",
      adapter: async <T>(
        request: Common.gaxios.GaxiosOptionsPrepared,
      ): Promise<Common.GaxiosResponse<T>> => {
        capturedRequest = request;
        return Object.assign(new Response(null, { status: 200 }), {
          config: request,
          data: {} as T,
        });
      },
    });

    await upsertModernAndroidOneTimeProduct(
      androidpublisher,
      {
        packageName: "com.example.moonlit",
        productId: "hero.sage",
        title: "Moon Sage",
        description: "Unlock Moon Sage",
        priceAmountMicros: 24_990_000,
        currency: "USD",
      },
      { allowCreate: true },
    );

    expect(capturedRequest).toBeDefined();
    const requestUrl = new URL(String(capturedRequest?.url));
    expect(requestUrl.pathname).toBe(
      "/androidpublisher/v3/applications/com.example.moonlit/onetimeproducts/hero.sage",
    );
    expect(requestUrl.searchParams.get("allowMissing")).toBe("true");
    expect(requestUrl.searchParams.get("updateMask")).toBe(
      "listings,purchaseOptions",
    );
    expect(requestUrl.searchParams.get("regionsVersion.version")).toBe(
      "2022/01",
    );
    expect(capturedRequest?.data).toMatchObject({
      packageName: "com.example.moonlit",
      productId: "hero.sage",
      listings: [
        {
          languageCode: "en-US",
          title: "Moon Sage",
          description: "Unlock Moon Sage",
        },
      ],
      purchaseOptions: [
        {
          purchaseOptionId: "buy",
          regionalPricingAndAvailabilityConfigs: [
            {
              regionCode: "US",
              availability: "AVAILABLE",
              price: {
                currencyCode: "USD",
                units: "24",
                nanos: 990_000_000,
              },
            },
          ],
        },
      ],
    });
  });
});

describe("shouldFallbackToLegacyOneTimeProduct", () => {
  it("does not hide a bare 404 from an allow-missing create", () => {
    expect(
      shouldFallbackToLegacyOneTimeProduct(
        { code: 404 },
        { allowCreate: true },
      ),
    ).toBe(false);
  });

  it("preserves a bare 404 fallback for legacy-only updates", () => {
    expect(
      shouldFallbackToLegacyOneTimeProduct(
        { response: { status: 404 } },
        { allowCreate: false },
      ),
    ).toBe(true);
  });

  it.each([true, false])(
    "honors an explicit legacy API response when allowCreate=%s",
    (allowCreate) => {
      expect(
        shouldFallbackToLegacyOneTimeProduct(
          new Error("Please use the InAppProducts API for this application"),
          { allowCreate },
        ),
      ).toBe(true);
    },
  );
});

describe("playPriceMicrosToNumber", () => {
  it("accepts non-negative safe integer price strings", () => {
    expect(playPriceMicrosToNumber("0")).toBe(0);
    expect(playPriceMicrosToNumber("990000")).toBe(990_000);
    expect(playPriceMicrosToNumber(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("rejects malformed, negative, fractional, and unsafe price strings", () => {
    expect(playPriceMicrosToNumber(undefined)).toBeUndefined();
    expect(playPriceMicrosToNumber("abc")).toBeUndefined();
    expect(playPriceMicrosToNumber(" 990000 ")).toBeUndefined();
    expect(playPriceMicrosToNumber("1e6")).toBeUndefined();
    expect(playPriceMicrosToNumber("-1")).toBeUndefined();
    expect(playPriceMicrosToNumber("1.5")).toBeUndefined();
    expect(
      playPriceMicrosToNumber(String(Number.MAX_SAFE_INTEGER + 1)),
    ).toBeUndefined();
  });
});

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

  it("truncates nanos / 1000 conversion (sub-micro fraction is dropped, not rounded up)", () => {
    // 999_999_999 nanos / 1000 = 999_999.999 → truncates to 999_999
    // micros. We deliberately don't round up to 1_000_000; rounding
    // would silently push prices across the unit boundary (PR #124 (https://github.com/hyodotdev/openiap/pull/124)
    // review — "999_999_999 nanos rounding up to a full unit"), and
    // Play stores prices in micros internally so truncation matches
    // the canonical representation.
    expect(
      moneyToMicros({ currencyCode: "USD", units: "0", nanos: 999_999_999 }),
    ).toBe(999_999);
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

  it("returns undefined when units is not a non-negative decimal string", () => {
    expect(
      moneyToMicros({ currencyCode: "USD", units: "abc", nanos: 0 }),
    ).toBeUndefined();
    expect(
      moneyToMicros({ currencyCode: "USD", units: "+1", nanos: 0 }),
    ).toBeUndefined();
    expect(
      moneyToMicros({ currencyCode: "USD", units: " 1", nanos: 0 }),
    ).toBeUndefined();
    expect(
      moneyToMicros({ currencyCode: "USD", units: "1 ", nanos: 0 }),
    ).toBeUndefined();
  });

  it("returns undefined for negative prices", () => {
    expect(
      moneyToMicros({ currencyCode: "USD", units: "-1", nanos: 0 }),
    ).toBeUndefined();
    expect(
      moneyToMicros({ currencyCode: "USD", units: "0", nanos: -1_000 }),
    ).toBeUndefined();
  });

  it("returns undefined when nanos is outside Google Money bounds", () => {
    expect(
      moneyToMicros({ currencyCode: "USD", units: "0", nanos: 1_000_000_000 }),
    ).toBeUndefined();
    expect(
      moneyToMicros({ currencyCode: "USD", units: "0", nanos: -1_000_000_000 }),
    ).toBeUndefined();
    expect(
      moneyToMicros({ currencyCode: "USD", units: "0", nanos: 1.5 }),
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
