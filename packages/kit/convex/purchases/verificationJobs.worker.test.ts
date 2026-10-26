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
  enqueue as registeredEnqueue,
  read as registeredRead,
  run as registeredRun,
  verificationJobFailure,
} from "./verificationJobs";
import type { VerificationInput } from "./verificationInput";
import {
  AmazonReceiptVerificationError,
  PlayStorePurchaseNotFoundError,
  PlayStoreVerificationError,
} from "./errors";

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
vi.mock("../purchaseIssues/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../purchaseIssues/shared")>()),
  verifyRecordingIssues: (
    _ctx: unknown,
    _args: unknown,
    verify: () => Promise<unknown>,
  ) => verify(),
}));

const run = testableFunction(registeredRun);
const enqueue = testableFunction(registeredEnqueue);
const read = testableFunction(registeredRead);
const jobId = "job_fixture" as Id<"verificationJobs">;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(64));
});
afterEach(() => vi.unstubAllEnvs());

describe("queued verification uses the existing store adapters", () => {
  it.each(["enqueue", "read"] as const)(
    "rejects untrusted %s before authenticated CLI database reads",
    async (operation) => {
      const ctx = {
        auth: {
          getUserIdentity: vi.fn().mockResolvedValue({
            subject: "fixture-user|fixture-session",
            iapkitCli: true,
          }),
        },
        runQuery: vi.fn().mockResolvedValue({
          scope: "admin",
          expiresAt: Date.now() + 60_000,
        }),
        runMutation: vi.fn(),
      };
      const common = {
        apiKey: "openiap-kit_pk_fixture",
        idempotencyKey: "a".repeat(64),
      };
      const request =
        operation === "enqueue"
          ? enqueue._handler(ctx, {
              ...common,
              inputJson: JSON.stringify({
                store: "google",
                purchaseToken: "test_purchase_token_123456789",
              }),
              correlationId: "fixture",
            })
          : read._handler(ctx, { ...common, jobId: "job-fixture" });
      await expect(request).rejects.toThrow("UNKNOWN_ERROR");
      expect(ctx.runQuery.mock.calls.length).toBe(0);
      expect(ctx.runMutation.mock.calls.length).toBe(0);
    },
  );

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

  it("keeps Google purchase-not-found unresolved without a final verdict", async () => {
    const input = {
      store: "google",
      purchaseToken: "test_purchase_token_123456789",
    };
    const apiKeyHash = "key-hash";
    const idempotencyHash = "idempotency-hash";
    const requestHash = "request-hash";
    const ctx = {
      runMutation: vi
        .fn()
        .mockResolvedValueOnce({
          apiKeyHash,
          idempotencyHash,
          requestHash,
          status: "running",
          expiresAt: Date.now() + 60_000,
          correlationId: "fixture",
          payload: encryptVerificationJob(
            JSON.stringify({ apiKey: "openiap-kit_pk_fixture", input }),
            JSON.stringify([apiKeyHash, idempotencyHash, requestHash]),
          ),
        })
        .mockResolvedValue(null),
    };
    verifiers.google.mockRejectedValue(
      new PlayStoreVerificationError(new PlayStorePurchaseNotFoundError()),
    );
    await run._handler(ctx, { jobId, lease: "lease" });
    expect(ctx.runMutation.mock.lastCall?.[1]).toEqual({
      jobId,
      lease: "lease",
      error: {
        code: "PLAY_STORE_VERIFICATION_ERROR",
        message:
          "Verification could not finish. Check the project configuration or contact support.",
      },
    });
  });

  it("retries classified Amazon outages while leaving permanent failures final", () => {
    const outage = verificationJobFailure(
      new AmazonReceiptVerificationError("private-response", { outage: true }),
    );
    expect(outage.retryAfterSec).toBe(5);
    expect(outage.error.code).toBe("AMAZON_RECEIPT_VERIFICATION_ERROR");
    expect(JSON.stringify(outage)).not.toContain("private-response");
    expect(
      verificationJobFailure(
        new AmazonReceiptVerificationError("invalid shared secret", {
          status: 496,
        }),
      ).retryAfterSec,
    ).toBeUndefined();
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
