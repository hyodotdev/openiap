import { beforeAll, describe, expect, it } from "vitest";

let helpers: typeof import("./webhooks");

beforeAll(async () => {
  process.env.VITE_KIT_CONVEX_URL = "https://placeholder.convex.cloud";
  helpers = await import("./webhooks");
});

describe("pubSubOidcAudiences", () => {
  it("accepts concrete push endpoint audience when configured for the origin", () => {
    const audiences = helpers.pubSubOidcAudiences(
      "https://kit.openiap.dev/v1/webhooks/openiap-kit_secret",
      "https://kit.openiap.dev/",
    );

    expect(audiences).toContain("https://kit.openiap.dev/");
    expect(audiences).toContain("https://kit.openiap.dev");
    expect(audiences).toContain(
      "https://kit.openiap.dev/v1/webhooks/openiap-kit_secret",
    );
  });

  it("does not derive endpoint audiences for a different configured host", () => {
    const audiences = helpers.pubSubOidcAudiences(
      "https://kit.openiap.dev/v1/webhooks/openiap-kit_secret",
      "https://example.com/",
    );

    expect(audiences).toEqual(["https://example.com/"]);
  });
});

describe("isAllowedPubSubServiceAccount", () => {
  it("accepts verified Google service account principals by default", () => {
    expect(
      helpers.isAllowedPubSubServiceAccount(
        "pubsub-rtdn-push@rescuedogs-f3098.iam.gserviceaccount.com",
      ),
    ).toBe(true);
  });

  it("rejects non-service-account Google identities by default", () => {
    expect(helpers.isAllowedPubSubServiceAccount("person@gmail.com")).toBe(
      false,
    );
  });

  it("requires an exact principal match when configured", () => {
    expect(
      helpers.isAllowedPubSubServiceAccount(
        "pubsub-rtdn-push@rescuedogs-f3098.iam.gserviceaccount.com",
        "pubsub-rtdn-push@rescuedogs-f3098.iam.gserviceaccount.com",
      ),
    ).toBe(true);
    expect(
      helpers.isAllowedPubSubServiceAccount(
        "other@rescuedogs-f3098.iam.gserviceaccount.com",
        "pubsub-rtdn-push@rescuedogs-f3098.iam.gserviceaccount.com",
      ),
    ).toBe(false);
  });
});

describe("sanitizePubSubAudienceForLog", () => {
  it("redacts webhook api keys from audience logs", () => {
    expect(
      helpers.sanitizePubSubAudienceForLog(
        "https://kit.openiap.dev/v1/webhooks/openiap-kit_secret",
      ),
    ).toBe("https://kit.openiap.dev/v1/webhooks/<api-key-redacted>");
  });
});
