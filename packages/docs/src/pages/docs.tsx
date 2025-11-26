import { useState, useEffect } from 'react';
import { Route, Routes, Navigate, NavLink } from 'react-router-dom';
import { MenuDropdown } from '../components/MenuDropdown';
import Ecosystem from './docs/ecosystem';
import LifeCycle from './docs/lifecycle';
import Subscription from './docs/lifecycle/subscription';
import Types from './docs/types';
import APIs from './docs/apis';
import Events from './docs/events';
import Errors from './docs/errors';
import Purchase from './docs/features/purchase';
import SubscriptionOffers from './docs/features/subscription-offers';
import OfferCodeRedemption from './docs/features/offer-code-redemption';
import ExternalPurchase from './docs/features/external-purchase';
import SubscriptionUpgradeDowngrade from './docs/features/subscription-upgrade-downgrade';
import IOSSetup from './docs/ios-setup';
import AndroidSetup from './docs/android-setup';
import HorizonSetup from './docs/horizon-setup';
import Announcements from './docs/updates/announcements';
import Notes from './docs/updates/notes';
import Versions from './docs/updates/versions';
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
                to="/docs/ecosystem"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Ecosystem
              </NavLink>
            </li>
            <MenuDropdown
              title="Life Cycle"
              titleTo="/docs/lifecycle"
              items={[
                { to: '/docs/lifecycle/subscription', label: 'Subscription' },
              ]}
              onItemClick={closeSidebar}
            />
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
            <MenuDropdown
              title="Android Setup"
              titleTo="/docs/android-setup"
              items={[{ to: '/docs/horizon-setup', label: 'Horizon OS' }]}
              onItemClick={closeSidebar}
            />
          </ul>
          <h3 style={{ marginTop: '2rem' }}>Features</h3>
          <ul>
            <li>
              <NavLink
                to="/docs/features/purchase"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Purchase
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/features/subscription-offers"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Subscription Offers
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/features/offer-code-redemption"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Offer Code Redemption
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/features/external-purchase"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                External Purchase
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/features/subscription-upgrade-downgrade"
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
                to="/docs/updates/announcements"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Announcements
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/updates/notes"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Notes
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/updates/versions"
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
          <Route index element={<Navigate to="/docs/ecosystem" replace />} />
          <Route path="ecosystem" element={<Ecosystem />} />
          <Route path="lifecycle" element={<LifeCycle />} />
          <Route path="lifecycle/subscription" element={<Subscription />} />
          <Route path="types" element={<Types />} />
          <Route path="apis" element={<APIs />} />
          <Route path="events" element={<Events />} />
          <Route path="errors" element={<Errors />} />
          <Route path="features/purchase" element={<Purchase />} />
          <Route
            path="features/subscription-offers"
            element={<SubscriptionOffers />}
          />
          <Route
            path="features/offer-code-redemption"
            element={<OfferCodeRedemption />}
          />
          <Route
            path="features/external-purchase"
            element={<ExternalPurchase />}
          />
          <Route
            path="features/subscription-upgrade-downgrade"
            element={<SubscriptionUpgradeDowngrade />}
          />
          <Route path="ios-setup" element={<IOSSetup />} />
          <Route path="android-setup" element={<AndroidSetup />} />
          <Route path="horizon-setup" element={<HorizonSetup />} />
          <Route path="updates/announcements" element={<Announcements />} />
          <Route path="updates/notes" element={<Notes />} />
          <Route path="updates/versions" element={<Versions />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default Docs;
