import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useScrollToHash(offset = 80) {
  const location = useLocation();

  useEffect(() => {
    if (location.state?.commerceKeepScroll) return;

    // Always scroll to top first when route changes
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      // Wait for DOM to be ready
      const timeoutId = setTimeout(() => {
        const id = location.hash.slice(1); // Remove the #
        const element = document.getElementById(id);
        if (element) {
          let ancestor = element.parentElement;
          while (ancestor) {
            if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
            ancestor = ancestor.parentElement;
          }
          const menu = document.querySelector('.docs-sidebar-toggle');
          const menuBounds = menu?.getBoundingClientRect();
          const visibleOffset = menuBounds?.height
            ? Math.max(offset, menuBounds.bottom + 16)
            : offset;
          const y =
            element.getBoundingClientRect().top +
            window.pageYOffset -
            visibleOffset;
          window.scrollTo({ top: y, behavior: 'instant' });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [location, offset]);
}

/**
 * Get the hash from the URL without the #
 */
export function getHashId(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  return hash ? hash.slice(1) : null;
}
