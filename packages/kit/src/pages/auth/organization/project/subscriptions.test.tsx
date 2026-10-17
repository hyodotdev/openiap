/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  project: {
    _id: "projects_test",
    organizationId: "organizations_test",
    name: "Martie",
    slug: "martie",
    reportingCurrency: "USD",
  },
  metricsPending: false,
  metrics: {
    stats: {
      state: "current",
      asOf: 1,
      validUntil: Number.MAX_SAFE_INTEGER,
    },
    recentCountsTruncated: false,
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
  useQuery: vi.fn((reference: string) =>
    reference === "subscriptions.metricsSummary"
      ? mocks.metricsPending
        ? undefined
        : mocks.metrics
      : reference === "commerce.destinations.canManage"
        ? false
        : mocks.subscriptions,
  ),
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
import { useQuery } from "convex/react";

describe("ProjectSubscriptions responsive metrics", () => {
  afterEach(() => {
    cleanup();
    mocks.metrics.stats.state = "current";
    mocks.metrics.recentCountsTruncated = false;
    mocks.metrics.stats.validUntil = Number.MAX_SAFE_INTEGER;
    mocks.metricsPending = false;
    vi.useRealTimers();
  });

  it("refreshes the query at the returned expiry and clears its timer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    mocks.metrics.stats.validUntil = 1_050;
    const view = render(<ProjectSubscriptions />);
    await act(() => vi.advanceTimersByTime(50));
    expect(vi.mocked(useQuery).mock.calls).toContainEqual([
      "subscriptions.metricsSummary",
      { projectId: "projects_test", refreshAt: 1_050 },
    ]);
    expect(screen.getAllByText("—")).toHaveLength(4);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("hides an expired arrival and requests a bounded immediate refresh", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_100);
    mocks.metrics.stats.validUntil = 1_050;
    render(<ProjectSubscriptions />);
    expect(screen.getAllByText("—")).toHaveLength(4);
    await act(() => vi.advanceTimersByTime(0));
    expect(vi.mocked(useQuery).mock.calls).toContainEqual([
      "subscriptions.metricsSummary",
      { projectId: "projects_test", refreshAt: 1_101 },
    ]);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("keeps subscription rows visible while metrics refresh", () => {
    mocks.metricsPending = true;
    render(<ProjectSubscriptions />);
    expect(screen.getByText("Total tracked")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Updating");
    expect(screen.getAllByText("—")).toHaveLength(6);
  });

  it.each(["rebuilding", "incomplete"] as const)(
    "hides partial headline totals while %s",
    (state) => {
      mocks.metrics.stats.state = state;
      render(<ProjectSubscriptions />);
      expect(screen.getByRole("status").textContent).toMatch(
        /subscription totals/i,
      );
      expect(screen.getAllByText("—")).toHaveLength(4);
      expect(screen.getByText("Total tracked")).toBeTruthy();
    },
  );

  it("stacks secondary metric cards before the small breakpoint", () => {
    render(<ProjectSubscriptions />);

    const refundedLabel = screen.getByText("Refunded (30d)");
    const secondaryMetrics = refundedLabel.parentElement?.parentElement;

    expect(secondaryMetrics?.classList.contains("grid-cols-1")).toBe(true);
    expect(secondaryMetrics?.classList.contains("sm:grid-cols-3")).toBe(true);
    expect(secondaryMetrics?.classList.contains("grid-cols-3")).toBe(false);
  });
});
