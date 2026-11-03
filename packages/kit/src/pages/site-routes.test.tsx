/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Children, isValidElement } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";

vi.mock("./faq", () => ({ default: () => <p>{"FAQ page"}</p> }));
vi.mock("./about", () => ({ default: () => <p>{"About page"}</p> }));
vi.mock("./contact", () => ({ default: () => <p>{"Contact page"}</p> }));
vi.mock("./terms-of-service", () => ({ default: () => <p>{"Terms"}</p> }));
vi.mock("./privacy-policy", () => ({ default: () => <p>{"Privacy"}</p> }));
vi.mock("./404", () => ({ default: () => <p>{"Not found page"}</p> }));
vi.mock("./blog/BlogLayout", () => ({ default: () => <Outlet /> }));
vi.mock("./blog", () => ({ default: () => <p>{"Blog index"}</p> }));
vi.mock("./blog/iapkit-joins-openiap", () => ({
  default: () => <p>{"Blog post"}</p>,
}));

import { RESERVED_ORG_SLUGS } from "../../convex/organizations/reservedSlugs";
import { siteChildRoutes } from "./site-routes";

// Mirrors the signed-in tree: site pages beside the organization routes.
function renderSignedIn(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Outlet />}>{siteChildRoutes}</Route>
        <Route path=":orgSlug" element={<p>{"Organization"}</p>}>
          <Route path="projects" element={<p>{"Projects"}</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("siteChildRoutes", () => {
  afterEach(cleanup);

  it("opens the FAQ instead of an organization named faq", () => {
    renderSignedIn("/faq");
    expect(screen.getByText("FAQ page")).toBeTruthy();
    expect(screen.queryByText("Organization")).toBeNull();
  });

  it("still routes a single segment to the organization", () => {
    renderSignedIn("/acme");
    expect(screen.getByText("Organization")).toBeTruthy();
  });

  it("shows the site 404 for an unknown deep path", () => {
    renderSignedIn("/acme/unknown/page");
    expect(screen.getByText("Not found page")).toBeTruthy();
  });

  it("reserves every site path as an organization slug", () => {
    const paths = Children.toArray(siteChildRoutes.props.children)
      .filter(isValidElement)
      .map((route) => (route.props as { path?: string }).path)
      .filter((path): path is string => !!path && path !== "*");
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(RESERVED_ORG_SLUGS.has(path)).toBe(true);
  });
});
