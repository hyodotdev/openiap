/** @vitest-environment jsdom */
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  purchase: {
    _id: "purchases_1",
    projectId: "projects_test",
    store: "google",
    state: "ENTITLED",
    isValid: true,
    rawEvidenceVisible: false,
    environment: undefined as string | undefined,
  },
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useLocation: () => ({ search: "" }),
  useOutletContext: () => ({ project: { _id: "projects_test" } }),
  useParams: () => ({
    orgSlug: "acme",
    projectSlug: "martie",
    purchaseId: "purchases_1",
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: (query: string) =>
    query === "getPurchaseById" ? mocks.purchase : false,
}));

vi.mock("@/convex", () => ({
  api: {
    purchases: { query: { getPurchaseById: "getPurchaseById" } },
    commerce: { destinations: { canManage: "canManage" } },
  },
  HarmonizedPurchaseState: { ENTITLED: "ENTITLED", UNKNOWN: "UNKNOWN" },
}));

vi.mock("@/components/ResyncFromStoreButton", () => ({
  ResyncFromStoreButton: () => null,
}));

import PurchaseDetail from "./purchase-detail";

describe("PurchaseDetail environment", () => {
  afterEach(cleanup);

  const environmentValue = () =>
    screen.getByText("Environment").nextElementSibling?.textContent;

  it("shows the purchase's environment", () => {
    mocks.purchase.environment = "Sandbox";
    render(<PurchaseDetail />);
    expect(environmentValue()).toBe("Sandbox");
  });

  it("says so when the store did not report one", () => {
    mocks.purchase.environment = undefined;
    render(<PurchaseDetail />);
    expect(environmentValue()).toBe("Not reported");
  });
});
