import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import { useLocation } from 'react-router-dom';
import Footer from './Footer';

function Layout() {
  const location = useLocation();
  // Both documentation sections lay out their own full-height sidebar, so
  // the site footer would sit under an empty column.
  const hasSidebar = /^\/(?:docs|commerce-protocol)(?:\/|$)/.test(
    location.pathname
  );
  // DocsShell marks its content column as the page's one main landmark.
  const Content = hasSidebar ? 'div' : 'main';

  return (
    <div className="layout">
      <Navigation />
      <Content className="main-content">
        <Outlet />
      </Content>
      {!hasSidebar && <Footer />}
    </div>
  );
}

export default Layout;
