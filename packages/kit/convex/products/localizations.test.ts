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
      normalizeProductLocalizations(
        [
          { locale: " ja-JP ", title: " ムーンセージ ", description: "  " },
          { locale: "ko-KR", title: "문 세이지", description: " 전체 해금 " },
        ],
        "Android",
        "Consumable",
      ),
    ).toEqual([
      { locale: "ja-JP", title: "ムーンセージ" },
      { locale: "ko-KR", title: "문 세이지", description: "전체 해금" },
    ]);
  });

  it("treats an absent or empty list as nothing to store", () => {
    expect(
      normalizeProductLocalizations(undefined, "Android", "Consumable"),
    ).toBeUndefined();
    expect(
      normalizeProductLocalizations([], "Android", "Consumable"),
    ).toBeUndefined();
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
      expect(
        normalizeProductLocalizations(
          [{ locale, title: "x" }],
          "Android",
          "Consumable",
        ),
      ).toEqual([{ locale, title: "x" }]);
    }
  });

  it("rejects malformed locales rather than letting the store 400", () => {
    for (const locale of ["ko_KR", "", "k", "ko-", "-KR", "ko KR"]) {
      expect(() =>
        normalizeProductLocalizations(
          [{ locale, title: "x" }],
          "Android",
          "Consumable",
        ),
      ).toThrow(/Invalid localization locale/);
    }
  });

  it("reserves the base locale for the product's own title", () => {
    expect(() =>
      normalizeProductLocalizations(
        [{ locale: BASE_LISTING_LOCALE, title: "Moon Sage" }],
        "Android",
        "Consumable",
      ),
    ).toThrow(/reserved/);
  });

  it("rejects duplicate locales", () => {
    expect(() =>
      normalizeProductLocalizations(
        [
          { locale: "ko-KR", title: "하나" },
          { locale: "ko-KR", title: "둘" },
        ],
        "Android",
        "Consumable",
      ),
    ).toThrow(/Duplicate localization locale/);
  });

  it("rejects a blank title and over-long store text", () => {
    expect(() =>
      normalizeProductLocalizations(
        [{ locale: "ko-KR", title: "   " }],
        "Android",
        "Consumable",
      ),
    ).toThrow(/needs a title/);
    expect(() =>
      normalizeProductLocalizations(
        [{ locale: "ko-KR", title: "가".repeat(56) }],
        "Android",
        "Consumable",
      ),
    ).toThrow(/at most 55/);
    expect(() =>
      normalizeProductLocalizations(
        [{ locale: "ko-KR", title: "코인", description: "가".repeat(201) }],
        "Android",
        "Consumable",
      ),
    ).toThrow(/at most 200/);
  });

  // ASC caps IAP localization name/description far below Play's limits;
  // validating against one store would either block a legal Android
  // title or pass an iOS one that ASC then rejects.
  it("applies each platform's own store limits", () => {
    const long = { locale: "ko-KR", title: "가".repeat(40) };
    expect(
      normalizeProductLocalizations([long], "Android", "Consumable"),
    ).toEqual([long]);
    expect(() =>
      normalizeProductLocalizations([long], "IOS", "Consumable"),
    ).toThrow(/IOS accepts at most 30/);
  });

  // Play documents a 55-char title for a one-time product but no title
  // cap for a subscription, so holding both to 55 would refuse a legal
  // subscription name.
  it("does not cap a Play subscription title", () => {
    const long = { locale: "ko-KR", title: "가".repeat(80) };
    expect(
      normalizeProductLocalizations([long], "Android", "Subscription"),
    ).toEqual([long]);
    expect(() =>
      normalizeProductLocalizations([long], "Android", "Consumable"),
    ).toThrow(/at most 55/);
  });

  it("canonicalizes locale casing so ko-kr and ko-KR are one locale", () => {
    expect(
      normalizeProductLocalizations(
        [{ locale: "ko-kr", title: "코인" }],
        "Android",
        "Consumable",
      ),
    ).toEqual([{ locale: "ko-KR", title: "코인" }]);
    expect(
      normalizeProductLocalizations(
        [{ locale: "zh-hans", title: "币" }],
        "Android",
        "Consumable",
      ),
    ).toEqual([{ locale: "zh-Hans", title: "币" }]);
    // Case-insensitive input is a feature, not a typo to reject.
    expect(
      normalizeProductLocalizations(
        [{ locale: "KO", title: "코인" }],
        "Android",
        "Consumable",
      ),
    ).toEqual([{ locale: "ko", title: "코인" }]);
    expect(() =>
      normalizeProductLocalizations(
        [
          { locale: "ko-KR", title: "하나" },
          { locale: "ko-kr", title: "둘" },
        ],
        "Android",
        "Consumable",
      ),
    ).toThrow(/Duplicate localization locale/);
    // Casing must not let a caller sneak past the base-locale guard.
    expect(() =>
      normalizeProductLocalizations(
        [{ locale: "EN-us", title: "x" }],
        "Android",
        "Consumable",
      ),
    ).toThrow(/reserved/);
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

  // Promoting is unavoidable — `title` is required — but the promoted
  // listing must ALSO stay a localization, or the locale is lost and the
  // next push republishes that text as en-US.
  it("promotes the first listing without losing its locale", () => {
    expect(
      splitStoreListings([{ locale: "ko-KR", title: "문 세이지" }], "fallback"),
    ).toEqual({
      title: "문 세이지",
      localizations: [{ locale: "ko-KR", title: "문 세이지" }],
    });
  });

  it("round-trips a store that has no en-US listing", () => {
    const pulled = splitStoreListings(
      [
        { locale: "ko-KR", title: "문 세이지", description: "전체 해금" },
        { locale: "ja-JP", title: "ムーンセージ" },
      ],
      "fallback",
    );
    // ko-KR survives the round trip rather than being flattened into the
    // en-US slot and disappearing.
    expect(listingRowsForProduct(pulled).map((row) => row.locale)).toEqual([
      "en-US",
      "ko-KR",
      "ja-JP",
    ]);
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
