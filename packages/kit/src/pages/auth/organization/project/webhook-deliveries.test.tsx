/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  canManage: true,
  resend: vi.fn(async () => ({ status: "pending" })),
  results: [
    {
      _id: "outboundDeliveries_1",
      eventId: "commerceEvents_1",
      eventType: "entitlement.revoked",
      eventAvailable: true,
      destinationId: "outboundDestinations_1",
      destinationHost: "hooks.example.com",
      status: "failed",
      resendable: true,
      attempts: 14,
      nextAttemptAt: 0,
      lastStatusCode: 503,
      attemptHistory: [
        { at: 0, outcome: "retrying", statusCode: 503, latencyMs: 120 },
        { at: 60_000, outcome: "failed", errorClass: "timeout" },
      ],
      createdAt: 0,
      updatedAt: 60_000,
    },
  ],
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useOutletContext: () => ({ project: { _id: "projects_test" } }),
  useParams: () => ({ orgSlug: "acme", projectSlug: "app" }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.resend,
  usePaginatedQuery: () => ({
    results: mocks.results,
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
  useQuery: () => mocks.canManage,
}));

vi.mock("@/convex", () => ({
  api: {
    commerce: {
      destinations: { canManage: "canManage" },
      deliveryState: { listDeliveries: "listDeliveries", resend: "resend" },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import WebhookDeliveries from "./webhook-deliveries";

describe("WebhookDeliveries", () => {
  afterEach(() => {
    cleanup();
    mocks.canManage = true;
    mocks.resend.mockClear();
  });

  it("shows attempt history and re-sends for admins", async () => {
    render(<WebhookDeliveries />);
    expect(
      screen.getByText("hooks.example.com", { exact: false }),
    ).toBeTruthy();
    expect(screen.getByText("2 recent attempts")).toBeTruthy();
    expect(screen.getByText("timeout")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Re-send/ }));
    await waitFor(() =>
      expect(mocks.resend).toHaveBeenCalledWith({
        deliveryId: "outboundDeliveries_1",
      }),
    );
  });

  it("hides re-send from members", () => {
    mocks.canManage = false;
    render(<WebhookDeliveries />);
    expect(screen.queryByRole("button", { name: /Re-send/ })).toBeNull();
  });
});
