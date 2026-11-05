import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop(): null {
  const { pathname, hash } = useLocation();

  useEffect(() => {
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
        if (scrollToTarget()) stopWaiting();
      });
      const timeout = window.setTimeout(stopWaiting, 10_000);
      function stopWaiting(): void {
        observer.disconnect();
        window.clearTimeout(timeout);
      }
      observer.observe(document.body, { childList: true, subtree: true });
      return stopWaiting;
    }
    window.scrollTo(0, 0);
    const mainElement = document.querySelector("main");
    if (mainElement) {
      mainElement.scrollTop = 0;
    }
  }, [pathname, hash]);

  return null;
}
