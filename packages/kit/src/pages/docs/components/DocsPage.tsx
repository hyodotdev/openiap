import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { DOCS_NAV, flattenDocsNav, type DocsNavEntry } from "../nav";

// `DOCS_NAV` is a module-level constant, so flatten once at module
// load instead of on every `DocsPage` render. Each docs page mounts
// one DocsPage; without hoisting, every navigation re-walked the
// nav tree just to derive a 1- or 2-segment breadcrumb.
const FLATTENED_NAV = flattenDocsNav(DOCS_NAV);

/**
 * Wraps every docs section. Renders the breadcrumb + title block up
 * top and the content below. Each page passes its own `slug` so we
 * can derive the breadcrumb from the flattened nav tree without
 * plumbing state through router.
 */
export function DocsPage({
  slug,
  title,
  description,
  children,
}: {
  slug: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const crumbs = buildBreadcrumbs(slug);

  return (
    <article className="w-full max-w-3xl px-4 pt-8 md:px-8">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link to="/docs" className="hover:text-foreground">
          Docs
        </Link>
        {crumbs.slice(0, -1).map((crumb) => (
          <span key={crumb.slug} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <Link to={`/docs/${crumb.slug}`} className="hover:text-foreground">
              {crumb.title}
            </Link>
          </span>
        ))}
      </nav>

      <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      {description && (
        <p className="mb-8 text-lg text-muted-foreground">{description}</p>
      )}

      <div className="docs-content text-[15px] leading-7 text-foreground/90">
        {children}
      </div>
      {/* Trailing spacer so the last line of content doesn't sit flush
          against the bottom of the viewport at scroll-end. A `pb-*` on
          the article itself gets trimmed by a Blink/WebKit quirk when
          the article is a flex item inside a scroll container, so use
          a real block element with a fixed height instead. */}
      <div aria-hidden style={{ height: "80px" }} />
    </article>
  );
}

function buildBreadcrumbs(targetSlug: string): DocsNavEntry[] {
  if (!targetSlug) return [{ slug: "", title: "Introduction" }];
  const match = FLATTENED_NAV.find((entry) => entry.slug === targetSlug);
  if (!match) return [];

  // At most one level of nesting, so parent is the prefix of the slug
  // before the last `/`. Top-level pages have no parent — previously
  // we defaulted `parentSlug` to `""` which matched the Introduction
  // entry and produced `Docs > Introduction > Quickstart` for every
  // top-level page. Now we only look up a parent when the slug itself
  // is nested.
  const parentSlug = targetSlug.includes("/")
    ? targetSlug.slice(0, targetSlug.lastIndexOf("/"))
    : null;
  const parent =
    parentSlug !== null
      ? FLATTENED_NAV.find((entry) => entry.slug === parentSlug)
      : null;
  return parent && parent.slug !== match.slug ? [parent, match] : [match];
}
