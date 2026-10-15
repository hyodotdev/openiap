import { createHash } from "node:crypto";
import { ConvexError } from "convex/values";
import { getFunctionName, type FunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";

import {
  AmazonReceiptVerificationError,
  AmazonSandboxNotEnabledError,
  AppStoreBundleIdMismatchError,
  AppStoreServerCredentialsMissingError,
  AppStoreTransactionVerificationFailedError,
  InvalidApiKeyError,
  PlayStoreAuthenticationFailedError,
  PlayStorePurchaseNotFoundError,
  PlayStorePurchaseVerificationFailedError,
  PlayStoreVerificationError,
  ProjectAndroidPackageNameNotConfiguredError,
  STORE_OUTAGE_RETRY_AFTER_SEC,
} from "../purchases/errors";
import { HarmonizedPurchaseState } from "../purchases/purchaseState";
import {
  classifyVerdict,
  classifyVerificationError,
  verifyRecordingIssues,
} from "./shared";

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

describe("classifyVerificationError", () => {
  it.each([
    [new ProjectAndroidPackageNameNotConfiguredError(), "STORE_NOT_CONFIGURED"],
    [
      new AppStoreServerCredentialsMissingError(["keyId"]),
      "CREDENTIALS_MISSING",
    ],
    [new PlayStoreAuthenticationFailedError(), "CREDENTIALS_REJECTED"],
    [new AppStoreBundleIdMismatchError("a", "b"), "APP_MISMATCH"],
    [new AmazonSandboxNotEnabledError(), "SANDBOX_NOT_ALLOWED"],
    [new AppStoreTransactionVerificationFailedError("forged"), "INAUTHENTIC"],
    [
      new AppStoreTransactionVerificationFailedError("denied", undefined, 401),
      "CREDENTIALS_REJECTED",
    ],
    [
      new AmazonReceiptVerificationError("invalid shared secret", {
        status: 496,
      }),
      "CREDENTIALS_REJECTED",
    ],
    [new AmazonReceiptVerificationError("bad json"), "VERIFICATION_FAILED"],
    // Google wraps the classified error; the wrapped one decides.
    [
      new PlayStoreVerificationError(new PlayStorePurchaseNotFoundError()),
      "INAUTHENTIC",
    ],
    [
      new PlayStoreVerificationError(
        new PlayStorePurchaseVerificationFailedError("bad request", 400),
      ),
      "VERIFICATION_FAILED",
    ],
  ])("classifies %s as %s", (error, cause) => {
    expect(classifyVerificationError(error)).toEqual({ cause });
  });

  it("reports a store outage as retryable with its delay", () => {
    const outage = new PlayStoreVerificationError(
      new PlayStorePurchaseVerificationFailedError(
        "unavailable",
        503,
        STORE_OUTAGE_RETRY_AFTER_SEC,
      ),
    );
    expect(classifyVerificationError(outage)).toEqual({
      cause: "STORE_UNAVAILABLE",
      retryAfterSec: STORE_OUTAGE_RETRY_AFTER_SEC,
    });
  });

  it("reports the project admission limit with its delay", () => {
    const limited = new ConvexError({
      code: "RATE_LIMITED",
      message: "Too many verification requests",
      retryAfterSec: 3,
    });
    expect(classifyVerificationError(limited)).toEqual({
      cause: "RATE_LIMITED",
      retryAfterSec: 3,
    });
  });

  it("records nothing for an unknown key or an internal fault", () => {
    expect(classifyVerificationError(new InvalidApiKeyError())).toBeNull();
    expect(classifyVerificationError(new Error("boom"))).toBeNull();
  });
});

describe("classifyVerdict", () => {
  const entitled = {
    state: HarmonizedPurchaseState.ENTITLED,
    productId: "premium",
  };

  it("separates a product mismatch from a store rejection", () => {
    expect(
      classifyVerdict(
        { state: HarmonizedPurchaseState.INAUTHENTIC, productId: "premium" },
        "other",
      ),
    ).toBe("PRODUCT_MISMATCH");
    // No store-verified product to compare: the store rejected the receipt.
    expect(
      classifyVerdict({ state: HarmonizedPurchaseState.INAUTHENTIC }, "other"),
    ).toBe("INAUTHENTIC");
    expect(
      classifyVerdict({ state: HarmonizedPurchaseState.PENDING }, undefined),
    ).toBe("STORE_PENDING");
    expect(classifyVerdict(entitled, "premium")).toBeNull();
    expect(
      classifyVerdict({ state: HarmonizedPurchaseState.EXPIRED }, undefined),
    ).toBeNull();
  });
});

describe("verifyRecordingIssues", () => {
  const jws = "eyJhbGciOiJFUzI1NiJ9.eyJ0cmFuc2FjdGlvbklkIjoiMSJ9.c2ln";
  const correlationId = "0f8fad5b-d9cb-469f-a165-70867728950e";

  function actionCtx() {
    const recorded: unknown[] = [];
    const runMutation = vi.fn(
      async (reference: FunctionReference<"mutation">, args: unknown) => {
        expect(getFunctionName(reference)).toBe(
          "purchaseIssues/internal:record",
        );
        recorded.push(args);
        return null;
      },
    );
    return { ctx: { runMutation } as never, recorded, runMutation };
  }

  it("rethrows the original error after recording a hash of the evidence", async () => {
    const { ctx, recorded } = actionCtx();
    const failure = new AppStoreBundleIdMismatchError("a", "b");

    await expect(
      verifyRecordingIssues(
        ctx,
        {
          apiKey: "openiap-kit_pk_app",
          evidence: { store: "apple", jws },
          expectedProductId: "premium",
          correlationId,
        },
        () => Promise.reject(failure),
      ),
    ).rejects.toBe(failure);

    expect(recorded).toEqual([
      {
        apiKey: "openiap-kit_pk_app",
        issue: {
          cause: "APP_MISMATCH",
          store: "apple",
          fingerprint: sha256(jws),
          claimedProductId: "premium",
          correlationId,
        },
      },
    ]);
    expect(JSON.stringify(recorded)).not.toContain(jws);
  });

  it("returns a failing verdict unchanged and labels the store-verified product", async () => {
    const { ctx, recorded } = actionCtx();
    const verdict = {
      isValid: false,
      state: HarmonizedPurchaseState.INAUTHENTIC,
      productId: "premium",
      environment: "Sandbox" as const,
    };

    await expect(
      verifyRecordingIssues(
        ctx,
        {
          apiKey: "k",
          evidence: { store: "google", purchaseToken: "token-value" },
          expectedProductId: "other",
        },
        () => Promise.resolve(verdict),
      ),
    ).resolves.toBe(verdict);
    expect(recorded).toEqual([
      {
        apiKey: "k",
        issue: {
          cause: "PRODUCT_MISMATCH",
          store: "google",
          fingerprint: sha256("token-value"),
          productId: "premium",
          claimedProductId: "other",
          environment: "Sandbox",
        },
      },
    ]);
  });

  it("treats a Horizon sku as a claim, never a verified product", async () => {
    const { ctx, recorded } = actionCtx();
    await verifyRecordingIssues(
      ctx,
      { apiKey: "k", evidence: { store: "horizon", userId: "42", sku: "gem" } },
      () =>
        Promise.resolve({
          isValid: false,
          state: HarmonizedPurchaseState.INAUTHENTIC,
          productId: "gem",
        }),
    );
    expect(recorded).toEqual([
      {
        apiKey: "k",
        issue: {
          cause: "INAUTHENTIC",
          store: "horizon",
          fingerprint: sha256("42:gem"),
          claimedProductId: "gem",
        },
      },
    ]);
  });

  it("records nothing for a valid verdict and survives a failed record", async () => {
    const { ctx, runMutation } = actionCtx();
    const entitled = {
      isValid: true,
      state: HarmonizedPurchaseState.ENTITLED,
      productId: "premium",
    };
    await verifyRecordingIssues(
      ctx,
      { apiKey: "k", evidence: { store: "google", purchaseToken: "t" } },
      () => Promise.resolve(entitled),
    );
    expect(runMutation).not.toHaveBeenCalled();

    runMutation.mockRejectedValueOnce(new Error("write conflict"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const pending = { isValid: false, state: HarmonizedPurchaseState.PENDING };
    await expect(
      verifyRecordingIssues(
        ctx,
        { apiKey: "k", evidence: { store: "google", purchaseToken: "t" } },
        () => Promise.resolve(pending),
      ),
    ).resolves.toBe(pending);
    expect(error).toHaveBeenCalledWith(
      "[purchase-issues] record failed: %s",
      "Error",
    );
    error.mockRestore();
  });
});
