import { describe, expect, it, vi } from "vitest";

import {
  connectWebhookStream,
  parseWebhookEventData,
  type WebhookEventPayload,
  type WebhookEventStream,
} from "./webhook-client";

const validEvent: WebhookEventPayload = {
  id: "uuid-1",
  type: "SubscriptionRenewed",
  source: "AppleAppStoreServerNotificationsV2",
  platform: "IOS",
  environment: "Production",
  projectId: "project-1",
  occurredAt: 1_711_000_000_000,
  receivedAt: 1_711_000_001_000,
  purchaseToken: "token-1",
  productId: "com.example.premium",
  subscriptionState: "Active",
};

describe("parseWebhookEventData", () => {
  it("parses a valid event JSON into an event payload", () => {
    const result = parseWebhookEventData(JSON.stringify(validEvent));
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.event.id).toBe("uuid-1");
      expect(result.event.type).toBe("SubscriptionRenewed");
      expect(result.event.purchaseToken).toBe("token-1");
    }
  });

  it("skips heartbeats (empty payload)", () => {
    expect(parseWebhookEventData("")).toEqual({
      kind: "skip",
      reason: "heartbeat",
    });
  });

  it("skips stream-control envelopes that have no `type`", () => {
    const result = parseWebhookEventData(
      JSON.stringify({ cursor: 12345 }),
    );
    expect(result.kind).toBe("skip");
  });

  it("returns parse error on malformed JSON", () => {
    const result = parseWebhookEventData("not json");
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toMatch(/parse SSE payload/);
    }
  });

  it("returns error when required fields are missing", () => {
    const result = parseWebhookEventData(
      JSON.stringify({
        type: "SubscriptionRenewed",
        // missing id / purchaseToken / occurredAt / receivedAt
      }),
    );
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toMatch(/missing required fields/);
    }
  });
});

describe("connectWebhookStream", () => {
  it("subscribes via the injected EventSource factory and forwards events", () => {
    const onEvent = vi.fn();
    const onError = vi.fn();

    let messageHandler:
      | ((event: { data: string; lastEventId?: string }) => void)
      | null = null;

    const fakeStream: WebhookEventStream = {
      onmessage: null,
      onerror: null,
      addEventListener: (type, listener) => {
        if (type === "message") {
          messageHandler = listener;
        }
      },
      close: vi.fn(),
    };

    const factory = vi.fn(() => fakeStream);

    const listener = connectWebhookStream({
      apiKey: "test-key",
      baseUrl: "http://localhost:3100",
      onEvent,
      onError,
      eventSourceFactory: factory,
    });

    expect(factory).toHaveBeenCalledWith(
      "http://localhost:3100/v1/webhooks/stream/test-key",
      {},
    );

    expect(messageHandler).not.toBeNull();
    messageHandler!({ data: JSON.stringify(validEvent) });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].id).toBe("uuid-1");
    expect(onError).not.toHaveBeenCalled();

    listener.close();
    expect(fakeStream.close).toHaveBeenCalled();
  });

  it("falls back to onmessage when addEventListener is not provided", () => {
    const onEvent = vi.fn();

    const fakeStream: WebhookEventStream = {
      onmessage: null,
      onerror: null,
      close: () => {},
    };

    connectWebhookStream({
      apiKey: "test-key",
      baseUrl: "http://localhost:3100",
      onEvent,
      eventSourceFactory: () => fakeStream,
    });

    expect(fakeStream.onmessage).not.toBeNull();
    fakeStream.onmessage!({ data: JSON.stringify(validEvent) });
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("calls onError with TRANSPORT_ERROR when the stream errors", () => {
    const onError = vi.fn();
    const fakeStream: WebhookEventStream = {
      onmessage: null,
      onerror: null,
      close: () => {},
    };

    connectWebhookStream({
      apiKey: "test-key",
      baseUrl: "http://localhost:3100",
      onEvent: () => {},
      onError,
      eventSourceFactory: () => fakeStream,
    });

    fakeStream.onerror?.(new Error("boom"));
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "TRANSPORT_ERROR" }),
    );
  });

  it("emits NO_EVENTSOURCE when factory throws and returns a no-op listener", () => {
    const onError = vi.fn();
    const result = connectWebhookStream({
      apiKey: "key",
      baseUrl: "http://localhost",
      onEvent: () => {},
      onError,
      eventSourceFactory: () => {
        throw new Error("missing");
      },
    });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NO_EVENTSOURCE" }),
    );
    expect(typeof result.close).toBe("function");
  });

  it("trims trailing slashes in baseUrl", () => {
    const factory = vi.fn(
      (): WebhookEventStream => ({
        onmessage: null,
        onerror: null,
        close: () => {},
      }),
    );
    connectWebhookStream({
      apiKey: "k",
      baseUrl: "https://kit.openiap.dev/",
      onEvent: () => {},
      eventSourceFactory: factory,
    });
    expect(factory.mock.calls[0][0]).toBe(
      "https://kit.openiap.dev/v1/webhooks/stream/k",
    );
  });

  it("URL-encodes the apiKey", () => {
    const factory = vi.fn(
      (): WebhookEventStream => ({
        onmessage: null,
        onerror: null,
        close: () => {},
      }),
    );
    connectWebhookStream({
      apiKey: "key with spaces & symbols",
      baseUrl: "http://localhost",
      onEvent: () => {},
      eventSourceFactory: factory,
    });
    expect(factory.mock.calls[0][0]).toBe(
      "http://localhost/v1/webhooks/stream/key%20with%20spaces%20%26%20symbols",
    );
  });
});
