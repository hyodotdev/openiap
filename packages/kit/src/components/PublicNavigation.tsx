import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { ThemeDropdown } from "./ThemeDropdown";
import { openAuthModal } from "../lib/signals";

export function PublicNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navigateHome = () => {
    void navigate("/");
  };

  const handleFeaturesClick = () => {
    if (location.pathname !== "/") {
      void navigate("/#features");
    } else {
      const element = document.getElementById("features");
      element?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleDocsClick = () => {
    void navigate("/docs");
  };

  const handleOpenAuthModal = () => {
    openAuthModal();
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 w-full">
        <div className="glass w-full">
          <div className="container max-w-7xl mx-auto w-full">
            <div className="flex items-center justify-between h-14 sm:h-16 w-full px-4">
              <div className="flex items-center gap-8">
                <button
                  onClick={navigateHome}
                  className="flex items-center gap-2"
                >
                  <img
                    src="/logo.webp"
                    alt="IAPKit"
                    className="w-8 h-8 logo-image"
                  />
                  <span className="font-bold text-xl">IAPKit</span>
                </button>
                <nav className="hidden md:flex items-center gap-4">
                  <button
                    onClick={handleFeaturesClick}
                    className="text-sm font-medium hover:text-accent transition-colors whitespace-nowrap"
                  >
                    {"Features"}
                  </button>
                  <button
                    onClick={handleDocsClick}
                    className={`text-sm font-medium transition-colors whitespace-nowrap ${
                      location.pathname === "/docs"
                        ? "text-accent"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {"Docs"}
                  </button>
                  <a
                    href="https://openiap.dev/sponsors"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    {"Sponsors"}
                  </a>
                </nav>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <ThemeDropdown />
                <button
                  onClick={handleOpenAuthModal}
                  className="hidden md:inline-flex btn-ghost text-sm"
                >
                  {"Sign In"}
                </button>
                <button
                  onClick={handleOpenAuthModal}
                  className="hidden md:inline-flex btn-gradient text-sm"
                >
                  {"Get started"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                  className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
                  aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={isMobileMenuOpen}
                  aria-controls="public-mobile-menu"
                >
                  {isMobileMenuOpen ? (
                    <X className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Menu className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div
            id="public-mobile-menu"
            className="md:hidden border-t border-border glass w-full"
          >
            <div className="container max-w-7xl mx-auto w-full">
              <nav className="px-4 py-4 space-y-3">
                <button
                  onClick={() => {
                    handleFeaturesClick();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left text-sm font-medium hover:text-accent transition-colors"
                >
                  {"Features"}
                </button>
                <button
                  onClick={() => {
                    handleDocsClick();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left text-sm font-medium hover:text-accent transition-colors"
                >
                  {"Docs"}
                </button>
                <a
                  href="https://openiap.dev/sponsors"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full text-left text-sm font-medium hover:text-accent transition-colors"
                >
                  {"Sponsors"}
                </a>
                <div className="pt-3 space-y-3 border-t border-border">
                  <button
                    onClick={handleOpenAuthModal}
                    className="btn-secondary w-full text-sm justify-center"
                  >
                    {"Sign In"}
                  </button>
                  <button
                    onClick={handleOpenAuthModal}
                    className="btn-gradient w-full text-sm justify-center"
                  >
                    {"Get started"}
                  </button>
                </div>
              </nav>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
