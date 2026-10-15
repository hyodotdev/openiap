import { describe, expect, it } from "vitest";

import { redactEventUrls, redactUrls } from "./mixpanel";

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
