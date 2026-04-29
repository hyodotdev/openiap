import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";

import { DOCS_NAV, type DocsNavEntry } from "./nav";
import { MixpanelEvent, trackEvent } from "@/lib/mixpanel";

/**
 * Docs shell. The container claims the full viewport and splits into
 * two independent scroll columns: the sidebar on the left owns its
 * own `overflow-y-auto` and the content `<main>` has its own. Before
 * this split, the right column's scroll would bubble up to whichever
 * layout wrapped us (Public / Auth) and carry the left rail along.
 *
 * Desktop also supports collapsing the sidebar to a narrow rail
 * (persisted to `localStorage`) for wider reading on smaller screens
 * or during pairing sessions. Mobile stays drawer-style with a
 * floating trigger — no in-page header now that the Public wrapper
 * no longer hosts the docs.
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

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar — own scroll column, fixed viewport height,
          collapsible to a 0-width rail with a re-open tab. */}
      <aside
        className={`relative hidden h-screen shrink-0 overflow-y-auto border-r border-border bg-card/30 py-6 transition-[width] md:block ${
          collapsed ? "w-0 border-r-0" : "w-64"
        }`}
      >
        {!collapsed && (
          <>
            <DocsNavHeader />
            <DocsNavTree />
          </>
        )}
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
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-30 w-72 overflow-y-auto border-r border-border bg-card py-6 md:hidden">
            <DocsNavHeader onNavigate={() => setMobileOpen(false)} />
            <DocsNavTree onNavigate={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {/* Mobile menu trigger — fixed so it follows the viewport, not
          the scrolling content underneath. */}
      <button
        type="button"
        onClick={() => setMobileOpen((open) => !open)}
        className="fixed top-3 left-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-md text-muted-foreground hover:text-foreground md:hidden"
        aria-label="Toggle docs navigation"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <main className="flex min-w-0 flex-1 justify-center overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

const COLLAPSE_KEY = "iapkit.docs.sidebarCollapsed";

function DocsNavHeader({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="mb-4 px-4">
      {/* Link points at `/` so users can leave the docs section
          entirely — previously this stayed inside /docs and users
          had no way back to the dashboard without the browser back
          button. */}
      <Link
        to="/"
        onClick={onNavigate}
        className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground hover:text-primary"
        title="Back to IAPKit"
      >
        <img
          src="/logo.png"
          alt=""
          className="h-6 w-6 rounded"
          aria-hidden="true"
        />
        <span>IAPKit</span>
        <span className="text-muted-foreground font-normal">Docs</span>
      </Link>
      {/* Cross-link to the blog. Signed-in users have no other way in
          — the public navigation is hidden inside the auth shell, so
          surface Blog right next to the home link. */}
      <Link
        to="/blog"
        onClick={onNavigate}
        className="mt-3 flex items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
      >
        <span className="font-medium">Blog</span>
        <span className="text-xs">→</span>
      </Link>
    </div>
  );
}

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
