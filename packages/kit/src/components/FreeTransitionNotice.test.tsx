/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { FreeTransitionNotice } from "./FreeTransitionNotice";

const DISMISS_KEY = "iapkit.freeTransitionNoticeDismissed.v2";
const TITLE = "IAPKit validation APIs are now free.";
const MESSAGE_PREFIX = "Thank you for supporting IAPKit.";

function renderNotice(hadBillingRelationship: boolean) {
  return render(
    <MemoryRouter>
      <FreeTransitionNotice hadBillingRelationship={hadBillingRelationship} />
    </MemoryRouter>,
  );
}

describe("FreeTransitionNotice", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  test("does not render for orgs that never had a billing relationship", () => {
    renderNotice(false);
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  test("renders for ex-paying orgs when no dismiss flag is set", () => {
    renderNotice(true);
    expect(screen.queryByText(TITLE)).not.toBeNull();
    expect(
      screen.queryByText((content) => content.startsWith(MESSAGE_PREFIX)),
    ).not.toBeNull();
  });

  test("stays hidden when localStorage already has the dismiss flag", () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    renderNotice(true);
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  test("clicking the X button persists dismissal and hides the banner", async () => {
    const user = userEvent.setup();
    renderNotice(true);

    const dismissButton = screen.getByRole("button", {
      name: "Dismiss notice",
    });
    await user.click(dismissButton);

    expect(screen.queryByText(TITLE)).toBeNull();
    expect(window.localStorage.getItem(DISMISS_KEY)).toBe("1");
  });

  test("clicking 'Read the announcement' does NOT persist dismissal", async () => {
    const user = userEvent.setup();
    renderNotice(true);

    const readLink = screen.getByRole("link", {
      name: "Read the announcement →",
    });
    await user.click(readLink);

    // The banner may re-render on navigation, but critically the
    // persistent flag must NOT be set — so if the user lands back on
    // the dashboard, the banner is still visible.
    expect(window.localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  test("clicking the Sponsor link does NOT persist dismissal", async () => {
    const user = userEvent.setup();
    renderNotice(true);

    const sponsorLink = screen.getByRole("link", {
      name: "Sponsor OpenIAP",
    });
    await user.click(sponsorLink);

    expect(window.localStorage.getItem(DISMISS_KEY)).toBeNull();
  });
});
