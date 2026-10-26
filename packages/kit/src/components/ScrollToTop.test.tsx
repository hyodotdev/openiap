/** @vitest-environment jsdom */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollToTop } from "./ScrollToTop";

const location = vi.hoisted(() => ({
  pathname: "/docs/api",
  hash: "#verification-jobs",
}));
vi.mock("react-router-dom", () => ({ useLocation: () => location }));

function hashTarget(id: string): [HTMLElement, ReturnType<typeof vi.fn>] {
  const element = document.createElement("section");
  element.id = id;
  const scroll = vi.fn();
  element.scrollIntoView = scroll;
  return [element, scroll];
}

beforeEach(() => {
  vi.useFakeTimers();
  location.hash = "#verification-jobs";
});
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("lazy route hash navigation", () => {
  it("scrolls once when a delayed target appears", async () => {
    render(<ScrollToTop />);
    const [target, scroll] = hashTarget("verification-jobs");
    await act(async () => document.body.append(target));
    expect(scroll).toHaveBeenCalledOnce();
    await act(async () => {
      target.remove();
      document.body.append(target);
    });
    expect(scroll).toHaveBeenCalledOnce();
  });

  it("stops waiting for an unknown hash after ten seconds", async () => {
    render(<ScrollToTop />);
    await act(async () => {
      vi.advanceTimersByTime(10_001);
    });
    const [target, scroll] = hashTarget("verification-jobs");
    await act(async () => document.body.append(target));
    expect(scroll).not.toHaveBeenCalled();
  });

  it("stops the previous wait when navigation changes", async () => {
    const view = render(<ScrollToTop />);
    location.hash = "#new-target";
    view.rerender(<ScrollToTop />);
    const [previous, previousScroll] = hashTarget("verification-jobs");
    const [current, currentScroll] = hashTarget("new-target");
    await act(async () => document.body.append(previous, current));
    expect(previousScroll).not.toHaveBeenCalled();
    expect(currentScroll).toHaveBeenCalledOnce();
  });
});
