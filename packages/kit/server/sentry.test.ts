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
