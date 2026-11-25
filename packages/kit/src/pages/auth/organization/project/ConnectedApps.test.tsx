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
  grants: [] as
    | {
        id: string;
        clientName: string;
        scope: "read" | "write";
        connectedBy: string | null;
        createdAt: number;
        lastUsedAt: number;
      }[]
    | null,
  disconnect: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: () => mocks.grants,
  useMutation: () => mocks.disconnect,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-router-dom", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/convex", () => ({
  api: {
    oauth: {
      query: { listProjectGrants: "grants" },
      mutation: { disconnect: "disconnect" },
    },
  },
}));
import { ConnectedApps } from "./ConnectedApps";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Connected apps", () => {
  it("points to the guide while no app is connected", () => {
    mocks.grants = [];
    render(<ConnectedApps projectId={"p1" as never} />);
    expect(
      screen.getByRole("link", { name: "AI assistants" }).getAttribute("href"),
    ).toBe("/docs/ai-assistants");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows nothing to a member, who cannot manage connections", () => {
    mocks.grants = null;
    const { container } = render(<ConnectedApps projectId={"p1" as never} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows each app's access and disconnects only the one clicked", async () => {
    mocks.disconnect.mockResolvedValue(null);
    mocks.grants = [
      {
        id: "g1",
        clientName: "Claude",
        scope: "read",
        connectedBy: "Hyo",
        createdAt: 0,
        lastUsedAt: 0,
      },
      {
        id: "g2",
        clientName: "ChatGPT",
        scope: "write",
        connectedBy: null,
        createdAt: 0,
        lastUsedAt: 0,
      },
    ];
    render(<ConnectedApps projectId={"p1" as never} />);
    expect(screen.getByText("Claude · Read only")).toBeDefined();
    expect(screen.getByText("ChatGPT · Read and change")).toBeDefined();
    expect(screen.getByText(/Connected by Hyo/)).toBeDefined();

    expect(screen.getByText(/^Connected on /)).toBeDefined();

    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect ChatGPT" }));
    expect(confirm).toHaveBeenCalledWith(
      "Disconnect ChatGPT? It loses access to this project at once.",
    );
    expect(mocks.disconnect).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect ChatGPT" }));
    await waitFor(() =>
      expect(mocks.disconnect).toHaveBeenCalledWith({ grantId: "g2" }),
    );
    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps every pending disconnect disabled until its own request ends", async () => {
    const finish: Record<string, () => void> = {};
    mocks.disconnect.mockReset().mockImplementation(
      ({ grantId }: { grantId: string }) =>
        new Promise<null>((resolve) => {
          finish[grantId] = () => resolve(null);
        }),
    );
    mocks.grants = ["Claude", "ChatGPT"].map((clientName, index) => ({
      id: `g${index + 1}`,
      clientName,
      scope: "read" as const,
      connectedBy: null,
      createdAt: 0,
      lastUsedAt: 0,
    }));
    vi.stubGlobal("confirm", () => true);
    render(<ConnectedApps projectId={"p1" as never} />);
    const button = (name: string) =>
      screen.getByRole("button", { name: `Disconnect ${name}` });

    fireEvent.click(button("Claude"));
    fireEvent.click(button("ChatGPT"));
    await waitFor(() =>
      expect(button("ChatGPT").hasAttribute("disabled")).toBe(true),
    );
    expect(button("Claude").hasAttribute("disabled")).toBe(true);

    finish.g2();
    await waitFor(() =>
      expect(button("ChatGPT").hasAttribute("disabled")).toBe(false),
    );
    expect(button("Claude").hasAttribute("disabled")).toBe(true);
    fireEvent.click(button("Claude"));
    expect(mocks.disconnect).toHaveBeenCalledTimes(2);
  });
});
