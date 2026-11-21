// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ConvexError } from "convex/values";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SEARCH =
  "?response_type=code&client_id=https%3A%2F%2Fclaude.ai%2Foauth%2Fx&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&code_challenge=abc&code_challenge_method=S256&state=s1";
const REQUEST = {
  responseType: "code",
  clientId: "https://claude.ai/oauth/x",
  redirectUri: "https://claude.ai/api/mcp/auth_callback",
  codeChallenge: "abc",
  codeChallengeMethod: "S256",
  resource: undefined,
};

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false },
  details: undefined as
    | undefined
    | { error: string }
    | {
        clientName: string;
        redirectHost: string;
        projects: { id: string; name: string; organizationName: string }[];
      },
  signIn: vi.fn(),
  approve: vi.fn(),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: mocks.signIn }),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => mocks.auth,
  useQuery: () => mocks.details,
  useMutation: () => mocks.approve,
}));
import OauthAuthorize from "./oauth-authorize";
import { SIGN_IN_UNFINISHED, takeSignInReturn } from "@/lib/signInReturn";

const assign = vi.fn();

beforeEach(() => {
  window.history.replaceState({}, "", `/oauth/authorize${SEARCH}`);
  vi.stubGlobal("location", { ...window.location, search: SEARCH, assign });
  assign.mockReset();
  mocks.auth = { isAuthenticated: true, isLoading: false };
  mocks.details = {
    clientName: "Claude",
    redirectHost: "claude.ai",
    projects: [
      { id: "p1", name: "App", organizationName: "Acme" },
      { id: "p2", name: "Game", organizationName: "Acme" },
    ],
  };
  mocks.signIn.mockReset().mockResolvedValue({});
  mocks.approve
    .mockReset()
    .mockResolvedValue({ redirectTo: "https://claude.ai/back?code=c" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("connector consent page", () => {
  it("keeps the whole request through GitHub sign-in", async () => {
    mocks.auth.isAuthenticated = false;
    render(<OauthAuthorize />, { wrapper: MemoryRouter });
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with GitHub" }),
    );
    await waitFor(() =>
      expect(mocks.signIn).toHaveBeenCalledWith("github", {
        redirectTo: `/oauth/authorize${SEARCH}`,
      }),
    );
    expect(takeSignInReturn()).toBe(`/oauth/authorize${SEARCH}`);
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("forgets where it started when GitHub sign-in cannot start", async () => {
    mocks.auth.isAuthenticated = false;
    mocks.signIn.mockRejectedValue(new Error("offline"));
    render(<OauthAuthorize />, { wrapper: MemoryRouter });
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with GitHub" }),
    );
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /sign-in failed/,
    );
    expect(takeSignInReturn()).toBeNull();
  });

  it("says when a sign-in it resumed did not finish", () => {
    mocks.auth.isAuthenticated = false;
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/oauth/authorize", state: SIGN_IN_UNFINISHED },
        ]}
      >
        <OauthAuthorize />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/did not finish/);
  });

  it("names the app and its host, and connects read-only unless changes are ticked", async () => {
    render(<OauthAuthorize />, { wrapper: MemoryRouter });
    expect(screen.getByText("Claude")).toBeDefined();
    expect(screen.getByText(/claude\.ai/)).toBeDefined();
    expect(mocks.approve).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() =>
      expect(mocks.approve).toHaveBeenCalledWith({
        request: REQUEST,
        state: "s1",
        allow: true,
        projectId: "p1",
        scope: "read",
      }),
    );
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://claude.ai/back?code=c"),
    );
  });

  it("sends the chosen project and write access only when asked", async () => {
    render(<OauthAuthorize />, { wrapper: MemoryRouter });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "p2" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() =>
      expect(mocks.approve).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "p2", scope: "write" }),
      ),
    );
  });

  it("returns to the app with the denial on cancel", async () => {
    mocks.approve.mockResolvedValue({
      redirectTo: "https://claude.ai/back?error=access_denied",
    });
    render(<OauthAuthorize />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(mocks.approve).toHaveBeenCalledWith(
        expect.objectContaining({ allow: false }),
      ),
    );
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        "https://claude.ai/back?error=access_denied",
      ),
    );
  });

  it("says Connecting only for an approval, never for a cancel", async () => {
    mocks.approve.mockReturnValue(new Promise(() => {}));
    render(<OauthAuthorize />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled"),
      ).toBe(true),
    );
    expect(screen.queryByText("Connecting…")).toBeNull();

    cleanup();
    render(<OauthAuthorize />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Connecting…")).toBeDefined();
  });

  it("shows a refused request and offers nothing to approve", () => {
    mocks.details = { error: "This app is not on IAPKit's connector list." };
    render(<OauthAuthorize />, { wrapper: MemoryRouter });
    expect(screen.getByRole("alert").textContent).toContain("connector list");
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
  });

  it("lets a user with no project to offer cancel back to the app", async () => {
    mocks.details = {
      clientName: "Claude",
      redirectHost: "claude.ai",
      projects: [],
    };
    render(<OauthAuthorize />, { wrapper: MemoryRouter });
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(mocks.approve).toHaveBeenCalledWith(
        expect.objectContaining({ allow: false }),
      ),
    );
  });

  it("shows the server's reason when approval is refused", async () => {
    mocks.approve.mockRejectedValue(
      new ConvexError({
        code: "INSUFFICIENT_SCOPE",
        message: "Choose a project you own or administer.",
      }),
    );
    render(<OauthAuthorize />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Choose a project you own or administer.",
    );

    cleanup();
    mocks.approve.mockRejectedValue(new Error("network"));
    render(<OauthAuthorize />, { wrapper: MemoryRouter });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Start again from the app/,
    );
  });
});
