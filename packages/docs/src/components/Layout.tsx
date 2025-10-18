import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import { useLocation } from 'react-router-dom';
import Footer from './Footer';

function Layout() {
  const location = useLocation();
  const isDocsPage = location.pathname.startsWith('/docs');

  return (
    <div className="layout">
      <Navigation />
      <main className="main-content">
        <Outlet />
      </main>
      {!isDocsPage && <Footer />}
    </div>
  );
}

export default Layout;
