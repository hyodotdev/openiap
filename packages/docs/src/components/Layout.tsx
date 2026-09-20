import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import { useLocation } from 'react-router-dom';
import Footer from './Footer';

function Layout() {
  const location = useLocation();
  // Both documentation sections lay out their own full-height sidebar, so
  // the site footer would sit under an empty column.
  const hasSidebar =
    location.pathname.startsWith('/docs') ||
    location.pathname.startsWith('/commerce-protocol');

  return (
    <div className="layout">
      <Navigation />
      <main className="main-content">
        <Outlet />
      </main>
      {!hasSidebar && <Footer />}
    </div>
  );
}

export default Layout;
