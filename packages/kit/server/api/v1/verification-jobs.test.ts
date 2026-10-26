import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertVerificationSource } from "../../../convex/purchases/verificationSource";

vi.mock("hono/bun", () => ({
  getConnInfo: () => ({ remote: { address: "127.0.0.1" } }),
}));
const transport = vi.hoisted(() => ({
  action: vi.fn(),
  query: vi.fn(),
  mutation: vi.fn(),
  handleConvexError: vi.fn(),
}));
vi.mock("../../convex", () => ({
  client: transport,
  handleConvexError: transport.handleConvexError,
}));
const { apiRoutes } = await import("./routes");
const key = "openiap-kit_pk_queue_fixture";
const idempotencyKey = "a".repeat(64);
const headers = {
  Authorization: `Bearer ${key}`,
  "Idempotency-Key": idempotencyKey,
  "Content-Type": "application/json",
};

beforeEach(() => {
  vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(64));
  vi.resetAllMocks();
  transport.handleConvexError.mockReturnValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("optional verification job transport", () => {
  it("acknowledges only successful durable enqueue and signs the exact input", async () => {
    transport.action.mockResolvedValue({
      jobId: "job-fixture",
      deduped: false,
    });
    const response = await apiRoutes.request("/purchase/verification-jobs", {
      method: "POST",
      headers,
      body: JSON.stringify({
        store: "google",
        purchaseToken: "test_purchase_token_123456789",
      }),
    });
    expect(response.status).toBe(202);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      jobId: "job-fixture",
      deduped: false,
    });
    const { sourceAuth, ...args } = transport.action.mock.calls[0][1];
    expect(() =>
      assertVerificationSource("enqueue", args, sourceAuth),
    ).not.toThrow();
    expect(() => assertVerificationSource("read", args, sourceAuth)).toThrow();
  });

  it("rejects malformed headers and evidence before reaching Convex", async () => {
    const missing = await apiRoutes.request("/purchase/verification-jobs", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(missing.status).toBe(400);
    const malformed = await apiRoutes.request("/purchase/verification-jobs", {
      method: "POST",
      headers,
      body: JSON.stringify({ store: "google", purchaseToken: "short" }),
    });
    expect(malformed.status).toBe(400);
    expect(transport.action).not.toHaveBeenCalled();
  });

  it("distinguishes queued work from a final invalid receipt and strips internal metadata", async () => {
    const base = {
      jobId: "job-fixture",
      createdAt: 1,
      expiresAt: 900_001,
      store: "google",
      correlationId: "fixture",
    };
    transport.action.mockResolvedValueOnce({ ...base, status: "queued" });
    const queued = await apiRoutes.request(
      "/purchase/verification-jobs/job-fixture",
      { headers },
    );
    expect(await queued.json()).toEqual({
      jobId: "job-fixture",
      status: "queued",
      createdAt: 1,
      expiresAt: 900_001,
    });
    expect(queued.headers.get("Retry-After")).toBe("2");
    transport.action.mockResolvedValueOnce({
      ...base,
      status: "succeeded",
      completedAt: 2,
      receipt: {
        isValid: false,
        state: "INAUTHENTIC",
        stableRejection: true,
        transactionDetails: { transactionId: "private-transaction" },
      },
    });
    const completed = await apiRoutes.request(
      "/purchase/verification-jobs/job-fixture",
      { headers },
    );
    expect(completed.status).toBe(200);
    expect(await completed.json()).toEqual({
      jobId: "job-fixture",
      status: "succeeded",
      createdAt: 1,
      expiresAt: 900_001,
      completedAt: 2,
      result: { store: "google", isValid: false, state: "INAUTHENTIC" },
    });
  });

  it.each([
    ["SERVICE_BUSY", 503],
    ["RATE_LIMITED", 429],
    ["IDEMPOTENCY_CONFLICT", 409],
    ["NOT_FOUND", 404],
    ["INVALID_API_KEY", 403],
  ] as const)(
    "maps %s without acknowledging acceptance",
    async (code, status) => {
      transport.action.mockRejectedValue(new Error("redacted"));
      transport.handleConvexError.mockReturnValue({
        code,
        message: "Fixture",
        ...(status === 503 || status === 429 ? { retryAfterSec: 5 } : {}),
      });
      const result = await apiRoutes.request(
        "/purchase/verification-jobs/job-fixture",
        { headers },
      );
      expect(result.status).toBe(status);
      expect(await result.json()).toMatchObject({ errors: [{ code }] });
      if (status === 503 || status === 429)
        expect(result.headers.get("Retry-After")).toBe("5");
    },
  );

  it("publishes both optional operations alongside unchanged synchronous verification", async () => {
    const spec = await apiRoutes.request("/openapi");
    const body = await spec.json();
    expect(body.paths["/purchase/verify"].post.responses).toHaveProperty("200");
    expect(
      body.paths["/purchase/verification-jobs"].post.responses,
    ).toHaveProperty("202");
    expect(
      body.paths["/purchase/verification-jobs/{jobId}"].get.responses,
    ).toHaveProperty("200");
  });
});
