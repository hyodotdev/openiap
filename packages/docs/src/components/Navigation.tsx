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

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Auto-close the top nav menu on route change so a stale dropdown doesn't
  // sit open over the new page (especially relevant when crossing into /docs
  // where the docs sidebar takes over as the primary navigation surface).
  // The top-nav hamburger stays mounted on every route — Introduction /
  // Languages / Tutorials / Sponsors must remain reachable on mobile from
  // /docs too, and the closed docs sidebar already uses
  // `pointer-events: none` + `translateX(-100%)` so the two menus don't
  // compete for taps.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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

          {/* Mobile Menu Button — visible on every route. Top-level pages
              (Introduction / Languages / Tutorials / Sponsors) must remain
              reachable on mobile, including from /docs. */}
          <button
            className="mobile-menu-button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

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
      </div>
    </nav>
  );
}

export default Navigation;
