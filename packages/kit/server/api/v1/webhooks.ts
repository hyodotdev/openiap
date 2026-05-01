import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { OAuth2Client } from "google-auth-library";
import { ConvexClient } from "convex/browser";

import { api } from "@/convex";
import { client, convexUrlForRealtime, handleConvexError } from "../../convex";

// Inbound webhook receivers for Apple ASN v2 and Google Pub/Sub RTDN.
//
// Auth model:
// - Apple ASN does not support custom Authorization headers, so the
//   project's API key is encoded in the path: kit gives each project a
//   webhook URL of the form
//     https://kit.openiap.dev/v1/webhooks/apple/{apiKey}
//   to register in App Store Connect. The path segment behaves like a
//   capability token; rotating the project's API key invalidates the
//   URL just like it invalidates verifyReceipt callers. The Convex
//   action verifies the signedPayload signature against Apple's roots,
//   so even if the URL leaks, only Apple-signed payloads are accepted.
//
// - Google Pub/Sub push delivers a Bearer JWT from Google in the
//   Authorization header that we verify against
//   https://www.googleapis.com/oauth2/v1/certs (via OAuth2Client). The
//   project's API key is also in the path so kit can resolve which
//   project a notification belongs to. Both checks must pass.

const webhooks = new Hono();

// Unified lifecycle endpoint. The exact same URL works for both Apple
// App Store Connect and Google Pub/Sub push subscriptions: kit
// inspects the body shape to detect which store sent the
// notification, then dispatches to the same Convex action that the
// platform-specific paths use.
//
// Detection rules:
//   - Apple ASN v2 payload: `{ "signedPayload": "<JWS>" }`
//   - Google Pub/Sub push: `{ "message": { "data": "<base64>",
//     "messageId": "..." }, "subscription": "..." }`
// Anything else returns 400 INVALID_INPUT so misconfigured upstream
// senders fail loudly rather than silently being dropped.
//
// Why one URL: the comparison-table feedback was that exposing two
// "Apple URL" / "Google URL" copy boxes in the dashboard makes the
// hosted-backend pitch leakier than it needs to be. With one URL,
// the operator pastes the same string into App Store Connect AND
// Google Pub/Sub; whichever platform they haven't configured simply
// never sends traffic, and kit's per-platform receiver code only
// runs when its expected payload shape arrives.
const unifiedHandler = async (c: Context) => {
  const apiKey = c.req.param("apiKey");
  if (!apiKey) {
    return c.json(
      {
        errors: [
          { code: "INVALID_INPUT", message: "Missing apiKey path segment" },
        ],
      },
      400,
    );
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { errors: [{ code: "INVALID_INPUT", message: "Body is not JSON" }] },
      400,
    );
  }

  if (looksLikeApple(body)) {
    const setup = await getSetupStatus(apiKey);
    if (!setup.found)
      return platformError(c, "INVALID_API_KEY", "Unknown apiKey");
    if (!setup.ios.configured) {
      return platformError(
        c,
        "IOS_NOT_CONFIGURED",
        `Apple ASN v2 received but iOS is not configured for this project. Missing: ${setup.ios.missing.join(", ")}.`,
      );
    }
    return handleAppleNotification(
      c,
      apiKey,
      body as { signedPayload: string },
    );
  }
  if (looksLikeGoogle(body)) {
    const setup = await getSetupStatus(apiKey);
    if (!setup.found)
      return platformError(c, "INVALID_API_KEY", "Unknown apiKey");
    if (!setup.android.configured) {
      return platformError(
        c,
        "ANDROID_NOT_CONFIGURED",
        `Google RTDN received but Android is not configured for this project. Missing: ${setup.android.missing.join(", ")}.`,
      );
    }
    return handleGoogleNotification(c, apiKey, body as PubSubPushBody);
  }

  return c.json(
    {
      errors: [
        {
          code: "INVALID_INPUT",
          message:
            "Unrecognized payload. Expected Apple ASN v2 ({signedPayload}) or Google Pub/Sub ({message:{data,messageId}}).",
        },
      ],
    },
    400,
  );
};

// Public — paste this URL into both App Store Connect and Google
// Pub/Sub push subscription configuration.
webhooks.post("/:apiKey", unifiedHandler);

// Backwards-compatible aliases for operators who already configured a
// platform-specific URL. Both dispatch through the same handlers as
// the unified endpoint, so the dashboard / docs nudge users toward
// the one-URL pattern without breaking existing wiring.
webhooks.post("/apple/:apiKey", unifiedHandler);
webhooks.post("/google/:apiKey", unifiedHandler);

type PubSubPushBody = {
  message: {
    data: string;
    messageId: string;
    publishTime?: string;
    attributes?: Record<string, string>;
  };
  subscription?: string;
};

function looksLikeApple(body: unknown): boolean {
  return (
    !!body &&
    typeof body === "object" &&
    "signedPayload" in body &&
    typeof (body as Record<string, unknown>).signedPayload === "string"
  );
}

function looksLikeGoogle(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const message = (body as { message?: unknown }).message;
  if (!message || typeof message !== "object") return false;
  const m = message as Record<string, unknown>;
  return typeof m.data === "string" && typeof m.messageId === "string";
}

// Surface a 412 Precondition Failed with a stable `code` so the
// dashboard / SDK can branch on it without parsing the message.
function platformError(c: Context, code: string, message: string) {
  return c.json({ errors: [{ code, message }] }, 412);
}

async function getSetupStatus(apiKey: string): Promise<{
  found: boolean;
  ios: { configured: boolean; missing: string[] };
  android: { configured: boolean; missing: string[] };
}> {
  const status = (await client.query(api.projects.setupStatus.getSetupStatus, {
    apiKey,
  })) as {
    found: boolean;
    ios: { configured: boolean; missing: string[] };
    android: { configured: boolean; missing: string[] };
  };
  return status;
}

async function handleAppleNotification(
  c: Context,
  apiKey: string,
  body: { signedPayload: string },
) {
  if (typeof body.signedPayload !== "string" || body.signedPayload.length < 1) {
    return c.json(
      {
        errors: [
          {
            code: "INVALID_INPUT",
            message: "Missing or invalid signedPayload",
          },
        ],
      },
      400,
    );
  }
  try {
    const result = await client.action(api.webhooks.apple.ingestAppleAsnIOS, {
      apiKey,
      signedPayload: body.signedPayload,
    });
    return c.json({
      ok: true,
      eventType: result.type,
      deduped: result.deduped,
    });
  } catch (error) {
    return mapWebhookError(c, error, "apple");
  }
}

async function handleGoogleNotification(
  c: Context,
  apiKey: string,
  body: PubSubPushBody,
) {
  // Pub/Sub push always sends `Authorization: Bearer <jwt>` when OIDC
  // is configured on the subscription. We verify it when the operator
  // has set GOOGLE_PUBSUB_PUSH_AUDIENCE; otherwise we skip strict
  // checks (development / sandbox).
  const authHeader = c.req.header("authorization");
  const audience = process.env.GOOGLE_PUBSUB_PUSH_AUDIENCE;
  if (audience) {
    const ok = await verifyPubSubOidcToken(authHeader, audience);
    if (!ok) {
      return c.json(
        {
          errors: [
            {
              code: "UNAUTHORIZED",
              message: "Pub/Sub OIDC verification failed",
            },
          ],
        },
        401,
      );
    }
  }

  let decoded: Record<string, unknown>;
  try {
    decoded = JSON.parse(
      Buffer.from(body.message.data, "base64").toString("utf-8"),
    );
  } catch {
    return c.json(
      {
        errors: [
          {
            code: "INVALID_INPUT",
            message: "Pub/Sub message.data is not base64-encoded JSON",
          },
        ],
      },
      400,
    );
  }

  const payload = {
    messageId: body.message.messageId,
    packageName:
      typeof decoded.packageName === "string" ? decoded.packageName : undefined,
    eventTimeMillis:
      typeof decoded.eventTimeMillis === "string"
        ? Number(decoded.eventTimeMillis)
        : typeof decoded.eventTimeMillis === "number"
          ? decoded.eventTimeMillis
          : Date.parse(body.message.publishTime ?? "") || Date.now(),
    subscriptionNotification: decoded.subscriptionNotification as
      | undefined
      | {
          notificationType: number;
          purchaseToken: string;
          subscriptionId: string;
        },
    oneTimeProductNotification: decoded.oneTimeProductNotification as
      | undefined
      | { notificationType: number; purchaseToken: string; sku: string },
    voidedPurchaseNotification: decoded.voidedPurchaseNotification as
      | undefined
      | {
          purchaseToken: string;
          orderId?: string;
          productType?: number;
          refundType?: number;
        },
    testNotification: decoded.testNotification as
      | undefined
      | { version: string },
  };

  try {
    const result = await client.action(api.webhooks.google.ingestGoogleRtdn, {
      apiKey,
      rawMessage: JSON.stringify(decoded),
      payload,
    });
    return c.json({
      ok: true,
      eventType: result.type,
      deduped: result.deduped,
    });
  } catch (error) {
    return mapWebhookError(c, error, "google");
  }
}

// Server-Sent Events stream of normalized webhook events tied to the
// caller's API key. Per-connection, we open a Convex `onUpdate`
// subscription against `webhookEventsSince(apiKey, sinceMs)` so kit
// pushes new events to the SSE client the moment Convex commits them.
// No polling — Convex's reactive query is the source of liveness.
//
// Protocol:
//   GET /v1/webhooks/stream/:apiKey
//
//   Response: text/event-stream with one event per webhook,
//     id: <sourceNotificationId>
//     event: <WebhookEventType>
//     data: <serialized WebhookEvent JSON>
//
//   Reconnection: the standard `Last-Event-ID` header is honored on
//   reconnect — kit looks up that event's `receivedAt` and resumes
//   from there, so events that fired while the connection was closed
//   are delivered in order on the next connect.
//
//   Heartbeat: an SSE `event: heartbeat` is emitted every 25s so
//   intermediate proxies (Fly edge, Cloudflare, browser fetch) don't
//   close the idle connection.
const HEARTBEAT_MS = 25_000;

webhooks.get("/stream/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const lastEventId = c.req.header("last-event-id") ?? undefined;

  let cursor = await resolveStreamStartCursor(apiKey, lastEventId);

  return streamSSE(c, async (stream) => {
    let aborted = false;
    stream.onAbort(() => {
      aborted = true;
    });

    const reactive = new ConvexClient(convexUrlForRealtime);
    const seen = new Set<string>();

    await stream.writeSSE({
      event: "ready",
      data: JSON.stringify({ cursor }),
    });

    // Convex `onUpdate` re-fires the callback every time the query
    // result changes. We track previously-emitted ids so a row that
    // was already emitted earlier in the connection isn't re-sent
    // when the result set grows. The `cursor` advances whenever we
    // emit so the next reconnect resumes from the right point.
    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = reactive.onUpdate(
        api.webhooks.query.webhookEventsSince,
        { apiKey, sinceMs: cursor, limit: 500 },
        (events: unknown) => {
          if (aborted) return;
          if (!Array.isArray(events)) return;
          for (const event of events as Array<Record<string, unknown>>) {
            const id = typeof event.id === "string" ? event.id : null;
            if (!id || seen.has(id)) continue;
            seen.add(id);
            if (
              typeof event.receivedAt === "number" &&
              event.receivedAt > cursor
            ) {
              cursor = event.receivedAt;
            }
            stream
              .writeSSE({
                id,
                event:
                  typeof event.type === "string" ? event.type : "WebhookEvent",
                data: JSON.stringify(event),
              })
              .catch((err) => {
                console.error("[webhooks/stream] write failed", err);
              });
          }
        },
      );
    } catch (error) {
      console.error("[webhooks/stream] subscribe failed", error);
      await stream.writeSSE({
        event: "stream-error",
        data: JSON.stringify({
          message: error instanceof Error ? error.message : "Subscribe failed",
        }),
      });
      void reactive.close();
      return;
    }

    try {
      while (!aborted) {
        await stream.sleep(HEARTBEAT_MS);
        if (aborted) break;
        await stream.writeSSE({ event: "heartbeat", data: "" });
      }
    } finally {
      try {
        unsubscribe?.();
      } catch {
        // closing twice (close() + unsubscribe) is benign in some
        // hot-reload paths.
      }
      void reactive.close();
    }
  });
});

// Translate an EventSource `Last-Event-ID` (which is the spec's stable
// `sourceNotificationId`) into a `sinceMs` cursor by looking up the
// event's `receivedAt`. Falls back to "now" when the id is unknown so
// we never replay the entire 30-day window for a confused client.
async function resolveStreamStartCursor(
  apiKey: string,
  lastEventId: string | undefined,
): Promise<number> {
  if (!lastEventId) {
    return 0;
  }
  try {
    const events = (await client.query(api.webhooks.query.webhookEventsSince, {
      apiKey,
      sinceMs: 0,
      limit: 500,
    })) as Array<{ id: string; receivedAt: number }>;
    const match = events.find((event) => event.id === lastEventId);
    if (match) {
      return match.receivedAt;
    }
    return Date.now();
  } catch (error) {
    console.warn("[webhooks/stream] cursor resolution failed", error);
    return Date.now();
  }
}

const oauth2Client = new OAuth2Client();

async function verifyPubSubOidcToken(
  authHeader: string | undefined,
  audience: string,
): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7);
  try {
    const ticket = await oauth2Client.verifyIdToken({
      idToken: token,
      audience,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      return false;
    }
    const email = payload.email;
    // Pub/Sub push requests are signed by a Google service account
    // dedicated to the publishing project. Reject any caller that is
    // not from the gcp-sa-pubsub principal namespace.
    if (!email || !email.endsWith("@gcp-sa-pubsub.iam.gserviceaccount.com")) {
      return false;
    }
    return payload.email_verified === true;
  } catch (error) {
    console.warn("[webhooks/google] OIDC verification error", error);
    return false;
  }
}

function mapWebhookError(
  c: Context,
  error: unknown,
  source: "apple" | "google",
) {
  const convexError = handleConvexError(error);
  if (convexError !== null) {
    // 400 keeps the upstream from retrying forever on a permanent
    // input error (bundle mismatch, malformed JWS, etc.).
    return c.json({ errors: [convexError] }, 400);
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.startsWith("UNSUPPORTED_EVENT")) {
    // Apple/Google ship new notification types ahead of the openiap
    // spec. Acknowledge with 200 so the upstream stops retrying — the
    // event was deliberately dropped, not lost.
    return c.json({ ok: true, dropped: true, reason: errorMessage });
  }

  console.error(
    `[webhooks/${source}] unexpected error`,
    errorMessage,
    error instanceof Error ? error.stack : "",
  );
  return c.json(
    {
      errors: [
        {
          code: "WEBHOOK_INTERNAL_ERROR",
          message: errorMessage,
        },
      ],
    },
    500,
  );
}

export { webhooks as webhooksRoutes };
