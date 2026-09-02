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

  it("scrubs URL, credential, and account attributes from trace spans", () => {
    const secret = "openiap-kit_pk_live_SECRET";
    const pii = "user-private";
    const rawUrl = `https://kit.openiap.dev/v1/subscriptions/status/${secret}?userId=${pii}`;
    const traceData = {
      "url.full": rawUrl,
      "url.path": `/v1/subscriptions/status/${secret}`,
      "url.query": `?userId=${pii}`,
      "url.path.parameter.apiKey": secret,
      "http.request.header.authorization": `Bearer ${secret}`,
      "http.request.body": { purchaseToken: "receipt-secret" },
      "http.request.method": "GET",
    };
    const event = scrubSentryEvent({
      contexts: { trace: { data: { ...traceData } } },
      spans: [
        {
          description: `GET ${rawUrl}`,
          data: { ...traceData },
        },
      ],
    });
    expect(event.contexts?.trace?.data).toEqual({
      "url.full": "https://kit.openiap.dev/v1/subscriptions/status/redacted",
      "url.path": "/v1/subscriptions/status/redacted",
      "http.request.method": "GET",
    });
    expect(event.spans?.[0].data).toEqual(event.contexts?.trace?.data);
    expect(event.spans?.[0].description).toBe(
      "GET https://kit.openiap.dev/v1/subscriptions/status/redacted",
    );
    expect(JSON.stringify(event)).not.toContain(secret);
    expect(JSON.stringify(event)).not.toContain(pii);
  });

  it("leaves events without URL-shaped fields untouched", () => {
    expect(scrubSentryEvent({})).toEqual({});
    const event = scrubSentryEvent({ request: {} });
    expect(event.request).toEqual({});
  });
});
