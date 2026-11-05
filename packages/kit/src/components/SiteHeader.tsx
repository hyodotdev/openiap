import { useEffect, useState, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { Menu, X } from "lucide-react";

import { ThemeDropdown } from "./ThemeDropdown";
import { useShowsLandingFeatures } from "../hooks/useShowsLandingFeatures";
import { openAuthModal } from "../lib/signals";
import GetStartedButton from "./GetStartedButton";

interface NavItem {
  label: string;
  to: string;
  matches?: string;
  external?: boolean;
}

const FEATURES_ITEM: NavItem = { label: "Features", to: "/#features" };

const NAV_ITEMS: NavItem[] = [
  { label: "Docs", to: "/docs", matches: "/docs" },
  { label: "Pricing", to: "/pricing", matches: "/pricing" },
  { label: "Blog", to: "/blog", matches: "/blog" },
  { label: "Sponsors", to: "https://openiap.dev/sponsors", external: true },
];

/**
 * The one header for the landing page, docs, and blog, signed in or not.
 * `fullWidth` lines it up with the docs sidebar instead of the page column.
 */
export function SiteHeader({ fullWidth = false }: { fullWidth?: boolean }) {
  const location = useLocation();
  const { isAuthenticated } = useConvexAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = useShowsLandingFeatures()
    ? [FEATURES_ITEM, ...NAV_ITEMS]
    : NAV_ITEMS;

  const isActive = (item: NavItem) =>
    item.matches !== undefined &&
    (location.pathname === item.matches ||
      location.pathname.startsWith(`${item.matches}/`));
  // "page" only on the section's own page; "true" inside the section.
  const ariaCurrent = (item: NavItem) =>
    isActive(item)
      ? location.pathname === item.matches
        ? "page"
        : "true"
      : undefined;

  // Features is a section of the landing page; scroll when already there.
  const handleNavClick = (item: NavItem, event: MouseEvent) => {
    if (item === FEATURES_ITEM && location.pathname === "/") {
      event.preventDefault();
      document
        .getElementById("features")
        ?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const navLinkClass = (item: NavItem) =>
    `text-sm font-medium transition-colors whitespace-nowrap ${
      isActive(item)
        ? "text-foreground"
        : "text-muted-foreground hover:text-foreground"
    }`;

  const renderNavItem = (
    item: NavItem,
    onSelect?: () => void,
    extraClass = "",
  ) =>
    item.external ? (
      <a
        key={item.label}
        href={item.to}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onSelect}
        className={`${navLinkClass(item)} ${extraClass}`}
      >
        {item.label}
      </a>
    ) : (
      <Link
        key={item.label}
        to={item.to}
        onClick={(event) => {
          handleNavClick(item, event);
          onSelect?.();
        }}
        aria-current={ariaCurrent(item)}
        className={`${navLinkClass(item)} ${extraClass}`}
      >
        {item.label}
      </Link>
    );

  const renderAccountActions = (onSelect?: () => void) => (
    <>
      {!isAuthenticated && (
        <button
          type="button"
          onClick={() => {
            onSelect?.();
            openAuthModal();
          }}
          className="btn-ghost h-9"
        >
          {"Sign In"}
        </button>
      )}
      <GetStartedButton className="btn-gradient h-9" onClick={onSelect} />
    </>
  );

  return (
    <header className="relative z-40 w-full shrink-0 border-b border-border bg-background">
      <div
        className={`flex h-14 w-full items-center justify-between gap-4 ${
          fullWidth ? "px-4 md:px-6" : "container mx-auto max-w-7xl"
        }`}
      >
        <div className="flex min-w-0 items-center gap-8">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo.webp" alt="" className="h-7 w-7 logo-image" />
            <span className="text-lg font-semibold">{"IAPKit"}</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-6 lg:flex">
            {navItems.map((item) => renderNavItem(item))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeDropdown />
          <div className="hidden items-center gap-2 lg:flex">
            {renderAccountActions()}
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="icon-button lg:hidden"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="site-mobile-menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <nav
          id="site-mobile-menu"
          aria-label="Main"
          className="absolute inset-x-0 top-14 border-b border-border bg-background px-4 py-4 shadow-sm lg:hidden"
        >
          <div className="flex flex-col gap-3">
            {navItems.map((item) =>
              renderNavItem(item, closeMobileMenu, "py-1"),
            )}
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 [&>*]:w-full [&>*]:justify-center">
            {renderAccountActions(closeMobileMenu)}
          </div>
        </nav>
      )}
    </header>
  );
}
