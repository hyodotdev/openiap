import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertVerificationSource } from "../../../convex/purchases/verificationSource";
import { ReceiptVerificationError } from "../../../convex/purchases/errors";
import { getFunctionName } from "convex/server";

vi.mock("hono/bun", () => ({
  getConnInfo: () => ({ remote: { address: "127.0.0.1" } }),
}));

const convexClientMock = vi.hoisted(() => ({
  action: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
  handleConvexError: vi.fn(),
}));

vi.mock("../../convex", () => ({
  client: convexClientMock,
  handleConvexError: convexClientMock.handleConvexError,
}));

const { apiRoutes } = await import("./routes");

describe("apiRoutes", () => {
  // The logger writes one JSON line per request to stdout.
  let logLines: Array<Record<string, unknown>>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    convexClientMock.action.mockReset();
    convexClientMock.mutation.mockReset();
    convexClientMock.query.mockReset();
    convexClientMock.handleConvexError.mockReset();
    convexClientMock.handleConvexError.mockReturnValue(null);
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
    // The sandboxed Redoc page fetches the spec from an opaque origin.
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");

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

  it("runs Redoc in a sandbox that allows only its shim and the pinned CDN script", async () => {
    const response = await apiRoutes.request("/");

    expect(response.status).toBe(200);
    const page = await response.text();
    const inlineScripts = [
      ...page.matchAll(/<script>([\s\S]*?)<\/script[^>]*>/gi),
    ];
    expect(inlineScripts).toHaveLength(1);
    const shimHash = createHash("sha256")
      .update(inlineScripts[0]?.[1] ?? "")
      .digest("base64");
    const redocScript =
      "https://cdn.redoc.ly/redoc/v3.0.0-rc.0/redoc.standalone.js";
    expect(page).toMatch(
      /<script\s+type="module"\s+src="[^"]+"\s+integrity="sha384-[A-Za-z0-9+/=]+"\s+crossorigin="anonymous"\s*>/,
    );
    expect(page).toContain(`src="${redocScript}"`);
    expect(response.headers.get("Content-Security-Policy")).toBe(
      `sandbox allow-scripts allow-popups allow-downloads; script-src 'sha256-${shimHash}' ${redocScript}`,
    );
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

  it("returns 429 when the persistent verification backstop is exhausted", async () => {
    convexClientMock.action.mockRejectedValueOnce(new Error("limited"));
    convexClientMock.handleConvexError.mockReturnValueOnce({
      code: "RATE_LIMITED",
      message: "Too many verification requests",
      retryAfterSec: 2,
    });

    const response = await apiRoutes.request("/purchase/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer route-test-backstop",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store: "google",
        purchaseToken: "token".repeat(8),
      }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
    expect((await response.json()).errors[0].code).toBe("RATE_LIMITED");
  });

  it("answers a store outage with 503 and Retry-After instead of a permanent 400", async () => {
    convexClientMock.action.mockRejectedValueOnce(new Error("outage"));
    convexClientMock.handleConvexError.mockReturnValueOnce({
      code: "PLAY_STORE_VERIFICATION_ERROR",
      message:
        "Failed to verify Google Play purchase: Purchase verification failed (HTTP 503)",
      retryAfterSec: 5,
    });

    const response = await apiRoutes.request("/purchase/verify", {
      method: "POST",
      headers: {
        Authorization: "Bearer route-test-outage",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        store: "google",
        purchaseToken: "token".repeat(8),
      }),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect((await response.json()).errors[0].code).toBe(
      "PLAY_STORE_VERIFICATION_ERROR",
    );
  });

  it("does not charge the replay budget for store-outage retries", async () => {
    const send = () => {
      convexClientMock.action.mockRejectedValueOnce(new Error("outage"));
      convexClientMock.handleConvexError.mockReturnValueOnce({
        code: "PLAY_STORE_VERIFICATION_ERROR",
        message: "Failed to verify Google Play purchase",
        retryAfterSec: 5,
      });
      return apiRoutes.request("/purchase/verify", {
        method: "POST",
        headers: {
          Authorization: "Bearer route-test-outage-refund",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          store: "google",
          purchaseToken: "refund".repeat(8),
        }),
      });
    };

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 40; attempt += 1) {
      statuses.push((await send()).status);
    }

    expect(new Set(statuses)).toEqual(new Set([503]));
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
      correlationId: response.headers.get("X-Correlation-Id"),
      sourceAuth: {
        issuedAt: expect.any(Number),
        mac: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
    const { sourceAuth, ...authenticated } = args;
    expect(() =>
      assertVerificationSource("amazon", authenticated, sourceAuth),
    ).not.toThrow();
  });

  it.each([
    {
      label: "Apple",
      apiKey: "route-test-apple-forwarding",
      body: {
        store: "apple" as const,
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
        store: "horizon" as const,
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
      // The persisted correlation id is the one the response header reports.
      expect(args).toEqual({
        ...expectedArgs,
        correlationId: response.headers.get("X-Correlation-Id"),
        sourceAuth: {
          issuedAt: expect.any(Number),
          mac: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      });
      const { sourceAuth, ...authenticated } = args;
      expect(() =>
        assertVerificationSource(body.store, authenticated, sourceAuth),
      ).not.toThrow();
    },
  );

  it.each(["/purchase/verify", "/verify-purchase"])(
    "%s refunds source-unavailable attempts and never calls Convex without a proof",
    async (path) => {
      vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", undefined);
      convexClientMock.handleConvexError.mockImplementation((error: unknown) =>
        error instanceof ReceiptVerificationError
          ? {
              code: error.errorCode,
              message: error.errorMessage,
              retryAfterSec: error.retryAfterSec,
            }
          : null,
      );
      const request = () =>
        apiRoutes.request(path, {
          method: "POST",
          headers: {
            authorization: `Bearer source-cutover-${path.slice(1)}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            store: "google",
            purchaseToken: "source-fixture-purchase-token",
          }),
        });
      for (let attempt = 0; attempt < 32; attempt++) {
        const response = await request();
        expect(response.status).toBe(503);
        expect(response.headers.get("retry-after")).toBe("5");
        expect(await response.json()).toMatchObject({
          errors: [{ code: "UNKNOWN_ERROR", retryAfterSec: 5 }],
        });
      }
      expect(convexClientMock.action).not.toHaveBeenCalled();
      vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "e".repeat(64));
      convexClientMock.action.mockResolvedValue({
        isValid: true,
        state: "ENTITLED",
      });
      expect((await request()).status).toBe(200);
      expect(convexClientMock.action).toHaveBeenCalledOnce();
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

  it("lets an on-hold Google subscription retry without exposing the hint", async () => {
    const onHold = {
      isValid: false,
      state: "EXPIRED",
      stableRejection: false,
    };
    convexClientMock.action
      .mockResolvedValueOnce(onHold)
      .mockResolvedValueOnce(onHold);
    const request = () =>
      apiRoutes.request("/purchase/verify", {
        method: "POST",
        headers: {
          Authorization: "Bearer route-test-on-hold",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          store: "google",
          purchaseToken: "on-hold-token".repeat(4),
        }),
      });

    const first = await request();
    const second = await request();

    expect(await first.json()).toEqual({
      store: "google",
      isValid: false,
      state: "EXPIRED",
    });
    expect(second.status).toBe(200);
    expect(convexClientMock.action).toHaveBeenCalledTimes(2);
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
    // A state Convex knows but the published schema does not must not ship.
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
    // Server-defect path: Convex's validator pins isValid to a boolean.
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
    // The client saw a failure; the log must not report a success verdict.
    const verifyLine = logLines.find((line) => line.kind === "verify_request");
    expect(verifyLine).toMatchObject({
      statusCode: 500,
      isValid: false,
      state: "UNKNOWN",
    });
  });

  it("keeps a stable rejection armed through a malformed verdict", async () => {
    // The reported state is overwritten on this path, so the cooldown has to be
    // derived before the reset — otherwise a revoked receipt becomes replayable.
    convexClientMock.action.mockResolvedValue({
      isValid: "false",
      state: "INAUTHENTIC",
    });
    const send = () =>
      apiRoutes.request("/purchase/verify", {
        method: "POST",
        headers: {
          Authorization: "Bearer route-test-stable-rejection-500",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          store: "google",
          purchaseToken: "stablereject".repeat(4),
        }),
      });

    expect((await send()).status).toBe(500);

    const replayed = await send();
    expect(replayed.status).toBe(429);
    expect(await replayed.json()).toMatchObject({
      errors: [{ code: "REPEATED_FAILURE" }],
    });
  });

  it("forwards an opaque environment value", async () => {
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
      environment: "Xcode",
    });
  });

  describe("includeTransactionDetails", () => {
    const appleVerdict = {
      isValid: true,
      state: "ENTITLED",
      productId: "premium.monthly",
      environment: "Sandbox",
      transactionDetails: {
        transactionId: "2000000000000002",
        originalTransactionId: "2000000000000001",
        expiresAt: 1_800_000_000_000,
      },
    };
    const jws = `${"a".repeat(40)}.${"b".repeat(40)}.${"c".repeat(40)}`;
    const verify = (apiKey: string, body: Record<string, unknown>) =>
      apiRoutes.request("/purchase/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ store: "apple", jws, ...body }),
      });

    it("leaves the default response byte-identical", async () => {
      convexClientMock.action.mockResolvedValueOnce(appleVerdict);

      const response = await verify("route-test-details-default", {});

      expect(response.status).toBe(200);
      // Golden: the exact body shipped SDKs decode today.
      expect(await response.text()).toBe(
        '{"store":"apple","isValid":true,"state":"ENTITLED","productId":"premium.monthly","environment":"Sandbox"}',
      );
      expect(response.headers.get("X-Correlation-Id")).toMatch(
        /^[0-9a-f-]{36}$/,
      );
    });

    it("adds the commerce-event identifiers and the correlation id on request", async () => {
      convexClientMock.action.mockResolvedValueOnce(appleVerdict);

      const response = await verify("route-test-details-on", {
        includeTransactionDetails: true,
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        store: "apple",
        isValid: true,
        state: "ENTITLED",
        productId: "premium.monthly",
        environment: "Sandbox",
        transactionId: "2000000000000002",
        originalTransactionId: "2000000000000001",
        expiresAt: 1_800_000_000_000,
        commerceEnvironment: "sandbox",
        correlationId: response.headers.get("X-Correlation-Id"),
      });
    });

    it("tells a settled rejection from one a retry can change", async () => {
      // Fresh evidence per call: the replay guard holds a settled rejection.
      let call = 0;
      const finalVerdict = async (
        verdict: Record<string, unknown>,
        body: Record<string, unknown> = {
          store: "apple",
          jws: `${jws}${(call += 1)}`,
        },
      ) => {
        convexClientMock.action.mockResolvedValueOnce(verdict);
        const response = await apiRoutes.request("/purchase/verify", {
          method: "POST",
          headers: {
            Authorization: "Bearer route-test-details-final",
            "content-type": "application/json",
          },
          body: JSON.stringify({ ...body, includeTransactionDetails: true }),
        });
        return ((await response.json()) as { finalVerdict?: boolean })
          .finalVerdict;
      };

      for (const state of ["EXPIRED", "CANCELED", "INAUTHENTIC", "CONSUMED"]) {
        expect(await finalVerdict({ isValid: false, state })).toBe(true);
      }
      // Google's revoked token maps to UNKNOWN but is settled.
      expect(
        await finalVerdict(
          { isValid: false, state: "UNKNOWN", stableRejection: true },
          { store: "google", purchaseToken: "g".repeat(80) },
        ),
      ).toBe(true);
      // Play revives an on-hold subscription on the same token.
      expect(
        await finalVerdict(
          { isValid: false, state: "EXPIRED", stableRejection: false },
          { store: "google", purchaseToken: "h".repeat(80) },
        ),
      ).toBe(false);
      // Meta checks current ownership, so the user can buy right after.
      expect(
        await finalVerdict(
          { isValid: false, state: "INAUTHENTIC" },
          { store: "horizon", userId: "123456789", sku: "sku" },
        ),
      ).toBe(false);
      expect(await finalVerdict({ isValid: false, state: "UNKNOWN" })).toBe(
        false,
      );
      expect(await finalVerdict({ isValid: false, state: "PENDING" })).toBe(
        false,
      );
      // A valid purchase carries no verdict to stop on.
      expect(
        await finalVerdict({ isValid: true, state: "ENTITLED" }),
      ).toBeUndefined();
    });

    it("adds only what the store supplied", async () => {
      convexClientMock.action.mockResolvedValueOnce({
        isValid: true,
        state: "ENTITLED",
        productId: "sku",
      });

      const response = await apiRoutes.request("/purchase/verify", {
        method: "POST",
        headers: {
          Authorization: "Bearer route-test-details-horizon",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          store: "horizon",
          userId: "123456789",
          sku: "sku",
          includeTransactionDetails: true,
        }),
      });

      expect(await response.json()).toEqual({
        store: "horizon",
        isValid: true,
        state: "ENTITLED",
        productId: "sku",
        correlationId: response.headers.get("X-Correlation-Id"),
      });
    });

    it("publishes the flag and the fields in the OpenAPI document", async () => {
      const spec = JSON.stringify(
        await (await apiRoutes.request("/openapi")).json(),
      );
      for (const name of [
        "includeTransactionDetails",
        "transactionId",
        "originalTransactionId",
        "expiresAt",
        "commerceEnvironment",
        "correlationId",
        "finalVerdict",
      ]) {
        expect(spec).toContain(`"${name}"`);
      }
    });
  });
});

// Synthetic service credential for this isolated verification transport fixture.
beforeEach(() =>
  vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "e".repeat(64)),
);
afterEach(() => vi.unstubAllEnvs());
