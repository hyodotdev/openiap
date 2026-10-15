/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => {
  const state: { metrics: unknown; lastArgs: unknown } = {
    metrics: undefined,
    lastArgs: undefined,
  };
  return {
    project: {
      _id: "projects_test",
      organizationId: "organizations_test",
      name: "Martie",
      slug: "martie",
      reportingCurrency: "USD",
    },
    state,
  };
});

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({ project: mocks.project }),
  useParams: () => ({ orgSlug: "org", projectSlug: "martie" }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("convex/react", () => ({
  useQuery: (_reference: string, args: unknown) => {
    mocks.state.lastArgs = args;
    return mocks.state.metrics;
  },
}));

vi.mock("@/convex", () => ({
  api: {
    subscriptions: {
      query: { getRevenueMetrics: "subscriptions.getRevenueMetrics" },
    },
  },
}));

import ProjectAnalytics from "./analytics";

const today = new Date().toISOString().slice(0, 10);

function response(overrides: Record<string, unknown>) {
  return {
    days: [],
    currencies: [],
    productIds: [],
    platforms: [],
    truncated: false,
    environment: "Production",
    dataState: "ready",
    pendingLateEvents: 0,
    ...overrides,
  };
}

beforeAll(() => {
  // Recharts measures its container; jsdom has no ResizeObserver.
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

describe("ProjectAnalytics data states", () => {
  afterEach(cleanup);

  it("asks for production with cohorts by default", () => {
    mocks.state.metrics = response({ dataState: "not_collected" });
    render(<ProjectAnalytics />);
    expect(mocks.state.lastArgs).toMatchObject({
      environment: "Production",
      includeCohorts: true,
    });
  });

  it("tells not collected, processing and real zero apart", () => {
    mocks.state.metrics = response({ dataState: "not_collected" });
    render(<ProjectAnalytics />);
    expect(
      screen.getByText("No store notifications received yet"),
    ).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    cleanup();

    mocks.state.metrics = response({ dataState: "processing" });
    render(<ProjectAnalytics />);
    expect(screen.getByText("Rolling up notifications")).toBeTruthy();
    expect(
      screen.queryByText("No store notifications received yet"),
    ).toBeNull();
    cleanup();

    mocks.state.metrics = response({
      dataState: "zero",
      lastRunAt: Date.now(),
    });
    render(<ProjectAnalytics />);
    expect(
      screen.getByText("No subscription activity in this range"),
    ).toBeTruthy();
    expect(screen.getByText("Trials started").parentElement?.textContent).toBe(
      "Trials started0",
    );
  });

  it("counts trials and churn only from the trial split day, and says why", () => {
    const yesterday = new Date(Date.now() - 86_400_000)
      .toISOString()
      .slice(0, 10);
    const row = {
      currency: "USD",
      productId: "premium",
      platform: "IOS",
      activeSubs: 4,
      renewals: 0,
      cancellations: 0,
      refunds: 0,
      revenueMicros: 0,
      refundedMicros: 0,
    };
    mocks.state.metrics = response({
      dataState: "ready",
      lastRunAt: Date.now(),
      trialSplitFromDay: today,
      currencies: ["USD"],
      days: [
        // Before the split the trial counters and expirations are omitted.
        { ...row, day: yesterday, newSubs: 3 },
        {
          ...row,
          day: today,
          activeTrials: 1,
          newSubs: 1,
          trialStarts: 1,
          trialConversions: 0,
          directPaidStarts: 0,
          expirations: 1,
        },
      ],
    });
    render(<ProjectAnalytics />);
    expect(screen.getByText("Trial split starts mid-range")).toBeTruthy();
    expect(screen.getByText("Trials started").parentElement?.textContent).toBe(
      `Trials started1From ${today}`,
    );
    // One paid expiry of the four paid subscriptions the split day started with.
    expect(screen.getByText("Churn").parentElement?.textContent).toBe(
      `Churn25.0%1 expired of 4 paid at start, from ${today}`,
    );
  });

  it("shows late notifications and the cohort table when data is ready", () => {
    mocks.state.metrics = response({
      dataState: "ready",
      lastRunAt: Date.now(),
      definitionsFromDay: "2000-01-01",
      pendingLateEvents: 2,
      oldestPendingLateDay: "2026-03-05",
      currencies: ["USD"],
      days: [
        {
          day: today,
          currency: "USD",
          productId: "premium",
          platform: "IOS",
          activeSubs: 4,
          activeTrials: 1,
          newSubs: 2,
          trialStarts: 1,
          trialConversions: 1,
          directPaidStarts: 1,
          renewals: 1,
          cancellations: 1,
          expirations: 0,
          refunds: 0,
          revenueMicros: 3 * 9_990_000,
          refundedMicros: 0,
        },
      ],
      cohorts: [
        {
          month: "2026-01",
          currency: "USD",
          members: 4,
          revenueMicros: 8 * 9_990_000,
          refundedMicros: 0,
          realizedLtvMicros: 2 * 9_990_000,
          retained: [4, 2],
          trialStarts: 3,
          trialConversions: 1,
          trialsPending: 1,
          observedThrough: today,
        },
      ],
    });
    render(<ProjectAnalytics />);
    expect(screen.getByText("Late notifications pending")).toBeTruthy();
    expect(screen.getByText("Monthly cohorts · USD")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("USD 19.98")).toBeTruthy();
    expect(screen.getByText("50% of 2")).toBeTruthy();
  });
});
