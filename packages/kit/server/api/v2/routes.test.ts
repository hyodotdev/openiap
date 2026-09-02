import { describe, expect, it, vi } from "vitest";

vi.mock("../../convex", () => ({
  client: { mutation: vi.fn(), query: vi.fn() },
  handleConvexError: () => null,
}));

import { apiRoutesV2 } from "./routes";

describe("v2 routes", () => {
  it("publishes the secret-only tokenless OpenAPI contract", async () => {
    const response = await apiRoutesV2.request("/openapi");
    const body = (await response.json()) as {
      openapi: string;
      paths: Record<
        string,
        Record<
          string,
          {
            operationId?: string;
            responses?: Record<string, { headers?: Record<string, unknown> }>;
          }
        >
      >;
      components?: {
        securitySchemes?: Record<string, { scheme?: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(body.openapi).toBe("3.1.0");
    expect(body.components?.securitySchemes?.apiKey?.scheme).toBe("bearer");
    expect(body.paths["/subscriptions/status"]?.get?.operationId).toBe(
      "getSubscriptionStatusV2",
    );
    expect(
      body.paths["/subscriptions/status"]?.get?.responses?.["429"]?.headers,
    ).toHaveProperty("Retry-After");
    expect(
      body.paths["/subscriptions/status"]?.get?.responses?.["429"]?.headers,
    ).toHaveProperty("X-RateLimit-Scope");
    expect(JSON.stringify(body.paths["/subscriptions/status"])).not.toContain(
      "purchaseToken",
    );
    expect(body.paths["/subscriptions/user-erasure"]?.post?.operationId).toBe(
      "requestSubscriptionUserErasureV2",
    );
  });
});
