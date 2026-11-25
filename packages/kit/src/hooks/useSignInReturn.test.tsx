// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isSignInUnfinished,
  rememberSignInReturn,
  takeSignInReturn,
} from "@/lib/signInReturn";
import { useSignInReturn } from "./useSignInReturn";

const PATH = "/oauth/authorize?client_id=x&state=s";

function Probe() {
  useSignInReturn();
  const location = useLocation();
  return (
    <p>
      {location.pathname + location.search}
      {isSignInUnfinished(location.state) ? " unfinished" : ""}
    </p>
  );
}

function renderAt(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Probe />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});
afterEach(cleanup);

describe("useSignInReturn", () => {
  it("returns a failed sign-in from the home page to its approval page", async () => {
    rememberSignInReturn(PATH);
    renderAt("/");
    expect(await screen.findByText(`${PATH} unfinished`)).toBeDefined();
  });

  it("leaves the home page alone without a note", () => {
    renderAt("/");
    expect(screen.getByText("/")).toBeDefined();
  });

  it("forgets the note once the approval page shows again", () => {
    rememberSignInReturn(PATH);
    renderAt(PATH);
    expect(takeSignInReturn()).toBeNull();
  });

  it("forgets the note when Back restores the approval page", () => {
    renderAt("/docs");
    rememberSignInReturn(PATH);
    window.dispatchEvent(new Event("pageshow"));
    expect(takeSignInReturn()).toBe(PATH);

    rememberSignInReturn(PATH);
    window.history.replaceState({}, "", PATH);
    window.dispatchEvent(new Event("pageshow"));
    expect(takeSignInReturn()).toBeNull();
  });

  it("keeps the note on other pages", () => {
    rememberSignInReturn(PATH);
    renderAt("/hyo-dev/projects");
    expect(takeSignInReturn()).toBe(PATH);
  });
});
