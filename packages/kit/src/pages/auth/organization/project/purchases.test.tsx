/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("shows every store in a responsive card grid", () => {
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

    const grid = screen.getByRole("button", {
      name: "Total Purchases",
    }).parentElement;
    expect(grid?.classList.contains("sm:grid-cols-2")).toBe(true);
    expect(grid?.classList.contains("xl:grid-cols-4")).toBe(true);
    expect(
      screen.getByText(/Amazon lifecycle stays here through RVS rechecks/),
    ).toBeTruthy();
  });

  it("filters the purchases table from Amazon and Horizon cards", () => {
    render(<ProjectPurchases />);

    fireEvent.click(screen.getByRole("button", { name: "Amazon Appstore" }));
    expect(mocks.setSearchParams).toHaveBeenCalledOnce();
    expect(
      (mocks.setSearchParams.mock.calls[0][0] as URLSearchParams).get("store"),
    ).toBe("amazon");

    mocks.setSearchParams.mockReset();
    fireEvent.keyDown(screen.getByRole("button", { name: "Meta Horizon" }), {
      key: "Enter",
    });
    expect(
      (mocks.setSearchParams.mock.calls[0][0] as URLSearchParams).get("store"),
    ).toBe("horizon");
  });
});
