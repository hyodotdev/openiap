/** @vitest-environment jsdom */
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "apple", label: "App Store" },
  { value: "google", label: "Google Play" },
] as const;

function Harness() {
  const [value, setValue] = useState<"apple" | "google">("apple");
  return (
    <SegmentedControl
      label="Store"
      options={OPTIONS}
      value={value}
      onChange={setValue}
    />
  );
}

describe("SegmentedControl", () => {
  afterEach(cleanup);

  it("selects on click and keeps one tab stop on the selected option", () => {
    render(<Harness />);
    const [apple, google] = screen.getAllByRole("radio");
    expect([apple.tabIndex, google.tabIndex]).toEqual([0, -1]);

    fireEvent.click(google);
    expect(google.getAttribute("aria-checked")).toBe("true");
    expect([apple.tabIndex, google.tabIndex]).toEqual([-1, 0]);
  });

  it("moves the selection and focus with the arrow keys, wrapping at the ends", () => {
    render(<Harness />);
    const [apple, google] = screen.getAllByRole("radio");

    fireEvent.keyDown(apple, { key: "ArrowRight" });
    expect(google.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(google);

    fireEvent.keyDown(google, { key: "ArrowRight" });
    expect(apple.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(apple);

    fireEvent.keyDown(apple, { key: "ArrowLeft" });
    expect(google.getAttribute("aria-checked")).toBe("true");
  });
});
