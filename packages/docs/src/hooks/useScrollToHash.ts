import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useScrollToHash() {
  const location = useLocation();

  useEffect(() => {
    // Always scroll to top first when route changes
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      // Wait for DOM to be ready
      const timeoutId = setTimeout(() => {
        const id = location.hash.slice(1); // Remove the #
        const element = document.getElementById(id);
        if (element) {
          // Account for fixed header
          const yOffset = -80;
          const y =
            element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'instant' });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [location]);
}
