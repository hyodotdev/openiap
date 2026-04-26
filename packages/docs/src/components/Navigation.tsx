import { Link, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { DarkModeToggle } from './DarkModeToggle';
import { Menu, X } from 'lucide-react';
import { FaGithub, FaSearch } from 'react-icons/fa';
import { openSearchModal } from '../lib/signals';
import { IAPKIT_URL, LOGO_PATH, trackIapKitClick } from '../lib/config';

function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  // Docs pages have their own sticky "Menu" toggle for the docs sidebar.
  // The top nav's mobile hamburger ☰ sits in the same vertical area on
  // mobile and was visually-and-tap competing with that toggle — users
  // reported tapping the docs Menu button but having the top nav menu
  // open instead. Hide the top hamburger on docs routes so the docs
  // sidebar toggle is the only "open menu" affordance there.
  const isDocsRoute = location.pathname.startsWith('/docs');

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Force-close the top nav menu whenever the user navigates onto a
  // docs route (covers the "I had the top menu open, then tapped a
  // docs link" path).
  useEffect(() => {
    if (isDocsRoute) setIsMobileMenuOpen(false);
  }, [isDocsRoute]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearchModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link to="/" className="logo">
          <img src={LOGO_PATH} alt="OpenIAP" className="logo-image" />
          <span className="logo-text">OpenIAP</span>
        </Link>

        {/* Desktop Menu */}
        <ul className="nav-menu desktop-menu">
          <li>
            <NavLink
              to="/introduction"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Introduction
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/docs"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Docs
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/languages"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Languages
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/tutorials"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Tutorials
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/sponsors"
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Sponsors
            </NavLink>
          </li>
        </ul>

        <div className="nav-actions">
          {/* Search Button */}
          <button
            type="button"
            className="search-button"
            onClick={() => openSearchModal()}
            aria-label="Search APIs (Cmd+K)"
            title="Search APIs (Cmd+K)"
          >
            <FaSearch size={18} />
          </button>

          <DarkModeToggle />

          {/* IAPKit Link */}
          <a
            href={IAPKIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="iapkit-link"
            onClick={trackIapKitClick}
          >
            IAPKit
          </a>

          {/* GitHub Link */}
          <a
            href="https://github.com/hyodotdev/openiap"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
            aria-label="View on GitHub"
          >
            <FaGithub size={20} />
          </a>

          {/* Mobile Menu Button — hidden on /docs routes so it can't
              compete with the docs sidebar's own Menu toggle. */}
          {!isDocsRoute && (
            <button
              className="mobile-menu-button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          )}
        </div>

        {/* Mobile Menu Dropdown — also hidden on /docs to remove its
            invisible-but-present 0-height absolute box from the DOM. */}
        {!isDocsRoute && (
          <div className={`mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}>
            <ul className="mobile-nav-list">
              <li>
                <NavLink
                  to="/introduction"
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={closeMobileMenu}
                >
                  Introduction
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/docs"
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={closeMobileMenu}
                >
                  Docs
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/languages"
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={closeMobileMenu}
                >
                  Languages
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/tutorials"
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={closeMobileMenu}
                >
                  Tutorials
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/sponsors"
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={closeMobileMenu}
                >
                  Sponsors
                </NavLink>
              </li>

              <li>
                <a
                  href={IAPKIT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackIapKitClick();
                    closeMobileMenu();
                  }}
                >
                  IAPKit
                </a>
              </li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navigation;
