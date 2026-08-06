import { ConvexError, v } from "convex/values";

// Localized store-listing text. A product's `title` / `description`
// remain the base listing every store requires; `localizations` only
// adds languages on top of it, so a row without any behaves exactly as
// it did before this existed.
//
// Both stores take BCP-47 codes in the same shape — Play calls the field
// `languageCode` on its listing objects, App Store Connect calls it
// `locale` on inAppPurchaseLocalizations / subscriptionLocalizations —
// so one representation serves both push paths.

/** Locale every product's base `title` / `description` is published as. */
export const BASE_LISTING_LOCALE = "en-US";

// The stores cap listing text differently, and Play differs again by
// product type: it documents 55/200 for a one-time product but only a
// description cap for a subscription, leaving the title uncapped. App
// Store Connect allows 30/45. Validate against the exact surface the
// row targets so an Android operator isn't held to Apple's limit, an
// iOS operator isn't told their text is fine right up until ASC rejects
// it, and a legal subscription title isn't refused for exceeding a
// limit Play never states.
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

// Play and ASC do NOT share a locale vocabulary — Simplified Chinese is
// `zh-CN` on Play and `zh-Hans` on ASC; Latin American Spanish is
// `es-419` on Play and `es-MX` on ASC. A product row targets exactly one
// platform, so the operator authors the codes that row's own store
// expects and no translation layer is needed. The pattern therefore has
// to admit script subtags (`zh-Hans`) and numeric region subtags
// (`es-419`) alongside `ko` and `pt-BR`, while still rejecting the
// obvious typos (`ko_KR`, `KO`, `korean`) that would otherwise surface
// as an opaque 400 from the store two steps later.
const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;

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

/**
 * Normalizes and validates operator-supplied localizations.
 *
 * @param localizations Raw rows from the dashboard / MCP / a pull.
 * @returns The cleaned list, or undefined when there is nothing to store.
 * @throws When a locale is malformed, duplicated, collides with the base
 *   locale, has a blank title, or exceeds a store length limit.
 */
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

export function normalizeProductLocalizations(
  localizations: ProductLocalization[] | undefined,
  platform: ProductPlatform,
  type: ProductListingType,
): ProductLocalization[] | undefined {
  if (!localizations || localizations.length === 0) return undefined;

  const limits = listingLimitsFor(platform, type);
  const seen = new Set<string>();
  const normalized: ProductLocalization[] = [];

  for (const entry of localizations) {
    // Canonicalize case before comparing: `ko-kr` and `ko-KR` are the
    // same locale, so without this a duplicate slips through and the
    // store rejects the pair — and `EN-us` would dodge the base-locale
    // guard entirely.
    const locale = canonicalizeLocale(entry.locale);
    if (!LOCALE_PATTERN.test(locale)) {
      throw invalidListing(
        `Invalid localization locale "${entry.locale}". Use a BCP-47 code such as "ko" or "ko-KR".`,
      );
    }
    if (locale === BASE_LISTING_LOCALE) {
      throw invalidListing(
        `Localization locale "${BASE_LISTING_LOCALE}" is reserved for the product's own title and description. Edit those instead of adding a localization for it.`,
      );
    }
    if (seen.has(locale)) {
      throw new Error(`Duplicate localization locale "${locale}".`);
    }
    seen.add(locale);

    const title = entry.title.trim();
    if (!title) {
      throw new Error(`Localization "${locale}" needs a title.`);
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
 * Splits store listings into the base listing plus the extra locales.
 *
 * The pull direction's counterpart to {@link listingRowsForProduct}: a
 * store's listing array becomes the `title` / `description` /
 * `localizations` triple a product row stores. The base locale is
 * preferred as the base listing; when a store has no entry for it (an
 * app authored entirely in another language) the first listing takes
 * that role so the required `title` is never empty.
 */
export function splitStoreListings(
  listings: Array<{
    locale?: string | null;
    title?: string | null;
    description?: string | null;
  }>,
  fallbackTitle: string,
): {
  title: string;
  description?: string;
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

  const base = usable.find((listing) => listing.locale === BASE_LISTING_LOCALE);
  // A store with no base-locale listing still has to yield a non-empty
  // `title`, so the first listing is promoted into that slot — but it is
  // ALSO kept as a localization. Dropping it would lose the locale, and
  // the next push would then republish that text as en-US.
  const promoted = base ?? usable[0];
  const others = usable
    .filter((listing) => listing.locale !== BASE_LISTING_LOCALE)
    .map((listing) => ({
      locale: listing.locale,
      title: listing.title,
      ...(listing.description ? { description: listing.description } : {}),
    }));

  return {
    title: promoted.title,
    ...(promoted.description ? { description: promoted.description } : {}),
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
  localizations?: ProductLocalization[];
}): ProductLocalization[] {
  return [
    {
      locale: BASE_LISTING_LOCALE,
      title: product.title,
      ...(product.description ? { description: product.description } : {}),
    },
    ...(product.localizations ?? []).filter(
      (entry) => entry.locale !== BASE_LISTING_LOCALE,
    ),
  ];
}
