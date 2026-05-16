import { afterEach, describe, expect, it, vi } from "vitest";

import {
  kitClient,
  normalizeKitBaseUrl,
  redactKitApiKeyPath,
} from "../src/kit-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("redactKitApiKeyPath", () => {
  it("redacts api key path segments from known kit routes", () => {
    expect(redactKitApiKeyPath("/v1/products/custom-secret?platform=IOS")).toBe(
      "/v1/products/<api-key-redacted>?platform=IOS",
    );
    expect(
      redactKitApiKeyPath("/v1/subscriptions/status/custom-secret?userId=u1"),
    ).toBe("/v1/subscriptions/status/<api-key-redacted>?userId=u1");
    expect(
      redactKitApiKeyPath("/v1/subscriptions/bind-user/custom-secret"),
    ).toBe("/v1/subscriptions/bind-user/<api-key-redacted>");
    expect(redactKitApiKeyPath("/v1/webhooks/google/custom-secret")).toBe(
      "/v1/webhooks/google/<api-key-redacted>",
    );
    expect(redactKitApiKeyPath("/v1/webhooks/custom-secret")).toBe(
      "/v1/webhooks/<api-key-redacted>",
    );
    expect(redactKitApiKeyPath("/api/v1/webhooks/custom-secret")).toBe(
      "/api/v1/webhooks/<api-key-redacted>",
    );
    expect(redactKitApiKeyPath("/v1/products/custom-secret/state")).toBe(
      "/v1/products/<api-key-redacted>/state",
    );
  });
});

describe("normalizeKitBaseUrl", () => {
  it("normalizes http(s) base URLs without credentials", () => {
    expect(normalizeKitBaseUrl("https://kit.example/")).toBe(
      "https://kit.example",
    );
    expect(normalizeKitBaseUrl("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });

  it("rejects base URLs with credentials or non-http protocols", () => {
    expect(() => normalizeKitBaseUrl("https://user:pass@kit.example")).toThrow(
      "kit baseUrl must not include credentials",
    );
    expect(() => normalizeKitBaseUrl("ftp://kit.example")).toThrow(
      "kit baseUrl must use http or https",
    );
    expect(() => normalizeKitBaseUrl("https://kit.example?token=secret")).toThrow(
      "kit baseUrl must not include query or fragment",
    );
  });
});

describe("kitClient", () => {
  it("forwards subscription metadata when creating products", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ id: "product-id", created: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = kitClient({
      apiKey: "custom-secret",
      baseUrl: "https://kit.example",
    });

    await expect(
      client.upsertProduct({
        productId: "premium_monthly",
        platform: "IOS",
        type: "Subscription",
        title: "Premium",
        billingPeriod: "P1M",
        subscriptionGroupName: "premium_tiers",
        reviewNote: "Sandbox review note",
      }),
    ).resolves.toEqual({ id: "product-id", created: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://kit.example/v1/products/custom-secret",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          productId: "premium_monthly",
          platform: "IOS",
          type: "Subscription",
          title: "Premium",
          billingPeriod: "P1M",
          subscriptionGroupName: "premium_tiers",
          reviewNote: "Sandbox review note",
        }),
      }),
    );
  });

  it("parses JSON response content types case-insensitively", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ products: [] }), {
        status: 200,
        headers: {
          "content-type": "Application/VND.OPENIAP+JSON ; Charset=UTF-8",
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = kitClient({
      apiKey: "custom-secret",
      baseUrl: "https://kit.example",
    });

    await expect(client.listProducts()).resolves.toEqual({ products: [] });
  });

  it("does not expose custom api keys in HTTP error messages", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ errors: [] }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = kitClient({
      apiKey: "custom-secret",
      baseUrl: "https://kit.example",
    });

    await expect(client.listProducts()).rejects.toThrow(
      "kit /v1/products/<api-key-redacted> returned 403",
    );
  });
});
