import { afterEach, describe, expect, it, vi } from "vitest";

import { redactEventUrls, redactUrls } from "./mixpanel";

const mixpanel = vi.hoisted(() => ({
  init: vi.fn(),
  set_config: vi.fn(),
  start_session_recording: vi.fn(),
  stop_session_recording: vi.fn(),
  track: vi.fn(),
}));
vi.mock("mixpanel-browser/dist/mixpanel-core.cjs.js", () => ({
  default: mixpanel,
}));
vi.mock("../config/env", () => ({ MIXPANEL_TOKEN: "test-token" }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("session replay privacy", () => {
  it("keeps authenticated dashboard initialization from recording", async () => {
    vi.resetModules();
    vi.stubGlobal("window", {
      location: new URL(
        "http://localhost/acme/project/app/purchases/user/private-id?ip=1.2.3.4",
      ),
    });
    const { trackEvent, MixpanelEvent } = await import("./mixpanel");
    trackEvent(MixpanelEvent.ViewedPurchases);
    expect(mixpanel.init).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({ record_sessions_percent: 0 }),
    );
    expect(mixpanel.start_session_recording).not.toHaveBeenCalled();
    expect(mixpanel.track).toHaveBeenCalled();
  });
  it("keeps replay disabled on public pages too, including later authenticated navigation", async () => {
    vi.resetModules();
    const location = new URL("http://localhost/docs/purchase-flow");
    vi.stubGlobal("window", { location });
    const { trackEvent, MixpanelEvent } = await import("./mixpanel");
    trackEvent(MixpanelEvent.ViewedDocs);
    location.pathname = "/acme/project/app/purchases/user/private-id";
    trackEvent(MixpanelEvent.ViewedPurchases);
    expect(mixpanel.init).toHaveBeenCalledTimes(1);
    expect(mixpanel.init).toHaveBeenCalledWith(
      "test-token",
      expect.objectContaining({ record_sessions_percent: 0 }),
    );
    expect(mixpanel.set_config).not.toHaveBeenCalled();
    expect(mixpanel.start_session_recording).not.toHaveBeenCalled();
    expect(mixpanel.track).toHaveBeenCalledTimes(2);
  });
});

describe("Mixpanel URL redaction", () => {
  it("keeps the route and parameter names but drops identifying values", () => {
    expect(
      redactUrls(
        "https://kit.openiap.dev/acme/project/app/Purchases/User/alice%40example.com?tab=1",
      ),
    ).toBe(
      "https://kit.openiap.dev/acme/project/app/Purchases/User/:appUserId?tab=",
    );
    expect(
      redactUrls("/a/project/b/purchases?ip=203.0.113.9&user=alice&cursor=xyz"),
    ).toBe("/a/project/b/purchases?ip=&user=&cursor=");
    expect(redactUrls("Purchase issues")).toBe("Purchase issues");
    expect(redactUrls("/a/project/b/purchases/user/o'neil%40x.com")).toBe(
      "/a/project/b/purchases/user/:appUserId",
    );
  });

  it("redacts every string an event carries, nested ones included", () => {
    const event = redactEventUrls({
      event: "$mp_click",
      properties: {
        $current_url: "https://kit.openiap.dev/a/project/b/purchases?user=bob",
        $pathname: "/a/project/b/purchases/user/bob",
        $el_attr__href: "/a/project/b/purchases/user/bob/",
        $referrer: "https://kit.openiap.dev/a/project/b/purchases?ip=1.2.3.4",
        $elements: [{ "$attr-href": "/a/project/b/purchases/user/bob" }],
        $target: { "$attr-href": "/x?appUserId=bob" },
        $el_text: "Purchase issues",
        count: 3,
      },
    });
    expect(JSON.stringify(event)).not.toMatch(/bob|1\.2\.3\.4/);
    expect(event.properties).toMatchObject({
      $el_attr__href: "/a/project/b/purchases/user/:appUserId/",
      $el_text: "Purchase issues",
      count: 3,
    });
  });
});
