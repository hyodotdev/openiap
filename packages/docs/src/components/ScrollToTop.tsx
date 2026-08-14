import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

function ScrollToTop() {
  const { hash, key, pathname } = useLocation();

  useLayoutEffect(() => {
    if (hash) return;

    window.scrollTo(0, 0);
  }, [hash, key, pathname]);

  return null;
}

export default ScrollToTop;
