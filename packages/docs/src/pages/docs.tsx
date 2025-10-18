import { useState, useEffect } from 'react';
import { Route, Routes, Navigate, NavLink } from 'react-router-dom';
import LifeCycle from './docs/lifecycle';
import Types from './docs/types';
import APIs from './docs/apis';
import Events from './docs/events';
import Errors from './docs/errors';
import ExternalPurchase from './docs/external-purchase';
import Features from './docs/features';
import IOSSetup from './docs/ios-setup';
import AndroidSetup from './docs/android-setup';
import Updates from './docs/updates';
import Versions from './docs/versions';
import Announcements from './docs/announcements';
import NotFound from './404';

function Docs() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const closeSidebar = () => setIsSidebarOpen(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="docs-container">
      <button
        className={`docs-sidebar-toggle ${isSidebarOpen ? 'hidden' : ''} ${isScrolled ? 'scrolled' : ''}`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label="Toggle sidebar"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 5h14M3 10h14M3 15h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span>Menu</span>
      </button>

      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar}></div>
      )}

      <aside className={`docs-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <nav className="docs-nav">
          <h3>Documentation</h3>
          <ul>
            <li>
              <NavLink
                to="/docs/lifecycle"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Life Cycle
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/types"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Types
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/apis"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                APIs
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/events"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Events
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/errors"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Errors
              </NavLink>
            </li>
          </ul>
          <h3 style={{ marginTop: '2rem' }}>Setup Guide</h3>
          <ul>
            <li>
              <NavLink
                to="/docs/ios-setup"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                iOS Setup
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/android-setup"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Android Setup
              </NavLink>
            </li>
          </ul>
          <h3 style={{ marginTop: '2rem' }}>Features</h3>
          <ul>
            <li>
              <NavLink
                to="/docs/external-purchase"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                External Purchase
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/subscription-upgrade-downgrade"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Subscription Upgrade/Downgrade
              </NavLink>
            </li>
          </ul>
          <h3 style={{ marginTop: '2rem' }}>Updates</h3>
          <ul>
            <li>
              <NavLink
                to="/docs/announcements"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Announcements
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/updates"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Notes
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/versions"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Versions
              </NavLink>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="docs-content">
        <Routes>
          <Route index element={<Navigate to="/docs/lifecycle" replace />} />
          <Route path="lifecycle" element={<LifeCycle />} />
          <Route path="types" element={<Types />} />
          <Route path="apis" element={<APIs />} />
          <Route path="events" element={<Events />} />
          <Route path="errors" element={<Errors />} />
          <Route path="external-purchase" element={<ExternalPurchase />} />
          <Route path="subscription-upgrade-downgrade" element={<Features />} />
          <Route path="ios-setup" element={<IOSSetup />} />
          <Route path="android-setup" element={<AndroidSetup />} />
          <Route path="updates" element={<Updates />} />
          <Route path="versions" element={<Versions />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default Docs;
