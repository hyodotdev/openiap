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
    expect(() =>
      normalizeKitBaseUrl("https://kit.example?token=secret"),
    ).toThrow("kit baseUrl must not include query or fragment");
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
      "https://kit.example/v1/products",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer custom-secret",
        }),
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

  it("forwards explicit and cleared sales-region states", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "product-id", created: false }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = kitClient({
      apiKey: "custom-secret",
      baseUrl: "https://kit.example",
    });

    for (const regions of ["all", []] as const) {
      await client.upsertProduct({
        productId: "coins",
        platform: "Android",
        type: "Consumable",
        title: "Coins",
        regions,
      });
      expect(fetchMock).toHaveBeenLastCalledWith(
        "https://kit.example/v1/products",
        expect.objectContaining({
          body: JSON.stringify({
            productId: "coins",
            platform: "Android",
            type: "Consumable",
            title: "Coins",
            regions,
          }),
        }),
      );
    }
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
    expect(fetchMock).toHaveBeenCalledWith(
      "https://kit.example/v1/products",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer custom-secret",
        }),
      }),
    );
  });

  it("calls revenue and sync endpoints with encoded query params", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = kitClient({
      apiKey: "custom-secret",
      baseUrl: "https://kit.example",
    });

    await client.revenueMetrics({
      fromDay: "2026-06-01",
      toDay: "2026-06-04",
    });
    await client.syncProducts({
      platform: "Android",
      direction: "purge-local",
      dryRun: true,
    });
    await client.syncJob("job/with slash");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://kit.example/v1/subscriptions/revenue?fromDay=2026-06-01&toDay=2026-06-04",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer custom-secret",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://kit.example/v1/products/sync/android?direction=purge-local&dryRun=true",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer custom-secret",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://kit.example/v1/products/sync/jobs/job%2Fwith%20slash",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer custom-secret",
        }),
      }),
    );
  });

  it("writes and removes client payloads through the admin endpoints", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = kitClient({
      apiKey: "openiap-kit_sk_admin",
      baseUrl: "https://kit.example",
    });

    await client.setClientPayload({
      productId: "premium/monthly",
      platform: "IOS",
      format: "toml",
      body: 'rule = "premium"',
      expectedVersion: 2,
    });
    await client.removeClientPayload({
      productId: "premium/monthly",
      platform: "IOS",
      expectedVersion: 3,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://kit.example/v1/products/client-payload/premium%2Fmonthly?platform=IOS",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          authorization: "Bearer openiap-kit_sk_admin",
        }),
        body: JSON.stringify({
          format: "toml",
          body: 'rule = "premium"',
          expectedVersion: 2,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://kit.example/v1/products/client-payload/premium%2Fmonthly?platform=IOS&expectedVersion=3",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          authorization: "Bearer openiap-kit_sk_admin",
        }),
      }),
    );
  });

  it("reads the durable client-payload editor revision", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ expectedVersion: 4 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = kitClient({
      apiKey: "openiap-kit_sk_admin",
      baseUrl: "https://kit.example",
    });
    await expect(
      client.getClientPayloadState({
        productId: "premium/monthly",
        platform: "IOS",
      }),
    ).resolves.toEqual({ expectedVersion: 4 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://kit.example/v1/products/client-payload/premium%2Fmonthly?platform=IOS",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer openiap-kit_sk_admin",
        }),
      }),
    );
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
      "kit /v1/products returned 403",
    );
  });
});
