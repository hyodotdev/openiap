import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("@/convex", () => ({
  api: {
    products: {
      query: {
        listProducts: "listProducts",
      },
      mutation: {
        upsertProduct: "upsertProduct",
        setProductState: "setProductState",
        removeProduct: "removeProduct",
      },
      jobs: {
        enqueueProductSync: "enqueueProductSync",
        getSyncJobById: "getSyncJobById",
        cancelProductSync: "cancelProductSync",
      },
    },
  },
}));

vi.mock("../../convex", () => ({
  client: {
    query: mocks.query,
    mutation: mocks.mutation,
  },
  handleConvexError: () => null,
}));

const { productsRoutes } = await import("./products");

function buildApp() {
  const app = new Hono();
  app.route("/products", productsRoutes);
  return app;
}

describe("productsRoutes", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.mutation.mockReset();
  });

  it("rejects oversized path apiKey before calling Convex", async () => {
    const app = buildApp();
    const response = await app.request(`/products/${"a".repeat(129)}`);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      errors: [{ code: "INVALID_API_KEY", message: "API key is too long" }],
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects blank path apiKey before calling Convex", async () => {
    const app = buildApp();
    const response = await app.request("/products/%20%20");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      errors: [{ code: "INVALID_API_KEY", message: "API key is required" }],
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects oversized productId inputs before calling Convex", async () => {
    const app = buildApp();
    const productId = "p".repeat(257);

    const cases = [
      app.request("/products/key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          platform: "IOS",
          type: "Subscription",
          title: "Premium",
        }),
      }),
      app.request("/products/key/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          platform: "IOS",
          state: "Draft",
        }),
      }),
      app.request(`/products/key/${productId}?platform=IOS`, {
        method: "DELETE",
      }),
    ];

    for (const responsePromise of cases) {
      const response = await responsePromise;
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        errors: [
          { code: "INVALID_INPUT", message: "productId must be ≤ 256 chars" },
        ],
      });
    }

    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects blank productId path params before calling Convex", async () => {
    const app = buildApp();

    const response = await app.request("/products/key/%20%20?platform=IOS", {
      method: "DELETE",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        { code: "INVALID_INPUT", message: "productId must not be empty" },
      ],
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects oversized product bodies before calling Convex", async () => {
    const app = buildApp();

    const response = await app.request("/products/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId: "premium_monthly",
        platform: "IOS",
        type: "Subscription",
        title: "Premium",
        description: "x".repeat(64 * 1024),
      }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      errors: [
        { code: "PAYLOAD_TOO_LARGE", message: "Product payload is too large" },
      ],
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects oversized product content-length before reading the body", async () => {
    const app = buildApp();

    const response = await app.request("/products/key", {
      method: "POST",
      headers: { "content-length": String(64 * 1024 + 1) },
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      errors: [
        { code: "PAYLOAD_TOO_LARGE", message: "Product payload is too large" },
      ],
    });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects non-object product bodies before calling Convex", async () => {
    const app = buildApp();
    const cases = [
      [
        app.request("/products/key", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "null",
        }),
        {
          code: "INVALID_INPUT",
          message: "productId, platform, type, title are required",
        },
      ],
      [
        app.request("/products/key/state", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "null",
        }),
        {
          code: "INVALID_INPUT",
          message: "productId, platform, state are required",
        },
      ],
    ] as const;

    for (const [responsePromise, error] of cases) {
      const response = await responsePromise;
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ errors: [error] });
    }

    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects invalid product enum inputs before calling Convex", async () => {
    const app = buildApp();

    const cases = [
      [
        app.request("/products/key?platform=Web"),
        { code: "INVALID_INPUT", message: "platform must be IOS|Android" },
      ],
      [
        app.request("/products/key", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productId: "premium_monthly",
            platform: "IOS",
            type: "Rental",
            title: "Premium",
          }),
        }),
        {
          code: "INVALID_INPUT",
          message: "type must be Subscription|NonConsumable|Consumable",
        },
      ],
      [
        app.request("/products/key/state", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productId: "premium_monthly",
            platform: "IOS",
            state: "Deleted",
          }),
        }),
        {
          code: "INVALID_INPUT",
          message: "state must be Draft|Ready|Active|Removed",
        },
      ],
    ] as const;

    for (const [responsePromise, error] of cases) {
      const response = await responsePromise;
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ errors: [error] });
    }

    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects invalid product string fields before calling Convex", async () => {
    const app = buildApp();
    const cases = [
      [
        {
          productId: "   ",
          platform: "IOS",
          type: "Subscription",
          title: "Premium",
          subscriptionGroupName: "premium_tiers",
        },
        {
          code: "INVALID_INPUT",
          message: "productId, platform, type, title are required",
        },
      ],
      [
        {
          productId: "premium_monthly",
          platform: "IOS",
          type: "Subscription",
          title: "   ",
          subscriptionGroupName: "premium_tiers",
        },
        {
          code: "INVALID_INPUT",
          message: "productId, platform, type, title are required",
        },
      ],
      [
        {
          productId: "premium_monthly",
          platform: "IOS",
          type: "Subscription",
          title: 42,
          subscriptionGroupName: "premium_tiers",
        },
        { code: "INVALID_INPUT", message: "title must be a string" },
      ],
      [
        {
          productId: "premium_monthly",
          platform: "IOS",
          type: "Subscription",
          title: "Premium",
          subscriptionGroupName: {},
        },
        {
          code: "INVALID_INPUT",
          message:
            "description, currency, subscriptionGroupName, reviewNote, storeRef must be strings",
        },
      ],
    ] as const;

    for (const [body, error] of cases) {
      const response = await app.request("/products/key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ errors: [error] });
    }

    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects invalid product prices before calling Convex", async () => {
    const app = buildApp();

    const cases = [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "990000"] as const;

    for (const priceAmountMicros of cases) {
      const response = await app.request("/products/key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: "premium_monthly",
          platform: "IOS",
          type: "Subscription",
          title: "Premium",
          subscriptionGroupName: "premium_tiers",
          priceAmountMicros,
        }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        errors: [
          {
            code: "INVALID_INPUT",
            message: "priceAmountMicros must be a non-negative safe integer",
          },
        ],
      });
    }

    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects invalid sync query params before calling Convex", async () => {
    const app = buildApp();
    const cases = [
      [
        app.request("/products/key/sync/ios?direction=sideways", {
          method: "POST",
        }),
        {
          code: "INVALID_INPUT",
          message: "direction must be pull|push|both|purge-local",
        },
      ],
      [
        app.request("/products/key/sync/ios?dryRun=banana", {
          method: "POST",
        }),
        {
          code: "INVALID_INPUT",
          message: "dryRun must be true|false",
        },
      ],
    ] as const;

    for (const [responsePromise, error] of cases) {
      const response = await responsePromise;
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ errors: [error] });
    }
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("enqueues product sync jobs", async () => {
    const app = buildApp();
    mocks.mutation.mockResolvedValueOnce({
      jobId: "job_123",
      deduped: false,
    });

    const response = await app.request(
      "/products/key/sync/android?direction=push&dryRun=true",
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      jobId: "job_123",
      deduped: false,
    });
    expect(mocks.mutation).toHaveBeenCalledWith("enqueueProductSync", {
      apiKey: "key",
      platform: "Android",
      direction: "push",
      dryRun: true,
    });
  });

  it("rejects oversized sync job ids before calling Convex", async () => {
    const app = buildApp();
    const jobId = "j".repeat(257);

    const cases = [
      app.request(`/products/key/sync/jobs/${jobId}`),
      app.request(`/products/key/sync/jobs/${jobId}/cancel`, {
        method: "POST",
      }),
    ];

    for (const responsePromise of cases) {
      const response = await responsePromise;
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        errors: [
          { code: "INVALID_INPUT", message: "jobId must be ≤ 256 chars" },
        ],
      });
    }

    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("rejects blank sync job ids before calling Convex", async () => {
    const app = buildApp();

    const cases = [
      app.request("/products/key/sync/jobs/%20%20"),
      app.request("/products/key/sync/jobs/%20%20/cancel", {
        method: "POST",
      }),
    ];

    for (const responsePromise of cases) {
      const response = await responsePromise;
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        errors: [{ code: "INVALID_INPUT", message: "jobId must not be empty" }],
      });
    }

    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("requires iOS subscription group names before calling Convex", async () => {
    const app = buildApp();

    const response = await app.request("/products/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId: "premium_monthly",
        platform: "IOS",
        type: "Subscription",
        title: "Premium",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "INVALID_INPUT",
          message:
            "subscriptionGroupName is required for iOS Subscription products",
        },
      ],
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("forwards subscription metadata to Convex", async () => {
    const app = buildApp();
    mocks.mutation.mockResolvedValueOnce({ id: "product-id", created: true });

    const response = await app.request("/products/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId: "premium_monthly",
        platform: "IOS",
        type: "Subscription",
        title: "Premium",
        billingPeriod: "P1M",
        subscriptionGroupName: "premium_tiers",
        reviewNote: "Sandbox review note",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "product-id",
      created: true,
    });
    expect(mocks.mutation).toHaveBeenCalledWith("upsertProduct", {
      apiKey: "key",
      productId: "premium_monthly",
      platform: "IOS",
      type: "Subscription",
      title: "Premium",
      description: undefined,
      priceAmountMicros: undefined,
      currency: undefined,
      billingPeriod: "P1M",
      subscriptionGroupName: "premium_tiers",
      reviewNote: "Sandbox review note",
      state: undefined,
      storeRef: undefined,
    });
  });

  it("does not return raw internal product mutation errors", async () => {
    const app = buildApp();
    mocks.mutation.mockRejectedValueOnce(
      new Error("database password leaked in stack"),
    );

    const response = await app.request("/products/key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId: "premium_monthly",
        platform: "IOS",
        type: "Subscription",
        title: "Premium",
        subscriptionGroupName: "premium_tiers",
      }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "PRODUCT_UPSERT_FAILED",
          message: "Product upsert failed",
        },
      ],
    });
    expect(mocks.mutation).toHaveBeenCalledOnce();
  });

  it("does not return raw internal product list errors", async () => {
    const app = buildApp();
    mocks.query.mockRejectedValueOnce(new Error("internal query detail"));

    const response = await app.request("/products/key");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "PRODUCT_LIST_FAILED",
          message: "Product list failed",
        },
      ],
    });
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it("does not return raw internal product delete errors", async () => {
    const app = buildApp();
    mocks.mutation.mockRejectedValueOnce(new Error("internal delete detail"));

    const response = await app.request(
      "/products/key/premium_monthly?platform=IOS",
      { method: "DELETE" },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "PRODUCT_REMOVE_FAILED",
          message: "Product remove failed",
        },
      ],
    });
    expect(mocks.mutation).toHaveBeenCalledOnce();
  });
});
