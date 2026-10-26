import { ConvexError } from "convex/values";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";
import { sha256Hex } from "../utils/sha256";
import {
  encryptVerificationJob,
  decryptVerificationJob,
} from "./verificationJobCrypto";
import {
  run as registeredRun,
  verificationJobFailure,
} from "./verificationJobs";
import type { VerificationInput } from "./verificationInput";

const verifiers = vi.hoisted(() => ({
  apple: vi.fn(),
  google: vi.fn(),
  amazon: vi.fn(),
  horizon: vi.fn(),
}));
vi.mock("./ios", () => ({ verifyAppStoreReceipt: verifiers.apple }));
vi.mock("./android", () => ({ verifyGooglePlayReceipt: verifiers.google }));
vi.mock("./amazon", () => ({ verifyAmazonReceipt: verifiers.amazon }));
vi.mock("./horizon", () => ({ verifyHorizonReceipt: verifiers.horizon }));
vi.mock("../purchaseIssues/shared", () => ({
  verifyRecordingIssues: (
    _ctx: unknown,
    _args: unknown,
    verify: () => Promise<unknown>,
  ) => verify(),
}));

const run = testableFunction(registeredRun);
const jobId = "job_fixture" as Id<"verificationJobs">;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(64));
});
afterEach(() => vi.unstubAllEnvs());

describe("queued verification uses the existing store adapters", () => {
  it.each<VerificationInput>([
    {
      store: "apple",
      jws: `${"a".repeat(40)}.${"b".repeat(40)}.${"c".repeat(40)}`,
      expectedProductId: "product.test",
    },
    {
      store: "google",
      purchaseToken: "test_purchase_token_123456789",
      expectedProductId: "product.test",
    },
    {
      store: "amazon",
      userId: "amazon-user",
      receiptId: "test-receipt-12345",
      sandbox: true,
      expectedProductId: "product.test",
    },
    { store: "horizon", userId: "12345", sku: "product.test" },
  ])(
    "authenticates and dispatches $store evidence without returning it",
    async (input) => {
      const apiKey = "openiap-kit_sk_worker_fixture";
      const apiKeyHash = await sha256Hex(apiKey);
      const idempotencyHash = "idempotency-hash";
      const requestHash = "request-hash";
      const job = {
        apiKeyHash,
        idempotencyHash,
        requestHash,
        status: "running",
        expiresAt: Date.now() + 60_000,
        correlationId: "fixture",
        payload: encryptVerificationJob(
          JSON.stringify({ apiKey, input }),
          JSON.stringify([apiKeyHash, idempotencyHash, requestHash]),
        ),
      };
      const receipt = { isValid: false, state: "INAUTHENTIC" };
      const ctx = {
        runMutation: vi.fn(
          async (reference: FunctionReference<"mutation">, _args: unknown) =>
            getFunctionName(reference).endsWith(":forWorker") ? job : null,
        ),
      };
      verifiers[input.store].mockResolvedValue(receipt);
      await run._handler(ctx, { jobId, lease: "lease" });
      expect(verifiers[input.store]).toHaveBeenCalledOnce();
      const { store: _store, ...evidence } = input;
      expect(verifiers[input.store].mock.calls[0][1]).toMatchObject({
        ...evidence,
        apiKey,
        correlationId: "fixture",
      });
      expect(ctx.runMutation.mock.lastCall?.[1]).toEqual({
        jobId,
        lease: "lease",
        receipt,
      });
    },
  );

  it("does not start store work after the job deadline", async () => {
    const ctx = {
      runMutation: vi
        .fn()
        .mockResolvedValueOnce({ status: "expired" })
        .mockResolvedValue(null),
    };
    await run._handler(ctx, { jobId, lease: "lease" });
    for (const verify of Object.values(verifiers))
      expect(verify).not.toHaveBeenCalled();
    expect(ctx.runMutation).toHaveBeenCalledTimes(2);
  });

  it("does not execute store work when the atomic startup claim is refused", async () => {
    const ctx = {
      runMutation: vi.fn().mockResolvedValue(null),
    };
    await run._handler(ctx, { jobId, lease: "lease" });
    expect(ctx.runMutation).toHaveBeenCalledOnce();
    expect(ctx.runMutation.mock.calls[0][1]).toMatchObject({
      jobId,
      lease: "lease",
    });
    for (const verify of Object.values(verifiers))
      expect(verify).not.toHaveBeenCalled();
  });

  it("detects payload substitution and secret rotation", () => {
    const encrypted = encryptVerificationJob("secret receipt", "job-a");
    expect(() => decryptVerificationJob(encrypted, "job-b")).toThrow();
    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "b".repeat(64));
    expect(() => decryptVerificationJob(encrypted, "job-a")).toThrow();
  });

  it("retains retry hints while removing store messages, credentials and details", () => {
    const error = new ConvexError(
      JSON.stringify({
        error: "STORE_UNAVAILABLE",
        message: "secret-token",
        details: { key: "private-key" },
        retryAfterSec: 5,
      }),
    );
    const failure = verificationJobFailure(error);
    expect(failure).toMatchObject({
      error: { code: "STORE_UNAVAILABLE" },
      retryAfterSec: 5,
    });
    expect(JSON.stringify(failure)).not.toContain("secret-token");
    expect(JSON.stringify(failure)).not.toContain("private-key");
    expect(verificationJobFailure(new Error("private-key"))).toEqual({
      error: {
        code: "VERIFICATION_FAILED",
        message:
          "Verification could not finish. Check the project configuration or contact support.",
      },
    });
  });
});
