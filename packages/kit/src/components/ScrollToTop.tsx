import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  // React Router splits the location into pathname/hash — `pathname` alone
  // never contains `#`, so checks like `pathname === "/#features"` never
  // fire. Track a combined key so the features-page exemption works both
  // for direct `/features` navigation and for home-anchor `/#features`.
  const currentKey = pathname + hash;
  const prevKeyRef = useRef(currentKey);

  useEffect(() => {
    const prevKey = prevKeyRef.current;
    prevKeyRef.current = currentKey;

    const mainElement = document.querySelector("main");

    const isFeaturePage =
      pathname === "/features" || (pathname === "/" && hash === "#features");
    const wasFeaturePage = prevKey === "/features" || prevKey === "/#features";

    // Skip scroll reset when arriving on the features page
    if (isFeaturePage && !wasFeaturePage) {
      return;
    }

    if (hash) {
      const scrollToTarget = (): boolean => {
        const element = document.getElementById(hash.slice(1));
        if (!element) return false;
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        return true;
      };
      if (scrollToTarget()) return;
      // Lazy routes may mount the hash target after this effect runs.
      const observer = new MutationObserver(() => {
        if (scrollToTarget()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    } else if (!isFeaturePage) {
      window.scrollTo(0, 0);
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
    }
  }, [pathname, hash, currentKey]);

  return null;
}
