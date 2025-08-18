import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import SearchModal from './components/SearchModal';
import Home from './pages/home';
import Introduction from './pages/introduction';
import Docs from './pages/docs';
import Languages from './pages/languages';
import Tutorials from './pages/tutorials';
import Sponsors from './pages/sponsors';
import NotFound from './pages/404';
import { searchModalSignal, closeSearchModal } from './lib/signals';
import { effect } from '@preact/signals-react';

function App() {
  const [isSearchOpen, setIsSearchOpen] = useState(searchModalSignal.value);

  useEffect(() => {
    // Subscribe to signal changes
    const unsubscribe = effect(() => {
      setIsSearchOpen(searchModalSignal.value);
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="introduction" element={<Introduction />} />
          <Route path="docs/*" element={<Docs />} />
          <Route path="languages" element={<Languages />} />
          <Route path="tutorials" element={<Tutorials />} />
          <Route path="sponsors" element={<Sponsors />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <SearchModal isOpen={isSearchOpen} onClose={closeSearchModal} />
    </>
  );
}

export default App;
