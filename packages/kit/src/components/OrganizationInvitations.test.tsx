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
  results: [
    {
      _id: "invitation_one",
      organizationName: "Inviting org",
      role: "member",
      email: "invitee@example.test",
    },
  ],
  status: "CanLoadMore",
  loadMore: vi.fn(),
  respond: vi.fn(),
  navigate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("convex/react", () => ({
  usePaginatedQuery: () => mocks,
  useMutation: () => mocks.respond,
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("@/convex", () => ({
  api: {
    organizations: {
      query: { getMyInvitations: "mine", getPendingInvitations: "pending" },
      mutation: { respondToInvitation: "respond", cancelInvitation: "cancel" },
    },
  },
}));
import { OrganizationInvitations } from "./OrganizationInvitations";
import { OrganizationPendingInvitations } from "./OrganizationPendingInvitations";
describe("OrganizationInvitations", () => {
  beforeEach(() => {
    mocks.status = "CanLoadMore";
    mocks.respond.mockReset();
    mocks.navigate.mockReset();
    mocks.error.mockReset();
    mocks.loadMore.mockReset();
    mocks.results = [
      {
        _id: "invitation_one",
        organizationName: "Inviting org",
        role: "member",
        email: "invitee@example.test",
      },
    ];
  });
  afterEach(cleanup);
  it("requires an explicit accept before joining and navigating", async () => {
    mocks.respond.mockResolvedValue({ slug: "inviting" });
    render(<OrganizationInvitations />);
    expect(mocks.respond).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() =>
      expect(mocks.respond).toHaveBeenCalledWith({
        invitationId: "invitation_one",
        accept: true,
      }),
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/inviting"),
    );
  });
  it("declines without navigating or accepting", async () => {
    mocks.respond.mockResolvedValue(null);
    render(<OrganizationInvitations />);
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() =>
      expect(mocks.respond).toHaveBeenCalledWith({
        invitationId: "invitation_one",
        accept: false,
      }),
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("keeps a rejected or expired invitation from navigating", async () => {
    mocks.respond.mockRejectedValue(new Error("expired"));
    render(<OrganizationInvitations />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("loads the next bounded page on request", () => {
    render(<OrganizationInvitations />);
    fireEvent.click(screen.getByRole("button", { name: "More invitations" }));
    expect(mocks.loadMore).toHaveBeenCalledWith(10);
  });
  it("renders nothing for an account with no invitations", () => {
    mocks.results = [];
    mocks.status = "Exhausted";
    const { container } = render(<OrganizationInvitations />);
    expect(container.textContent).toBe("");
  });
  it("can load more when a filtered page contains no visible invitations", () => {
    mocks.results = [];
    render(<OrganizationInvitations />);
    fireEvent.click(screen.getByRole("button", { name: "More invitations" }));
    expect(mocks.loadMore).toHaveBeenCalledWith(10);
  });
});

describe("manager invitation controls", () => {
  afterEach(cleanup);
  it("withdraws only the selected pending offer", async () => {
    mocks.results = [
      {
        _id: "invitation_one",
        organizationName: "Inviting org",
        role: "member",
        email: "invitee@example.test",
      },
    ];
    mocks.status = "CanLoadMore";
    mocks.respond.mockReset().mockResolvedValue(undefined);
    render(
      <OrganizationPendingInvitations
        organizationId={"organizations_test" as never}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Withdraw invitation" }),
    );
    await waitFor(() =>
      expect(mocks.respond).toHaveBeenCalledWith({
        invitationId: "invitation_one",
      }),
    );
  });
  it("loads past an empty filtered manager page", () => {
    mocks.results = [];
    mocks.status = "CanLoadMore";
    mocks.loadMore.mockReset();
    render(
      <OrganizationPendingInvitations
        organizationId={"organizations_test" as never}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "More pending invitations" }),
    );
    expect(mocks.loadMore).toHaveBeenCalledWith(10);
  });
});
