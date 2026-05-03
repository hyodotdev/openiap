import { describe, expect, it } from "vitest";

import {
  connectWebhookStream,
  type WebhookEventPayload,
  type WebhookEventStream,
} from "./webhook-client";

const validEvent: WebhookEventPayload = {
  id: "uuid-typed-sse",
  type: "SubscriptionRenewed",
  source: "AppleAppStoreServerNotificationsV2",
  platform: "IOS",
  environment: "Production",
  projectId: "project-1",
  occurredAt: 1_711_000_000_000,
  receivedAt: 1_711_000_001_000,
  purchaseToken: "token-typed-sse",
  productId: "com.example.premium",
  subscriptionState: "Active",
};

class FetchEventSource implements WebhookEventStream {
  onmessage: ((event: { data: string; lastEventId?: string }) => void) | null =
    null;
  onerror: ((error: unknown) => void) | null = null;

  private readonly controller = new AbortController();
  private readonly listeners = new Map<
    string,
    Array<(event: { data: string; lastEventId?: string }) => void>
  >();
  private closed = false;

  constructor(url: string) {
    void this.read(url);
  }

  addEventListener(
    type: string,
    listener: (event: { data: string; lastEventId?: string }) => void,
  ) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  close() {
    this.closed = true;
    this.controller.abort();
  }

  private async read(url: string) {
    try {
      const response = await fetch(url, { signal: this.controller.signal });
      if (!response.body) {
        throw new Error("SSE response has no body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!this.closed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let separator = buffer.indexOf("\n\n");
        while (separator !== -1) {
          const frame = buffer.slice(0, separator);
          buffer = buffer.slice(separator + 2);
          this.dispatch(frame);
          separator = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if (!this.closed) {
        this.onerror?.(error);
      }
    }
  }

  private dispatch(frame: string) {
    if (!frame.trim()) return;

    let eventType = "message";
    let lastEventId: string | undefined;
    const data: string[] = [];

    for (const rawLine of frame.split(/\r?\n/)) {
      if (!rawLine || rawLine.startsWith(":")) continue;
      const colonIndex = rawLine.indexOf(":");
      const field = colonIndex === -1 ? rawLine : rawLine.slice(0, colonIndex);
      let value = colonIndex === -1 ? "" : rawLine.slice(colonIndex + 1);
      if (value.startsWith(" ")) {
        value = value.slice(1);
      }

      if (field === "event") {
        eventType = value || "message";
      } else if (field === "id") {
        lastEventId = value;
      } else if (field === "data") {
        data.push(value);
      }
    }

    const event = { data: data.join("\n"), lastEventId };
    if (eventType === "message") {
      this.onmessage?.(event);
    }
    for (const listener of this.listeners.get(eventType) ?? []) {
      listener(event);
    }
  }
}

describe("connectWebhookStream SSE integration", () => {
  it("receives typed SSE frames from an actual HTTP stream", async () => {
    const encoder = new TextEncoder();
    const server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  [
                    "id: uuid-typed-sse",
                    "event: SubscriptionRenewed",
                    `data: ${JSON.stringify(validEvent)}`,
                    "",
                    "",
                  ].join("\n"),
                ),
              );
              controller.close();
            },
          }),
          {
            headers: {
              "content-type": "text/event-stream",
              "cache-control": "no-cache",
            },
          },
        ),
    });

    let listener: { close(): void } | null = null;
    try {
      const event = await new Promise<WebhookEventPayload>(
        (resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Timed out waiting for SSE event")),
            2_000,
          );

          listener = connectWebhookStream({
            apiKey: "test-key",
            baseUrl: `http://127.0.0.1:${server.port}`,
            eventSourceFactory: (url) => new FetchEventSource(url),
            onEvent: (received) => {
              clearTimeout(timeout);
              resolve(received);
            },
            onError: (error) => {
              clearTimeout(timeout);
              reject(error);
            },
          });
        },
      );

      expect(event.id).toBe("uuid-typed-sse");
      expect(event.type).toBe("SubscriptionRenewed");
      expect(event.purchaseToken).toBe("token-typed-sse");
    } finally {
      listener?.close();
      server.stop(true);
    }
  });
});
