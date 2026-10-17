/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  org: {
    _id: "organizations_test",
    slug: "test",
    name: "Test org",
    role: "member",
  },
  members: [
    {
      userId: "users_me",
      email: "me@example.test",
      name: "Me",
      role: "member",
    },
  ],
  remove: vi.fn(),
  navigate: vi.fn(),
  error: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (ref: string) =>
    ref === "user"
      ? { _id: "users_me" }
      : ref === "org"
        ? mocks.org
        : mocks.members,
  useMutation: (ref: string) => (ref === "remove" ? mocks.remove : vi.fn()),
}));
vi.mock("react-router-dom", () => ({
  useParams: () => ({ orgSlug: "test" }),
  useNavigate: () => mocks.navigate,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error } }));
vi.mock("@/convex", () => ({
  api: {
    auth: { loggedInUser: "user" },
    organizations: {
      query: {
        getOrganizationBySlug: "org",
        getOrganizationMembers: "members",
      },
      mutation: {
        removeMember: "remove",
        inviteMember: "invite",
        updateOrganization: "update",
      },
    },
  },
}));
vi.mock("@/components/OrganizationPendingInvitations", () => ({
  OrganizationPendingInvitations: () => null,
}));
import OrganizationSettings from "./settings";
describe("organization self-leave controls", () => {
  beforeEach(() => {
    mocks.org.role = "member";
    mocks.members = [
      {
        userId: "users_me",
        email: "me@example.test",
        name: "Me",
        role: "member",
      },
    ];
    mocks.remove.mockReset().mockResolvedValue(undefined);
    mocks.navigate.mockReset();
    mocks.error.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  it("lets an ordinary member leave using their own identity", async () => {
    render(<OrganizationSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Leave organization" }));
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({
        organizationId: "organizations_test",
        userId: "users_me",
      }),
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/", { replace: true }),
    );
  });
  it("disables self-leave for the last owner", () => {
    mocks.org.role = "owner";
    mocks.members[0].role = "owner";
    render(<OrganizationSettings />);
    expect(
      screen
        .getByRole("button", { name: "Leave organization" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByText("Another owner must remain before you can leave."),
    ).toBeTruthy();
  });
  it("allows self-leave when another owner remains", () => {
    mocks.org.role = "owner";
    mocks.members[0].role = "owner";
    mocks.members.push({
      userId: "users_other",
      email: "other@example.test",
      name: "Other",
      role: "owner",
    });
    render(<OrganizationSettings />);
    expect(
      screen
        .getByRole("button", { name: "Leave organization" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });
  it("keeps the user on the page when server authorization changes", async () => {
    mocks.remove.mockRejectedValue(new Error("role changed"));
    render(<OrganizationSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Leave organization" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
