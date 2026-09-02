import { describe, expect, it } from "vitest";

import { scrubSentryEvent } from "./sentry";

describe("scrubSentryEvent", () => {
  it("redacts path-carried API keys and drops the query string", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://kit.openiap.dev/v1/subscriptions/status/openiap-kit_pk_live_abc?userId=user-1",
        query_string: "userId=user-1",
      },
    });
    expect(event.request?.url).toBe(
      "https://kit.openiap.dev/v1/subscriptions/status/redacted",
    );
    expect(event.request && "query_string" in event.request).toBe(false);
  });

  it("redacts legacy path keys without relying on a scoped prefix", () => {
    const event = scrubSentryEvent({
      request: {
        url: "https://kit.openiap.dev/v1/subscriptions/status/legacy-project-key?userId=user-1",
      },
      transaction: "GET /v1/products/legacy-project-key",
    });
    expect(event.request?.url).toBe(
      "https://kit.openiap.dev/v1/subscriptions/status/redacted",
    );
    expect(event.transaction).toBe("GET /v1/products/redacted");
  });

  it("drops request credentials and purchase evidence", () => {
    const event = scrubSentryEvent({
      request: {
        headers: {
          Authorization: "Bearer openiap-kit_sk_live_secret",
          Cookie: "session=secret",
          "content-type": "application/json",
        },
        cookies: { session: "secret" },
        data: { purchaseToken: "receipt-secret" },
      },
    });
    expect(event.request).toEqual({
      headers: { "content-type": "application/json" },
    });
  });

  it("redacts keys embedded in transaction names", () => {
    const event = scrubSentryEvent({
      transaction: "GET /v1/products/openiap-kit_sk_live_abc",
    });
    expect(event.transaction).toBe("GET /v1/products/redacted");
  });

  it("leaves events without URL-shaped fields untouched", () => {
    expect(scrubSentryEvent({})).toEqual({});
    const event = scrubSentryEvent({ request: {} });
    expect(event.request).toEqual({});
  });
});
