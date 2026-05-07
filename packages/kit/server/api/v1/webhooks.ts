import { Hono } from "hono";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { OAuth2Client } from "google-auth-library";
import { ConvexClient } from "convex/browser";

import { api } from "@/convex";
import { client, convexUrlForRealtime, handleConvexError } from "../../convex";
import { drainWebhookEventBatches } from "./webhookStreamDrain";

// Shared reactive client for the SSE webhook stream. We keep a
// SINGLE WebSocket open to Convex regardless of how many SDK clients
// are subscribed — the previous per-connection `new ConvexClient(...)`
// inside streamSSE fanned out to one WebSocket per subscriber, which
// scaled poorly under typical traffic where every dashboard tab + every
// mobile SDK opens its own SSE connection. Each per-connection
// `onUpdate(...)` returns its own unsubscribe handle so isolating
// the *subscription lifecycle* per request still works correctly.
//
// Initialized lazily on first SSE connection — module-level
// instantiation would open the WebSocket at boot time, which (a)
// breaks the smoke build (placeholder CONVEX_URL → infinite reconnect
// loop blocks `server.stop()` shutdown) and (b) wastes a connection
// on processes that never serve a stream request.
let sharedReactiveClient: ConvexClient | null = null;
function getSharedReactiveClient(): ConvexClient {
  sharedReactiveClient ??= new ConvexClient(convexUrlForRealtime);
  return sharedReactiveClient;
}

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

  // Setup-status gating now lives INSIDE the ingest actions
  // (`ingestAppleAsnIOS` / `ingestGoogleRtdn`) — they already query
  // the project once and throw structured ConvexError codes
  // (`INVALID_API_KEY` / `IOS_NOT_CONFIGURED` / `ANDROID_NOT_CONFIGURED`)
  // that `mapWebhookError` translates to the right HTTP status.
  // Doing the check here as a separate Convex query was adding an
  // extra round-trip per webhook.
  if (looksLikeApple(body)) {
    return handleAppleNotification(
      c,
      apiKey,
      body as { signedPayload: string },
    );
  }
  if (looksLikeGoogle(body)) {
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
  // is configured on the subscription. We require the operator to have
  // set GOOGLE_PUBSUB_PUSH_AUDIENCE in production so kit fails closed
  // — a missing env var must not silently let anonymous bodies through
  // a Google-shaped path. In development / sandbox, the operator can
  // opt out by setting `KIT_ALLOW_UNAUTHENTICATED_PUBSUB=1`.
  const authHeader = c.req.header("authorization");
  const audience = process.env.GOOGLE_PUBSUB_PUSH_AUDIENCE;
  const allowUnauth = process.env.KIT_ALLOW_UNAUTHENTICATED_PUBSUB === "1";
  if (!audience) {
    if (!allowUnauth) {
      console.error(
        "[webhooks/google] GOOGLE_PUBSUB_PUSH_AUDIENCE is unset; rejecting request. Set KIT_ALLOW_UNAUTHENTICATED_PUBSUB=1 only for local dev.",
      );
      return c.json(
        {
          errors: [
            {
              code: "MISCONFIGURED",
              message:
                "Pub/Sub OIDC audience is not configured on this kit instance",
            },
          ],
        },
        503,
      );
    }
    console.warn(
      "[webhooks/google] GOOGLE_PUBSUB_PUSH_AUDIENCE unset and KIT_ALLOW_UNAUTHENTICATED_PUBSUB=1 — accepting unauthenticated Pub/Sub body (dev mode only).",
    );
  } else {
    const ok = await verifyPubSubOidcToken(
      authHeader,
      pubSubOidcAudiences(c.req.url, audience),
    );
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

  // Decode the Pub/Sub `message.data` once and keep both the parsed
  // form (used to build the typed payload) and the original UTF-8 text
  // (passed through as `rawMessage` so consumers / auditors / future
  // signature verifiers see exactly what Google sent — JSON.stringify
  // would normalize spacing + key order and break any byte-level
  // verification).
  let decodedRaw: string;
  let decoded: Record<string, unknown>;
  try {
    decodedRaw = Buffer.from(body.message.data, "base64").toString("utf-8");
    decoded = JSON.parse(decodedRaw);
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
      rawMessage: decodedRaw,
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

// Drop fields the client doesn't need over the wire. `rawSignedPayload`
// holds the original JWS / Pub/Sub envelope including the upstream
// signature. Until kit grows per-purchaser SSE auth (tracked as
// follow-up — see PR #124 (https://github.com/hyodotdev/openiap/pull/124) review), the SSE feed is gated only by the
// project API key, so any holder of that key would otherwise see
// every other customer's signed payload. The client doesn't need it
// for normal reconciliation flows: `purchaseToken` + `productId` are
// enough to match against local state. Operators that DO need the
// raw payload can fetch it through an authenticated server-to-server
// query rather than a long-lived browser-readable stream.
function redactWebhookEventForStream(
  event: Record<string, unknown>,
): Record<string, unknown> {
  const { rawSignedPayload: _omit, ...rest } = event;
  void _omit;
  return rest;
}

webhooks.get("/stream/:apiKey", async (c) => {
  const apiKey = c.req.param("apiKey");
  const lastEventId = c.req.header("last-event-id") ?? undefined;

  // Validate the API key BEFORE entering streamSSE. If the key is
  // wrong / rotated, every downstream `webhookEventsSince(apiKey, …)`
  // call returns `[]`, which in the absence of this guard makes the
  // SSE handler emit `ready` plus heartbeats forever — clients silently
  // never receive lifecycle updates after a key rotation. Returning a
  // 401 surfaces the misconfiguration immediately instead of looking
  // like a healthy idle stream.
  const project = await client.query(api.projects.query.getProjectByApiKey, {
    apiKey,
  });
  if (!project) {
    return c.json(
      {
        errors: [
          {
            code: "INVALID_API_KEY",
            message:
              "Project API key not recognized. Generate a fresh key in the kit dashboard or check that the key was not rotated.",
          },
        ],
      },
      401,
    );
  }

  const startCursor = await resolveStreamStartCursor(apiKey, lastEventId);

  return streamSSE(c, async (stream) => {
    let aborted = false;
    stream.onAbort(() => {
      aborted = true;
    });

    // Use the lazy module-level shared client so we don't open a new
    // WebSocket per SSE subscriber. Each subscription's lifecycle is
    // bound to its own `unsubscribe` handle returned by
    // `reactive.onUpdate(...)`, so isolation between connections is
    // preserved without paying the per-connection WebSocket cost.
    const reactive = getSharedReactiveClient();
    // Bounded dedup tracker: caps at SEEN_MAX entries with FIFO
    // eviction so a long-lived SSE connection (days/weeks) can't
    // grow the Set unbounded under high event volume. The window
    // The cap kicks in only after the backlog drain (Phase 1)
    // completes and we've armed the live tail (Phase 2). During
    // Phase 1 we hold every drained id so the Phase 2 onUpdate
    // can't double-deliver an event Phase 1 already emitted —
    // even if the backlog runs to tens of thousands of rows.
    // After Phase 2 is armed we only need a window long enough to
    // cover the ~5s overlap between phases plus normal-traffic
    // jitter; 5000 entries (~5 min of high-volume webhook traffic)
    // comfortably bounds that.
    const SEEN_MAX_AFTER_DRAIN = 5000;
    let drainComplete = false;
    const seenOrder: string[] = [];
    const seenSet = new Set<string>();
    const seen = {
      has(id: string): boolean {
        return seenSet.has(id);
      },
      add(id: string): void {
        if (seenSet.has(id)) return;
        seenSet.add(id);
        seenOrder.push(id);
        if (drainComplete && seenOrder.length > SEEN_MAX_AFTER_DRAIN) {
          const evicted = seenOrder.shift();
          if (evicted !== undefined) seenSet.delete(evicted);
        }
      },
      // Called by the SSE handler when Phase 1 finishes draining
      // and Phase 2 has been registered. The pre-drain ids are now
      // safe to age out under the SEEN_MAX_AFTER_DRAIN bound — the
      // overlap-window guarantee only needs the tail.
      markDrainComplete(): void {
        drainComplete = true;
        // Trim immediately so we don't carry a multi-minute backlog
        // forever just because the drain ran long.
        while (seenOrder.length > SEEN_MAX_AFTER_DRAIN) {
          const evicted = seenOrder.shift();
          if (evicted !== undefined) seenSet.delete(evicted);
        }
      },
    };
    // `liveStart` is the boundary between the backlog drain (paginated
    // HTTP queries) and the live tail (Convex `onUpdate` subscription
    // pinned to `sinceMs = liveStart`). Convex pins query args at
    // subscription time and won't refresh them as cursors advance —
    // attaching `onUpdate` with the original cursor would create a
    // 500-row result window that never moves forward, so new events
    // beyond the initial batch would never reach the consumer (PR #124 (https://github.com/hyodotdev/openiap/pull/124)
    // review fix). Draining first, then pinning the live tail at
    // "now", sidesteps that limitation.
    const liveStart = Date.now();

    await stream.writeSSE({
      event: "ready",
      data: JSON.stringify({ cursor: startCursor.sinceMs }),
    });

    // ── Phase 1: drain backlog ───────────────────────────────────
    // Pull every event between the reconnect cursor and `liveStart`
    // through paginated `webhookEventsSince` calls. The cursor pair
    // (`sinceMs`, `afterCreationTime`) is honored by the query so
    // same-`receivedAt` cohorts larger than `limit` still advance.
    let drainCursor = startCursor.sinceMs;
    let drainCreationCursor = startCursor.afterCreationTime;
    // Tracks the receivedAt of the last event we *delivered* (not the
    // last cursor position) so we can detect a saturated-cohort
    // stall: if a follow-up query returns empty while we just
    // delivered events at drainCursor's millisecond, the
    // receivedAt-keyed query bound (limit=5000) fell short of the
    // full cohort. Bumping drainCursor by 1ms in that case sacrifices
    // any remaining events past the 5000-event-per-ms threshold but
    // guarantees forward progress — and the threshold is a hard upper
    // bound that no real-world store webhook ever approaches.
    let lastDeliveredReceivedAt: number | null = null;
    // Hard safety bounds on the drain loop. Without these, a project
    // with a very large 30-day backlog could keep one connection
    // running for an unbounded amount of time, holding the kit pod's
    // SSE budget. Hitting either bound stops drain phase and lets
    // Phase 2 take over from the live cursor — clients can reconnect
    // with their last received id to continue.
    const DRAIN_MAX_ITERATIONS = 200; // 200 * 500-row pages = 100k events
    const DRAIN_MAX_MS = 60_000; // wall-clock cap (1 min)
    const drainStartedAt = Date.now();
    let drainIterations = 0;
    try {
      while (!aborted) {
        if (drainIterations >= DRAIN_MAX_ITERATIONS) {
          console.warn(
            "[webhooks/stream] drain hit DRAIN_MAX_ITERATIONS — handing off to live tail",
            { drainIterations, drainCursor },
          );
          break;
        }
        if (Date.now() - drainStartedAt > DRAIN_MAX_MS) {
          console.warn(
            "[webhooks/stream] drain hit DRAIN_MAX_MS — handing off to live tail",
            { elapsedMs: Date.now() - drainStartedAt, drainCursor },
          );
          break;
        }
        drainIterations += 1;
        const batch = (await client.query(
          api.webhooks.query.webhookEventsSince,
          {
            apiKey,
            sinceMs: drainCursor,
            afterCreationTime: drainCreationCursor,
            limit: 500,
          },
        )) as Array<Record<string, unknown>>;
        if (!batch.length) {
          // Saturated-cohort fallback: if the previous iteration
          // delivered events stuck at drainCursor's millisecond and
          // this query came back empty, the query's fetchLimit cap
          // hid the rest of that cohort. Advance past the millisecond
          // and try once more before declaring drain complete.
          if (
            lastDeliveredReceivedAt !== null &&
            lastDeliveredReceivedAt === drainCursor
          ) {
            drainCursor += 1;
            drainCreationCursor = undefined;
            lastDeliveredReceivedAt = null;
            continue;
          }
          break;
        }

        let advanced = false;
        for (const event of batch) {
          if (aborted) break;
          const id = typeof event.id === "string" ? event.id : null;
          if (!id || seen.has(id)) continue;
          // Stop the drain once we've crossed into "live" territory —
          // events at or past `liveStart` are owned by the live tail.
          if (
            typeof event.receivedAt === "number" &&
            event.receivedAt >= liveStart
          ) {
            break;
          }
          seen.add(id);
          if (
            typeof event.receivedAt === "number" &&
            event.receivedAt > drainCursor
          ) {
            drainCursor = event.receivedAt;
            advanced = true;
          }
          if (
            typeof event._creationTime === "number" &&
            (drainCreationCursor === undefined ||
              event._creationTime > drainCreationCursor)
          ) {
            drainCreationCursor = event._creationTime;
            advanced = true;
          }
          await stream
            .writeSSE({
              id,
              event:
                typeof event.type === "string" ? event.type : "WebhookEvent",
              data: JSON.stringify(redactWebhookEventForStream(event)),
            })
            .catch((err) => {
              console.error("[webhooks/stream] drain write failed", err);
            });
          if (typeof event.receivedAt === "number") {
            lastDeliveredReceivedAt = event.receivedAt;
          }
        }
        if (!advanced) break;
        if (batch.length < 500) break;
      }
    } catch (error) {
      console.error("[webhooks/stream] drain failed", error);
      await stream.writeSSE({
        event: "stream-error",
        data: JSON.stringify({
          message: error instanceof Error ? error.message : "Drain failed",
        }),
      });
      // No reactive.close() — the client is shared across SSE
      // subscribers. We never registered an `onUpdate` here (still
      // in the drain phase), so there's nothing per-connection to
      // tear down.
      return;
    }
    if (aborted) {
      return;
    }

    // ── Phase 2: attach live tail ────────────────────────────────
    // Convex reactive query args are immutable for the life of an
    // `onUpdate` subscription, so the subscription itself cannot be
    // the delivery cursor. Use it only as a wake-up signal, then drain
    // through `webhookEventsSince` with a per-connection moving cursor.
    // That keeps long-lived streams moving past every 500-row page.
    //
    // The overlap closes a small race window: an event committed with
    // `receivedAt` marginally before `liveStart` would otherwise be
    // missed by both phases. `seen` dedupes the overlap.
    const PHASE_OVERLAP_MS = 5_000;
    let liveCursor = liveStart - PHASE_OVERLAP_MS;
    let liveCreationCursor: number | undefined;
    let liveDraining = false;
    let liveDrainRequested = false;
    const drainLiveTail = async (): Promise<void> => {
      if (liveDraining) {
        liveDrainRequested = true;
        return;
      }
      liveDraining = true;
      try {
        do {
          liveDrainRequested = false;
          const result = await drainWebhookEventBatches({
            initialCursor: {
              sinceMs: liveCursor,
              afterCreationTime: liveCreationCursor,
            },
            maxIterations: DRAIN_MAX_ITERATIONS,
            isAborted: () => aborted,
            loadBatch: async ({ sinceMs, afterCreationTime, limit }) =>
              await client.query(api.webhooks.query.webhookEventsSince, {
                apiKey,
                sinceMs,
                afterCreationTime,
                limit,
              }),
            seen,
            writeEvent: async (event, id) => {
              await stream
                .writeSSE({
                  id,
                  event:
                    typeof event.type === "string"
                      ? event.type
                      : "WebhookEvent",
                  data: JSON.stringify(redactWebhookEventForStream(event)),
                })
                .catch((err) => {
                  console.error("[webhooks/stream] live write failed", err);
                });
            },
            onIterationLimit: ({ iterations, cursor }) => {
              console.warn(
                "[webhooks/stream] live drain hit DRAIN_MAX_ITERATIONS",
                { iterations, liveCursor: cursor.sinceMs },
              );
            },
            onSaturatedCohortFallback: ({
              iterations,
              cursor,
              nextSinceMs,
              limit,
            }) => {
              console.warn(
                "[webhooks/stream] live drain saturated same-ms cohort fallback",
                {
                  iterations,
                  limit,
                  liveCursor: cursor.sinceMs,
                  afterCreationTime: cursor.afterCreationTime,
                  nextLiveCursor: nextSinceMs,
                },
              );
            },
          });
          liveCursor = result.cursor.sinceMs;
          liveCreationCursor = result.cursor.afterCreationTime;
        } while (liveDrainRequested && !aborted);
      } catch (error) {
        console.error("[webhooks/stream] live drain failed", error);
        await stream.writeSSE({
          event: "stream-error",
          data: JSON.stringify({
            message:
              error instanceof Error ? error.message : "Live drain failed",
          }),
        });
      } finally {
        liveDraining = false;
        if (liveDrainRequested && !aborted) {
          void drainLiveTail();
        }
      }
    };

    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = reactive.onUpdate(
        api.webhooks.query.latestWebhookEventsSince,
        {
          apiKey,
          sinceMs: liveStart - PHASE_OVERLAP_MS,
          limit: 500,
        },
        (events: unknown) => {
          if (aborted) return;
          if (!Array.isArray(events)) return;
          void drainLiveTail();
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
      // unsubscribe() not needed — onUpdate threw before returning a
      // handle. Don't close the shared client.
      return;
    }

    await drainLiveTail();

    // Phase 2 onUpdate is now armed — switch the dedup tracker
    // from "hold every drained id" to "bounded sliding window."
    // The pre-drain ids that are older than the overlap window
    // (5s back from liveStart) can no longer be re-surfaced by
    // the live tail, so they're safe to age out.
    seen.markDrainComplete();

    try {
      while (!aborted) {
        await stream.sleep(HEARTBEAT_MS);
        if (aborted) break;
        await drainLiveTail();
        if (aborted) break;
        await stream.writeSSE({ event: "heartbeat", data: "" });
      }
    } finally {
      // Unsubscribe from this connection's onUpdate but DO NOT close
      // the shared reactive client — other live SSE subscribers and
      // future connections share the same WebSocket.
      try {
        unsubscribe?.();
      } catch {
        // Some Convex client versions throw on double-unsubscribe
        // during hot-reload paths; benign.
      }
    }
  });
});

// Translate an EventSource `Last-Event-ID` (which is the spec's stable
// `sourceNotificationId`) into a `sinceMs` + `afterCreationTime` cursor
// pair. The new `findEventCursor` query hits the dedicated
// `by_project_and_notification_id` index so the lookup is O(log n)
// regardless of how many events the project has accumulated. The prior
// implementation scanned the first 500 events and silently fell back
// to "now" for anything beyond that — projects with > 500 events
// would lose every replay-on-reconnect (PR #124 (https://github.com/hyodotdev/openiap/pull/124) review fix).
//
// Returns `{ sinceMs, afterCreationTime }` so the SSE handler can pass
// both to `webhookEventsSince` and resume strictly past the last
// emitted event even under same-`receivedAt` bursts.
async function resolveStreamStartCursor(
  apiKey: string,
  lastEventId: string | undefined,
): Promise<{ sinceMs: number; afterCreationTime?: number }> {
  if (!lastEventId) {
    // New client (no Last-Event-ID) starts from the live tail. The
    // prior `sinceMs: 0` made every fresh connection drain the
    // entire 30-day retention window, which on busy projects melted
    // the kit pod and saturated the SDK with already-known history.
    // Long-offline reconciliation is the explicit job of the
    // `webhookEventsSince` query — clients that need historical
    // events query it directly with whatever cursor they tracked.
    return { sinceMs: Date.now() };
  }
  try {
    const match = await client.query(api.webhooks.query.findEventCursor, {
      apiKey,
      sourceNotificationId: lastEventId,
    });
    if (match) {
      return {
        sinceMs: match.receivedAt,
        afterCreationTime: match._creationTime,
      };
    }
    // Unknown lastEventId — never replay the full 30-day window for a
    // confused / forged client.
    return { sinceMs: Date.now() };
  } catch (error) {
    const sanitized =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : "(unknown error type)";
    console.warn("[webhooks/stream] cursor resolution failed", sanitized);
    return { sinceMs: Date.now() };
  }
}

const oauth2Client = new OAuth2Client();

async function verifyPubSubOidcToken(
  authHeader: string | undefined,
  audience: string | string[],
): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn("[webhooks/google] OIDC verification failed: missing bearer");
    return false;
  }
  const token = authHeader.slice(7);
  const expectedAudiences = Array.isArray(audience) ? audience : [audience];
  try {
    const ticket = await oauth2Client.verifyIdToken({
      idToken: token,
      audience,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      console.warn("[webhooks/google] OIDC verification failed: empty payload");
      return false;
    }
    const email = payload.email;
    if (!email || payload.email_verified !== true) {
      console.warn("[webhooks/google] OIDC verification failed: email", {
        audience: sanitizePubSubAudienceForLog(payload.aud),
        email,
        emailVerified: payload.email_verified,
        issuer: payload.iss,
      });
      return false;
    }
    // Bind to a specific service-account principal when configured.
    // Without GOOGLE_PUBSUB_PUSH_PRINCIPAL set, accept verified Google
    // service-account identities. Pub/Sub signs push OIDC tokens as the
    // subscription's configured service account (for example
    // `pubsub-rtdn-push@project.iam.gserviceaccount.com`), not the
    // Google-managed Pub/Sub service agent that has Token Creator access.
    const configuredPrincipal = process.env.GOOGLE_PUBSUB_PUSH_PRINCIPAL;
    if (!isAllowedPubSubServiceAccount(email, configuredPrincipal)) {
      console.warn("[webhooks/google] OIDC principal rejected", {
        audience: sanitizePubSubAudienceForLog(payload.aud),
        configuredPrincipal: configuredPrincipal ?? "(any service account)",
        email,
        expectedAudiences: expectedAudiences.map(sanitizePubSubAudienceForLog),
        issuer: payload.iss,
      });
      return false;
    }
    return true;
  } catch (error) {
    const sanitized =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : "(unknown error type)";
    console.warn("[webhooks/google] OIDC verification error", {
      error: sanitized,
      expectedAudiences: expectedAudiences.map(sanitizePubSubAudienceForLog),
      tokenClaims: decodeJwtPayloadForLog(token),
    });
    return false;
  }
}

export function isAllowedPubSubServiceAccount(
  email: string,
  configuredPrincipal?: string,
): boolean {
  if (configuredPrincipal) return email === configuredPrincipal;
  return email.endsWith(".gserviceaccount.com");
}

export function pubSubOidcAudiences(
  requestUrl: string,
  configuredAudience: string,
): string[] {
  const audiences = new Set(
    configuredAudience
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const request = safeUrl(requestUrl);
  if (!request) return Array.from(audiences);

  for (const raw of Array.from(audiences)) {
    const configured = safeUrl(raw);
    if (!configured) continue;
    const configuredIsOriginOnly =
      configured.pathname === "/" && !configured.search && !configured.hash;
    if (!configuredIsOriginOnly || configured.host !== request.host) continue;

    audiences.add(configured.origin);
    audiences.add(`${configured.origin}/`);
    audiences.add(`${configured.origin}${request.pathname}${request.search}`);
  }
  return Array.from(audiences);
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

type JwtClaimsForLog = {
  aud?: string | string[];
  email?: string;
  emailVerified?: boolean;
  issuer?: string;
};

function decodeJwtPayloadForLog(token: string): JwtClaimsForLog | null {
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    return {
      aud: sanitizePubSubAudienceForLog(decoded.aud),
      email: typeof decoded.email === "string" ? decoded.email : undefined,
      emailVerified:
        typeof decoded.email_verified === "boolean"
          ? decoded.email_verified
          : undefined,
      issuer: typeof decoded.iss === "string" ? decoded.iss : undefined,
    };
  } catch {
    return null;
  }
}

export function sanitizePubSubAudienceForLog(
  audience: unknown,
): string | string[] | undefined {
  if (Array.isArray(audience)) {
    return audience
      .map((value) => sanitizePubSubAudienceForLog(value))
      .filter((value): value is string => typeof value === "string");
  }
  if (typeof audience !== "string") return undefined;
  const parsed = safeUrl(audience);
  if (!parsed) return audience;
  const path = parsed.pathname.replace(
    /^(\/v1\/webhooks\/)[^/]+$/,
    "$1<api-key-redacted>",
  );
  return `${parsed.origin}${path}${parsed.search}`;
}

function mapWebhookError(
  c: Context,
  error: unknown,
  source: "apple" | "google",
) {
  const convexError = handleConvexError(error);
  if (convexError !== null) {
    // Apple/Google ship new notification types ahead of the openiap
    // spec. Acknowledge with 200 so the upstream stops retrying — the
    // event was deliberately dropped, not lost. Other normalization
    // errors (MissingNotificationId, MissingPurchaseToken,
    // BUNDLE_ID_MISMATCH, INVALID_SIGNATURE, …) are permanent
    // configuration/payload errors that need 4xx so the operator
    // notices and the upstream stops retrying.
    if (convexError.code === "UNSUPPORTED_EVENT") {
      return c.json({ ok: true, dropped: true, reason: convexError.message });
    }
    // Bad / unrecognized API key: 401 with a stable code the dashboard
    // and SDK can branch on without parsing the message.
    if (convexError.code === "INVALID_API_KEY") {
      return c.json({ errors: [convexError] }, 401);
    }
    // Per-platform setup-status gates (the action throws these when
    // the project hasn't configured the matching platform). 412
    // Precondition Failed is the same status the previous HTTP-layer
    // pre-check returned, so SDKs / dashboards branching on these
    // codes don't have to change.
    if (
      convexError.code === "IOS_NOT_CONFIGURED" ||
      convexError.code === "ANDROID_NOT_CONFIGURED"
    ) {
      return c.json({ errors: [convexError] }, 412);
    }
    return c.json({ errors: [convexError] }, 400);
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  if (errorMessage.startsWith("UNSUPPORTED_EVENT")) {
    // Legacy fallback — kept until all action paths migrate to the
    // ConvexError shape above.
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
