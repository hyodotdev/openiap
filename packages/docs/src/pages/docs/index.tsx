import { useState, useEffect } from 'react';
import { Route, Routes, Navigate, NavLink } from 'react-router-dom';
import { MenuDropdown } from '../../components/MenuDropdown';
import Ecosystem from './ecosystem';
import LifeCycle from './lifecycle';
import Subscription from './lifecycle/subscription';
import TypesIndex from './types/index';
import TypesProduct from './types/product';
import TypesPurchase from './types/purchase';
import TypesRequest from './types/request';
import TypesAlternative from './types/alternative';
import TypesVerification from './types/verification';
import TypesIOS from './types/ios';
import TypesAndroid from './types/android';
import APIsIndex from './apis/index';
import APIsConnection from './apis/connection';
import APIsProducts from './apis/products';
import APIsPurchase from './apis/purchase';
import APIsSubscription from './apis/subscription';
import APIsValidation from './apis/validation';
import APIsIOS from './apis/ios';
import APIsAndroid from './apis/android';
import APIsDebugging from './apis/debugging';
import Events from './events';
import Errors from './errors';
import Purchase from './features/purchase';
import SubscriptionFeature from './features/subscription';
import Discount from './features/discount';
import OfferCodeRedemption from './features/offer-code-redemption';
import ExternalPurchase from './features/external-purchase';
import SubscriptionUpgradeDowngrade from './features/subscription-upgrade-downgrade';
import IOSSetup from './ios-setup';
import AndroidSetup from './android-setup';
import HorizonSetup from './horizon-setup';
import Example from './example';
import Announcements from './updates/announcements';
import Notes from './updates/notes';
import Versions from './updates/versions';
import AIAssistants from './guides/ai-assistants';
import NotFound from '../404';

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
            <MenuDropdown
              title="Types"
              titleTo="/docs/types"
              items={[
                { to: '/docs/types/product', label: 'Product Types' },
                { to: '/docs/types/purchase', label: 'Purchase Types' },
                { to: '/docs/types/request', label: 'Request Types' },
                { to: '/docs/types/alternative', label: 'Alternative Billing' },
                { to: '/docs/types/verification', label: 'Verification' },
                { to: '/docs/types/ios', label: 'iOS Types' },
                { to: '/docs/types/android', label: 'Android Types' },
              ]}
              onItemClick={closeSidebar}
            />
            <MenuDropdown
              title="APIs"
              titleTo="/docs/apis"
              items={[
                { to: '/docs/apis/connection', label: 'Connection' },
                { to: '/docs/apis/products', label: 'Products' },
                { to: '/docs/apis/purchase', label: 'Purchase' },
                { to: '/docs/apis/subscription', label: 'Subscription' },
                { to: '/docs/apis/validation', label: 'Validation' },
                { to: '/docs/apis/ios', label: 'iOS APIs' },
                { to: '/docs/apis/android', label: 'Android APIs' },
                { to: '/docs/apis/debugging', label: 'Debugging' },
              ]}
              onItemClick={closeSidebar}
            />
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
            <li>
              <NavLink
                to="/docs/guides/ai-assistants"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                AI Assistants
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/example"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Example
              </NavLink>
            </li>
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
                to="/docs/features/subscription"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Subscription
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/docs/features/discount"
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                Discounts (Android)
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
          <Route path="types" element={<TypesIndex />} />
          <Route path="types/product" element={<TypesProduct />} />
          <Route path="types/purchase" element={<TypesPurchase />} />
          <Route path="types/request" element={<TypesRequest />} />
          <Route path="types/alternative" element={<TypesAlternative />} />
          <Route path="types/verification" element={<TypesVerification />} />
          <Route path="types/ios" element={<TypesIOS />} />
          <Route path="types/android" element={<TypesAndroid />} />
          <Route path="apis" element={<APIsIndex />} />
          <Route path="apis/connection" element={<APIsConnection />} />
          <Route path="apis/products" element={<APIsProducts />} />
          <Route path="apis/purchase" element={<APIsPurchase />} />
          <Route path="apis/subscription" element={<APIsSubscription />} />
          <Route path="apis/validation" element={<APIsValidation />} />
          <Route path="apis/ios" element={<APIsIOS />} />
          <Route path="apis/android" element={<APIsAndroid />} />
          <Route path="apis/debugging" element={<APIsDebugging />} />
          <Route path="events" element={<Events />} />
          <Route path="errors" element={<Errors />} />
          <Route path="features/purchase" element={<Purchase />} />
          <Route
            path="features/subscription"
            element={<SubscriptionFeature />}
          />
          <Route path="features/discount" element={<Discount />} />
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
          <Route path="example" element={<Example />} />
          <Route path="guides/ai-assistants" element={<AIAssistants />} />
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
