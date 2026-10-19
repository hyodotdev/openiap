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

const mocks = vi.hoisted(() => {
  const keys = [
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
  ];
  return {
    initialKeys: keys,
    keys,
    create: vi.fn(),
    revoke: vi.fn(),
    regenerate: vi.fn(),
  };
});
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
  mocks.keys = mocks.initialKeys;
  cleanup();
  vi.clearAllMocks();
  for (const mutation of [mocks.create, mocks.revoke, mocks.regenerate]) {
    mutation.mockReset();
  }
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
    expect(within(list).getByText("No actions available")).toBeTruthy();
    // jsdom ignores breakpoints, so pin the switch between the two layouts.
    expect(table.className).toMatch(/\bhidden\b.*\bxl:table\b/);
    expect(list.className).toContain("xl:hidden");
  });

  it.each(["table", "list"] as const)(
    "revokes only the confirmed key from the %s",
    async (layout) => {
      const confirm = vi.fn(() => true);
      vi.stubGlobal("confirm", confirm);
      render(<ApiKeys />);
      fireEvent.click(
        within(screen.getByRole(layout)).getByRole("button", {
          name: "Revoke iOS app",
        }),
      );
      await waitFor(() =>
        expect(mocks.revoke).toHaveBeenCalledWith({ keyId: "key_active" }),
      );
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining("revoke"));
      expect(mocks.regenerate).not.toHaveBeenCalled();
    },
  );

  it.each(["table", "list"] as const)(
    "regenerates only the confirmed key from the %s and shows it once",
    async (layout) => {
      const confirm = vi.fn(() => true);
      vi.stubGlobal("confirm", confirm);
      mocks.regenerate.mockResolvedValue({
        name: "iOS app",
        key: "pk_live_new",
        keyType: "publishable",
      });
      render(<ApiKeys />);
      fireEvent.click(
        within(screen.getByRole(layout)).getByRole("button", {
          name: "Regenerate iOS app",
        }),
      );
      expect(await screen.findByText("pk_live_new")).toBeTruthy();
      expect(confirm).toHaveBeenCalledWith(
        expect.stringContaining("regenerate"),
      );
      expect(mocks.regenerate).toHaveBeenCalledWith({ keyId: "key_active" });
      expect(mocks.revoke).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Dismiss API key" }));
      expect(screen.queryByText("pk_live_new")).toBeNull();
    },
  );

  it("changes nothing when the confirmation is cancelled", () => {
    vi.stubGlobal("confirm", () => false);
    render(<ApiKeys />);
    const list = screen.getByRole("list");
    fireEvent.click(
      within(list).getByRole("button", { name: "Revoke iOS app" }),
    );
    fireEvent.click(
      within(list).getByRole("button", { name: "Regenerate iOS app" }),
    );
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(mocks.regenerate).not.toHaveBeenCalled();
  });

  it("shows the empty state without a table or list", () => {
    mocks.keys = [];
    render(<ApiKeys />);
    expect(screen.getByText("No API keys yet")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
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
    const publishable = screen.getByRole("radio", { name: /Publishable/ });
    const highlighted = (radio: HTMLElement) =>
      /(?:^|\s)border-primary(?:\s|$)/.test(
        radio.closest("label")?.className ?? "",
      );
    expect([highlighted(publishable), highlighted(secret)]).toEqual([
      true,
      false,
    ]);
    fireEvent.click(secret);
    expect([highlighted(publishable), highlighted(secret)]).toEqual([
      false,
      true,
    ]);

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
