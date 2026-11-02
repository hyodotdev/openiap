import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { PageWithTitle } from "@/components/PageWithTitle";
import { authModalSignal, closeAuthModal } from "../lib/signals";
import { AuthModal } from "../components/AuthModal";
import { SiteLayout } from "../components/SiteLayout";
import LandingPage from "./landing";
import BlogLayout from "./blog/BlogLayout";
import BlogIndex from "./blog";
import IapkitJoinsOpenIap from "./blog/iapkit-joins-openiap";
import DocsLayout from "./docs/DocsLayout";
import { docsChildRoutes } from "./docs/routes";
import Terms from "./terms-of-service";
import Privacy from "./privacy-policy";
import About from "./about";
import Contact from "./contact";
import Faq from "./faq";
import NotFound from "./404";

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
          <Route
            path="faq"
            element={
              <PageWithTitle
                title="Receipt validation FAQ"
                description="How receipt validation works, why it needs a trusted server, and what IAPKit verifies for each store."
                keywords={[
                  "receipt validation FAQ",
                  "consumable consumption state",
                  "in-app purchase fraud",
                ]}
              >
                <Faq />
              </PageWithTitle>
            }
          />
          <Route path="blog" element={<BlogLayout />}>
            <Route index element={<BlogIndex />} />
            <Route
              path="iapkit-joins-openiap"
              element={<IapkitJoinsOpenIap />}
            />
          </Route>
          <Route
            path="about"
            element={
              <PageWithTitle title="About">
                <About />
              </PageWithTitle>
            }
          />
          <Route
            path="contact"
            element={
              <PageWithTitle title="Contact">
                <Contact />
              </PageWithTitle>
            }
          />
          <Route
            path="terms-of-service"
            element={
              <PageWithTitle title="Terms of Service">
                <Terms />
              </PageWithTitle>
            }
          />
          <Route
            path="privacy-policy"
            element={
              <PageWithTitle title="Privacy Policy">
                <Privacy />
              </PageWithTitle>
            }
          />
          <Route
            path="termsofservice"
            element={<Navigate to="/terms-of-service" replace />}
          />
          <Route
            path="privacyandpolicy"
            element={<Navigate to="/privacy-policy" replace />}
          />
          <Route
            path="*"
            element={
              <PageWithTitle title="Page not found">
                <NotFound />
              </PageWithTitle>
            }
          />
        </Route>
      </Routes>
      <AuthModal isOpen={authModalState.isOpen} onClose={closeAuthModal} />
    </>
  );
}
