/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  pathname: "/hyo-dev/project/martie/purchases",
  organization: {
    _id: "organizations_test",
    name: "Hyo Dev",
    slug: "hyo-dev",
  },
  project: {
    _id: "projects_test",
    organizationId: "organizations_test",
    name: "Martie",
    slug: "martie",
  },
}));

vi.mock("react-router-dom", () => ({
  Outlet: () => <div data-testid="project-outlet" />,
  useLocation: () => ({ pathname: mocks.pathname }),
  useNavigate: () => mocks.navigate,
  useParams: () => ({ orgSlug: "hyo-dev", projectSlug: "martie" }),
}));

vi.mock("convex/react", () => ({
  useQuery: (reference: string) =>
    reference === "organizations.getBySlug"
      ? mocks.organization
      : mocks.project,
}));

vi.mock("@/convex", () => ({
  api: {
    organizations: {
      query: { getOrganizationBySlug: "organizations.getBySlug" },
    },
    projects: { query: { getProject: "projects.getProject" } },
  },
}));

import ProjectIndex from "./index";

describe("ProjectIndex responsive tabs", () => {
  afterEach(() => {
    cleanup();
    mocks.navigate.mockReset();
    mocks.pathname = "/hyo-dev/project/martie/purchases";
    vi.restoreAllMocks();
  });

  it("keeps the tab row in its own horizontal scroller without wrapping", () => {
    render(<ProjectIndex />);

    const navigation = screen.getByRole("navigation", {
      name: "Project sections",
    });
    const scroller = navigation.parentElement;
    expect(scroller?.classList.contains("overflow-x-auto")).toBe(true);
    expect(scroller?.classList.contains("overscroll-x-contain")).toBe(true);
    expect(navigation.classList.contains("w-max")).toBe(true);
    expect(navigation.classList.contains("min-w-full")).toBe(true);

    const buttons = within(navigation).getAllByRole("button");
    expect(buttons).toHaveLength(8);
    for (const button of buttons) {
      expect(button.classList.contains("shrink-0")).toBe(true);
      expect(button.classList.contains("whitespace-nowrap")).toBe(true);
    }

    expect(
      within(navigation)
        .getByRole("button", { name: "Purchases" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(navigation)
        .getByRole("button", { name: "API Keys" })
        .textContent?.trim(),
    ).toBe("API Keys");
  });

  it("preserves project navigation from the scrollable tab row", () => {
    render(<ProjectIndex />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/hyo-dev/project/martie/settings",
    );
  });

  it("reveals the active tab when a deep link loads", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.classList.contains("overflow-x-auto")) {
          return DOMRect.fromRect({ x: 0, width: 500 });
        }
        if (this.textContent?.includes("Settings")) {
          return DOMRect.fromRect({ x: 600, width: 100 });
        }
        return DOMRect.fromRect();
      },
    );
    mocks.pathname = "/hyo-dev/project/martie/settings";

    render(<ProjectIndex />);

    const activeButton = screen.getByRole("button", { name: "Settings" });
    const scroller = activeButton.closest("nav")?.parentElement;

    expect(activeButton.getAttribute("aria-current")).toBe("page");
    expect(scroller?.scrollLeft).toBe(200);
  });

  it("does not move the tab row when the active tab is already visible", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.classList.contains("overflow-x-auto")) {
          return DOMRect.fromRect({ x: 0, width: 500 });
        }
        if (this.textContent?.includes("Purchases")) {
          return DOMRect.fromRect({ x: 16, width: 100 });
        }
        return DOMRect.fromRect();
      },
    );

    render(<ProjectIndex />);

    const activeButton = screen.getByRole("button", { name: "Purchases" });
    const scroller = activeButton.closest("nav")?.parentElement;

    expect(scroller?.scrollLeft).toBe(0);
  });
});
