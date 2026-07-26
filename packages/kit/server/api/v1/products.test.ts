import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ConvexError } from "convex/values";

const mocks = vi.hoisted(() => ({
  handleConvexError: vi.fn(),
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
        getProductClientPayloadEditorStateWithApiKey:
          "getProductClientPayloadEditorStateWithApiKey",
      },
      mutation: {
        upsertProduct: "upsertProduct",
        setProductState: "setProductState",
        upsertProductClientPayloadWithApiKey:
          "upsertProductClientPayloadWithApiKey",
        removeProductClientPayloadWithApiKey:
          "removeProductClientPayloadWithApiKey",
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
  handleConvexError: mocks.handleConvexError,
}));

const { productsRoutes } = await import("./products");

function buildApp() {
  const app = new Hono();
  app.route("/products", productsRoutes);
  return app;
}

describe("productsRoutes", () => {
  beforeEach(() => {
    mocks.handleConvexError.mockReset();
    mocks.handleConvexError.mockReturnValue(null);
    mocks.query.mockReset();
    mocks.mutation.mockReset();
  });

  it("supports Bearer-authenticated admin routes without keys in URLs", async () => {
    const app = buildApp();
    const headers = {
      authorization: "Bearer openiap-kit_sk_admin",
      "content-type": "application/json",
    };

    mocks.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ _id: "job_1", status: "queued" });
    mocks.mutation
      .mockResolvedValueOnce({ id: "product_1", created: true })
      .mockResolvedValueOnce({ id: "product_1", state: "Active" })
      .mockResolvedValueOnce({ jobId: "job_1", deduped: false })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    const responses = await Promise.all([
      app.request("/products?platform=IOS", { headers }),
      app.request("/products", {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId: "coins_100",
          platform: "IOS",
          type: "Consumable",
          title: "100 coins",
        }),
      }),
      app.request("/products/state", {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId: "coins_100",
          platform: "IOS",
          state: "Active",
        }),
      }),
      app.request("/products/sync/ios?direction=pull&dryRun=true", {
        method: "POST",
        headers,
      }),
      app.request("/products/sync/jobs/job_1", { headers }),
      app.request("/products/sync/jobs/job_1/cancel", {
        method: "POST",
        headers,
      }),
      app.request("/products/coins_100?platform=IOS", {
        method: "DELETE",
        headers,
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 202, 200, 200, 200,
    ]);
    expect(mocks.query).toHaveBeenNthCalledWith(1, "listProducts", {
      apiKey: "openiap-kit_sk_admin",
      platform: "IOS",
    });
    expect(mocks.query).toHaveBeenNthCalledWith(2, "getSyncJobById", {
      apiKey: "openiap-kit_sk_admin",
      jobId: "job_1",
    });
    for (const [, args] of mocks.mutation.mock.calls) {
      expect(args).toMatchObject({ apiKey: "openiap-kit_sk_admin" });
    }
  });

  it("returns 403 before any catalog admin access with a publishable key", async () => {
    const app = buildApp();
    const headers = {
      authorization: "Bearer openiap-kit_pk_mobile",
      "content-type": "application/json",
    };
    const requests = [
      app.request("/products", {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId: "coins_100",
          platform: "IOS",
          type: "Consumable",
          title: "100 coins",
        }),
      }),
      app.request("/products/state", {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId: "coins_100",
          platform: "IOS",
          state: "Active",
        }),
      }),
      app.request("/products/sync/ios?direction=pull&dryRun=true", {
        method: "POST",
        headers,
      }),
      app.request("/products/sync/jobs/job_1", { headers }),
      app.request("/products/sync/jobs/job_1/cancel", {
        method: "POST",
        headers,
      }),
      app.request("/products/client-payload/coins_100?platform=IOS", {
        headers,
      }),
      app.request("/products/client-payload/coins_100?platform=IOS", {
        method: "PUT",
        headers,
        body: JSON.stringify({ format: "json", body: "{}" }),
      }),
      app.request(
        "/products/client-payload/coins_100?platform=IOS&expectedVersion=1",
        { method: "DELETE", headers },
      ),
      app.request("/products/coins_100?platform=IOS", {
        method: "DELETE",
        headers,
      }),
    ];

    for (const request of requests) {
      const response = await request;
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        errors: [
          {
            code: "INSUFFICIENT_SCOPE",
            message:
              "This operation requires a secret admin key. Publishable mobile keys cannot access administrative operations.",
          },
        ],
      });
    }
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("keeps publishable product and client-payload reads available", async () => {
    const app = buildApp();
    const headers = {
      authorization: "Bearer openiap-kit_pk_mobile",
    };
    const clientPayload = {
      format: "toml",
      body: 'tier = "premium"',
      version: 1,
      updatedAt: 123,
    };
    mocks.query
      .mockResolvedValueOnce({
        products: [{ productId: "premium", clientPayload }],
        hasMore: false,
      })
      .mockResolvedValueOnce(clientPayload);

    const listResponse = await app.request(
      "/products?platform=IOS&includeClientPayload=true",
      { headers },
    );
    const payloadResponse = await app.request(
      "/products/openiap-kit_pk_mobile/premium/client-payload?platform=IOS",
    );

    expect(listResponse.status).toBe(200);
    expect(payloadResponse.status).toBe(200);
    await expect(payloadResponse.json()).resolves.toEqual({
      clientPayload,
    });
    expect(mocks.query).toHaveBeenNthCalledWith(
      1,
      "listProductsWithClientPayloads",
      {
        apiKey: "openiap-kit_pk_mobile",
        platform: "IOS",
        limit: 25,
      },
    );
    expect(mocks.query).toHaveBeenNthCalledWith(2, "getProductClientPayload", {
      apiKey: "openiap-kit_pk_mobile",
      productId: "premium",
      platform: "IOS",
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("requires Bearer authentication on keyless admin routes", async () => {
    const app = buildApp();
    const response = await app.request("/products/sync/ios", {
      method: "POST",
    });

    expect(response.status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("retires secret-key-in-path product routes", async () => {
    const app = buildApp();
    const response = await app.request(
      "/products/openiap-kit_sk_secret/sync/ios",
      { method: "POST" },
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      errors: [
        {
          code: "SECRET_API_KEY_IN_URL",
          message:
            "Secret API keys are not accepted in URLs. Use Authorization: Bearer <secret-key> on the canonical route.",
        },
      ],
    });
    expect(mocks.mutation).not.toHaveBeenCalled();
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

  it("serves the product client-payload read endpoint", async () => {
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

  it("serves the secret-key editor revision after payload deletion", async () => {
    const app = buildApp();
    mocks.query.mockResolvedValueOnce({ expectedVersion: 4 });

    const response = await app.request(
      "/products/client-payload/premium.monthly?platform=IOS",
      {
        headers: { authorization: "Bearer openiap-kit_sk_secret" },
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ expectedVersion: 4 });
    expect(mocks.query).toHaveBeenCalledWith(
      "getProductClientPayloadEditorStateWithApiKey",
      {
        apiKey: "openiap-kit_sk_secret",
        productId: "premium.monthly",
        platform: "IOS",
      },
    );
  });

  it("forwards secret-key client-payload updates and removals", async () => {
    const app = buildApp();
    mocks.mutation
      .mockResolvedValueOnce({
        id: "payload-id",
        created: true,
        changed: true,
        version: 1,
        updatedAt: 123,
      })
      .mockResolvedValueOnce({ ok: true });

    const updateResponse = await app.request(
      "/products/client-payload/premium.monthly?platform=IOS",
      {
        method: "PUT",
        headers: {
          authorization: "Bearer openiap-kit_sk_secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          format: "toml",
          body: 'rule = "premium"',
          expectedVersion: 0,
        }),
      },
    );
    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      version: 1,
      changed: true,
    });
    expect(mocks.mutation).toHaveBeenNthCalledWith(
      1,
      "upsertProductClientPayloadWithApiKey",
      {
        apiKey: "openiap-kit_sk_secret",
        productId: "premium.monthly",
        platform: "IOS",
        format: "toml",
        body: 'rule = "premium"',
        expectedVersion: 0,
      },
    );

    const removeResponse = await app.request(
      "/products/client-payload/premium.monthly?platform=IOS&expectedVersion=1",
      {
        method: "DELETE",
        headers: { authorization: "Bearer openiap-kit_sk_secret" },
      },
    );
    expect(removeResponse.status).toBe(200);
    await expect(removeResponse.json()).resolves.toEqual({ ok: true });
    expect(mocks.mutation).toHaveBeenNthCalledWith(
      2,
      "removeProductClientPayloadWithApiKey",
      {
        apiKey: "openiap-kit_sk_secret",
        productId: "premium.monthly",
        platform: "IOS",
        expectedVersion: 1,
      },
    );
  });

  it("accepts a fully escaped 16 KiB text client payload envelope", async () => {
    const app = buildApp();
    const payloadBody = "\0".repeat(16 * 1024);
    const encodedBody = JSON.stringify({
      format: "text",
      body: payloadBody,
      expectedVersion: 0,
    });
    expect(new TextEncoder().encode(encodedBody).byteLength).toBeGreaterThan(
      64 * 1024,
    );
    mocks.mutation.mockResolvedValueOnce({
      id: "payload-id",
      created: true,
      changed: true,
      version: 1,
      updatedAt: 123,
    });

    const response = await app.request(
      "/products/client-payload/premium.monthly?platform=IOS",
      {
        method: "PUT",
        headers: {
          authorization: "Bearer openiap-kit_sk_secret",
          "content-type": "application/json",
        },
        body: encodedBody,
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledWith(
      "upsertProductClientPayloadWithApiKey",
      expect.objectContaining({ body: payloadBody }),
    );
  });

  it("requires a Bearer key for client-payload writes", async () => {
    const app = buildApp();
    const response = await app.request(
      "/products/client-payload/premium?platform=IOS",
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ format: "json", body: "{}" }),
      },
    );

    expect(response.status).toBe(401);
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("validates client-payload write inputs before Convex", async () => {
    const app = buildApp();
    const headers = {
      authorization: "Bearer openiap-kit_sk_secret",
      "content-type": "application/json",
    };
    const cases = [
      app.request("/products/client-payload/premium?platform=IOS", {
        method: "PUT",
        headers,
        body: JSON.stringify({ format: "yaml", body: "rule: premium" }),
      }),
      app.request("/products/client-payload/premium?platform=IOS", {
        method: "PUT",
        headers,
        body: JSON.stringify({ format: "json", body: {} }),
      }),
      app.request("/products/client-payload/premium?platform=IOS", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          format: "json",
          body: "{}",
          expectedVersion: -1,
        }),
      }),
      app.request(
        "/products/client-payload/premium?platform=IOS&expectedVersion=1.5",
        {
          method: "DELETE",
          headers: { authorization: "Bearer openiap-kit_sk_secret" },
        },
      ),
    ];

    for (const responsePromise of cases) {
      const response = await responsePromise;
      expect(response.status).toBe(400);
    }
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it("maps backend scope failures for legacy keys to HTTP 403", async () => {
    const app = buildApp();
    const scopeError = {
      code: "INSUFFICIENT_SCOPE",
      message: "This operation requires a secret admin key.",
    };
    mocks.mutation.mockRejectedValueOnce(new Error("scope"));
    mocks.handleConvexError.mockReturnValueOnce(scopeError);

    const response = await app.request(
      "/products/client-payload/premium?platform=IOS",
      {
        method: "PUT",
        headers: {
          authorization: "Bearer openiap-kit_legacy",
          "content-type": "application/json",
        },
        body: JSON.stringify({ format: "json", body: "{}" }),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ errors: [scopeError] });
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
