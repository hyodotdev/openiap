/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  switchOrganization: vi.fn(),
  organization: {
    _id: "organizations_test",
    name: "Hyo Dev",
    slug: "hyo-dev",
  },
}));

vi.mock("react-router-dom", () => ({
  Outlet: () => <div data-testid="organization-outlet" />,
  useLocation: () => ({ pathname: "/hyo-dev/project/martie/purchases" }),
  useNavigate: () => mocks.navigate,
  useParams: () => ({ orgSlug: "hyo-dev" }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.switchOrganization,
  useQuery: (reference: string) => {
    if (reference === "auth.loggedInUser") {
      return { name: "Hyo", email: "hyo@example.test" };
    }
    if (reference === "organizations.list") return [mocks.organization];
    return mocks.organization;
  },
}));

vi.mock("@/convex", () => ({
  api: {
    auth: { loggedInUser: "auth.loggedInUser" },
    organizations: {
      mutation: { switchOrganization: "organizations.switch" },
      query: {
        getOrganizationBySlug: "organizations.getBySlug",
        getUserOrganizations: "organizations.list",
      },
    },
  },
}));

vi.mock("../../../hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    profile: {
      currentOrganizationId: "organizations_test",
      displayName: "Hyo",
    },
  }),
}));

vi.mock("../../../components/ThemeDropdown", () => ({
  ThemeDropdown: () => <button type="button">Theme</button>,
}));

vi.mock("../../../components/SignOutButton", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

vi.mock("../../../components/FreeTransitionNotice", () => ({
  FreeTransitionNotice: () => null,
}));

import OrganizationLayout from "./index";

describe("OrganizationLayout responsive sizing", () => {
  afterEach(() => {
    cleanup();
    mocks.navigate.mockReset();
    mocks.switchOrganization.mockReset();
  });

  it("contains horizontal overflow inside the content column", () => {
    const { container } = render(<OrganizationLayout />);

    const sidebar = container.querySelector("aside");
    const main = container.querySelector("main");
    const contentColumn = main?.parentElement;

    expect(sidebar?.classList.contains("shrink-0")).toBe(true);
    expect(contentColumn?.classList.contains("min-w-0")).toBe(true);
    expect(main?.classList.contains("overflow-y-auto")).toBe(true);
    expect(main?.classList.contains("overflow-x-hidden")).toBe(true);
  });
});
