import {
  Navigate,
  Route,
  Routes,
  NavLink,
  Link,
  useLocation,
} from 'react-router-dom';
import DocsShell from '../../components/DocsShell';
import { MenuDropdown } from '../../components/MenuDropdown';
import NotFound from '../404';
import Overview from './overview';
import Authentication from './authentication';
import Capabilities from './capabilities';
import Conformance from './conformance';
import Graphql from './graphql';
import Operations from './operations';
import Profiles from './profiles';
import Rest from './rest';
import Versioning from './versioning';
import Webhooks from './webhooks';
import Ecosystem from './ecosystem';
import GettingStarted from './getting-started';
import Implementation from './implementation';
import Whitepaper from './whitepaper';

interface NavigationGroup {
  id: string;
  title: string;
  items: { to: string; label: string }[];
}

const NAV_GROUPS: NavigationGroup[] = [
  {
    id: 'guides',
    title: 'Start here',
    items: [
      { to: '/commerce-protocol', label: 'Overview' },
      {
        to: '/commerce-protocol/getting-started',
        label: '1. Follow a purchase',
      },
      { to: '/commerce-protocol/ecosystem', label: '2. Choose your part' },
      { to: '/commerce-protocol/implementation', label: '3. Build and review' },
    ],
  },
  {
    id: 'contract',
    title: 'Terms & responsibilities',
    items: [
      {
        to: '/commerce-protocol/profiles',
        label: 'Profiles · service responsibilities',
      },
      { to: '/commerce-protocol/operations', label: 'Operations · API calls' },
      {
        to: '/commerce-protocol/authentication',
        label: 'Authentication · who may call',
      },
    ],
  },
  {
    id: 'bindings',
    title: 'APIs & event delivery',
    items: [
      { to: '/commerce-protocol/rest', label: 'REST' },
      { to: '/commerce-protocol/graphql', label: 'GraphQL' },
      { to: '/commerce-protocol/webhooks', label: 'Events & Webhooks' },
    ],
  },
  {
    id: 'compatibility',
    title: 'Compatibility',
    items: [
      {
        to: '/commerce-protocol/capabilities',
        label: 'Capabilities · supported features',
      },
      {
        to: '/commerce-protocol/conformance',
        label: 'Conformance · contract checks',
      },
      { to: '/commerce-protocol/versioning', label: 'Versioning' },
    ],
  },
];

const [START_NAVIGATION, ...REFERENCE_NAVIGATION] = NAV_GROUPS;
const [OVERVIEW, ...START_STEPS] = START_NAVIGATION.items;
const WHITEPAPER_NAVIGATION = {
  to: '/commerce-protocol/whitepaper',
  label: 'Whitepaper',
};

/** The server-side specification: its own section, not a page of the SDK docs. */
function CommerceProtocol() {
  const { pathname, search, hash } = useLocation();

  const isReference =
    pathname === WHITEPAPER_NAVIGATION.to ||
    REFERENCE_NAVIGATION.some((group) =>
      group.items.some((item) => item.to === pathname)
    );

  // `/commerce-protocol/` renders the overview but leaves NavLink's exact match
  // unsatisfied, so the sidebar highlights nothing. Canonicalise instead.
  const canonical = pathname.replace(/\/+$/, '');
  if (canonical !== pathname) {
    return <Navigate to={{ pathname: canonical, search, hash }} replace />;
  }

  return (
    <DocsShell
      navLabel="Commerce Protocol navigation"
      wide={pathname === '/commerce-protocol'}
      nav={(closeSidebar) => (
        <div className="commerce-navigation">
          <ul>
            <li>
              <NavLink
                to={OVERVIEW.to}
                end
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                {OVERVIEW.label}
              </NavLink>
            </li>
            <MenuDropdown
              title={START_NAVIGATION.title}
              items={START_STEPS}
              defaultExpanded
              onItemClick={closeSidebar}
            />
          </ul>
          <h3 id="commerce-nav-reference">Reference</h3>
          <ul aria-labelledby="commerce-nav-reference">
            {REFERENCE_NAVIGATION.map((group) => (
              <MenuDropdown
                key={group.id}
                title={group.title}
                items={group.items}
                onItemClick={closeSidebar}
              />
            ))}
            <li>
              <NavLink
                to={WHITEPAPER_NAVIGATION.to}
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                {WHITEPAPER_NAVIGATION.label}
              </NavLink>
            </li>
          </ul>
        </div>
      )}
    >
      {isReference && (
        <div className="commerce-reference-context">
          <span>Reference</span>
          <Link to="/commerce-protocol/getting-started">
            Follow the purchase walkthrough →
          </Link>
        </div>
      )}
      <Routes>
        <Route index element={<Overview />} />
        <Route path="ecosystem" element={<Ecosystem />} />
        <Route path="getting-started" element={<GettingStarted />} />
        <Route path="implementation" element={<Implementation />} />
        <Route path="whitepaper" element={<Whitepaper />} />
        <Route path="profiles" element={<Profiles />} />
        <Route path="operations" element={<Operations />} />
        <Route path="rest" element={<Rest />} />
        <Route path="graphql" element={<Graphql />} />
        <Route path="webhooks" element={<Webhooks />} />
        <Route path="authentication" element={<Authentication />} />
        <Route path="capabilities" element={<Capabilities />} />
        <Route path="conformance" element={<Conformance />} />
        <Route path="versioning" element={<Versioning />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </DocsShell>
  );
}

export default CommerceProtocol;
