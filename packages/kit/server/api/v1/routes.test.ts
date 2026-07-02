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
  });
});
