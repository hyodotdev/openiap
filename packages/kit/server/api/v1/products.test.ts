import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ConvexError } from "convex/values";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("@/convex", () => ({
  api: {
    products: {
      query: {
        listProducts: "listProducts",
        listProductsWithClientPayloads: "listProductsWithClientPayloads",
        getProductClientPayload: "getProductClientPayload",
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

  it("strictly parses and forwards the bounded client-payload list opt-in", async () => {
    const app = buildApp();
    mocks.query.mockResolvedValueOnce({
      products: [{ productId: "premium" }],
      hasMore: true,
      nextCursor: "opaque/next=2",
    });

    const response = await app.request(
      "/products/key?platform=IOS&includeClientPayload=true&limit=10&cursor=opaque%2Fstart%3D1",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      products: [{ productId: "premium" }],
      hasMore: true,
      nextCursor: "opaque/next=2",
    });
    expect(mocks.query).toHaveBeenLastCalledWith(
      "listProductsWithClientPayloads",
      {
        apiKey: "key",
        platform: "IOS",
        limit: 10,
        cursor: "opaque/start=1",
      },
    );

    mocks.query.mockResolvedValue([]);
    const explicitFalse = await app.request(
      "/products/key?platform=IOS&includeClientPayload=false",
    );
    expect(explicitFalse.status).toBe(200);
    await expect(explicitFalse.json()).resolves.toEqual({ products: [] });
    expect(mocks.query).toHaveBeenLastCalledWith("listProducts", {
      apiKey: "key",
      platform: "IOS",
    });

    mocks.query.mockClear();
    const invalid = await app.request(
      "/products/key?includeClientPayload=TRUE",
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({
      errors: [
        {
          code: "INVALID_INPUT",
          message: "includeClientPayload must be true|false",
        },
      ],
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("requires a platform and validates payload-page inputs before Convex", async () => {
    const app = buildApp();
    const cases = [
      [
        "/products/key?includeClientPayload=true",
        "platform is required when includeClientPayload=true",
      ],
      [
        "/products/key?platform=IOS&includeClientPayload=true&limit=0",
        "limit must be an integer between 1 and 50",
      ],
      [
        "/products/key?platform=IOS&includeClientPayload=true&limit=51",
        "limit must be an integer between 1 and 50",
      ],
      [
        "/products/key?platform=IOS&includeClientPayload=true&limit=1.5",
        "limit must be an integer between 1 and 50",
      ],
      [
        "/products/key?platform=IOS&includeClientPayload=true&cursor=%20",
        "cursor must be a non-empty string of at most 4096 characters",
      ],
    ] as const;

    for (const [url, message] of cases) {
      const response = await app.request(url);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        errors: [{ code: "INVALID_INPUT", message }],
      });
    }
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("keeps ignoring payload-page params on the legacy default path", async () => {
    const app = buildApp();
    mocks.query.mockResolvedValue([]);

    for (const cursor of ["legacy-value", "%20", "x".repeat(4097)]) {
      const response = await app.request(
        `/products/key?platform=IOS&limit=not-a-number&cursor=${cursor}`,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ products: [] });
      expect(mocks.query).toHaveBeenLastCalledWith("listProducts", {
        apiKey: "key",
        platform: "IOS",
      });
    }
  });

  it("uses the 25-item payload page default", async () => {
    const app = buildApp();
    mocks.query.mockResolvedValueOnce({ products: [], hasMore: false });

    const response = await app.request(
      "/products/key?platform=Android&includeClientPayload=true",
    );

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("listProductsWithClientPayloads", {
      apiKey: "key",
      platform: "Android",
      limit: 25,
    });
  });

  it("returns a restartable 400 when catalog churn invalidates a cursor", async () => {
    const app = buildApp();
    mocks.query.mockRejectedValueOnce(
      new ConvexError({
        isConvexSystemError: true,
        paginationError: "InvalidCursor",
      }),
    );

    const response = await app.request(
      "/products/key?platform=IOS&includeClientPayload=true&cursor=stale",
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "INVALID_CURSOR",
          message:
            "cursor is no longer valid; restart from the first page without cursor",
        },
      ],
    });
  });

  it("keeps the default product list read opted out", async () => {
    const app = buildApp();
    mocks.query.mockResolvedValueOnce([]);

    const response = await app.request("/products/key");

    expect(response.status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith("listProducts", {
      apiKey: "key",
      platform: undefined,
    });
  });

  it("serves the read-only product client-payload endpoint", async () => {
    const app = buildApp();
    const clientPayload = {
      format: "toml",
      body: 'rule = "premium"',
      version: 3,
      updatedAt: 123,
    };
    mocks.query.mockResolvedValueOnce(clientPayload);

    const response = await app.request(
      "/products/key/premium.monthly/client-payload?platform=Android",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ clientPayload });
    expect(mocks.query).toHaveBeenCalledWith("getProductClientPayload", {
      apiKey: "key",
      productId: "premium.monthly",
      platform: "Android",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing client payload", async () => {
    const app = buildApp();
    mocks.query.mockResolvedValueOnce(null);

    const response = await app.request(
      "/products/key/premium.monthly/client-payload?platform=IOS",
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "NOT_FOUND",
          message: "Product client payload not found",
        },
      ],
    });
  });

  it("validates direct client-payload lookup inputs before Convex", async () => {
    const app = buildApp();
    const cases = [
      app.request("/products/key/premium/client-payload"),
      app.request("/products/key/premium/client-payload?platform=Web"),
      app.request(
        `/products/key/${"p".repeat(257)}/client-payload?platform=IOS`,
      ),
    ];

    for (const responsePromise of cases) {
      const response = await responsePromise;
      expect(response.status).toBe(400);
    }
    expect(mocks.query).not.toHaveBeenCalled();
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
