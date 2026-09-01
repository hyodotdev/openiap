import { describe, expect, it } from "vitest";

import { apiRoutesV2 } from "./routes";

describe("v2 routes", () => {
  it("publishes the secret-only tokenless OpenAPI contract", async () => {
    const response = await apiRoutesV2.request("/openapi");
    const body = (await response.json()) as {
      openapi: string;
      paths: Record<string, Record<string, { operationId?: string }>>;
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
    expect(JSON.stringify(body.paths["/subscriptions/status"])).not.toContain(
      "purchaseToken",
    );
    expect(body.paths["/subscriptions/user-erasure"]?.post?.operationId).toBe(
      "requestSubscriptionUserErasureV2",
    );
  });
});
