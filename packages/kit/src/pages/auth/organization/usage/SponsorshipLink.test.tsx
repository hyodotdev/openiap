/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => {
  const state: { link: unknown } = { link: undefined };
  return { state };
});
vi.mock("convex/react", () => ({ useQuery: () => mocks.state.link }));
vi.mock("@/convex", () => ({
  api: { sponsorship: { query: { getSponsorshipLink: "get" } } },
}));

import { SponsorshipLink } from "./SponsorshipLink";

const show = (link: unknown) => {
  mocks.state.link = link;
  return render(
    <SponsorshipLink organizationId={"organizations_a" as never} />,
  );
};

afterEach(cleanup);

describe("SponsorshipLink", () => {
  it("shows nothing until the maintainer links a sponsorship", () => {
    expect(show(undefined).container.innerHTML).toBe("");
    cleanup();
    expect(show(null).container.innerHTML).toBe("");
  });

  it("thanks a monthly sponsor with the account and amount", () => {
    show({ login: "aws", monthlyUsd: 1000, isOneTime: false });
    expect(screen.getByText("Sponsoring OpenIAP")).toBeTruthy();
    expect(screen.getByText(/· \$1,000 a month/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "@aws" }).getAttribute("href"),
    ).toBe("https://github.com/aws");
  });

  it("labels a one-time sponsorship", () => {
    show({ login: "acme", monthlyUsd: 500, isOneTime: true });
    expect(screen.getByText(/· \$500 one-time/)).toBeTruthy();
  });
});
