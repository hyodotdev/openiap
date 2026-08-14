import { Link, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { DarkModeToggle } from './DarkModeToggle';
import { Menu, X } from 'lucide-react';
import { FaGithub, FaSearch } from 'react-icons/fa';
import { openSearchModal } from '../lib/signals';
import {
  IAPKIT_LOGO_PATH,
  IAPKIT_URL,
  LOGO_PATH,
  trackIapKitClick,
} from '../lib/config';

function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Keep the global menu from covering the destination after navigation.
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
              to="/community-resources"
              className={({ isActive }) =>
                isActive || location.pathname === '/tutorials' ? 'active' : ''
              }
            >
              Community
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
            aria-label="Open IAPKit"
            title="Open IAPKit"
          >
            <img
              src={IAPKIT_LOGO_PATH}
              alt=""
              className="iapkit-link-logo"
              aria-hidden="true"
            />
            <span className="iapkit-link-label">IAPKit</span>
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

          <button
            className="mobile-menu-button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={
              isMobileMenuOpen
                ? 'Close navigation menu'
                : 'Open navigation menu'
            }
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <div
          id="mobile-navigation"
          className={`mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}
          aria-hidden={!isMobileMenuOpen}
        >
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
                to="/community-resources"
                className={({ isActive }) =>
                  isActive || location.pathname === '/tutorials' ? 'active' : ''
                }
                onClick={closeMobileMenu}
              >
                Community
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
                className="mobile-iapkit-link"
                onClick={() => {
                  trackIapKitClick();
                  closeMobileMenu();
                }}
              >
                <img src={IAPKIT_LOGO_PATH} alt="" aria-hidden="true" />
                <span>IAPKit</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
