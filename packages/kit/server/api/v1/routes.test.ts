import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";

vi.mock("hono/bun", () => ({
  getConnInfo: () => ({ remote: { address: "127.0.0.1" } }),
}));

const convexClientMock = vi.hoisted(() => ({
  action: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../../convex", () => ({
  client: convexClientMock,
  handleConvexError: () => null,
}));

const { apiRoutes } = await import("./routes");

describe("apiRoutes", () => {
  // The request logger writes one JSON line per request to stdout; capturing it
  // is the only way to assert what an operator actually sees.
  let logLines: Array<Record<string, unknown>>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    convexClientMock.action.mockReset();
    convexClientMock.mutation.mockReset();
    convexClientMock.query.mockReset();
    logLines = [];
    logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      const [first] = args;
      if (typeof first !== "string") return;
      try {
        logLines.push(JSON.parse(first) as Record<string, unknown>);
      } catch {
        // Not a structured line; ignore.
      }
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("serves the generated OpenAPI specification", async () => {
    const response = await apiRoutes.request("/openapi");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as {
      openapi: string;
      paths: Record<
        string,
        { post?: { operationId?: string; responses?: Record<string, unknown> } }
      >;
    };
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths["/purchase/verify"]?.post?.operationId).toBe(
      "verifyPurchase",
    );
    expect(body.paths["/purchase/verify"]?.post?.responses).toHaveProperty(
      "503",
    );
    expect(
      body.paths["/purchase/verify"]?.post?.responses?.["200"],
    ).toHaveProperty("headers.X-Concurrency-Scope");
    expect(
      body.paths["/purchase/verify"]?.post?.responses?.["500"],
    ).toHaveProperty("headers.X-RateLimit-Limit");
    expect(
      body.paths["/purchase/verify"]?.post?.responses?.["500"],
    ).toHaveProperty("headers.X-RateLimit-Remaining");
  });

  it("returns the verified productId from purchase verification", async () => {
    convexClientMock.action.mockResolvedValueOnce({
      isValid: true,
      state: "ENTITLED",
      productId: "premium.monthly",
    });

    const response = await apiRoutes.request("/purchase/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer route-test-product",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store: "google",
        purchaseToken: "token".repeat(8),
        expectedProductId: "premium.monthly",
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Concurrency-Limit")).toBe("8");
    expect(response.headers.get("X-Concurrency-Remaining")).toBe("7");
    expect(response.headers.get("X-Concurrency-Scope")).toBe("key");
    expect(await response.json()).toEqual({
      store: "google",
      isValid: true,
      state: "ENTITLED",
      productId: "premium.monthly",
    });
    expect(convexClientMock.action).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        apiKey: "route-test-product",
        purchaseToken: "token".repeat(8),
        expectedProductId: "premium.monthly",
      }),
    );
    expect(convexClientMock.query).not.toHaveBeenCalled();
  });

  it("forwards Amazon sandbox and expected product checks and exposes the RVS environment", async () => {
    convexClientMock.action.mockResolvedValueOnce({
      isValid: true,
      state: "ENTITLED",
      productId: "amazon.premium.monthly",
      environment: "Sandbox",
    });

    const response = await apiRoutes.request("/purchase/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer route-test-amazon-forwarding",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store: "amazon",
        userId: "amzn1.account.ABC123",
        receiptId: "amzn1.receipt.ABC123456789=:1",
        sandbox: true,
        expectedProductId: "amazon.premium.monthly",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      store: "amazon",
      isValid: true,
      state: "ENTITLED",
      productId: "amazon.premium.monthly",
      environment: "Sandbox",
    });
    expect(convexClientMock.action).toHaveBeenCalledOnce();
    const [functionReference, args] = convexClientMock.action.mock.calls[0];
    expect(getFunctionName(functionReference)).toBe(
      "purchases/amazon:verifyAmazonReceiptInternalV1",
    );
    expect(args).toEqual({
      apiKey: "route-test-amazon-forwarding",
      userId: "amzn1.account.ABC123",
      receiptId: "amzn1.receipt.ABC123456789=:1",
      sandbox: true,
      expectedProductId: "amazon.premium.monthly",
      requestIp: undefined,
    });
  });

  it.each([
    {
      label: "Apple",
      apiKey: "route-test-apple-forwarding",
      body: {
        store: "apple",
        jws: `${"a".repeat(40)}.${"b".repeat(40)}.${"c".repeat(40)}`,
        expectedProductId: "apple.premium.monthly",
      },
      functionName: "purchases/ios:verifyAppStoreReceiptInternalV1",
      expectedArgs: {
        apiKey: "route-test-apple-forwarding",
        jws: `${"a".repeat(40)}.${"b".repeat(40)}.${"c".repeat(40)}`,
        expectedProductId: "apple.premium.monthly",
        requestIp: undefined,
      },
    },
    {
      label: "Horizon",
      apiKey: "route-test-horizon-forwarding",
      body: {
        store: "horizon",
        userId: "123456789",
        sku: "horizon.premium.monthly",
      },
      functionName: "purchases/horizon:verifyMetaHorizonReceiptInternalV1",
      expectedArgs: {
        apiKey: "route-test-horizon-forwarding",
        userId: "123456789",
        sku: "horizon.premium.monthly",
        requestIp: undefined,
      },
    },
  ])(
    "forwards $label verification to the store-specific action",
    async ({ apiKey, body, functionName, expectedArgs }) => {
      convexClientMock.action.mockResolvedValueOnce({
        isValid: true,
        state: "ENTITLED",
        productId:
          "expectedProductId" in body ? body.expectedProductId : body.sku,
      });

      const response = await apiRoutes.request("/purchase/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      expect(response.status).toBe(200);
      expect(convexClientMock.action).toHaveBeenCalledOnce();
      const [functionReference, args] = convexClientMock.action.mock.calls[0];
      expect(getFunctionName(functionReference)).toBe(functionName);
      expect(args).toEqual(expectedArgs);
    },
  );

  it("keeps fetched UNKNOWN outcomes retryable without exposing internal hints", async () => {
    convexClientMock.action.mockResolvedValue({
      isValid: false,
      state: "UNKNOWN",
      productId: "future.product",
    });
    const request = () =>
      apiRoutes.request("/purchase/verify", {
        method: "POST",
        headers: {
          Authorization: "Bearer route-test-future-unknown",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          store: "google",
          purchaseToken: "future-unknown-token".repeat(3),
        }),
      });

    const first = await request();
    const second = await request();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toEqual({
      store: "google",
      isValid: false,
      state: "UNKNOWN",
      productId: "future.product",
    });
    expect(convexClientMock.action).toHaveBeenCalledTimes(2);
  });

  it("cooldowns an explicitly revoked UNKNOWN without exposing provenance", async () => {
    convexClientMock.action.mockResolvedValueOnce({
      isValid: false,
      state: "UNKNOWN",
      stableRejection: true,
    });
    const request = () =>
      apiRoutes.request("/purchase/verify", {
        method: "POST",
        headers: {
          Authorization: "Bearer route-test-revoked-unknown",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          store: "google",
          purchaseToken: "revoked-unknown-token".repeat(3),
        }),
      });

    const first = await request();
    const second = await request();

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      store: "google",
      isValid: false,
      state: "UNKNOWN",
    });
    expect(second.status).toBe(429);
    expect(await second.json()).toMatchObject({
      errors: [{ code: "REPEATED_FAILURE" }],
    });
    expect(convexClientMock.action).toHaveBeenCalledTimes(1);
  });

  it("enriches a valid Google receipt only when client payload is requested", async () => {
    convexClientMock.action.mockResolvedValueOnce({
      isValid: true,
      state: "ENTITLED",
      productId: "premium.monthly",
    });
    convexClientMock.query.mockResolvedValueOnce({
      format: "json",
      body: '{"tier":"premium"}',
      version: 2,
      updatedAt: 123,
    });

    const response = await apiRoutes.request("/purchase/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer route-test-payload-google",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store: "google",
        purchaseToken: "payloadtoken".repeat(4),
        includeClientPayload: true,
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      store: "google",
      isValid: true,
      state: "ENTITLED",
      productId: "premium.monthly",
      clientPayload: {
        format: "json",
        body: '{"tier":"premium"}',
        version: 2,
        updatedAt: 123,
      },
    });
    expect(convexClientMock.query).toHaveBeenCalledWith(expect.anything(), {
      apiKey: "route-test-payload-google",
      platform: "Android",
      productId: "premium.monthly",
    });
  });

  it("maps Apple payload lookup to IOS and uses the verified product id", async () => {
    convexClientMock.action.mockResolvedValueOnce({
      isValid: true,
      state: "ENTITLED",
      productId: "verified.product",
    });
    convexClientMock.query.mockResolvedValueOnce({
      format: "text",
      body: "ios rule",
      version: 1,
      updatedAt: 10,
    });

    const response = await apiRoutes.request("/purchase/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer route-test-payload-apple",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store: "apple",
        jws: `${"a".repeat(40)}.${"b".repeat(40)}.${"c".repeat(40)}`,
        expectedProductId: "caller.expected",
        includeClientPayload: true,
      }),
    });

    expect(response.status).toBe(200);
    expect(convexClientMock.query).toHaveBeenCalledWith(expect.anything(), {
      apiKey: "route-test-payload-apple",
      platform: "IOS",
      productId: "verified.product",
    });
  });

  it("omits missing metadata and fails open when enrichment lookup fails", async () => {
    const verified = {
      isValid: true,
      state: "ENTITLED",
      productId: "premium.monthly",
    };
    convexClientMock.action
      .mockResolvedValueOnce(verified)
      .mockResolvedValueOnce(verified);
    convexClientMock.query
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("private database detail"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    for (const [key, token] of [
      ["route-test-payload-missing", "missingtoken".repeat(4)],
      ["route-test-payload-fail-open", "failopentoken".repeat(4)],
    ]) {
      const response = await apiRoutes.request("/purchase/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          store: "google",
          purchaseToken: token,
          includeClientPayload: true,
        }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ store: "google", ...verified });
    }
    expect(convexClientMock.query).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      "[purchase/verify] CLIENT_PAYLOAD_LOOKUP_FAILED: %s",
      "Error",
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "private database detail",
    );
    consoleError.mockRestore();
  });

  it("never looks up client payload for opt-out, invalid, Horizon, or Amazon receipts", async () => {
    convexClientMock.action
      .mockResolvedValueOnce({
        isValid: true,
        state: "ENTITLED",
        productId: "premium.monthly",
      })
      .mockResolvedValueOnce({
        isValid: false,
        state: "INAUTHENTIC",
        productId: "premium.monthly",
      })
      .mockResolvedValueOnce({
        isValid: true,
        state: "ENTITLED",
        productId: "quest.sku",
      })
      .mockResolvedValueOnce({
        isValid: true,
        state: "ENTITLED",
        productId: "amazon.sku",
      });

    const requests = [
      {
        key: "route-test-payload-optout",
        body: {
          store: "google",
          purchaseToken: "optouttoken".repeat(4),
          includeClientPayload: false,
        },
      },
      {
        key: "route-test-payload-invalid",
        body: {
          store: "google",
          purchaseToken: "invalidtoken".repeat(4),
          includeClientPayload: true,
        },
      },
      {
        key: "route-test-payload-horizon",
        body: {
          store: "horizon",
          userId: "123456789",
          sku: "quest.sku",
          includeClientPayload: true,
        },
      },
      {
        key: "route-test-payload-amazon",
        body: {
          store: "amazon",
          userId: "amzn1.account.ABC123",
          receiptId: "amzn1.receipt.ABC123456789=:1",
          includeClientPayload: true,
        },
      },
    ];

    for (const request of requests) {
      const response = await apiRoutes.request("/purchase/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${request.key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(request.body),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).not.toHaveProperty("clientPayload");
    }
    expect(convexClientMock.query).not.toHaveBeenCalled();
  });

  it("degrades an out-of-contract state instead of publishing it", async () => {
    // Shipped SDKs decode this body with parsers they cannot update, so a
    // state Convex knows but the published schema does not must not reach one.
    convexClientMock.action.mockResolvedValueOnce({
      isValid: true,
      state: "REFUNDED",
      productId: "premium.monthly",
    });

    const response = await apiRoutes.request("/purchase/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer route-test-state-drift",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store: "google",
        purchaseToken: "token".repeat(8),
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      store: "google",
      isValid: true,
      state: "UNKNOWN",
      productId: "premium.monthly",
    });
  });

  it("refuses to publish a verdict that cannot be made contract-valid", async () => {
    // Only a server defect produces this — Convex's own validator pins
    // isValid to a boolean — but a body no SDK can trust must not be sent.
    convexClientMock.action.mockResolvedValueOnce({
      isValid: "true",
      state: "ENTITLED",
    });

    const response = await apiRoutes.request("/purchase/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer route-test-malformed-verdict",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store: "google",
        purchaseToken: "token".repeat(8),
      }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      errors: [{ code: "UNKNOWN_ERROR" }],
    });
    // The client saw a failure, so the structured log must not still report the
    // verdict this handler computed — otherwise the incident is invisible in
    // any success-rate view built on `isValid`.
    const verifyLine = logLines.find((line) => line.kind === "verify_request");
    expect(verifyLine).toMatchObject({
      statusCode: 500,
      isValid: false,
      state: "UNKNOWN",
    });
  });

  it("drops an environment value no shipped SDK accepts", async () => {
    convexClientMock.action.mockResolvedValueOnce({
      isValid: true,
      state: "ENTITLED",
      productId: "amazon.premium.monthly",
      environment: "Xcode",
    });

    const response = await apiRoutes.request("/purchase/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer route-test-environment-drift",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store: "amazon",
        userId: "amzn1.account.ABC123",
        receiptId: "amzn1.receipt.ABC123456789=:1",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      store: "amazon",
      isValid: true,
      state: "ENTITLED",
      productId: "amazon.premium.monthly",
    });
  });
});
