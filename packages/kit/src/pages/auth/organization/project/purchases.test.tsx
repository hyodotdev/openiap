/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
  searchParams: new URLSearchParams(),
  result: {
    page: [],
    continueCursor: null,
    isDone: true,
    stats: {
      total: 19,
      apple: 2,
      google: 8,
      googleOrders: 3,
      horizon: 4,
      amazon: 5,
      valid: 15,
      invalid: 4,
    },
  },
}));

vi.mock("react-router-dom", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => mocks.navigate,
  useOutletContext: () => ({
    project: {
      _id: "projects_test",
      organizationId: "organizations_test",
      name: "Test Project",
      slug: "test-project",
    },
  }),
  useParams: () => ({ orgSlug: "test-org", projectSlug: "test-project" }),
  useSearchParams: () => [mocks.searchParams, mocks.setSearchParams],
}));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.result,
}));

vi.mock("@/convex", () => ({
  api: { purchases: { query: { getReceiptsByProject: "purchases.list" } } },
  HarmonizedPurchaseState: {
    Entitled: "ENTITLED",
    Inauthentic: "INAUTHENTIC",
  },
}));

vi.mock("@/lib/mixpanel", () => ({
  MixpanelEvent: { ViewedPurchases: "viewed_purchases" },
  trackEvent: vi.fn(),
}));

vi.mock("./PurchasesTable", () => ({
  PurchasesTable: () => <div data-testid="purchases-table" />,
}));

vi.mock("antd", () => ({
  Input: (props: { placeholder?: string }) => (
    <input aria-label={props.placeholder} />
  ),
  Select: () => <div />,
}));

import ProjectPurchases from "./purchases";

describe("ProjectPurchases store stats", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.setSearchParams.mockReset();
    mocks.searchParams = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the total, every store and validity in one summary", () => {
    render(<ProjectPurchases />);

    expect(
      screen.getByRole("button", { name: "App Store" }).textContent,
    ).toContain("2");
    expect(
      screen.getByRole("button", { name: "Google Play" }).textContent,
    ).toContain("3");
    expect(
      screen.getByRole("button", { name: "Meta Horizon" }).textContent,
    ).toContain("4");
    expect(
      screen.getByRole("button", { name: "Amazon Appstore" }).textContent,
    ).toContain("5");

    expect(
      screen.getByRole("button", { name: "Total Purchases" }).textContent,
    ).toContain("19");
    expect(screen.getByRole("button", { name: "Valid" }).textContent).toContain(
      "15",
    );
    expect(
      screen.getByRole("button", { name: "Invalid" }).textContent,
    ).toContain("4");
    expect(
      screen.getByText(/Amazon lifecycle stays here through RVS rechecks/),
    ).toBeTruthy();
  });

  it("marks the total as showing everything only when nothing narrows the list", () => {
    const view = render(<ProjectPurchases />);
    const total = () => screen.getByRole("button", { name: "Total Purchases" });
    expect(total().getAttribute("aria-pressed")).toBe("true");
    view.unmount();

    mocks.searchParams = new URLSearchParams("product=premium_monthly");
    render(<ProjectPurchases />);
    expect(total().getAttribute("aria-pressed")).toBe("false");
    expect(total().textContent).toContain("Show every purchase");
  });

  it("offers Clear filters only while a filter narrows the list", () => {
    mocks.searchParams = new URLSearchParams("sortField=updatedAt");
    const view = render(<ProjectPurchases />);
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
    view.unmount();

    mocks.searchParams = new URLSearchParams("store=amazon");
    render(<ProjectPurchases />);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect([
      ...(mocks.setSearchParams.mock.calls[0][0] as URLSearchParams).keys(),
    ]).toEqual([]);
  });

  it("filters the purchases table from the Amazon and Horizon rows", () => {
    render(<ProjectPurchases />);

    fireEvent.click(screen.getByRole("button", { name: "Amazon Appstore" }));
    expect(mocks.setSearchParams).toHaveBeenCalledOnce();
    expect(
      (mocks.setSearchParams.mock.calls[0][0] as URLSearchParams).get("store"),
    ).toBe("amazon");

    mocks.setSearchParams.mockReset();
    fireEvent.click(screen.getByRole("button", { name: "Meta Horizon" }));
    expect(
      (mocks.setSearchParams.mock.calls[0][0] as URLSearchParams).get("store"),
    ).toBe("horizon");
  });
});
