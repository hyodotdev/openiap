import { useEffect, useMemo } from "react";
import { formatPageTitle } from "./usePageTitle";

export const SITE_ORIGIN = "https://kit.openiap.dev";
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-preview.webp`;

type JsonLd = Record<string, unknown> | Array<Record<string, unknown>>;

type SeoMeta = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  ogType?: "website" | "article";
  ogImage?: string;
  keywords?: string[];
  jsonLd?: JsonLd | null;
  jsonLdId?: string;
};

/**
 * Upserts a <meta> tag by name or property and flags it so cleanup
 * can remove only the tags this hook owns on unmount / navigation.
 * Crawlers that execute JS (Googlebot, Bingbot evergreen) read the
 * tag after React sets it; AEO/LLM crawlers that don't execute JS
 * still see the index.html baseline, which is why /blog and posts
 * also ship as static entries in sitemap.xml.
 */
function upsertMeta(attr: "name" | "property", key: string, value: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    el.setAttribute("data-seo-managed", "true");
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function upsertCanonical(href: string) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    el.setAttribute("data-seo-managed", "true");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function upsertJsonLd(id: string, data: JsonLd) {
  if (typeof document === "undefined") return;
  const selector = `script[type="application/ld+json"][data-seo-id="${id}"]`;
  let el = document.head.querySelector<HTMLScriptElement>(selector);
  if (!el) {
    el = document.createElement("script");
    el.setAttribute("type", "application/ld+json");
    el.setAttribute("data-seo-id", id);
    el.setAttribute("data-seo-managed", "true");
    document.head.appendChild(el);
  }
  // Escape `<` so a stray `</script>` inside JSON-LD content cannot
  // close the script tag early. The HTML parser treats the raw
  // sequence as markup; `<` is valid JSON + valid JS string and
  // the browser JSON.parse round-trips it transparently for crawlers.
  el.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
}

function removeJsonLd(id: string) {
  if (typeof document === "undefined") return;
  const el = document.head.querySelector(
    `script[type="application/ld+json"][data-seo-id="${id}"]`,
  );
  el?.remove();
}

// Removes every tag this hook previously set, regardless of page.
// Called on unmount AND whenever a route change is about to set new
// values, so the next page starts from a clean slate instead of
// inheriting stale description/keywords/canonical/og:* tags from the
// previous page.
function clearManagedSeoTags() {
  if (typeof document === "undefined") return;
  document.head
    .querySelectorAll('[data-seo-managed="true"]')
    .forEach((el) => el.remove());
}

export function useSeoMeta(meta: SeoMeta) {
  const {
    title,
    description,
    canonicalPath,
    ogType = "website",
    ogImage = DEFAULT_OG_IMAGE,
    keywords,
    jsonLd,
    jsonLdId,
  } = meta;

  // Callers typically construct `keywords` and `jsonLd` inline on
  // each render (see BlogIndex), which would give useEffect fresh
  // references every render and re-run the DOM upserts for no
  // reason. Serialize once per render so the dep list compares by
  // content. `JSON.stringify` is fine here — SEO payloads are
  // small and plain-JSON-safe.
  const keywordsKey = useMemo(
    () => (keywords && keywords.length > 0 ? JSON.stringify(keywords) : ""),
    [keywords],
  );
  const jsonLdKey = useMemo(
    () => (jsonLd ? JSON.stringify(jsonLd) : ""),
    [jsonLd],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    // Wipe anything a previous page left in the head so partial
    // updates (e.g. new page has no `description`) don't inherit
    // stale tags. Title, JSON-LD, canonical, og:*, twitter:* —
    // everything this hook owns.
    clearManagedSeoTags();

    const resolvedTitle = formatPageTitle(title);
    document.title = resolvedTitle;

    const canonicalUrl = canonicalPath
      ? new URL(canonicalPath, SITE_ORIGIN).toString()
      : undefined;

    if (description) {
      upsertMeta("name", "description", description);
      upsertMeta("property", "og:description", description);
      upsertMeta("property", "twitter:description", description);
    }

    if (keywords && keywords.length > 0) {
      upsertMeta("name", "keywords", keywords.join(", "));
    }

    upsertMeta("property", "og:title", resolvedTitle);
    upsertMeta("property", "twitter:title", resolvedTitle);
    upsertMeta("property", "og:type", ogType);
    upsertMeta("property", "og:image", ogImage);
    upsertMeta("property", "twitter:image", ogImage);
    upsertMeta("property", "twitter:card", "summary_large_image");

    if (canonicalUrl) {
      upsertCanonical(canonicalUrl);
      upsertMeta("property", "og:url", canonicalUrl);
      upsertMeta("property", "twitter:url", canonicalUrl);
    }

    if (jsonLd && jsonLdId) {
      upsertJsonLd(jsonLdId, jsonLd);
    }

    return () => {
      if (jsonLdId) {
        removeJsonLd(jsonLdId);
      }
      clearManagedSeoTags();
    };
    // `keywords` / `jsonLd` are inline literals at many callsites;
    // depend on serialized keys so the effect only re-runs on
    // actual content change. Runtime values are still read from the
    // live closure above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    description,
    canonicalPath,
    ogType,
    ogImage,
    keywordsKey,
    jsonLdKey,
    jsonLdId,
  ]);
}
