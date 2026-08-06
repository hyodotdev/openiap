import { google, type Common } from "googleapis";
import { describe, expect, it } from "vitest";

import {
  basePlanIdForPeriod,
  buildSubscriptionRegionalConfigs,
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

/**
 * Stubs the three Android Publisher calls the one-time upsert makes:
 * `onetimeproducts.get` (read-before-write), `convertRegionPrices`, and
 * the `onetimeproducts.patch` write. Each handler may return undefined
 * to fall through to a default, or throw a `{code}` object to simulate
 * an API error.
 */
function stubAndroidPublisher(handlers: {
  get?: () => unknown;
  convert?: () => unknown;
}) {
  const requests: Common.GaxiosOptions[] = [];
  const androidpublisher = google.androidpublisher({
    version: "v3",
    adapter: async <T>(
      request: Common.gaxios.GaxiosOptionsPrepared,
    ): Promise<Common.GaxiosResponse<T>> => {
      requests.push(request);
      const url = new URL(String(request.url));
      let data: unknown = {};

      if (url.pathname.endsWith("/pricing:convertRegionPrices")) {
        data = handlers.convert?.() ?? {};
      } else if (request.method === "GET") {
        const result = handlers.get?.();
        if (result === undefined)
          throw Object.assign(new Error("no"), { code: 404 });
        data = result;
      }

      return Object.assign(new Response(null, { status: 200 }), {
        config: request,
        data: data as T,
      });
    },
  });
  return { androidpublisher, requests };
}

const BASE_ARGS = {
  packageName: "com.example.moonlit",
  productId: "hero.sage",
  title: "Moon Sage",
  description: "Unlock Moon Sage",
  priceAmountMicros: 24_990_000,
  currency: "USD",
};

function patchRequest(requests: Common.GaxiosOptions[]) {
  return requests.find((request) => request.method === "PATCH");
}

function regionalConfigs(request: Common.GaxiosOptions | undefined) {
  const data = request?.data as
    | {
        purchaseOptions?: Array<{
          regionalPricingAndAvailabilityConfigs?: Array<{
            regionCode?: string;
            availability?: string;
            price?: unknown;
          }>;
          newRegionsConfig?: unknown;
        }>;
      }
    | undefined;
  return data?.purchaseOptions?.[0];
}

describe("upsertModernAndroidOneTimeProduct", () => {
  it("uses the generated lowercase one-time-product PATCH route", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({});

    await upsertModernAndroidOneTimeProduct(androidpublisher, BASE_ARGS, {
      allowCreate: true,
    });

    const request = patchRequest(requests);
    expect(request).toBeDefined();
    const requestUrl = new URL(String(request?.url));
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
    expect(request?.data).toMatchObject({
      packageName: "com.example.moonlit",
      productId: "hero.sage",
      listings: [
        {
          languageCode: "en-US",
          title: "Moon Sage",
          description: "Unlock Moon Sage",
        },
      ],
    });
  });

  // Issue #288: the push wrote a single hardcoded `regionCode: "US"`
  // config, so products were silently unbuyable in every other market.
  it("publishes every region Play converts the base price into", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      convert: () => ({
        convertedRegionPrices: {
          US: {
            regionCode: "US",
            price: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
          },
          KR: {
            regionCode: "KR",
            price: { currencyCode: "KRW", units: "33000", nanos: 0 },
          },
          JP: {
            regionCode: "JP",
            price: { currencyCode: "JPY", units: "3800", nanos: 0 },
          },
        },
        convertedOtherRegionsPrice: {
          usdPrice: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
          eurPrice: { currencyCode: "EUR", units: "22", nanos: 990_000_000 },
        },
      }),
    });

    const outcome = await upsertModernAndroidOneTimeProduct(
      androidpublisher,
      BASE_ARGS,
      { allowCreate: true },
    );

    const option = regionalConfigs(patchRequest(requests));
    expect(option?.regionalPricingAndAvailabilityConfigs).toEqual([
      {
        regionCode: "US",
        availability: "AVAILABLE",
        price: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
      },
      {
        regionCode: "KR",
        availability: "AVAILABLE",
        price: { currencyCode: "KRW", units: "33000", nanos: 0 },
      },
      {
        regionCode: "JP",
        availability: "AVAILABLE",
        price: { currencyCode: "JPY", units: "3800", nanos: 0 },
      },
    ]);
    // Markets Play launches later must be covered too, or the product
    // silently stops being available as Play expands.
    expect(option?.newRegionsConfig).toEqual({
      availability: "AVAILABLE",
      usdPrice: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
      eurPrice: { currencyCode: "EUR", units: "22", nanos: 990_000_000 },
    });
    expect(outcome.manualAction).toBeUndefined();
  });

  // The same replace semantics apply to the purchase-option list itself:
  // kit only models `buy`, so anything the operator added in Play Console
  // has to be echoed back or the push deletes it.
  it("never drops a purchase option kit doesn't model", async () => {
    const rentOption = {
      purchaseOptionId: "rent-48h",
      rentOption: { rentalPeriod: "P2D" },
      regionalPricingAndAvailabilityConfigs: [
        {
          regionCode: "US",
          availability: "AVAILABLE",
          price: { currencyCode: "USD", units: "4", nanos: 990_000_000 },
        },
      ],
    };
    const { androidpublisher, requests } = stubAndroidPublisher({
      get: () => ({
        purchaseOptions: [{ purchaseOptionId: "buy" }, rentOption],
      }),
      convert: () => ({
        convertedRegionPrices: {
          US: {
            regionCode: "US",
            price: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
          },
        },
      }),
    });

    await upsertModernAndroidOneTimeProduct(androidpublisher, BASE_ARGS, {
      allowCreate: false,
    });

    const data = patchRequest(requests)?.data as {
      purchaseOptions?: Array<{ purchaseOptionId?: string }>;
    };
    expect(data.purchaseOptions?.map((o) => o.purchaseOptionId)).toEqual([
      "buy",
      "rent-48h",
    ]);
    expect(data.purchaseOptions?.[1]).toEqual(rentOption);
  });

  // `updateMask: "purchaseOptions"` REPLACES the repeated field, so an
  // update that didn't read first would delete every region it omits —
  // silently un-selling a live product outside the converted set.
  it("never drops a region the product already had", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      get: () => ({
        purchaseOptions: [
          {
            purchaseOptionId: "buy",
            regionalPricingAndAvailabilityConfigs: [
              {
                regionCode: "US",
                availability: "AVAILABLE",
                price: { currencyCode: "USD", units: "19", nanos: 0 },
              },
              {
                regionCode: "BR",
                availability: "AVAILABLE",
                price: { currencyCode: "BRL", units: "99", nanos: 0 },
              },
              {
                regionCode: "RU",
                availability: "NO_LONGER_AVAILABLE",
                price: { currencyCode: "RUB", units: "1500", nanos: 0 },
              },
            ],
          },
        ],
      }),
      convert: () => ({
        convertedRegionPrices: {
          US: {
            regionCode: "US",
            price: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
          },
        },
      }),
    });

    await upsertModernAndroidOneTimeProduct(androidpublisher, BASE_ARGS, {
      allowCreate: false,
    });

    const configs =
      regionalConfigs(patchRequest(requests))
        ?.regionalPricingAndAvailabilityConfigs ?? [];
    const byRegion = new Map(configs.map((c) => [c.regionCode, c]));

    // Converted region takes the new price.
    expect(byRegion.get("US")?.price).toEqual({
      currencyCode: "USD",
      units: "24",
      nanos: 990_000_000,
    });
    // Unconverted regions survive untouched rather than being deleted.
    expect(byRegion.get("BR")?.price).toEqual({
      currencyCode: "BRL",
      units: "99",
      nanos: 0,
    });
    // A market the operator deliberately withdrew stays withdrawn.
    expect(byRegion.get("RU")?.availability).toBe("NO_LONGER_AVAILABLE");
  });

  it("preserves an operator's per-region availability while repricing", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      get: () => ({
        purchaseOptions: [
          {
            purchaseOptionId: "buy",
            regionalPricingAndAvailabilityConfigs: [
              {
                regionCode: "KR",
                availability: "NO_LONGER_AVAILABLE",
                price: { currencyCode: "KRW", units: "1000", nanos: 0 },
              },
            ],
          },
        ],
      }),
      convert: () => ({
        convertedRegionPrices: {
          KR: {
            regionCode: "KR",
            price: { currencyCode: "KRW", units: "33000", nanos: 0 },
          },
        },
      }),
    });

    await upsertModernAndroidOneTimeProduct(androidpublisher, BASE_ARGS, {
      allowCreate: false,
    });

    expect(
      regionalConfigs(patchRequest(requests))
        ?.regionalPricingAndAvailabilityConfigs,
    ).toEqual([
      {
        regionCode: "KR",
        availability: "NO_LONGER_AVAILABLE",
        price: { currencyCode: "KRW", units: "33000", nanos: 0 },
      },
    ]);
  });

  it("reports a manual action instead of silently shipping a US-only product", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      convert: () => {
        throw Object.assign(new Error("conversion unavailable"), { code: 500 });
      },
    });

    const outcome = await upsertModernAndroidOneTimeProduct(
      androidpublisher,
      BASE_ARGS,
      { allowCreate: true },
    );

    expect(
      regionalConfigs(patchRequest(requests))
        ?.regionalPricingAndAvailabilityConfigs,
    ).toEqual([
      {
        regionCode: "US",
        availability: "AVAILABLE",
        price: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
      },
    ]);
    expect(outcome.manualAction).toMatchObject({
      productId: "hero.sage",
      code: "regional_pricing_incomplete",
    });
    expect(outcome.manualAction?.message).toContain("Play Console");
  });

  it("refuses to publish a non-USD price to the US fallback region", async () => {
    const { androidpublisher } = stubAndroidPublisher({
      convert: () => {
        throw Object.assign(new Error("conversion unavailable"), { code: 500 });
      },
    });

    // Play pairs each region with its own currency, so a KRW amount on
    // regionCode "US" would 400. Fail with an actionable message instead.
    await expect(
      upsertModernAndroidOneTimeProduct(
        androidpublisher,
        { ...BASE_ARGS, currency: "KRW", priceAmountMicros: 700_000_000 },
        { allowCreate: true },
      ),
    ).rejects.toThrow(/could not convert KRW/);
  });
});

describe("buildSubscriptionRegionalConfigs", () => {
  it("maps every converted region and opens it to new subscribers", () => {
    expect(
      buildSubscriptionRegionalConfigs(
        {
          convertedRegionPrices: {
            US: {
              regionCode: "US",
              price: { currencyCode: "USD", units: "9", nanos: 990_000_000 },
            },
            KR: {
              regionCode: "KR",
              price: { currencyCode: "KRW", units: "13000", nanos: 0 },
            },
          },
        },
        { currencyCode: "USD", units: "9", nanos: 990_000_000 },
        "premium_monthly",
      ),
    ).toEqual([
      {
        regionCode: "US",
        price: { currencyCode: "USD", units: "9", nanos: 990_000_000 },
        newSubscriberAvailability: true,
      },
      {
        regionCode: "KR",
        price: { currencyCode: "KRW", units: "13000", nanos: 0 },
        newSubscriberAvailability: true,
      },
    ]);
  });

  it("falls back to the US base price when conversion is unavailable", () => {
    expect(
      buildSubscriptionRegionalConfigs(
        undefined,
        { currencyCode: "USD", units: "9", nanos: 990_000_000 },
        "premium_monthly",
      ),
    ).toEqual([
      {
        regionCode: "US",
        price: { currencyCode: "USD", units: "9", nanos: 990_000_000 },
        newSubscriberAvailability: true,
      },
    ]);
  });

  it("rejects a non-USD fallback rather than emitting an invalid config", () => {
    expect(() =>
      buildSubscriptionRegionalConfigs(
        undefined,
        { currencyCode: "KRW", units: "13000", nanos: 0 },
        "premium_monthly",
      ),
    ).toThrow(/could not convert KRW/);
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

describe("localized listings", () => {
  it("publishes the base listing plus every operator locale", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      convert: () => ({
        convertedRegionPrices: {
          US: {
            regionCode: "US",
            price: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
          },
        },
      }),
    });

    await upsertModernAndroidOneTimeProduct(
      androidpublisher,
      {
        ...BASE_ARGS,
        localizations: [
          { locale: "ko-KR", title: "문 세이지", description: "전체 해금" },
          { locale: "ja-JP", title: "ムーンセージ" },
        ],
      },
      { allowCreate: true },
    );

    const data = patchRequest(requests)?.data as {
      listings?: Array<{
        languageCode?: string;
        title?: string;
        description?: string;
      }>;
    };
    expect(data.listings).toEqual([
      {
        languageCode: "en-US",
        title: "Moon Sage",
        description: "Unlock Moon Sage",
      },
      { languageCode: "ko-KR", title: "문 세이지", description: "전체 해금" },
      // Play requires a description, so a locale that omits one reuses
      // its title rather than sending null.
      {
        languageCode: "ja-JP",
        title: "ムーンセージ",
        description: "ムーンセージ",
      },
    ]);
  });

  it("sends exactly the pre-localization listing when none are set", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({});

    await upsertModernAndroidOneTimeProduct(androidpublisher, BASE_ARGS, {
      allowCreate: true,
    });

    expect(
      (patchRequest(requests)?.data as { listings?: unknown[] }).listings,
    ).toEqual([
      {
        languageCode: "en-US",
        title: "Moon Sage",
        description: "Unlock Moon Sage",
      },
    ]);
  });

  // `updateMask` replaces the listings array too, so a locale added
  // directly in Play Console would be deleted by a kit push.
  it("never drops a locale the operator added in Play Console", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      get: () => ({
        listings: [
          { languageCode: "en-US", title: "Old", description: "Old" },
          { languageCode: "de-DE", title: "Mondweiser", description: "Alles" },
        ],
        purchaseOptions: [{ purchaseOptionId: "buy" }],
      }),
      convert: () => ({
        convertedRegionPrices: {
          US: {
            regionCode: "US",
            price: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
          },
        },
      }),
    });

    await upsertModernAndroidOneTimeProduct(
      androidpublisher,
      {
        ...BASE_ARGS,
        localizations: [{ locale: "ko-KR", title: "문 세이지" }],
      },
      { allowCreate: false },
    );

    const listings = (
      patchRequest(requests)?.data as {
        listings?: Array<{ languageCode?: string; title?: string }>;
      }
    ).listings;
    const byLocale = new Map(listings?.map((l) => [l.languageCode, l.title]));
    // kit's own locales win…
    expect(byLocale.get("en-US")).toBe("Moon Sage");
    expect(byLocale.get("ko-KR")).toBe("문 세이지");
    // …and the Play-Console-only locale survives.
    expect(byLocale.get("de-DE")).toBe("Mondweiser");
    expect(listings?.[0]?.languageCode).toBe("en-US");
  });
});

// Issue #288 follow-up found in review: conversion failure on an UPDATE
// preserved every existing region verbatim, which silently threw away
// the price change the operator had just made.
describe("conversion failure on an update", () => {
  it("still applies the new amount to regions using the base currency", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      get: () => ({
        purchaseOptions: [
          {
            purchaseOptionId: "buy",
            regionalPricingAndAvailabilityConfigs: [
              {
                regionCode: "US",
                availability: "AVAILABLE",
                price: { currencyCode: "USD", units: "19", nanos: 0 },
              },
              {
                regionCode: "KR",
                availability: "AVAILABLE",
                price: { currencyCode: "KRW", units: "25000", nanos: 0 },
              },
            ],
          },
        ],
      }),
      convert: () => {
        throw Object.assign(new Error("nope"), { code: 500 });
      },
    });

    const outcome = await upsertModernAndroidOneTimeProduct(
      androidpublisher,
      BASE_ARGS,
      { allowCreate: false },
    );

    const configs =
      regionalConfigs(patchRequest(requests))
        ?.regionalPricingAndAvailabilityConfigs ?? [];
    const byRegion = new Map(configs.map((c) => [c.regionCode, c]));
    // USD region takes the operator's new $24.99…
    expect(byRegion.get("US")?.price).toEqual({
      currencyCode: "USD",
      units: "24",
      nanos: 990_000_000,
    });
    // …and the KRW region keeps its old price rather than being given
    // a dollar amount Play would reject.
    expect(byRegion.get("KR")?.price).toEqual({
      currencyCode: "KRW",
      units: "25000",
      nanos: 0,
    });
    // The operator is told the rest did not move.
    expect(outcome.manualAction?.message).toContain("1 region(s)");
    expect(outcome.manualAction?.message).toContain(
      "kept their previous price",
    );
  });
});

describe("existing purchase-option fields", () => {
  it("preserves offer tags and tax settings on the buy option", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      get: () => ({
        purchaseOptions: [
          {
            purchaseOptionId: "buy",
            state: "ACTIVE",
            offerTags: [{ tag: "launch" }],
            taxAndComplianceSettings: { withdrawalRightType: "DIGITAL" },
          },
        ],
      }),
      convert: () => ({
        convertedRegionPrices: {
          US: {
            regionCode: "US",
            price: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
          },
        },
      }),
    });

    await upsertModernAndroidOneTimeProduct(androidpublisher, BASE_ARGS, {
      allowCreate: false,
    });

    const option = regionalConfigs(patchRequest(requests)) as unknown as {
      offerTags?: unknown;
      taxAndComplianceSettings?: unknown;
      state?: unknown;
    };
    expect(option.offerTags).toEqual([{ tag: "launch" }]);
    expect(option.taxAndComplianceSettings).toEqual({
      withdrawalRightType: "DIGITAL",
    });
    // `state` is output-only; echoing it back would 400.
    expect(option.state).toBeUndefined();
  });
});

// CodeRabbit caught this: `convertedRegionPrices` is an object, so a
// bare truthiness check treats `{}` — Play answering with no
// conversions — as success. The product would ship US-only while the
// sync reported a clean push with no manual action.
describe("empty conversion response", () => {
  it("is treated as a failed conversion, not a silent success", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      convert: () => ({ convertedRegionPrices: {} }),
    });

    const outcome = await upsertModernAndroidOneTimeProduct(
      androidpublisher,
      BASE_ARGS,
      { allowCreate: true },
    );

    expect(
      regionalConfigs(patchRequest(requests))
        ?.regionalPricingAndAvailabilityConfigs,
    ).toEqual([
      {
        regionCode: "US",
        availability: "AVAILABLE",
        price: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
      },
    ]);
    expect(outcome.manualAction?.code).toBe("regional_pricing_incomplete");
  });

  it("also enables base-currency repricing on an update", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      get: () => ({
        purchaseOptions: [
          {
            purchaseOptionId: "buy",
            regionalPricingAndAvailabilityConfigs: [
              {
                regionCode: "US",
                availability: "AVAILABLE",
                price: { currencyCode: "USD", units: "19", nanos: 0 },
              },
            ],
          },
        ],
      }),
      // A region map with only price-less entries is equally empty.
      convert: () => ({ convertedRegionPrices: { KR: { regionCode: "KR" } } }),
    });

    const outcome = await upsertModernAndroidOneTimeProduct(
      androidpublisher,
      BASE_ARGS,
      { allowCreate: false },
    );

    const byRegion = new Map(
      (
        regionalConfigs(patchRequest(requests))
          ?.regionalPricingAndAvailabilityConfigs ?? []
      ).map((c) => [c.regionCode, c]),
    );
    expect(byRegion.get("US")?.price).toEqual({
      currencyCode: "USD",
      units: "24",
      nanos: 990_000_000,
    });
    expect(outcome.manualAction?.code).toBe("regional_pricing_incomplete");
  });
});

// Found by live Play E2E, not by review: `convertRegionPrices` always
// converts using Play's CURRENT region definitions, so pinning an older
// regions version on the write makes Play reject any region whose
// currency changed since — "Invalid currency for region code BG …
// Expected BGN but got EUR".
describe("regions version alignment", () => {
  it("writes at the version the conversion was computed at", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      convert: () => ({
        regionVersion: { version: "2026/02" },
        convertedRegionPrices: {
          US: {
            regionCode: "US",
            price: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
          },
        },
      }),
    });

    await upsertModernAndroidOneTimeProduct(androidpublisher, BASE_ARGS, {
      allowCreate: true,
    });

    expect(
      new URL(String(patchRequest(requests)?.url)).searchParams.get(
        "regionsVersion.version",
      ),
    ).toBe("2026/02");
  });

  it("falls back to the historical pin when there is no conversion", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      convert: () => {
        throw Object.assign(new Error("nope"), { code: 500 });
      },
    });

    await upsertModernAndroidOneTimeProduct(androidpublisher, BASE_ARGS, {
      allowCreate: true,
    });

    expect(
      new URL(String(patchRequest(requests)?.url)).searchParams.get(
        "regionsVersion.version",
      ),
    ).toBe("2022/01");
  });
});

// Play refuses to drop a region once a purchase option has it ("Cannot
// remove region once it has been added"), so an explicit footprint has
// to withdraw the others rather than omit them.
describe("explicit sales regions", () => {
  const converted = {
    convertedRegionPrices: {
      US: {
        regionCode: "US",
        price: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
      },
      KR: {
        regionCode: "KR",
        price: { currencyCode: "KRW", units: "33000", nanos: 0 },
      },
      DE: {
        regionCode: "DE",
        price: { currencyCode: "EUR", units: "22", nanos: 0 },
      },
    },
    convertedOtherRegionsPrice: {
      usdPrice: { currencyCode: "USD", units: "24", nanos: 990_000_000 },
      eurPrice: { currencyCode: "EUR", units: "22", nanos: 0 },
    },
  };

  it("adds only the listed regions on a create", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      convert: () => converted,
    });

    await upsertModernAndroidOneTimeProduct(
      androidpublisher,
      { ...BASE_ARGS, regions: ["US", "KR"] },
      { allowCreate: true },
    );

    const option = regionalConfigs(patchRequest(requests));
    expect(
      option?.regionalPricingAndAvailabilityConfigs?.map((c) => c.regionCode),
    ).toEqual(["US", "KR"]);
    // An explicit footprint must not opt into markets Play adds later.
    expect(option?.newRegionsConfig).toBeUndefined();
  });

  it("withdraws an excluded region instead of removing it", async () => {
    const { androidpublisher, requests } = stubAndroidPublisher({
      get: () => ({
        purchaseOptions: [
          {
            purchaseOptionId: "buy",
            newRegionsConfig: {
              availability: "AVAILABLE",
              usdPrice: { currencyCode: "USD", units: "19", nanos: 0 },
              eurPrice: { currencyCode: "EUR", units: "17", nanos: 0 },
            },
            regionalPricingAndAvailabilityConfigs: [
              {
                regionCode: "US",
                availability: "AVAILABLE",
                price: { currencyCode: "USD", units: "19", nanos: 0 },
              },
              {
                regionCode: "DE",
                availability: "AVAILABLE",
                price: { currencyCode: "EUR", units: "17", nanos: 0 },
              },
            ],
          },
        ],
      }),
      convert: () => converted,
    });

    await upsertModernAndroidOneTimeProduct(
      androidpublisher,
      { ...BASE_ARGS, regions: ["US", "KR"] },
      { allowCreate: false },
    );

    const option = regionalConfigs(patchRequest(requests));
    const byRegion = new Map(
      (option?.regionalPricingAndAvailabilityConfigs ?? []).map((c) => [
        c.regionCode,
        c,
      ]),
    );
    expect(byRegion.get("US")?.availability).toBe("AVAILABLE");
    expect(byRegion.get("KR")?.availability).toBe("AVAILABLE");
    // DE stays in the list — Play won't accept its removal — but stops
    // being sellable.
    expect(byRegion.get("DE")?.availability).toBe("NO_LONGER_AVAILABLE");
    // An already-enabled "other regions" config is spread forward from
    // the existing option, so it has to be actively withdrawn.
    expect(
      (option?.newRegionsConfig as { availability?: string } | undefined)
        ?.availability,
    ).toBe("NO_LONGER_AVAILABLE");
  });
});
