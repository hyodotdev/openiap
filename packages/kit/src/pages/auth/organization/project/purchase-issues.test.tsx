/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const FINGERPRINT = "ab".repeat(32);
const ISSUE = {
  _id: "purchaseIssues_1",
  cause: "OWNERSHIP_CONFLICT",
  store: "google",
  fingerprint: FINGERPRINT,
  productId: "gold",
  claimedProductId: "silver",
  appUserId: "user-7",
  correlationId: "6ebb9c9e-2e6e-4f9a-9bf2-4a6a9d5f9d20",
  count: 3,
  firstSeenAt: 0,
  lastSeenAt: 60_000,
};

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  setSearchParams: vi.fn(),
  listArgs: vi.fn(),
  results: [] as Partial<typeof ISSUE>[],
  detail: null as Partial<typeof ISSUE> | null,
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useOutletContext: () => ({ project: { _id: "projects_test" } }),
  useParams: () => ({ orgSlug: "acme", projectSlug: "app" }),
  useSearchParams: () => [mocks.searchParams, mocks.setSearchParams],
}));

vi.mock("convex/react", () => ({
  usePaginatedQuery: (_query: string, args: unknown) => {
    mocks.listArgs(args);
    return { results: mocks.results, status: "Exhausted", loadMore: vi.fn() };
  },
  useQuery: (_query: string, args: unknown) =>
    args === "skip" ? undefined : mocks.detail,
}));

vi.mock("@/convex", () => ({
  api: {
    purchaseIssues: {
      query: {
        listPurchaseIssues: "listPurchaseIssues",
        getPurchaseIssue: "getPurchaseIssue",
      },
    },
  },
}));

import PurchaseIssues from "./purchase-issues";

describe("PurchaseIssues", () => {
  beforeEach(() => {
    mocks.results = [ISSUE];
  });

  afterEach(() => {
    cleanup();
    mocks.searchParams = new URLSearchParams();
    mocks.setSearchParams.mockClear();
    mocks.listArgs.mockClear();
    mocks.detail = null;
  });

  it("lists issues with the URL filters and a fingerprint prefix", () => {
    mocks.searchParams = new URLSearchParams(
      "cause=OWNERSHIP_CONFLICT&store=steam&appUserId=user-7&from=2026-10-01&to=2026-10-01",
    );
    render(<PurchaseIssues />);

    expect(mocks.listArgs).toHaveBeenLastCalledWith({
      projectId: "projects_test",
      cause: "OWNERSHIP_CONFLICT",
      store: undefined,
      productId: undefined,
      appUserId: "user-7",
      from: Date.parse("2026-10-01T00:00:00Z"),
      to: Date.parse("2026-10-02T00:00:00Z") - 1,
    });
    expect(screen.getByText("claimed silver")).toBeTruthy();
    expect(screen.getByText(FINGERPRINT.slice(0, 16))).toBeTruthy();
    expect(screen.queryByText(FINGERPRINT)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Linked to another account" }),
    );
    const [next] = mocks.setSearchParams.mock.calls[0] as [URLSearchParams];
    expect(next.get("issue")).toBe("purchaseIssues_1");
  });

  it("explains the selected issue and links its app user", () => {
    mocks.searchParams = new URLSearchParams("issue=purchaseIssues_1");
    mocks.detail = ISSUE;
    render(<PurchaseIssues />);

    const dialog = screen.getByRole("dialog", { name: "Purchase issue" });
    expect(dialog.textContent).toContain("Rebind only where your app's policy");
    expect(dialog.textContent).toContain(FINGERPRINT);
    expect(
      screen.getByRole("link", { name: "user-7" }).getAttribute("href"),
    ).toBe("/acme/project/app/purchases/user/user-7");
  });

  it("labels a shared row instead of showing a fingerprint", () => {
    const shared = {
      _id: "purchaseIssues_2",
      cause: "CREDENTIALS_REJECTED",
      store: "apple",
      count: 4,
      firstSeenAt: 0,
      lastSeenAt: 60_000,
    };
    mocks.results = [shared];
    mocks.searchParams = new URLSearchParams("issue=purchaseIssues_2");
    mocks.detail = shared;
    render(<PurchaseIssues />);

    expect(
      screen.getAllByText("Shared by every failure of this store and cause"),
    ).toHaveLength(2);
  });

  it("says when the selected issue is gone", () => {
    mocks.searchParams = new URLSearchParams("issue=purchaseIssues_9");
    render(<PurchaseIssues />);
    expect(screen.getByText(/no longer exists/)).toBeTruthy();
  });
});
