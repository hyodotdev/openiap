import { beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => {
    convexClientMock.action.mockReset();
    convexClientMock.mutation.mockReset();
    convexClientMock.query.mockReset();
  });

  it("serves the generated OpenAPI specification", async () => {
    const response = await apiRoutes.request("/openapi");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as {
      openapi: string;
      paths: Record<string, { post?: { operationId?: string } }>;
    };
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths["/purchase/verify"]?.post?.operationId).toBe(
      "verifyPurchase",
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
});
