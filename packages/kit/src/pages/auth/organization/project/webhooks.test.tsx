/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  setup: {
    ios: { configured: false, missing: ["iosBundleId"] },
    android: { configured: false, missing: ["androidPackageName"] },
    horizon: { configured: false, missing: ["horizonEnabled"] },
    amazon: { configured: true, missing: [] },
  },
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useOutletContext: () => ({ project: { _id: "projects_test" } }),
  useParams: () => ({
    orgSlug: "test-org",
    projectSlug: "test-project",
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: (reference: string) =>
    reference === "projects.getSetupStatus" ? mocks.setup : null,
}));

vi.mock("@/convex", () => ({
  api: {
    projects: {
      query: { getWebhookEndpointPaths: "projects.getWebhookEndpointPaths" },
      setupStatus: { getSetupStatus: "projects.getSetupStatus" },
    },
  },
}));

import ProjectWebhooks from "./webhooks";

describe("ProjectWebhooks setup badges", () => {
  afterEach(cleanup);

  it("renders a sandbox-only Amazon setup as ready", () => {
    render(<ProjectWebhooks />);

    const amazonBadge = screen.getByText("Amazon RVS").parentElement;
    expect(amazonBadge).toBeTruthy();
    expect(within(amazonBadge!).getByText("Ready")).toBeTruthy();
    expect(within(amazonBadge!).queryByText("Not configured")).toBeNull();
  });
});
