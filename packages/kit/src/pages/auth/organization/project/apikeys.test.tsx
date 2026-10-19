/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  keys: [
    {
      _id: "key_active",
      name: "iOS app",
      description: "Verifies purchases",
      keyPreview: "pk_live_abcd…wxyz",
      keyType: "publishable",
      isActive: true,
      createdAt: Date.UTC(2026, 9, 1),
    },
    {
      _id: "key_revoked",
      name: "Old backend",
      keyPreview: "sk_live_efgh…stuv",
      keyType: "secret",
      isActive: false,
      createdAt: Date.UTC(2026, 8, 1),
    },
  ],
  create: vi.fn(),
  revoke: vi.fn(),
  regenerate: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (ref: string) =>
    ref === "org"
      ? { _id: "org_1" }
      : ref === "project"
        ? { _id: "project_1" }
        : mocks.keys,
  useMutation: (ref: string) =>
    ({
      create: mocks.create,
      revoke: mocks.revoke,
      regenerate: mocks.regenerate,
    })[ref],
}));
vi.mock("react-router-dom", () => ({
  useParams: () => ({ orgSlug: "acme", projectSlug: "game" }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/mixpanel", () => ({
  MixpanelEvent: { ApiKeyCreated: "api_key_created" },
  trackEvent: vi.fn(),
}));
vi.mock("@/convex", () => ({
  api: {
    organizations: { query: { getOrganizationBySlug: "org" } },
    projects: { query: { getProjectByOrgAndSlug: "project" } },
    apiKeys: {
      query: { listProjectApiKeys: "keys" },
      mutation: {
        create: "create",
        revoke: "revoke",
        regenerate: "regenerate",
      },
    },
  },
}));

import ApiKeys from "./apikeys";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("API Keys page", () => {
  it("offers actions only for active keys in both layouts", () => {
    render(<ApiKeys />);
    const [table, list] = [screen.getByRole("table"), screen.getByRole("list")];
    for (const layout of [table, list]) {
      expect(
        within(layout).getByRole("button", { name: "Regenerate iOS app" }),
      ).toBeTruthy();
      expect(
        within(layout).getByRole("button", { name: "Revoke iOS app" }),
      ).toBeTruthy();
      expect(
        within(layout).queryByRole("button", { name: /Old backend/ }),
      ).toBeNull();
    }
    expect(within(table).getByText("No actions available")).toBeTruthy();
  });

  it("revokes and regenerates the confirmed key by id", async () => {
    vi.stubGlobal("confirm", () => true);
    mocks.regenerate.mockResolvedValue({
      name: "iOS app",
      key: "pk_live_new",
      keyType: "publishable",
    });
    render(<ApiKeys />);
    const list = screen.getByRole("list");
    fireEvent.click(
      within(list).getByRole("button", { name: "Revoke iOS app" }),
    );
    fireEvent.click(
      within(list).getByRole("button", { name: "Regenerate iOS app" }),
    );
    await waitFor(() =>
      expect(mocks.regenerate).toHaveBeenCalledWith({ keyId: "key_active" }),
    );
    expect(mocks.revoke).toHaveBeenCalledWith({ keyId: "key_active" });
  });

  it("highlights only the chosen key type and submits it", async () => {
    mocks.create.mockResolvedValue({
      name: "Staging",
      key: "sk_live_new",
      keyType: "secret",
    });
    render(<ApiKeys />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Create API Key" })[0],
    );
    const secret = screen.getByRole("radio", { name: /Secret admin/ });
    fireEvent.click(secret);
    const publishable = screen.getByRole("radio", { name: /Publishable/ });
    expect(secret.closest("label")?.className).toContain("border-primary");
    expect(publishable.closest("label")?.className).not.toContain(
      "border-primary",
    );

    fireEvent.change(screen.getByLabelText(/Key Name/), {
      target: { value: "  Staging  " },
    });
    fireEvent.submit(secret.closest("form")!);
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        projectId: "project_1",
        name: "Staging",
        description: undefined,
        keyType: "secret",
      }),
    );
  });
});
