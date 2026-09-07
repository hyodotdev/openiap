import {
  Navigate,
  Route,
  Routes,
  NavLink,
  useLocation,
} from 'react-router-dom';
import DocsShell from '../../components/DocsShell';
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

const NAV_ITEMS: { to: string; label: string }[] = [
  { to: '/commerce-protocol', label: 'Overview' },
  { to: '/commerce-protocol/profiles', label: 'Profiles' },
  { to: '/commerce-protocol/operations', label: 'Operations' },
  { to: '/commerce-protocol/rest', label: 'REST' },
  { to: '/commerce-protocol/graphql', label: 'GraphQL' },
  { to: '/commerce-protocol/webhooks', label: 'Events & Webhooks' },
  { to: '/commerce-protocol/authentication', label: 'Authentication' },
  { to: '/commerce-protocol/capabilities', label: 'Capabilities' },
  { to: '/commerce-protocol/conformance', label: 'Conformance' },
  { to: '/commerce-protocol/versioning', label: 'Versioning' },
];

/** The server-side specification: its own section, not a page of the SDK docs. */
function CommerceProtocol() {
  const { pathname, search, hash } = useLocation();

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
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/commerce-protocol'}
                className={({ isActive }) => (isActive ? 'active' : '')}
                onClick={closeSidebar}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    >
      <Routes>
        <Route index element={<Overview />} />
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
