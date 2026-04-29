import { useState, useEffect } from "react";
import { Routes, Route, Outlet, Navigate } from "react-router-dom";
import { PageWithTitle } from "@/components/PageWithTitle";
import { authModalSignal, closeAuthModal } from "../lib/signals";
import { AuthModal } from "../components/AuthModal";
import { PublicNavigation } from "../components/PublicNavigation";
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
import NotFound from "./404";

// Public Layout Component (for unauthenticated users)
function PublicLayout() {
  const [authModalState, setAuthModalState] = useState(authModalSignal.value);

  useEffect(() => {
    const unsubscribe = authModalSignal.subscribe((value) => {
      setAuthModalState(value);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full h-screen flex flex-col bg-background overflow-hidden">
      {/* Fixed Header */}
      <PublicNavigation />

      {/* Main Content with padding to account for fixed header */}
      <main className="flex-1 pt-14 sm:pt-16 w-full overflow-y-auto">
        <Outlet />
      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={authModalState.isOpen} onClose={closeAuthModal} />
    </div>
  );
}

// Public Pages Component - handles all unauthenticated routes
export default function PublicPages() {
  return (
    <Routes>
      {/* Docs sit outside the PublicLayout wrapper so DocsLayout owns
          the full viewport and can run independent scroll columns.
          The public navigation header wrapping everything else was
          both stealing sidebar height and double-scrolling the
          content column. */}
      <Route
        path="docs"
        element={
          <PageWithTitle title="Documentation">
            <DocsLayout />
          </PageWithTitle>
        }
      >
        {docsChildRoutes}
      </Route>
      <Route element={<PublicLayout />}>
        <Route
          index
          element={
            <PageWithTitle title="Launch in-app purchases faster">
              <LandingPage />
            </PageWithTitle>
          }
        />
        <Route path="blog" element={<BlogLayout />}>
          <Route
            index
            element={
              <PageWithTitle title="IAPKit Blog">
                <BlogIndex />
              </PageWithTitle>
            }
          />
          <Route
            path="iapkit-joins-openiap"
            element={
              <PageWithTitle title="IAPKit joins OpenIAP">
                <IapkitJoinsOpenIap />
              </PageWithTitle>
            }
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
  );
}
