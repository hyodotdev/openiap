import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";

import { DOCS_NAV, type DocsNavEntry } from "./nav";
import { SiteHeader } from "@/components/SiteHeader";
import { MixpanelEvent, trackEvent } from "@/lib/mixpanel";

/**
 * Docs shell: the site header, then two independent scroll columns —
 * the sidebar and the content. Desktop can collapse the sidebar
 * (persisted to `localStorage`); mobile opens it as a drawer from the
 * bar under the header.
 */
export default function DocsLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    // `localStorage` access throws in some private-browsing modes and
    // when storage is fully disabled (Safari ITP, locked-down
    // enterprise profiles). The collapsed flag is a best-effort
    // preference, not load-bearing — fall back to expanded so a
    // throw here can never crash the docs shell on first paint.
    try {
      return window.localStorage?.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage?.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // Private-mode / disabled storage — collapse is a best-effort
      // preference, don't let a write failure crash the page.
    }
  }, [collapsed]);

  // Intent signal: fire once per docs session when the shell mounts.
  // Sub-route navigation inside the docs is still captured by
  // mixpanel's autocapture `$mp_web_page_view`; this is the
  // "customer opened the manual" milestone we actually want to cohort
  // on for retention (did users who read the docs stay longer?).
  useEffect(() => {
    trackEvent(MixpanelEvent.ViewedDocs);
  }, []);

  const { pathname } = useLocation();
  const currentTitle = findCurrentTitle(DOCS_NAV, pathname);

  return (
    <div className="flex h-screen flex-col bg-background">
      <SiteHeader fullWidth />

      {/* Mobile docs menu — sits under the header instead of floating
          over the content. */}
      <button
        type="button"
        onClick={() => setMobileOpen((open) => !open)}
        className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4 text-sm font-medium text-foreground md:hidden"
        aria-label="Toggle docs navigation"
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? (
          <X className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Menu className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="truncate">{currentTitle ?? "Docs"}</span>
      </button>

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar — own scroll column, collapsible to a 0-width
          rail with a re-open tab. */}
        <aside
          className={`relative hidden h-full shrink-0 overflow-y-auto border-r border-border py-6 transition-[width] md:block ${
            collapsed ? "w-0 border-r-0" : "w-64"
          }`}
        >
          {!collapsed && <DocsNavTree />}
        </aside>

        {/* Desktop collapse toggle — always visible, flush to the rail. */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="sticky top-3 z-10 ml-0 hidden h-8 w-6 shrink-0 -translate-x-0 items-center justify-center self-start rounded-r-md border border-l-0 border-border bg-card text-muted-foreground shadow-sm hover:text-foreground md:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {/* Mobile drawer + scrim */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-border bg-card py-6 md:hidden">
              <DocsNavTree onNavigate={() => setMobileOpen(false)} />
            </aside>
          </>
        )}

        <main className="flex min-w-0 flex-1 justify-center overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const COLLAPSE_KEY = "iapkit.docs.sidebarCollapsed";

function DocsNavTree({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav className="px-4">
      {DOCS_NAV.map((entry) => (
        <DocsNavRow
          key={entry.slug}
          entry={entry}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function DocsNavRow({
  entry,
  pathname,
  depth = 0,
  onNavigate,
}: {
  entry: DocsNavEntry;
  pathname: string;
  depth?: number;
  onNavigate?: () => void;
}) {
  const href = entry.slug ? `/docs/${entry.slug}` : "/docs";
  const isActive = isEntryActive(entry, pathname);
  const isAncestorActive =
    entry.children?.some((child) => isEntryActive(child, pathname)) ?? false;

  return (
    <div>
      <Link
        to={href}
        onClick={onNavigate}
        title={entry.summary}
        aria-current={isActive ? "page" : undefined}
        className={`group relative flex items-center rounded-md py-1.5 pr-2 text-sm transition-colors ${
          depth === 0 ? "font-medium" : "font-normal"
        } ${
          isActive
            ? "bg-primary/15 text-primary"
            : isAncestorActive && depth === 0
              ? "text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
      >
        {/* Left accent bar for the active row — the bg tint alone was
            easy to miss on the dark theme. */}
        <span
          aria-hidden="true"
          className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full transition-colors ${
            isActive ? "bg-primary" : "bg-transparent"
          }`}
        />
        <span>{entry.title}</span>
      </Link>
      {entry.children && (
        <div className="mt-1 mb-2 space-y-0.5">
          {entry.children.map((child) => (
            <DocsNavRow
              key={child.slug}
              entry={child}
              pathname={pathname}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function findCurrentTitle(
  entries: DocsNavEntry[],
  pathname: string,
): string | undefined {
  for (const entry of entries) {
    if (isEntryActive(entry, pathname)) return entry.title;
    const child = entry.children && findCurrentTitle(entry.children, pathname);
    if (child) return child;
  }
  return undefined;
}

/**
 * Highlight logic: a row is active when its slug matches the path
 * exactly (`/docs` for "" / `/docs/quickstart` for "quickstart") or
 * when the path is a descendant of the row's slug and the row itself
 * has no children (so that "verification/apple" lights up its leaf,
 * not the "Store setup" parent).
 */
function isEntryActive(entry: DocsNavEntry, pathname: string): boolean {
  const href = entry.slug ? `/docs/${entry.slug}` : "/docs";
  if (entry.slug === "") {
    return pathname === "/docs" || pathname === "/docs/";
  }
  if (entry.children) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
