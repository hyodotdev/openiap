/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  setup: {
    ios: { configured: false, missing: ["iosBundleId"] },
    android: { configured: false, missing: ["androidPackageName"] },
    horizon: { configured: false, missing: ["horizonEnabled"] },
    amazon: { configured: true, missing: [] },
  },
  canManage: true,
  destinations: [] as Array<{
    _id: string;
    url: string;
    enabled: boolean;
    eventTypes?: string[];
    description?: string;
    consecutiveFailures: number;
  }>,
  failed: [] as Array<{
    _id: string;
    eventType: string;
    destinationUrl: string;
    lastError?: string;
    lastStatusCode?: number;
  }>,
  create: vi.fn(),
  update: vi.fn(),
  rotate: vi.fn(),
  remove: vi.fn(),
  replay: vi.fn(),
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
  useQuery: (reference: string) => {
    if (reference === "projects.getSetupStatus") return mocks.setup;
    if (reference === "commerce.destinations.canManage") return mocks.canManage;
    if (reference === "commerce.destinations.list") return mocks.destinations;
    if (reference === "commerce.deliveryState.listFailed") return mocks.failed;
    return null;
  },
  useMutation: (reference: string) => {
    if (reference === "commerce.destinations.create") return mocks.create;
    if (reference === "commerce.destinations.update") return mocks.update;
    if (reference === "commerce.destinations.rotateSecret") return mocks.rotate;
    if (reference === "commerce.destinations.remove") return mocks.remove;
    if (reference === "commerce.deliveryState.replay") return mocks.replay;
    return vi.fn();
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/convex", () => ({
  api: {
    projects: {
      query: { getWebhookEndpointPaths: "projects.getWebhookEndpointPaths" },
      setupStatus: { getSetupStatus: "projects.getSetupStatus" },
    },
    commerce: {
      destinations: {
        canManage: "commerce.destinations.canManage",
        list: "commerce.destinations.list",
        create: "commerce.destinations.create",
        update: "commerce.destinations.update",
        rotateSecret: "commerce.destinations.rotateSecret",
        remove: "commerce.destinations.remove",
      },
      deliveryState: {
        listFailed: "commerce.deliveryState.listFailed",
        replay: "commerce.deliveryState.replay",
      },
    },
  },
}));

import ProjectWebhooks from "./webhooks";

describe("ProjectWebhooks setup badges", () => {
  beforeEach(() => {
    mocks.canManage = true;
    mocks.destinations = [];
    mocks.failed = [];
    for (const mutation of [
      mocks.create,
      mocks.update,
      mocks.rotate,
      mocks.remove,
      mocks.replay,
    ]) {
      mutation.mockReset();
      mutation.mockResolvedValue(null);
    }
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders a sandbox-only Amazon setup as ready", () => {
    render(<ProjectWebhooks />);

    const amazonBadge = screen.getByText("Amazon RVS").parentElement;
    expect(amazonBadge).toBeTruthy();
    expect(within(amazonBadge!).getByText("Ready")).toBeTruthy();
    expect(within(amazonBadge!).queryByText("Not configured")).toBeNull();
  });

  it("hides destination controls from organization members", () => {
    mocks.canManage = false;
    render(<ProjectWebhooks />);

    expect(
      screen.getByText(/owner or admin can manage signed HTTPS destinations/),
    ).toBeTruthy();
    expect(screen.queryByPlaceholderText(/api\.example\.com/)).toBeNull();
  });

  it("creates a filtered destination and reveals its one-time secret", async () => {
    mocks.create.mockResolvedValue({
      destinationId: "outboundDestinations_1",
      secret: "whsec_once",
    });
    render(<ProjectWebhooks />);

    fireEvent.change(screen.getByPlaceholderText(/api\.example\.com/), {
      target: { value: "https://hooks.example.com/openiap" },
    });
    for (const checkbox of screen.getAllByRole("checkbox")) {
      if (
        checkbox.getAttribute("aria-label") !== "Receive subscription.renewed"
      ) {
        fireEvent.click(checkbox);
      }
    }
    fireEvent.click(screen.getByRole("button", { name: "Add destination" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        projectId: "projects_test",
        url: "https://hooks.example.com/openiap",
        eventTypes: ["subscription.renewed"],
      }),
    );
    expect(screen.getByText("whsec_once")).toBeTruthy();
    expect(screen.getByText("https://hooks.example.com/openiap")).toBeTruthy();
  });

  it("preserves concurrent rotated secrets for different destinations", async () => {
    mocks.destinations = [
      {
        _id: "outboundDestinations_1",
        url: "https://one.example.com/openiap",
        enabled: true,
        consecutiveFailures: 0,
      },
      {
        _id: "outboundDestinations_2",
        url: "https://two.example.com/openiap",
        enabled: true,
        consecutiveFailures: 0,
      },
    ];
    mocks.rotate.mockImplementation(
      async ({ destinationId }: { destinationId: string }) => ({
        secret:
          destinationId === "outboundDestinations_1"
            ? "whsec_first"
            : "whsec_second",
      }),
    );
    render(<ProjectWebhooks />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Rotate signing secret for https://one.example.com/openiap",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Rotate signing secret for https://two.example.com/openiap",
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("whsec_first")).toBeTruthy();
      expect(screen.getByText("whsec_second")).toBeTruthy();
    });
    expect(
      screen.getByLabelText(
        "Dismiss signing secret for https://one.example.com/openiap",
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Dismiss signing secret for https://two.example.com/openiap",
      ),
    ).toBeTruthy();
  });

  it("runs destination controls and dead-letter replay", async () => {
    mocks.destinations = [
      {
        _id: "outboundDestinations_1",
        url: "https://hooks.example.com/openiap",
        enabled: true,
        eventTypes: ["subscription.renewed"],
        consecutiveFailures: 0,
      },
    ];
    mocks.failed = [
      {
        _id: "outboundDeliveries_1",
        eventType: "subscription.renewed",
        destinationUrl: "https://hooks.example.com/openiap",
        lastStatusCode: 503,
      },
    ];
    mocks.rotate.mockResolvedValue({ secret: "whsec_rotated" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ProjectWebhooks />);

    expect(
      screen.getByLabelText(
        "https://hooks.example.com/openiap receive subscription.renewed",
      ),
    ).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));
    fireEvent.click(
      screen.getByLabelText(
        "https://hooks.example.com/openiap receive entitlement.granted",
      ),
    );
    fireEvent.click(
      screen.getByLabelText(
        "https://hooks.example.com/openiap receive entitlement.revoked",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save event filter" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Rotate signing secret for https://hooks.example.com/openiap",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove destination https://hooks.example.com/openiap",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({
        destinationId: "outboundDestinations_1",
        enabled: false,
      });
      expect(mocks.update).toHaveBeenCalledWith({
        destinationId: "outboundDestinations_1",
        eventTypes: [
          "subscription.renewed",
          "entitlement.granted",
          "entitlement.revoked",
        ],
      });
      expect(mocks.rotate).toHaveBeenCalled();
      expect(mocks.remove).toHaveBeenCalled();
      expect(mocks.replay).toHaveBeenCalledWith({
        deliveryId: "outboundDeliveries_1",
      });
    });
    expect(screen.getByText("HTTP 503", { exact: false })).toBeTruthy();
    expect(screen.getByText("whsec_rotated")).toBeTruthy();
    expect(
      screen.getAllByText("https://hooks.example.com/openiap"),
    ).toHaveLength(2);
  });
});
