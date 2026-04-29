import { Route, Navigate } from "react-router-dom";

import IntroductionPage from "./sections/introduction";
import QuickstartPage from "./sections/quickstart";
import ProjectsPage from "./sections/projects";
import VerificationApplePage from "./sections/verification-apple";
import VerificationGooglePage from "./sections/verification-google";
import VerificationHorizonPage from "./sections/verification-horizon";
import ApiReferencePage from "./sections/api";
import OperationsPage from "./sections/operations";
import AiAssistantsPage from "./sections/ai-assistants";
import ReleaseNotesPage from "./sections/release-notes";

/**
 * Docs routes as a Fragment of `<Route>` children. Consumers wrap
 * them in a `<Route path="docs" element={<DocsLayout />}>` in both
 * the public and authed route trees.
 *
 * Why a Fragment instead of an inner `<Routes>` (the previous
 * `DocsRoot` component): React Router ranks routes by full-path
 * specificity at the root tree level. A splat route `docs/*` scores
 * around 8, which loses to a sibling `:orgSlug/projects` (≈ 13) when
 * the URL is `/docs/projects` — React Router then picks the
 * organization route, renders `OrganizationLayout`, and shows the
 * "Organization not found" fallback because no org has slug `docs`.
 *
 * Declaring each docs path as a proper child Route (`docs`/`projects`
 * scores 20) beats the organization pattern cleanly. Bonus: route
 * data loaders (if added later) see the full path instead of a
 * collapsed splat.
 */
export const docsChildRoutes = (
  <>
    <Route index element={<IntroductionPage />} />
    <Route path="quickstart" element={<QuickstartPage />} />
    <Route path="projects" element={<ProjectsPage />} />
    <Route path="verification">
      <Route index element={<Navigate to="apple" replace />} />
      <Route path="apple" element={<VerificationApplePage />} />
      <Route path="google" element={<VerificationGooglePage />} />
      <Route path="horizon" element={<VerificationHorizonPage />} />
    </Route>
    <Route path="api" element={<ApiReferencePage />} />
    <Route path="operations" element={<OperationsPage />} />
    <Route path="ai-assistants" element={<AiAssistantsPage />} />
    <Route path="release-notes" element={<ReleaseNotesPage />} />
    {/* Unknown sub-paths bounce back to the docs index so the user
        never ends up in the authed organization routes by accident. */}
    <Route path="*" element={<Navigate to="/docs" replace />} />
  </>
);
