import { describe, expect, it } from "vitest";

import {
  BASE_LISTING_LOCALE,
  listingRowsForProduct,
  normalizeProductLocalizations,
  splitStoreListings,
} from "./localizations";

describe("normalizeProductLocalizations", () => {
  it("trims, drops blank descriptions, and sorts by locale", () => {
    expect(
      normalizeProductLocalizations([
        { locale: " ja-JP ", title: " ムーンセージ ", description: "  " },
        { locale: "ko-KR", title: "문 세이지", description: " 전체 해금 " },
      ]),
    ).toEqual([
      { locale: "ja-JP", title: "ムーンセージ" },
      { locale: "ko-KR", title: "문 세이지", description: "전체 해금" },
    ]);
  });

  it("treats an absent or empty list as nothing to store", () => {
    expect(normalizeProductLocalizations(undefined)).toBeUndefined();
    expect(normalizeProductLocalizations([])).toBeUndefined();
  });

  // Play and ASC use different vocabularies (zh-CN vs zh-Hans, es-419 vs
  // es-MX) and a row targets one platform, so both families must pass.
  it("accepts every locale shape the two stores actually use", () => {
    for (const locale of [
      "ko",
      "ko-KR",
      "pt-BR",
      "en-GB",
      "zh-CN",
      "zh-Hans",
      "zh-Hant",
      "es-419",
      "zh-Hant-TW",
    ]) {
      expect(normalizeProductLocalizations([{ locale, title: "x" }])).toEqual([
        { locale, title: "x" },
      ]);
    }
  });

  it("rejects malformed locales rather than letting the store 400", () => {
    for (const locale of ["ko_KR", "KO", "", "k", "ko-", "-KR", "ko KR"]) {
      expect(() =>
        normalizeProductLocalizations([{ locale, title: "x" }]),
      ).toThrow(/Invalid localization locale/);
    }
  });

  it("reserves the base locale for the product's own title", () => {
    expect(() =>
      normalizeProductLocalizations([
        { locale: BASE_LISTING_LOCALE, title: "Moon Sage" },
      ]),
    ).toThrow(/reserved/);
  });

  it("rejects duplicate locales", () => {
    expect(() =>
      normalizeProductLocalizations([
        { locale: "ko-KR", title: "하나" },
        { locale: "ko-KR", title: "둘" },
      ]),
    ).toThrow(/Duplicate localization locale/);
  });

  it("rejects a blank title and over-long store text", () => {
    expect(() =>
      normalizeProductLocalizations([{ locale: "ko-KR", title: "   " }]),
    ).toThrow(/needs a title/);
    expect(() =>
      normalizeProductLocalizations([
        { locale: "ko-KR", title: "가".repeat(56) },
      ]),
    ).toThrow(/at most 55/);
    expect(() =>
      normalizeProductLocalizations([
        { locale: "ko-KR", title: "코인", description: "가".repeat(201) },
      ]),
    ).toThrow(/at most 200/);
  });
});

describe("listingRowsForProduct", () => {
  it("puts the base listing first, then the extra locales", () => {
    expect(
      listingRowsForProduct({
        title: "Moon Sage",
        description: "Unlock Moon Sage",
        localizations: [{ locale: "ko-KR", title: "문 세이지" }],
      }),
    ).toEqual([
      {
        locale: BASE_LISTING_LOCALE,
        title: "Moon Sage",
        description: "Unlock Moon Sage",
      },
      { locale: "ko-KR", title: "문 세이지" },
    ]);
  });

  it("produces exactly the pre-localization single listing when none are set", () => {
    expect(listingRowsForProduct({ title: "Moon Sage" })).toEqual([
      { locale: BASE_LISTING_LOCALE, title: "Moon Sage" },
    ]);
  });
});

describe("splitStoreListings", () => {
  it("splits a pulled listing set into base plus localizations", () => {
    expect(
      splitStoreListings(
        [
          { locale: "ko-KR", title: "문 세이지", description: "전체 해금" },
          { locale: "en-US", title: "Moon Sage", description: "Unlock" },
        ],
        "fallback",
      ),
    ).toEqual({
      title: "Moon Sage",
      description: "Unlock",
      localizations: [
        { locale: "ko-KR", title: "문 세이지", description: "전체 해금" },
      ],
    });
  });

  it("promotes the first listing when the store has no base locale", () => {
    expect(
      splitStoreListings([{ locale: "ko-KR", title: "문 세이지" }], "fallback"),
    ).toEqual({ title: "문 세이지" });
  });

  it("falls back to the product id when nothing is usable", () => {
    expect(splitStoreListings([], "hero.sage")).toEqual({
      title: "hero.sage",
    });
    expect(
      splitStoreListings([{ locale: "ko-KR", title: null }], "hero.sage"),
    ).toEqual({ title: "hero.sage" });
  });

  it("round-trips with listingRowsForProduct", () => {
    const product = {
      title: "Moon Sage",
      description: "Unlock Moon Sage",
      localizations: [
        { locale: "ja-JP", title: "ムーンセージ" },
        { locale: "ko-KR", title: "문 세이지", description: "전체 해금" },
      ],
    };
    expect(
      splitStoreListings(listingRowsForProduct(product), "unused"),
    ).toEqual(product);
  });
});
