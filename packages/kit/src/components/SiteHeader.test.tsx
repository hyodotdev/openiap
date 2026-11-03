/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  isAuthenticated: false,
  openAuthModal: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: mocks.isAuthenticated,
    isLoading: false,
  }),
}));

vi.mock("../lib/signals", () => ({ openAuthModal: mocks.openAuthModal }));

vi.mock("./ThemeDropdown", () => ({ ThemeDropdown: () => null }));

import { SiteHeader } from "./SiteHeader";

function renderHeader(pathname = "/docs") {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <SiteHeader />
    </MemoryRouter>,
  );
}

const openMobileMenu = () =>
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

describe("SiteHeader", () => {
  afterEach(() => {
    cleanup();
    mocks.isAuthenticated = false;
    mocks.openAuthModal.mockClear();
  });

  it("offers Features and sign-in when signed out", () => {
    renderHeader();
    expect(screen.getAllByRole("link", { name: "Features" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Sign In" })).toHaveLength(1);
  });

  it("hides Features and links to the dashboard when signed in", () => {
    mocks.isAuthenticated = true;
    renderHeader();
    expect(screen.queryByRole("link", { name: "Features" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Open dashboard" }).getAttribute("href"),
    ).toBe("/");
  });

  it("closes the mobile menu after an external link", () => {
    renderHeader();
    openMobileMenu();
    const menu = document.getElementById("site-mobile-menu");
    expect(menu).not.toBeNull();
    fireEvent.click(
      menu!.querySelector('a[href="https://openiap.dev/sponsors"]')!,
    );
    expect(document.getElementById("site-mobile-menu")).toBeNull();
  });

  it("closes the mobile menu before opening sign-in", () => {
    renderHeader();
    openMobileMenu();
    const buttons = screen.getAllByRole("button", { name: "Sign In" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(mocks.openAuthModal).toHaveBeenCalledTimes(1);
    expect(document.getElementById("site-mobile-menu")).toBeNull();
  });

  it("closes the mobile menu after a link to the current page", () => {
    renderHeader("/blog");
    openMobileMenu();
    fireEvent.click(
      document
        .getElementById("site-mobile-menu")!
        .querySelector('a[href="/blog"]')!,
    );
    expect(document.getElementById("site-mobile-menu")).toBeNull();
  });
});
