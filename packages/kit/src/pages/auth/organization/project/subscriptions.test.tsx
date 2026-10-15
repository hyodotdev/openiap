/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  project: {
    _id: "projects_test",
    organizationId: "organizations_test",
    name: "Martie",
    slug: "martie",
    reportingCurrency: "USD",
  },
  metrics: {
    reportingCurrency: "USD",
    mrrMicros: 0,
    mrrByCurrency: [],
    excludedMrrByCurrency: [],
    activeSubs: 1,
    inGracePeriod: 0,
    inBillingRetry: 0,
    refunded30d: 0,
    canceled30d: 0,
  },
  subscriptions: {
    total: 1,
    items: [],
  },
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useOutletContext: () => ({ project: mocks.project }),
  useParams: () => ({ orgSlug: "acme", projectSlug: "martie" }),
}));

vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useQuery: (reference: string) =>
    reference === "subscriptions.metricsSummary"
      ? mocks.metrics
      : reference === "commerce.destinations.canManage"
        ? false
        : mocks.subscriptions,
}));

vi.mock("@/convex", () => ({
  api: {
    commerce: {
      destinations: { canManage: "commerce.destinations.canManage" },
    },
    subscriptions: {
      action: { resyncFromStore: "subscriptions.resyncFromStore" },
      query: {
        metricsSummary: "subscriptions.metricsSummary",
        listSubscriptions: "subscriptions.listSubscriptions",
      },
    },
  },
}));

import ProjectSubscriptions from "./subscriptions";

describe("ProjectSubscriptions responsive metrics", () => {
  afterEach(cleanup);

  it("stacks secondary metric cards before the small breakpoint", () => {
    render(<ProjectSubscriptions />);

    const refundedLabel = screen.getByText("Refunded (30d)");
    const secondaryMetrics = refundedLabel.parentElement?.parentElement;

    expect(secondaryMetrics?.classList.contains("grid-cols-1")).toBe(true);
    expect(secondaryMetrics?.classList.contains("sm:grid-cols-3")).toBe(true);
    expect(secondaryMetrics?.classList.contains("grid-cols-3")).toBe(false);
  });
});
