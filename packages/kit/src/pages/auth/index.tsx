import { useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex";
import { MixpanelEvent, trackEvent } from "@/lib/mixpanel";
import Profile from "./profile";
import CreateOrganization from "./organization/create";
import OrganizationLayout from "./organization";
import OrganizationDashboard from "./organization/dashboard";
import OrganizationProjects from "./organization/projects";
import OrganizationSettings from "./organization/settings";
import ProjectIndex from "./organization/project";
import ProjectPurchases from "./organization/project/purchases";
import ProjectApiKeys from "./organization/project/apikeys";
import ProjectSettings from "./organization/project/settings";
import ProjectPurchaseDetail from "./organization/project/purchase-detail";
import OrganizationUsagePage from "./organization/usage";
import BlogLayout from "../blog/BlogLayout";
import BlogIndex from "../blog";
import IapkitJoinsOpenIap from "../blog/iapkit-joins-openiap";
import DocsLayout from "../docs/DocsLayout";
import { docsChildRoutes } from "../docs/routes";
import NotFound from "../404";
import Terms from "../terms-of-service";
import Privacy from "../privacy-policy";
import About from "../about";
import Contact from "../contact";
import { PageWithTitle } from "@/components/PageWithTitle";

// Authenticated Pages Component - handles all authenticated routes
export default function AuthenticatedPages() {
  const location = useLocation();
  const hasOrganizations = useQuery(api.organizations.query.hasOrganizations);
  const hasProjects = useQuery(api.projects.query.hasProjects);
  const currentOrg = useQuery(
    api.organizations.query.getCurrentOrganization,
    {},
  );
  const hasTrackedSignup = useRef(false);

  // Fire the signup_completed retention event the first time we see
  // a signed-in user who has no organizations — that's the
  // post-OAuth / post-OTP "new user" state. Guarded by a ref so
  // component re-renders (react-router transitions, theme flips)
  // don't produce duplicate events per browser session.
  useEffect(() => {
    if (hasOrganizations === false && !hasTrackedSignup.current) {
      hasTrackedSignup.current = true;
      trackEvent(MixpanelEvent.SignupCompleted);
    }
  }, [hasOrganizations]);

  // Show loading while checking status
  if (hasOrganizations === undefined || hasProjects === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">{"Loading..."}</p>
        </div>
      </div>
    );
  }

  // If user has no organizations, show organization creation flow
  if (hasOrganizations === false) {
    return (
      <Routes>
        <Route
          path="onboarding/create-organization"
          element={
            <PageWithTitle title="Create organization">
              <CreateOrganization />
            </PageWithTitle>
          }
        />
        <Route
          path="*"
          element={<Navigate to="/onboarding/create-organization" />}
        />
      </Routes>
    );
  }

  // Wait for organization queries to complete before routing
  if (hasOrganizations === true && currentOrg === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">
            {"Loading organization..."}
          </p>
        </div>
      </div>
    );
  }

  const shouldRedirectToOrgHome =
    hasOrganizations &&
    currentOrg &&
    (location.pathname === "/" || location.pathname === "");

  if (shouldRedirectToOrgHome) {
    return <Navigate to={`/${currentOrg.slug}`} replace />;
  }

  return (
    <Routes>
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
        path="onboarding/create-organization"
        element={
          <PageWithTitle title="Create organization">
            <CreateOrganization />
          </PageWithTitle>
        }
      />
      <Route
        path="profile"
        element={
          <PageWithTitle title="Profile">
            <Profile />
          </PageWithTitle>
        }
      />

      {/* Organization-scoped routes */}
      <Route path=":orgSlug" element={<OrganizationLayout />}>
        <Route
          index
          element={
            <PageWithTitle title="Organization overview">
              <OrganizationDashboard />
            </PageWithTitle>
          }
        />
        <Route
          path="projects"
          element={
            <PageWithTitle title="Projects">
              <OrganizationProjects />
            </PageWithTitle>
          }
        />
        <Route
          path="settings"
          element={
            <PageWithTitle title="Organization settings">
              <OrganizationSettings />
            </PageWithTitle>
          }
        />
        <Route
          path="usage"
          element={
            <PageWithTitle title="Usage">
              <OrganizationUsagePage />
            </PageWithTitle>
          }
        />
        <Route path="plan" element={<Navigate to="../usage" replace />} />
        <Route
          path="plan/payment-method"
          element={<Navigate to="../usage" replace />}
        />
        <Route
          path="plan/modify"
          element={<Navigate to="../usage" replace />}
        />

        {/* Project routes */}
        <Route path="project/:projectSlug" element={<ProjectIndex />}>
          <Route index element={<Navigate to="purchases" replace />} />
          <Route
            path="dashboard"
            element={<Navigate to="../purchases" replace />}
          />
          <Route
            path="purchases"
            element={
              <PageWithTitle title="Project purchases">
                <ProjectPurchases />
              </PageWithTitle>
            }
          />
          <Route
            path="purchases/:purchaseId"
            element={
              <PageWithTitle title={"Purchase details"}>
                <ProjectPurchaseDetail />
              </PageWithTitle>
            }
          />
          <Route
            path="apikeys"
            element={
              <PageWithTitle title="Project API keys">
                <ProjectApiKeys />
              </PageWithTitle>
            }
          />
          <Route
            path="settings"
            element={
              <PageWithTitle title="Project settings">
                <ProjectSettings />
              </PageWithTitle>
            }
          />
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <PageWithTitle title="Page not found">
            <NotFound />
          </PageWithTitle>
        }
      />
    </Routes>
  );
}
