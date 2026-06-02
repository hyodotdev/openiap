import { describe, expect, it, vi } from "vitest";

vi.mock("hono/bun", () => ({
  getConnInfo: () => ({ remote: { address: "127.0.0.1" } }),
}));

vi.mock("../../convex", () => ({
  client: {
    action: vi.fn(),
    mutation: vi.fn(),
    query: vi.fn(),
  },
  handleConvexError: () => null,
}));

const { apiRoutes } = await import("./routes");

describe("apiRoutes", () => {
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
});
