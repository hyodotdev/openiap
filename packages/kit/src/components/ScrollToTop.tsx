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
      // If there's a hash, scroll to that element
      const element = document.getElementById(hash.slice(1));
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } else if (!isFeaturePage) {
      window.scrollTo(0, 0);
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
    }
  }, [pathname, hash, currentKey]);

  return null;
}
