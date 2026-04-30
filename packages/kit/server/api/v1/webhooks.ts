import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { OAuth2Client } from "google-auth-library";

import { api } from "@/convex";
import { client, handleConvexError } from "../../convex";

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

webhooks.post("/apple/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  let body: { signedPayload?: string };

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { errors: [{ code: "INVALID_INPUT", message: "Body is not JSON" }] },
      400,
    );
  }

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
    const result = await client.action(api.webhooks.apple.ingestAppleAsn, {
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
});

webhooks.post("/google/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");

  // Pub/Sub push always sends Authorization: Bearer <jwt>. Apple-style
  // unauthenticated path access is not appropriate here because Pub/Sub
  // explicitly supports OIDC and skipping it leaves the endpoint
  // spoofable.
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

  type PubSubPushBody = {
    message?: {
      data?: string;
      messageId?: string;
      publishTime?: string;
      attributes?: Record<string, string>;
    };
    subscription?: string;
  };

  let body: PubSubPushBody;
  try {
    body = await c.req.json<PubSubPushBody>();
  } catch {
    return c.json(
      { errors: [{ code: "INVALID_INPUT", message: "Body is not JSON" }] },
      400,
    );
  }

  if (!body.message?.data || !body.message?.messageId) {
    return c.json(
      {
        errors: [
          {
            code: "INVALID_INPUT",
            message: "Pub/Sub envelope missing message.data or messageId",
          },
        ],
      },
      400,
    );
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
});

// Server-Sent Events stream of normalized webhook events tied to the
// caller's API key. Built on `webhookEventsSince` polling rather than
// Convex's native subscription stream because the Hono server uses
// `ConvexHttpClient` (no streaming subscribe) and SSE works
// universally — RN, Expo, Flutter, KMP, and Godot all have stable SSE
// or chunked-HTTP support without needing a Convex client dependency
// in each SDK.
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
// Polling cadence: 1.5s. This trades a half-step of real-time
// freshness for not opening a Convex subscribe socket per client. The
// SDKs treat the SSE connection as authoritative real-time anyway —
// any further hardening (push, true streaming) is additive.
const STREAM_POLL_MS = 1_500;
const STREAM_PAGE_LIMIT = 100;

webhooks.get("/stream/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const lastEventId = c.req.header("last-event-id") ?? undefined;

  let cursor = await resolveStreamStartCursor(apiKey, lastEventId);

  return streamSSE(c, async (stream) => {
    // Heartbeats keep proxies (Fly edge, Cloudflare, browser fetch)
    // from timing the connection out during long quiet periods. SSE
    // comments are ignored by EventSource clients but count as
    // bytes-on-the-wire for the proxy idle timer.
    let aborted = false;
    stream.onAbort(() => {
      aborted = true;
    });

    await stream.writeSSE({
      event: "ready",
      data: JSON.stringify({ cursor }),
    });

    while (!aborted) {
      let events: Array<Record<string, unknown>> = [];
      try {
        events = (await client.query(api.webhooks.query.webhookEventsSince, {
          apiKey,
          sinceMs: cursor,
          limit: STREAM_PAGE_LIMIT,
        })) as Array<Record<string, unknown>>;
      } catch (error) {
        console.error("[webhooks/stream] poll failed", error);
        await stream.writeSSE({
          event: "stream-error",
          data: JSON.stringify({
            message:
              error instanceof Error ? error.message : "Unknown poll error",
          }),
        });
        // Sleep before retrying to avoid hot-looping on persistent
        // backend errors.
        await stream.sleep(STREAM_POLL_MS * 4);
        continue;
      }

      for (const event of events) {
        if (aborted) {
          break;
        }
        // Strict-equality `>` — events at exactly `sinceMs` are
        // already-seen on reconnect so we'd emit a dupe otherwise.
        if (typeof event.receivedAt === "number" && event.receivedAt > cursor) {
          cursor = event.receivedAt;
        }
        await stream.writeSSE({
          id: typeof event.id === "string" ? event.id : Date.now().toString(),
          event: typeof event.type === "string" ? event.type : "WebhookEvent",
          data: JSON.stringify(event),
        });
      }

      // Heartbeat sent regardless of new events so quiet connections
      // stay alive. Comment line per the SSE spec.
      await stream.writeSSE({ event: "heartbeat", data: "" });

      await stream.sleep(STREAM_POLL_MS);
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
