import { Hono } from "hono";
import { describe, expect, test } from "vitest";

import { createHealthPayload, handleHealthRequest } from "./health";

describe("createHealthPayload", () => {
  test("reports stable service metadata and a bounded deployment revision", () => {
    expect(
      createHealthPayload(
        {
          APP_ENV: "production",
          IAPKIT_REVISION: "ABCDEF0123456789ABCDEF0123456789ABCDEF01",
        },
        new Date("2026-07-30T12:34:56.000Z"),
      ),
    ).toEqual({
      ok: true,
      status: "healthy",
      service: "iapkit",
      apiVersion: "v1",
      revision: "abcdef012345",
      environment: "production",
      timestamp: "2026-07-30T12:34:56.000Z",
    });
  });

  test("does not expose arbitrary environment or revision values", () => {
    expect(
      createHealthPayload(
        {
          APP_ENV: "customer-private-environment",
          IAPKIT_REVISION: "not-a-git-revision",
        },
        new Date("2026-07-30T00:00:00.000Z"),
      ),
    ).toMatchObject({
      revision: null,
      environment: "development",
    });
  });
});

describe("handleHealthRequest", () => {
  test("returns a no-store JSON response without external dependencies", async () => {
    const app = new Hono();
    app.get("/health", handleHealthRequest);

    const response = await app.request("/health");
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(payload).toMatchObject({
      ok: true,
      status: "healthy",
      service: "iapkit",
      apiVersion: "v1",
    });
    expect(typeof payload.timestamp).toBe("string");
  });
});
