// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false },
  device: null as null | {
    name: string;
    scope: string;
    expiresAt: number;
    used: boolean;
  },
  signIn: vi.fn(),
  approve: vi.fn(),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: mocks.signIn }),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => mocks.auth,
  useQuery: () => mocks.device,
  useMutation: () => mocks.approve,
}));
import CliAuthorize from "./cli-authorize";

beforeEach(() => {
  window.history.replaceState({}, "", "/cli/authorize?user_code=ABC1234567");
  mocks.auth = { isAuthenticated: false, isLoading: false };
  mocks.device = null;
  mocks.signIn.mockReset().mockResolvedValue({});
  mocks.approve.mockReset().mockResolvedValue({ approved: true, error: null });
});
afterEach(cleanup);

describe("CLI browser consent", () => {
  it("keeps the code through GitHub sign-in without approving automatically", async () => {
    render(<CliAuthorize />);
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with GitHub" }),
    );
    await waitFor(() =>
      expect(mocks.signIn).toHaveBeenCalledWith("github", {
        redirectTo: "/cli/authorize?user_code=ABC1234567",
      }),
    );
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it("shows the device and scope and sends only the explicitly approved code", async () => {
    mocks.auth.isAuthenticated = true;
    mocks.device = {
      name: "Developer terminal",
      scope: "read",
      expiresAt: Date.now() + 10000,
      used: false,
    };
    render(<CliAuthorize />);
    expect(screen.getByText("Developer terminal")).toBeDefined();
    expect(mocks.approve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Approve connection" }));
    await waitFor(() =>
      expect(mocks.approve).toHaveBeenCalledWith({
        userCode: "ABC1234567",
        allow: true,
      }),
    );
    expect(await screen.findByRole("status")).toBeDefined();
  });

  it("reports a rejected code instead of showing a successful connection", async () => {
    mocks.auth.isAuthenticated = true;
    mocks.device = {
      name: "Terminal",
      scope: "admin",
      expiresAt: Date.now() + 10000,
      used: false,
    };
    mocks.approve.mockResolvedValue({
      approved: false,
      error: "This login code is invalid or expired.",
    });
    render(<CliAuthorize />);
    fireEvent.click(screen.getByRole("button", { name: "Approve connection" }));
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
