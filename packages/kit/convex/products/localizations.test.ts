import { describe, expect, it } from "vitest";

import {
  BASE_LISTING_LOCALE,
  listingRowsForProduct,
  normalizeProductLocalizations,
  splitStoreListings,
} from "./localizations";

describe("normalizeProductLocalizations", () => {
  it("sorts by locale so a store request body is deterministic", () => {
    expect(
      normalizeProductLocalizations(
        [
          { locale: "ko-KR", title: "코인" },
          { locale: "de-DE", title: "Münzen" },
          { locale: "ja-JP", title: "コイン" },
        ],
        "Android",
        "Consumable",
      )?.map((l) => l.locale),
    ).toEqual(["de-DE", "ja-JP", "ko-KR"]);
  });

  it("trims and drops blank descriptions", () => {
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

  it("normalizes common Japanese and Korean tags to ASC shortcodes", () => {
    expect(
      normalizeProductLocalizations(
        [
          { locale: "ja-JP", title: "コイン" },
          { locale: "ko-KR", title: "코인" },
        ],
        "IOS",
        "Consumable",
      ),
    ).toEqual([
      { locale: "ja", title: "コイン" },
      { locale: "ko", title: "코인" },
    ]);
  });

  it("rejects BCP-47 locales outside ASC's supported shortcode list", () => {
    expect(() =>
      normalizeProductLocalizations(
        [{ locale: "es-419", title: "Monedas" }],
        "IOS",
        "Consumable",
      ),
    ).toThrow(/App Store Connect locale.*es-419/);
  });

  it("detects duplicates after applying ASC aliases", () => {
    expect(() =>
      normalizeProductLocalizations(
        [
          { locale: "ko", title: "하나" },
          { locale: "ko-KR", title: "둘" },
        ],
        "IOS",
        "Consumable",
      ),
    ).toThrow(/Duplicate localization locale/);
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

describe("non-English base localization validation", () => {
  it("reserves the actual base locale and permits en-US as an extra", () => {
    expect(
      normalizeProductLocalizations(
        [{ locale: "en-US", title: "Moon Sage" }],
        "Android",
        "Consumable",
        "ko-KR",
      ),
    ).toEqual([{ locale: "en-US", title: "Moon Sage" }]);
    expect(() =>
      normalizeProductLocalizations(
        [{ locale: "ko-KR", title: "중복" }],
        "Android",
        "Consumable",
        "ko-KR",
      ),
    ).toThrow(/ko-KR.*reserved/);
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
      baseLocale: "en-US",
      localizations: [
        { locale: "ko-KR", title: "문 세이지", description: "전체 해금" },
      ],
    });
  });

  it("promotes the first listing and records its locale", () => {
    expect(
      splitStoreListings([{ locale: "ko-KR", title: "문 세이지" }], "fallback"),
    ).toEqual({
      title: "문 세이지",
      baseLocale: "ko-KR",
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
    // ko-KR stays the base rather than being flattened into a fabricated
    // en-US listing on the next push.
    expect(listingRowsForProduct(pulled).map((row) => row.locale)).toEqual([
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
    ).toEqual({ ...product, baseLocale: "en-US" });
  });

  it("round-trips a non-en-US base without inventing another locale", () => {
    const product = {
      title: "문 세이지",
      description: "전체 해금",
      baseLocale: "ko-KR",
      localizations: [{ locale: "ja-JP", title: "ムーンセージ" }],
    };
    expect(
      splitStoreListings(listingRowsForProduct(product), "unused"),
    ).toEqual(product);
  });

  it("honors an explicit store default locale", () => {
    expect(
      splitStoreListings(
        [
          { locale: "en-US", title: "Moon Sage" },
          { locale: "ko-KR", title: "문 세이지" },
        ],
        "unused",
        "ko-KR",
      ),
    ).toEqual({
      title: "문 세이지",
      baseLocale: "ko-KR",
      localizations: [{ locale: "en-US", title: "Moon Sage" }],
    });
  });
});
