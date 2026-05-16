import { beforeAll, describe, expect, it } from "vitest";
import { Hono } from "hono";

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

describe("webhooksRoutes", () => {
  it("rejects oversized path apiKey before reading the body", async () => {
    const app = new Hono();
    app.route("/webhooks", helpers.webhooksRoutes);

    const response = await app.request(`/webhooks/${"a".repeat(129)}`, {
      method: "POST",
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      errors: [{ code: "INVALID_API_KEY", message: "API key is too long" }],
    });
  });

  it("rejects blank path apiKey before reading the body", async () => {
    const app = new Hono();
    app.route("/webhooks", helpers.webhooksRoutes);

    const response = await app.request("/webhooks/%20%20", {
      method: "POST",
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      errors: [{ code: "INVALID_API_KEY", message: "API key is required" }],
    });
  });

  it("rejects oversized webhook bodies before JSON parsing", async () => {
    const app = new Hono();
    app.route("/webhooks", helpers.webhooksRoutes);

    const response = await app.request("/webhooks/openiap-kit_secret", {
      method: "POST",
      headers: { "content-length": String(256 * 1024 + 1) },
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      errors: [
        { code: "PAYLOAD_TOO_LARGE", message: "Webhook payload is too large" },
      ],
    });
  });
});

describe("legacyUnsupportedEventReason", () => {
  it("keeps legacy unsupported-event responses free of raw error details", () => {
    expect(
      helpers.legacyUnsupportedEventReason(
        new Error("UNSUPPORTED_EVENT: raw payload details"),
      ),
    ).toBe("Unsupported event");
    expect(helpers.legacyUnsupportedEventReason(new Error("OTHER"))).toBeNull();
  });
});

describe("isWebhookBodyTooLarge", () => {
  it("only rejects declared webhook bodies over the cap", () => {
    expect(helpers.isWebhookBodyTooLarge(undefined)).toBe(false);
    expect(helpers.isWebhookBodyTooLarge(String(256 * 1024))).toBe(false);
    expect(helpers.isWebhookBodyTooLarge(String(256 * 1024 + 1))).toBe(true);
    expect(helpers.isWebhookBodyTooLarge(String(Number.MAX_SAFE_INTEGER))).toBe(
      true,
    );
    expect(helpers.isWebhookBodyTooLarge("not-a-number")).toBe(false);
  });
});

describe("readWebhookJsonBody", () => {
  it("rejects streamed webhook bodies over the cap", async () => {
    const request = new Request("https://kit.openiap.dev/v1/webhooks/key", {
      method: "POST",
      body: JSON.stringify({ signedPayload: "a".repeat(256 * 1024) }),
    });

    await expect(helpers.readWebhookJsonBody(request)).rejects.toThrow(
      "Webhook payload is too large",
    );
  });
});

describe("webhookStreamUnavailableError", () => {
  it("does not expose raw stream lookup failures", () => {
    expect(helpers.webhookStreamUnavailableError()).toEqual({
      errors: [
        {
          code: "WEBHOOK_STREAM_UNAVAILABLE",
          message: "Webhook stream is temporarily unavailable",
        },
      ],
    });
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

describe("extractBearerToken", () => {
  it("accepts bearer scheme case-insensitively with flexible spacing", () => {
    expect(helpers.extractBearerToken("Bearer jwt-token")).toBe("jwt-token");
    expect(helpers.extractBearerToken("bearer   jwt-token")).toBe("jwt-token");
    expect(helpers.extractBearerToken("  BEARER jwt-token  ")).toBe(
      "jwt-token",
    );
  });

  it("rejects missing, non-bearer, or ambiguous authorization headers", () => {
    expect(helpers.extractBearerToken(undefined)).toBeNull();
    expect(helpers.extractBearerToken("Basic abc")).toBeNull();
    expect(helpers.extractBearerToken("Bearer")).toBeNull();
    expect(helpers.extractBearerToken("Bearer token extra")).toBeNull();
  });
});

describe("decodePubSubMessageData", () => {
  it("decodes strict base64 JSON objects", () => {
    const encoded = Buffer.from(
      JSON.stringify({ packageName: "dev.hyo.app" }),
    ).toString("base64");

    expect(helpers.decodePubSubMessageData(encoded)).toEqual({
      decodedRaw: '{"packageName":"dev.hyo.app"}',
      decoded: { packageName: "dev.hyo.app" },
    });
  });

  it("rejects malformed base64 instead of letting Buffer ignore junk", () => {
    const encoded = Buffer.from(JSON.stringify({ ok: true })).toString(
      "base64",
    );

    expect(helpers.decodePubSubMessageData(`${encoded}!`)).toBeNull();
    expect(helpers.decodePubSubMessageData("not base64")).toBeNull();
  });

  it("rejects decoded JSON primitives", () => {
    const encoded = Buffer.from('"not-an-object"').toString("base64");

    expect(helpers.decodePubSubMessageData(encoded)).toBeNull();
  });
});

describe("resolveGoogleEventTimeMillis", () => {
  it("accepts non-negative safe integer millis from Pub/Sub data", () => {
    expect(
      helpers.resolveGoogleEventTimeMillis("1700000000000", undefined),
    ).toBe(1_700_000_000_000);
    expect(helpers.resolveGoogleEventTimeMillis(1700000000000, undefined)).toBe(
      1_700_000_000_000,
    );
  });

  it("falls back to publishTime or now for malformed eventTimeMillis", () => {
    const publishTime = "2024-01-02T03:04:05.000Z";
    const publishedAt = Date.parse(publishTime);

    expect(helpers.resolveGoogleEventTimeMillis("0x10", publishTime, 123)).toBe(
      publishedAt,
    );
    expect(helpers.resolveGoogleEventTimeMillis("1e3", undefined, 123)).toBe(
      123,
    );
    expect(
      helpers.resolveGoogleEventTimeMillis(
        String(Number.MAX_SAFE_INTEGER + 1),
        undefined,
        123,
      ),
    ).toBe(123);
  });
});

describe("sanitizePubSubAudienceForLog", () => {
  it("preserves webhook endpoint audience logs", () => {
    const cases = [
      [
        "https://kit.openiap.dev/v1/webhooks/openiap-kit_secret",
        "https://kit.openiap.dev/v1/webhooks/openiap-kit_secret",
      ],
      [
        "https://kit.openiap.dev/v1/webhooks/apple/openiap-kit_secret",
        "https://kit.openiap.dev/v1/webhooks/apple/openiap-kit_secret",
      ],
      [
        "https://kit.openiap.dev/v1/webhooks/google/openiap-kit_secret",
        "https://kit.openiap.dev/v1/webhooks/google/openiap-kit_secret",
      ],
      [
        "https://kit.openiap.dev/v1/webhooks/stream/openiap-kit_secret?since=1",
        "https://kit.openiap.dev/v1/webhooks/stream/openiap-kit_secret?since=1",
      ],
      [
        "https://kit.openiap.dev/v1/webhooks/openiap-kit_secret?apiKey=openiap-kit_query&token=jwt-token&id_token=id-token&jwt=jwt-token&since=1",
        "https://kit.openiap.dev/v1/webhooks/openiap-kit_secret?apiKey=openiap-kit_query&token=jwt-token&id_token=id-token&jwt=jwt-token&since=1",
      ],
      [
        "https://kit.openiap.dev/api/v1/webhooks/openiap-kit_secret",
        "https://kit.openiap.dev/api/v1/webhooks/openiap-kit_secret",
      ],
    ];

    for (const [input, expected] of cases) {
      expect(helpers.sanitizePubSubAudienceForLog(input)).toBe(expected);
    }
  });
});

describe("normalizeLastEventId", () => {
  it("drops oversized reconnect cursors before Convex lookup", () => {
    expect(helpers.normalizeLastEventId(undefined)).toBeUndefined();
    expect(helpers.normalizeLastEventId("rtdn-msg-1")).toBe("rtdn-msg-1");
    expect(helpers.normalizeLastEventId("a".repeat(512))).toBe("a".repeat(512));
    expect(helpers.normalizeLastEventId("a".repeat(513))).toBeUndefined();
  });
});
