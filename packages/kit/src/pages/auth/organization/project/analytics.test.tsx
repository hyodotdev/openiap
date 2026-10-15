/** @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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

const churnRow = {
  currency: "USD",
  productId: "premium",
  platform: "IOS",
  activeTrials: 0,
  newSubs: 0,
  trialStarts: 0,
  trialConversions: 0,
  directPaidStarts: 0,
  renewals: 0,
  cancellations: 0,
  expirations: 0,
  refunds: 0,
  revenueMicros: 0,
  refundedMicros: 0,
};

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

  it("counts trials from the split day and churn once its base is known", () => {
    const dayKey = (daysAgo: number) =>
      new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
    const [twoDaysAgo, yesterday] = [dayKey(2), dayKey(1)];
    const row = {
      currency: "USD",
      productId: "premium",
      platform: "IOS",
      renewals: 0,
      cancellations: 0,
      refunds: 0,
      revenueMicros: 0,
      refundedMicros: 0,
      newSubs: 0,
    };
    const split = {
      trialStarts: 0,
      trialConversions: 0,
      directPaidStarts: 0,
    };
    mocks.state.metrics = response({
      dataState: "ready",
      lastRunAt: Date.now(),
      trialSplitFromDay: yesterday,
      currencies: ["USD"],
      days: [
        // Before the split the trial counters and expirations are omitted.
        { ...row, day: twoDaysAgo, activeSubs: 4, newSubs: 3 },
        {
          ...row,
          ...split,
          day: yesterday,
          activeSubs: 4,
          activeTrials: 1,
          trialStarts: 1,
          expirations: 1,
        },
        {
          ...row,
          ...split,
          day: today,
          activeSubs: 3,
          activeTrials: 1,
          expirations: 1,
        },
      ],
    });
    render(<ProjectAnalytics />);
    expect(screen.getByText("Trial split starts mid-range")).toBeTruthy();
    expect(screen.getByText("Trials started").parentElement?.textContent).toBe(
      `Trials started1From ${yesterday}`,
    );
    // The split day's base would count yesterday's trials as paid, so churn
    // starts the day after: one expiry of three paid subscriptions.
    expect(screen.getByText("Churn").parentElement?.textContent).toBe(
      `Churn33.3%1 expired of 3 paid at start, from ${today}`,
    );
  });

  it("shows churn as unknown until a day has a starting paid count", () => {
    mocks.state.metrics = response({
      dataState: "ready",
      lastRunAt: Date.now(),
      currencies: ["USD"],
      days: [{ ...churnRow, day: today, activeSubs: 3, expirations: 1 }],
    });
    render(<ProjectAnalytics />);
    expect(screen.getByText("Churn").parentElement?.textContent).toBe("Churn—");
  });

  it("fetches the day before the 90-day range for its starting paid count", () => {
    const dayBefore = new Date(Date.now() - 90 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    mocks.state.metrics = response({
      dataState: "ready",
      lastRunAt: Date.now(),
      currencies: ["USD"],
      days: [
        { ...churnRow, day: dayBefore, activeSubs: 4 },
        { ...churnRow, day: today, activeSubs: 3, expirations: 1 },
      ],
    });
    render(<ProjectAnalytics />);
    expect(mocks.state.lastArgs).toMatchObject({ fromDay: dayBefore });
    fireEvent.click(screen.getByText("Last 90 days"));
    expect(screen.getByText("Churn").parentElement?.textContent).toBe(
      "Churn25.0%1 expired of 4 paid at start",
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
