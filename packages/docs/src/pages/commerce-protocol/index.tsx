import { Fragment } from 'react';
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
      { to: '/commerce-protocol/ecosystem', label: 'Build your part' },
      { to: '/commerce-protocol/implementation', label: 'Build with AI' },
      { to: '/commerce-protocol/getting-started', label: 'Use a provider' },
      { to: '/commerce-protocol/whitepaper', label: 'Whitepaper' },
    ],
  },
  {
    id: 'contract',
    title: 'Implementation contract',
    items: [
      { to: '/commerce-protocol/profiles', label: 'Profiles' },
      { to: '/commerce-protocol/operations', label: 'Operations' },
      { to: '/commerce-protocol/authentication', label: 'Authentication' },
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
      { to: '/commerce-protocol/capabilities', label: 'Capabilities' },
      { to: '/commerce-protocol/conformance', label: 'Conformance' },
      { to: '/commerce-protocol/versioning', label: 'Versioning' },
    ],
  },
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
        <>
          {NAV_GROUPS.map((group) => (
            <Fragment key={group.id}>
              <h3 id={`commerce-nav-${group.id}`}>{group.title}</h3>
              <ul aria-labelledby={`commerce-nav-${group.id}`}>
                {group.items.map((item) => (
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
            </Fragment>
          ))}
        </>
      )}
    >
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
