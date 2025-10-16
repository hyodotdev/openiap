import { Link, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { DarkModeToggle } from './DarkModeToggle';
import { Menu, X } from 'lucide-react';
import { FaGithub, FaSearch } from 'react-icons/fa';
import { openSearchModal } from '../lib/signals';

function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

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
          <img src="/logo.png" alt="OpenIAP" className="logo-image" />
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

          {/* GitHub Link */}
          <a
            href="https://github.com/hyochan/openiap.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
            aria-label="View on GitHub"
          >
            <FaGithub size={20} />
          </a>

          {/* Mobile Menu Button */}
          <button
            className="mobile-menu-button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
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
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
