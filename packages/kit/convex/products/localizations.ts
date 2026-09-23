import { ConvexError, v } from "convex/values";

// Localized store-listing text. A product's `title` / `description` stay the
// base listing every store requires; `localizations` only adds languages.
//
// Both stores take BCP-47-shaped codes (Play's `languageCode`, ASC's `locale`
// on IAP and subscription localizations), so one representation serves both.

/** Locale every product's base `title` / `description` is published as. */
export const BASE_LISTING_LOCALE = "en-US";

// Listing limits differ by store and, on Play, by product type: Play states
// no title cap for a subscription. Validate against the surface the row
// targets, never one store's limits for both.
export type ProductPlatform = "IOS" | "Android";
export type ProductListingType =
  | "Subscription"
  | "NonConsumable"
  | "Consumable";

export interface ListingLimits {
  /** undefined = the store documents no cap for this surface. */
  title?: number;
  description: number;
}

export function listingLimitsFor(
  platform: ProductPlatform,
  type: ProductListingType,
): ListingLimits {
  if (platform === "IOS") return { title: 30, description: 45 };
  // 200, not the 80 in the bundled googleapis 157 types: Play's live discovery
  // document says "Maximum length - 200 characters" for
  // SubscriptionListing.description.
  if (type === "Subscription") return { description: 200 };
  return { title: 55, description: 200 };
}

export interface ProductLocalization {
  locale: string;
  title: string;
  description?: string;
}

export const productLocalizationValidator = v.object({
  locale: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
});

export const productLocalizationsValidator = v.array(
  productLocalizationValidator,
);

// Play and ASC name locales differently (`zh-CN` vs `zh-Hans`, `es-419` vs
// `es-MX`), so the shared pattern admits script and numeric region subtags.
// ASC's fixed shortcode list is enforced separately below.
const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;

// ASC accepts only these shortcodes, not every BCP-47 tag: Japanese and Korean
// are `ja` / `ko`, not Play's `ja-JP` / `ko-KR`. Checking here turns an opaque
// ASC 409 during push-sync into a local error.
// https://developer.apple.com/documentation/appstoreconnectapi/managing-metadata-in-your-app-by-using-locale-shortcodes
const ASC_LOCALE_SHORTCODES = new Set([
  "ar-SA",
  "bn-BD",
  "ca",
  "zh-Hans",
  "zh-Hant",
  "hr",
  "cs",
  "da",
  "nl-NL",
  "en-AU",
  "en-CA",
  "en-GB",
  "en-US",
  "fi",
  "fr-FR",
  "fr-CA",
  "de-DE",
  "el",
  "gu-IN",
  "he",
  "hi",
  "hu",
  "id",
  "it",
  "ja",
  "kn-IN",
  "ko",
  "ms",
  "ml-IN",
  "mr-IN",
  "no",
  "or-IN",
  "pl",
  "pt-BR",
  "pt-PT",
  "pa-IN",
  "ro",
  "ru",
  "sk",
  "sl-SI",
  "es-MX",
  "es-ES",
  "sv",
  "ta-IN",
  "te-IN",
  "th",
  "tr",
  "uk",
  "ur-PK",
  "vi",
]);

const ASC_LOCALE_ALIASES = new Map([
  ["ja-JP", "ja"],
  ["ko-KR", "ko"],
]);

/**
 * Canonicalizes a BCP-47 tag's casing: lowercase language, Titlecase
 * script, uppercase region — `ko-kr` → `ko-KR`, `zh-hans` → `zh-Hans`.
 */
function canonicalizeLocale(raw: string): string {
  const parts = raw.trim().split("-");
  return parts
    .map((part, index) => {
      if (index === 0) return part.toLowerCase();
      if (part.length === 4) {
        return part[0].toUpperCase() + part.slice(1).toLowerCase();
      }
      return part.toUpperCase();
    })
    .join("-");
}

/** Converts a BCP-47 locale into the shortcode accepted by ASC. */
export function localeForAppStoreConnect(raw: string): string {
  const canonical = canonicalizeLocale(raw);
  const locale = ASC_LOCALE_ALIASES.get(canonical) ?? canonical;
  if (!ASC_LOCALE_SHORTCODES.has(locale)) {
    throw invalidListing(
      `Invalid App Store Connect locale "${raw}". Use an ASC locale shortcode such as "en-US", "ja", "ko", or "zh-Hans".`,
    );
  }
  return locale;
}

/**
 * Structured so the REST route and MCP tool map it to 400 rather than a
 * generic 500 — these are operator input mistakes, not server faults.
 */
function invalidListing(message: string): ConvexError<{
  code: string;
  message: string;
}> {
  return new ConvexError({ code: "INVALID_INPUT", message });
}

/**
 * Normalizes and validates operator-supplied localizations.
 *
 * @param localizations Raw rows from the dashboard / MCP / a pull.
 * @returns The cleaned list, or undefined when there is nothing to store.
 * @throws When a locale is malformed, duplicated, collides with the base
 *   locale, has a blank title, or exceeds a store length limit.
 */
export function normalizeProductLocalizations(
  localizations: ProductLocalization[] | undefined,
  platform: ProductPlatform,
  type: ProductListingType,
  baseLocale: string = BASE_LISTING_LOCALE,
): ProductLocalization[] | undefined {
  if (!localizations || localizations.length === 0) return undefined;

  const limits = listingLimitsFor(platform, type);
  const normalizedBaseLocale =
    platform === "IOS"
      ? localeForAppStoreConnect(baseLocale)
      : canonicalizeLocale(baseLocale);
  const seen = new Set<string>();
  const normalized: ProductLocalization[] = [];

  for (const entry of localizations) {
    // Canonical casing first, so `ko-kr` counts as a duplicate of `ko-KR` and
    // `EN-us` cannot dodge the base-locale check.
    const canonicalLocale = canonicalizeLocale(entry.locale);
    const locale =
      platform === "IOS"
        ? localeForAppStoreConnect(canonicalLocale)
        : canonicalLocale;
    if (!LOCALE_PATTERN.test(locale)) {
      throw invalidListing(
        `Invalid localization locale "${entry.locale}". Use a BCP-47 code such as "ko" or "ko-KR".`,
      );
    }
    if (locale === normalizedBaseLocale) {
      throw invalidListing(
        `Localization locale "${normalizedBaseLocale}" is reserved for the product's own title and description. Edit those instead of adding a localization for it.`,
      );
    }
    if (seen.has(locale)) {
      throw invalidListing(`Duplicate localization locale "${locale}".`);
    }
    seen.add(locale);

    const title = entry.title.trim();
    if (!title) {
      throw invalidListing(`Localization "${locale}" needs a title.`);
    }
    if (limits.title !== undefined && title.length > limits.title) {
      throw invalidListing(
        `Localization "${locale}" title is ${title.length} characters; ${platform} accepts at most ${limits.title}.`,
      );
    }

    const description = entry.description?.trim() || undefined;
    if (description && description.length > limits.description) {
      throw invalidListing(
        `Localization "${locale}" description is ${description.length} characters; ${platform} accepts at most ${limits.description}.`,
      );
    }

    normalized.push({
      locale,
      title,
      ...(description ? { description } : {}),
    });
  }

  // Stable order keeps request bodies (and therefore diffs and test
  // fixtures) deterministic regardless of dashboard input order.
  normalized.sort((a, b) => a.locale.localeCompare(b.locale));
  return normalized;
}

/**
 * Splits store listings into the base listing plus the extra locales; the
 * pull-side counterpart of {@link listingRowsForProduct}. Prefers the base
 * locale, else the first listing, so the required `title` is never empty.
 */
export function splitStoreListings(
  listings: Array<{
    locale?: string | null;
    title?: string | null;
    description?: string | null;
  }>,
  fallbackTitle: string,
  preferredBaseLocale: string = BASE_LISTING_LOCALE,
): {
  title: string;
  description?: string;
  baseLocale?: string;
  localizations?: ProductLocalization[];
} {
  const usable = listings.filter(
    (
      listing,
    ): listing is {
      locale: string;
      title: string;
      description?: string | null;
    } => Boolean(listing.locale && listing.title),
  );
  if (usable.length === 0) return { title: fallbackTitle };

  const base =
    usable.find((listing) => listing.locale === preferredBaseLocale) ??
    usable.find((listing) => listing.locale === BASE_LISTING_LOCALE);
  // Keep the promoted listing's locale as `baseLocale`, or the next push
  // would relabel that text as en-US.
  const promoted = base ?? usable[0];
  const others = usable
    .filter((listing) => listing.locale !== promoted.locale)
    .map((listing) => ({
      locale: listing.locale,
      title: listing.title,
      ...(listing.description ? { description: listing.description } : {}),
    }));

  return {
    title: promoted.title,
    ...(promoted.description ? { description: promoted.description } : {}),
    baseLocale: promoted.locale,
    ...(others.length > 0 ? { localizations: others } : {}),
  };
}

/**
 * Expands a product's base listing plus its localizations into the
 * `{locale, title, description}` rows a store push writes.
 *
 * The base listing always comes first so a store that treats the first
 * entry as the default gets the language the operator authored.
 */
export function listingRowsForProduct(product: {
  title: string;
  description?: string;
  baseLocale?: string;
  localizations?: ProductLocalization[];
}): ProductLocalization[] {
  const baseLocale = product.baseLocale ?? BASE_LISTING_LOCALE;
  return [
    {
      locale: baseLocale,
      title: product.title,
      ...(product.description ? { description: product.description } : {}),
    },
    ...(product.localizations ?? []).filter(
      (entry) => entry.locale !== baseLocale,
    ),
  ];
}
