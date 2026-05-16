import { afterEach, describe, expect, it, vi } from "vitest";

import { kitClient, normalizeKitBaseUrl } from "../src/kit-client";

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("includes the full kit path in HTTP error messages", async () => {
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
      "kit /v1/products/custom-secret returned 403",
    );
  });
});
