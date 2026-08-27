import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Hono } from "hono";
import { ConvexError } from "convex/values";

const oidcMocks = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class OAuth2Client {
    verifyIdToken = oidcMocks.verifyIdToken;
  },
}));

const originalConvexUrl = process.env.VITE_KIT_CONVEX_URL;
const originalGooglePubsubPushAudience =
  process.env.GOOGLE_PUBSUB_PUSH_AUDIENCE;
const originalAllowUnauthenticatedPubsub =
  process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB;
let client: typeof import("../../convex").client;
let helpers: typeof import("./webhooks");

beforeAll(async () => {
  process.env.VITE_KIT_CONVEX_URL = "https://placeholder.convex.cloud";
  ({ client } = await import("../../convex"));
  helpers = await import("./webhooks");
});

afterAll(() => {
  if (originalConvexUrl === undefined) {
    delete process.env.VITE_KIT_CONVEX_URL;
  } else {
    process.env.VITE_KIT_CONVEX_URL = originalConvexUrl;
  }
});

afterEach(() => {
  if (originalGooglePubsubPushAudience === undefined) {
    delete process.env.GOOGLE_PUBSUB_PUSH_AUDIENCE;
  } else {
    process.env.GOOGLE_PUBSUB_PUSH_AUDIENCE = originalGooglePubsubPushAudience;
  }
  if (originalAllowUnauthenticatedPubsub === undefined) {
    delete process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB;
  } else {
    process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB =
      originalAllowUnauthenticatedPubsub;
  }
  vi.restoreAllMocks();
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

  it("does not add query strings to derived endpoint audiences", () => {
    const audiences = helpers.pubSubOidcAudiences(
      "https://kit.openiap.dev/v1/webhooks/openiap-kit_secret?admin=1",
      "https://kit.openiap.dev/",
    );

    expect(audiences).toContain(
      "https://kit.openiap.dev/v1/webhooks/openiap-kit_secret",
    );
    expect(audiences).not.toContain(
      "https://kit.openiap.dev/v1/webhooks/openiap-kit_secret?admin=1",
    );
  });
});

describe("webhooksRoutes", () => {
  function createApp() {
    const app = new Hono();
    app.route("/webhooks", helpers.webhooksRoutes);
    return app;
  }

  it("does not expose outbound webhook stream routes", async () => {
    const app = new Hono();
    app.route("/webhooks", helpers.webhooksRoutes);

    for (const path of [
      "/webhooks/stream",
      "/webhooks/stream/openiap-kit_pk_mobile",
    ]) {
      const response = await app.request(path);
      expect(response.status).toBe(404);
    }
  });

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

  it("directs legacy secret webhook URLs to the publishable lifecycle URL", async () => {
    const app = new Hono();
    app.route("/webhooks", helpers.webhooksRoutes);

    for (const path of [
      "/webhooks/openiap-kit_sk_legacy",
      "/webhooks/apple/openiap-kit_sk_legacy",
      "/webhooks/google/openiap-kit_sk_legacy",
    ]) {
      const response = await app.request(path, { method: "POST" });

      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toEqual({
        errors: [
          {
            code: "SECRET_API_KEY_IN_URL",
            message:
              "Secret API keys are not accepted in webhook URLs. Replace this URL with the publishable-key lifecycle URL shown in the IAPKit dashboard.",
          },
        ],
      });
    }
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

  it("rate-limits publishable webhook ingress before Convex", async () => {
    const app = new Hono();
    app.route("/webhooks", helpers.webhooksRoutes);

    const response = await app.request("/webhooks/openiap-kit_pk_mobile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "fly-client-ip": "203.0.113.10",
      },
      body: "{}",
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("x-ratelimit-limit")).toBe("600");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("599");
  });

  it("keeps only the inbound store lifecycle routes mounted", async () => {
    const app = new Hono();
    app.route("/webhooks", helpers.webhooksRoutes);

    for (const path of [
      "/webhooks/openiap-kit_pk_mobile",
      "/webhooks/apple/openiap-kit_pk_mobile",
      "/webhooks/google/openiap-kit_pk_mobile",
    ]) {
      const response = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        errors: [
          {
            code: "INVALID_INPUT",
            message:
              "Unrecognized payload. Expected Apple ASN v2 ({signedPayload}) or Google Pub/Sub ({message:{data,messageId}}).",
          },
        ],
      });
    }
  });

  it("rejects malformed JSON before store detection", async () => {
    const response = await createApp().request(
      "/webhooks/openiap-kit_pk_mobile",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [{ code: "INVALID_INPUT", message: "Body is not JSON" }],
    });
  });

  it("accepts Apple lifecycle events and preserves the public response", async () => {
    vi.spyOn(client, "action").mockResolvedValueOnce({
      type: "DID_RENEW",
      deduped: false,
    });

    const response = await createApp().request(
      "/webhooks/openiap-kit_pk_mobile",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signedPayload: "opaque-signed-payload" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      eventType: "DID_RENEW",
      deduped: false,
    });
  });

  it("rejects empty Apple signed payloads", async () => {
    const response = await createApp().request(
      "/webhooks/openiap-kit_pk_mobile",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signedPayload: "" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        { code: "INVALID_INPUT", message: "Missing or invalid signedPayload" },
      ],
    });
  });

  it("returns a sanitized 500 for unexpected Apple ingest failures", async () => {
    vi.spyOn(client, "action").mockRejectedValueOnce(new Error("internal"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await createApp().request(
      "/webhooks/openiap-kit_pk_mobile",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signedPayload: "opaque-signed-payload" }),
      },
    );

    expect(response.status).toBe(500);
    expect(error).toHaveBeenCalledWith(
      "[webhooks/apple] unexpected error",
      "Error",
    );
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "WEBHOOK_INTERNAL_ERROR",
          message: "Webhook processing failed",
        },
      ],
    });
  });

  it("fails closed when Google Pub/Sub audience is not configured", async () => {
    delete process.env.GOOGLE_PUBSUB_PUSH_AUDIENCE;
    delete process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const data = Buffer.from(
      JSON.stringify({ packageName: "dev.hyo.app" }),
    ).toString("base64");

    const response = await createApp().request(
      "/webhooks/openiap-kit_pk_mobile",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: { data, messageId: "message" } }),
      },
    );

    expect(response.status).toBe(503);
    expect(error).toHaveBeenCalled();
  });

  it("rejects malformed Google Pub/Sub message data in local dev mode", async () => {
    delete process.env.GOOGLE_PUBSUB_PUSH_AUDIENCE;
    process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB = "1";
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await createApp().request(
      "/webhooks/openiap-kit_pk_mobile",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: { data: "not base64", messageId: "message" },
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "INVALID_INPUT",
          message: "Pub/Sub message.data is not base64-encoded JSON",
        },
      ],
    });
  });

  it("accepts Google Pub/Sub lifecycle events in explicit local dev mode", async () => {
    delete process.env.GOOGLE_PUBSUB_PUSH_AUDIENCE;
    process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB = "1";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(client, "action").mockResolvedValueOnce({
      type: "SUBSCRIPTION_RENEWED",
      deduped: true,
    });
    const data = Buffer.from(
      JSON.stringify({
        packageName: "dev.hyo.app",
        eventTimeMillis: "1700000000000",
        subscriptionNotification: {
          notificationType: 2,
          purchaseToken: "opaque",
        },
      }),
    ).toString("base64");

    const response = await createApp().request(
      "/webhooks/openiap-kit_pk_mobile",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: { data, messageId: "message" } }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      eventType: "SUBSCRIPTION_RENEWED",
      deduped: true,
    });
  });

  it("forwards only the verified raw OIDC token to Convex", async () => {
    process.env.GOOGLE_PUBSUB_PUSH_AUDIENCE = "https://kit.openiap.dev/";
    delete process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB;
    oidcMocks.verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        email: "pubsub@project.iam.gserviceaccount.com",
        email_verified: true,
      }),
    });
    const action = vi.spyOn(client, "action").mockResolvedValueOnce({
      type: "TEST_NOTIFICATION",
      deduped: false,
    });
    const data = Buffer.from(
      JSON.stringify({
        packageName: "dev.hyo.app",
        testNotification: { version: "1.0" },
      }),
    ).toString("base64");

    const response = await createApp().request(
      "/webhooks/openiap-kit_pk_mobile",
      {
        method: "POST",
        headers: {
          authorization: "Bearer signed-oidc-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: { data, messageId: "message" } }),
      },
    );

    expect(response.status).toBe(200);
    expect(action).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        apiKey: "openiap-kit_pk_mobile",
        oidcToken: "signed-oidc-token",
      }),
    );
    expect(action.mock.calls[0]?.[1]).not.toHaveProperty("oidcAudiences");
  });

  it("maps authoritative Convex OIDC rejection to 401", async () => {
    delete process.env.GOOGLE_PUBSUB_PUSH_AUDIENCE;
    process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB = "1";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(client, "action").mockRejectedValueOnce(
      new ConvexError({
        code: "UNAUTHORIZED",
        message: "Google Pub/Sub OIDC authentication failed.",
      }),
    );
    const data = Buffer.from(
      JSON.stringify({
        packageName: "dev.hyo.app",
        testNotification: { version: "1.0" },
      }),
    ).toString("base64");

    const response = await createApp().request(
      "/webhooks/openiap-kit_pk_mobile",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: { data, messageId: "message" } }),
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "UNAUTHORIZED",
          message: "Google Pub/Sub OIDC authentication failed.",
        },
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
