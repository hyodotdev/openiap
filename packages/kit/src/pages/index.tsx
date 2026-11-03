import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { PageWithTitle } from "@/components/PageWithTitle";
import { authModalSignal, closeAuthModal } from "../lib/signals";
import { AuthModal } from "../components/AuthModal";
import { SiteLayout } from "../components/SiteLayout";
import LandingPage from "./landing";
import DocsLayout from "./docs/DocsLayout";
import { docsChildRoutes } from "./docs/routes";
import { siteChildRoutes } from "./site-routes";

// Public Pages Component - handles all unauthenticated routes
export default function PublicPages() {
  const [authModalState, setAuthModalState] = useState(authModalSignal.value);

  useEffect(() => {
    const unsubscribe = authModalSignal.subscribe((value) => {
      setAuthModalState(value);
    });
    return () => unsubscribe();
  }, []);

  // The auth modal sits outside the layouts so the docs header can open it too.
  return (
    <>
      <Routes>
        {/* DocsLayout renders the site header itself so its sidebar and
            content can scroll as independent columns below it. */}
        <Route path="docs" element={<DocsLayout />}>
          {docsChildRoutes}
        </Route>
        <Route element={<SiteLayout />}>
          <Route
            index
            element={
              <PageWithTitle
                title="Open purchase & entitlement infrastructure"
                description="Open-source purchase validation and entitlement infrastructure for the OpenIAP ecosystem, managed by OpenIAP."
                keywords={[
                  "purchase validation",
                  "entitlements",
                  "in-app purchases",
                  "open-source IAP backend",
                ]}
              >
                <LandingPage />
              </PageWithTitle>
            }
          />
          {siteChildRoutes}
        </Route>
      </Routes>
      <AuthModal isOpen={authModalState.isOpen} onClose={closeAuthModal} />
    </>
  );
}
