// Transport-agnostic webhook client for the openiap kit SSE stream
// (`GET /v1/webhooks/stream/{apiKey}`). Used by the JavaScript / TS
// wrappers (react-native-iap, expo-iap) but written without React or
// React-Native imports so it can also run in plain Node, browser, or
// any other JS runtime.
//
// The wire format is documented in `packages/kit/server/api/v1/webhooks.ts`
// and matches the GraphQL `WebhookEvent` shape from `webhook.graphql`.
//
// Parser logic is split out from the connection so it can be unit-
// tested without a live server. See `webhook-client.test.ts`.

export type WebhookEventType =
  | "SubscriptionStarted"
  | "SubscriptionRenewed"
  | "SubscriptionExpired"
  | "SubscriptionInGracePeriod"
  | "SubscriptionInBillingRetry"
  | "SubscriptionRecovered"
  | "SubscriptionCanceled"
  | "SubscriptionUncanceled"
  | "SubscriptionRevoked"
  | "SubscriptionPriceChange"
  | "SubscriptionProductChanged"
  | "SubscriptionPaused"
  | "SubscriptionResumed"
  | "PurchaseRefunded"
  | "PurchaseConsumptionRequest"
  | "TestNotification";

export const WEBHOOK_EVENT_TYPES = [
  "SubscriptionStarted",
  "SubscriptionRenewed",
  "SubscriptionExpired",
  "SubscriptionInGracePeriod",
  "SubscriptionInBillingRetry",
  "SubscriptionRecovered",
  "SubscriptionCanceled",
  "SubscriptionUncanceled",
  "SubscriptionRevoked",
  "SubscriptionPriceChange",
  "SubscriptionProductChanged",
  "SubscriptionPaused",
  "SubscriptionResumed",
  "PurchaseRefunded",
  "PurchaseConsumptionRequest",
  "TestNotification",
] as const satisfies readonly WebhookEventType[];

export type WebhookEventPayload = {
  id: string;
  type: WebhookEventType;
  source: string;
  platform: "IOS" | "Android";
  environment: "Production" | "Sandbox" | "Xcode";
  projectId: string;
  occurredAt: number;
  receivedAt: number;
  // Optional because TestNotification frames carry no transaction;
  // every other event type populates this.
  purchaseToken?: string;
  productId?: string;
  subscriptionState?: string;
  expiresAt?: number;
  renewsAt?: number;
  cancellationReason?: string;
  currency?: string;
  priceAmountMicros?: number;
  rawSignedPayload?: string;
};

export type WebhookListenerOptions = {
  /**
   * Project API key. Embedded in the URL path because Apple ASN
   * registration cannot send custom headers; the same path is reused
   * here for symmetry.
   */
  apiKey: string;
  /**
   * Override the kit base URL. Defaults to https://kit.openiap.dev.
   * In tests, point this at a local server.
   */
  baseUrl?: string;
  /** Called on every successfully-parsed webhook event. */
  onEvent: (event: WebhookEventPayload) => void;
  /**
   * Called on transport errors. The connection auto-reconnects
   * unconditionally; this callback exists for telemetry / surfacing
   * to the host UI.
   */
  onError?: (error: WebhookListenerError) => void;
  /**
   * Optional injection of an EventSource constructor. Lets RN /
   * Expo plug in `react-native-event-source` when running on a JS
   * runtime that lacks the global, or vitest plug in a stub.
   */
  eventSourceFactory?: (
    url: string,
    headers: Record<string, string>,
  ) => WebhookEventStream;
};

export interface WebhookEventStream {
  close(): void;
  onmessage: ((event: { data: string; lastEventId?: string }) => void) | null;
  onerror: ((error: unknown) => void) | null;
  addEventListener?: (
    type: string,
    listener: (event: { data: string; lastEventId?: string }) => void,
  ) => void;
}

export type WebhookListener = {
  /** Tear down the connection and stop receiving events. */
  close(): void;
};

export type WebhookListenerError = {
  code:
    | "TRANSPORT_ERROR"
    | "PARSE_ERROR"
    | "MALFORMED_EVENT"
    | "NO_EVENTSOURCE";
  message: string;
  cause?: unknown;
};

const DEFAULT_BASE_URL = "https://kit.openiap.dev";

export function connectWebhookStream(
  options: WebhookListenerOptions,
): WebhookListener {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const url = `${trimTrailingSlash(baseUrl)}/v1/webhooks/stream/${encodeURIComponent(options.apiKey)}`;

  const factory = options.eventSourceFactory ?? defaultEventSourceFactory;
  let stream: WebhookEventStream;
  try {
    stream = factory(url, {});
  } catch (error) {
    options.onError?.({
      code: "NO_EVENTSOURCE",
      message:
        error instanceof Error
          ? error.message
          : "EventSource constructor unavailable in this runtime",
      cause: error,
    });
    return { close: () => {} };
  }

  const seenIds = new Set<string>();
  const seenOrder: string[] = [];
  const markSeen = (id: string): boolean => {
    if (seenIds.has(id)) {
      return true;
    }
    seenIds.add(id);
    seenOrder.push(id);
    if (seenOrder.length > 1024) {
      const evicted = seenOrder.shift();
      if (evicted !== undefined) {
        seenIds.delete(evicted);
      }
    }
    return false;
  };

  const handleData = (raw: string) => {
    const parsed = parseWebhookEventData(raw);
    if (parsed.kind === "error") {
      options.onError?.({
        code: "PARSE_ERROR",
        message: parsed.message,
      });
      return;
    }
    if (parsed.kind === "skip") {
      return;
    }
    if (markSeen(parsed.event.id)) {
      return;
    }
    options.onEvent(parsed.event);
  };

  if (typeof stream.addEventListener === "function") {
    stream.addEventListener("message", (event) => handleData(event.data));
    // WHATWG EventSource dispatches frames with `event: Foo` only to
    // listeners registered for `Foo`, not to `message` / `onmessage`.
    // Kit emits webhook frames as typed SSE events, so subscribe to
    // every known webhook type and keep `message` for older servers or
    // polyfills that collapse typed frames into the generic channel.
    for (const eventType of WEBHOOK_EVENT_TYPES) {
      stream.addEventListener(eventType, (event) => handleData(event.data));
    }
  } else {
    stream.onmessage = (event) => handleData(event.data);
  }

  stream.onerror = (error) => {
    options.onError?.({
      code: "TRANSPORT_ERROR",
      message: "SSE transport error (auto-reconnecting)",
      cause: error,
    });
  };

  return {
    close: () => {
      try {
        stream.close();
      } catch {
        // Closing an already-closed EventSource is a no-op in browsers
        // but throws in some polyfills.
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing).
// ---------------------------------------------------------------------------

export type ParsedEventResult =
  | { kind: "ok"; event: WebhookEventPayload }
  | { kind: "skip"; reason: "heartbeat" | "stream-control" }
  | { kind: "error"; message: string };

export function parseWebhookEventData(raw: string): ParsedEventResult {
  if (!raw) {
    return { kind: "skip", reason: "heartbeat" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? `Failed to parse SSE payload: ${error.message}`
          : "Failed to parse SSE payload",
    };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("type" in parsed) ||
    typeof (parsed as Record<string, unknown>).type !== "string"
  ) {
    // Stream-control messages (the `ready`/`stream-error` envelopes
    // emitted by the kit server) have no `type` and are surfaced as
    // skips so consumers don't see them as events.
    return { kind: "skip", reason: "stream-control" };
  }

  const event = parsed as WebhookEventPayload;

  if (
    typeof event.id !== "string" ||
    typeof event.occurredAt !== "number" ||
    typeof event.receivedAt !== "number"
  ) {
    return {
      kind: "error",
      message: `WebhookEvent missing required fields (id/occurredAt/receivedAt)`,
    };
  }
  // purchaseToken is required for every event type *except*
  // TestNotification — Apple ASN v2 / Google RTDN test payloads
  // carry no transaction. Hard-rejecting here would surface valid
  // test webhooks as MALFORMED_EVENT and never reach listeners.
  if (
    event.type !== "TestNotification" &&
    typeof event.purchaseToken !== "string"
  ) {
    return {
      kind: "error",
      message: `WebhookEvent missing required field purchaseToken`,
    };
  }

  return { kind: "ok", event };
}

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function defaultEventSourceFactory(
  url: string,
  _headers: Record<string, string>,
): WebhookEventStream {
  // EventSource is part of the WHATWG spec and available in all
  // browser environments and most JS runtimes (Bun, Node 22+, Deno).
  // RN does not ship it natively — consumers must pass
  // `eventSourceFactory` from `react-native-sse` or similar.
  const ctor = (
    globalThis as {
      EventSource?: new (url: string) => WebhookEventStream;
    }
  ).EventSource;
  if (!ctor) {
    throw new Error(
      "EventSource is not defined. Pass `eventSourceFactory` for runtimes without a built-in EventSource.",
    );
  }
  return new ctor(url);
}
