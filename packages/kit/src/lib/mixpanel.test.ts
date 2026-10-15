import { describe, expect, it } from "vitest";

import { redactEventUrls, redactUrl } from "./mixpanel";

describe("Mixpanel URL redaction", () => {
  it("keeps the route but drops app user IDs, IPs and other filters", () => {
    expect(
      redactUrl(
        "https://kit.openiap.dev/acme/project/app/purchases/user/alice%40example.com",
      ),
    ).toBe(
      "https://kit.openiap.dev/acme/project/app/purchases/user/:appUserId",
    );
    expect(
      redactUrl("/acme/project/app/purchases?ip=203.0.113.9&user=alice#top"),
    ).toBe("/acme/project/app/purchases");
    expect(redactUrl("?appUserId=alice")).toBe("");
  });

  it("redacts every URL property an event carries", () => {
    const event = redactEventUrls({
      event: "$mp_click",
      properties: {
        $current_url: "https://kit.openiap.dev/a/project/b/purchases?user=bob",
        current_url_path: "/a/project/b/purchases/user/bob",
        current_url_search: "?user=bob",
        $el_attr__href: "/a/project/b/purchases/user/bob/",
        $referrer: "https://kit.openiap.dev/a/project/b/purchases?ip=1.2.3.4",
        $initial_referrer: "$direct",
        $el_text: "Purchase issues",
      },
    });
    expect(JSON.stringify(event)).not.toMatch(/bob|1\.2\.3\.4/);
    expect(event.properties).toMatchObject({
      current_url_path: "/a/project/b/purchases/user/:appUserId",
      $el_attr__href: "/a/project/b/purchases/user/:appUserId/",
      $initial_referrer: "$direct",
      $el_text: "Purchase issues",
    });
  });
});
