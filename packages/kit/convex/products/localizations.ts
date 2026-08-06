import { v } from "convex/values";

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

/** Play caps one-time-product titles at 55 chars, descriptions at 200. */
export const MAX_LISTING_TITLE_LENGTH = 55;
export const MAX_LISTING_DESCRIPTION_LENGTH = 200;

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

// Deliberately narrower than full BCP-47: Play and ASC both want the
// `language` or `language-REGION` forms in practice, and accepting
// exotic subtags here would only surface as an opaque 400 from the
// store two steps later.
const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Z]{2})?$/;

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
): ProductLocalization[] | undefined {
  if (!localizations || localizations.length === 0) return undefined;

  const seen = new Set<string>();
  const normalized: ProductLocalization[] = [];

  for (const entry of localizations) {
    const locale = entry.locale.trim();
    if (!LOCALE_PATTERN.test(locale)) {
      throw new Error(
        `Invalid localization locale "${entry.locale}". Use a BCP-47 code such as "ko" or "ko-KR".`,
      );
    }
    if (locale === BASE_LISTING_LOCALE) {
      throw new Error(
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
    if (title.length > MAX_LISTING_TITLE_LENGTH) {
      throw new Error(
        `Localization "${locale}" title is ${title.length} characters; stores accept at most ${MAX_LISTING_TITLE_LENGTH}.`,
      );
    }

    const description = entry.description?.trim() || undefined;
    if (description && description.length > MAX_LISTING_DESCRIPTION_LENGTH) {
      throw new Error(
        `Localization "${locale}" description is ${description.length} characters; stores accept at most ${MAX_LISTING_DESCRIPTION_LENGTH}.`,
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

  const base =
    usable.find((listing) => listing.locale === BASE_LISTING_LOCALE) ??
    usable[0];
  const others = usable
    .filter((listing) => listing.locale !== base.locale)
    .map((listing) => ({
      locale: listing.locale,
      title: listing.title,
      ...(listing.description ? { description: listing.description } : {}),
    }));

  return {
    title: base.title,
    ...(base.description ? { description: base.description } : {}),
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
