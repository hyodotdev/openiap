import { createHash, createHmac, randomBytes } from "node:crypto";
import { ConvexError } from "convex/values";
import { getFunctionName, type FunctionReference } from "convex/server";
import { describe, expect, it, vi } from "vitest";

import type { Id } from "../_generated/dataModel";
import {
  AmazonReceiptVerificationError,
  AmazonSandboxNotEnabledError,
  AppStoreBundleIdMismatchError,
  AppStoreInvalidJWSFormatError,
  AppStoreServerCredentialsMissingError,
  AppStoreTransactionVerificationFailedError,
  InvalidApiKeyError,
  MetaHorizonVerificationError,
  PlayStoreAuthenticationFailedError,
  PlayStorePurchaseNotFoundError,
  PlayStorePurchaseVerificationFailedError,
  PlayStoreVerificationError,
  ProjectAndroidPackageNameNotConfiguredError,
  STORE_OUTAGE_RETRY_AFTER_SEC,
} from "../purchases/errors";
import { HarmonizedPurchaseState } from "../purchases/purchaseState";
import { testableFunction } from "../test.setup";
import { purchaseIssueCauseValidator } from "../utils/validation";
import {
  issueRecordTarget,
  recordPurchaseIssue,
  type PurchaseIssueInput,
} from "./internal";
import { MemoryDb, memoryCtx } from "../test.memoryDb";
import {
  classifyVerdict,
  classifyVerificationError,
  isPurchaseScopedIssue,
  PROJECT_ISSUE_THROTTLE_MS,
  projectIssueDigest,
  verifyRecordingIssues,
} from "./shared";

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const PROJECT = "projects_1" as Id<"projects">;
const SALT = "project-fingerprint-salt";
const fingerprint = (digest: string): string =>
  createHmac("sha256", SALT).update(digest).digest("hex");
const recordTarget = testableFunction(issueRecordTarget)._handler;

describe("classifyVerificationError", () => {
  it.each([
    [new ProjectAndroidPackageNameNotConfiguredError(), "STORE_NOT_CONFIGURED"],
    [
      new AppStoreServerCredentialsMissingError(["keyId"]),
      "CREDENTIALS_MISSING",
    ],
    [new AppStoreBundleIdMismatchError("a", "b"), "APP_MISMATCH"],
    [new AppStoreInvalidJWSFormatError(), "MALFORMED_EVIDENCE"],
    [new AmazonSandboxNotEnabledError(), "SANDBOX_NOT_ALLOWED"],
    [
      new PlayStoreVerificationError(new PlayStoreAuthenticationFailedError()),
      "CREDENTIALS_REJECTED",
    ],
    [
      new AppStoreTransactionVerificationFailedError("denied", undefined, 401),
      "CREDENTIALS_REJECTED",
    ],
    [
      new MetaHorizonVerificationError("Error 403", undefined, 403),
      "CREDENTIALS_REJECTED",
    ],
    [
      new AmazonReceiptVerificationError("invalid shared secret", {
        status: 496,
      }),
      "CREDENTIALS_REJECTED",
    ],
    [
      new AmazonReceiptVerificationError("TypeError", { outage: true }),
      "STORE_UNAVAILABLE",
    ],
    // No store confirmed these as purchases: a signature that failed locally,
    // a token Google does not know, or a request the store refused.
    [new AppStoreTransactionVerificationFailedError("forged"), "INAUTHENTIC"],
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
    [new MetaHorizonVerificationError("bad json"), "VERIFICATION_FAILED"],
    [new AmazonReceiptVerificationError("bad json"), "VERIFICATION_FAILED"],
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

  it("records nothing for an unknown key, an internal fault, or a write conflict", () => {
    expect(classifyVerificationError(new InvalidApiKeyError())).toBeNull();
    expect(classifyVerificationError(new Error("boom"))).toBeNull();
    const conflict = new PlayStoreVerificationError(
      new Error(
        "Documents read from or written to the table changed while this mutation was being run",
      ),
    );
    expect(conflict.retryAfterSec).toBe(STORE_OUTAGE_RETRY_AFTER_SEC);
    expect(classifyVerificationError(conflict)).toBeNull();
  });
});

describe("classifyVerdict", () => {
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
    expect(
      classifyVerdict(
        { state: HarmonizedPurchaseState.ENTITLED, productId: "premium" },
        "premium",
      ),
    ).toBeNull();
    expect(
      classifyVerdict({ state: HarmonizedPurchaseState.EXPIRED }, undefined),
    ).toBeNull();
  });
});

describe("isPurchaseScopedIssue", () => {
  it("scopes only store answers about a verified purchase and bind failures", () => {
    expect(
      purchaseIssueCauseValidator.members
        .map((member) => member.value)
        .filter(isPurchaseScopedIssue),
    ).toEqual([
      "STORE_PENDING",
      "PRODUCT_MISMATCH",
      "OWNERSHIP_CONFLICT",
      "BIND_LIMIT_REACHED",
    ]);
  });
});

describe("verifyRecordingIssues", () => {
  const jws = "eyJhbGciOiJFUzI1NiJ9.eyJ0cmFuc2FjdGlvbklkIjoiMSJ9.c2ln";
  const correlationId = "0f8fad5b-d9cb-469f-a165-70867728950e";

  // An action ctx whose query and scheduled record run against `db`, as
  // Convex would.
  function actionCtx(db = new MemoryDb()) {
    db.seed("organizations", { _id: "organizations_1" });
    db.seed("projects", {
      _id: PROJECT,
      organizationId: "organizations_1",
      fingerprintSalt: SALT,
    });
    for (const key of ["k", "openiap-kit_pk_app"]) {
      db.seed("apiKeys", {
        key,
        keyType: "publishable",
        isActive: true,
        projectId: PROJECT,
        organizationId: "organizations_1",
      });
    }
    const scheduled: Array<{
      projectId: Id<"projects">;
      issue: PurchaseIssueInput;
    }> = [];
    const runQuery = vi.fn(
      async (
        reference: FunctionReference<"query">,
        args: Parameters<typeof recordTarget>[1],
      ) => {
        expect(getFunctionName(reference)).toBe(
          "purchaseIssues/internal:issueRecordTarget",
        );
        return recordTarget(memoryCtx(db), args);
      },
    );
    const runAfter = vi.fn(
      async (
        _delay: number,
        reference: FunctionReference<"mutation">,
        args: { projectId: Id<"projects">; issue: PurchaseIssueInput },
      ) => {
        expect(getFunctionName(reference)).toBe(
          "purchaseIssues/internal:record",
        );
        scheduled.push(args);
        await recordPurchaseIssue(
          memoryCtx(db) as never,
          args.projectId,
          args.issue,
        );
      },
    );
    return {
      ctx: { runQuery, scheduler: { runAfter } } as never,
      db,
      scheduled,
      runAfter,
      runQuery,
    };
  }

  it("rethrows the original error and records it on the project row, never the evidence", async () => {
    const { ctx, scheduled } = actionCtx();
    const failure = new AppStoreTransactionVerificationFailedError("forged");

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

    expect(scheduled).toEqual([
      {
        projectId: PROJECT,
        issue: {
          cause: "INAUTHENTIC",
          store: "apple",
          digest: await projectIssueDigest("apple", "INAUTHENTIC"),
          correlationId,
        },
      },
    ]);
    expect(JSON.stringify(scheduled)).not.toContain(sha256(jws));
    expect(JSON.stringify(scheduled)).not.toContain("openiap-kit_pk_app");
  });

  it("keeps a real purchase's row through a flood of evidence no store recognized", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { ctx, db, runAfter } = actionCtx();
    // A store's answer about a real purchase: keyed by its evidence.
    await verifyRecordingIssues(
      ctx,
      {
        apiKey: "k",
        evidence: { store: "google", purchaseToken: "real-token" },
        expectedProductId: "other",
      },
      () =>
        Promise.resolve({
          isValid: false,
          state: HarmonizedPurchaseState.INAUTHENTIC,
          productId: "premium",
        }),
    );
    const random = (): string => randomBytes(24).toString("hex");
    const unrecognized: Array<() => Promise<unknown>> = [
      () =>
        verifyRecordingIssues(
          ctx,
          { apiKey: "k", evidence: { store: "apple", jws: random() } },
          () =>
            Promise.reject(
              new AppStoreTransactionVerificationFailedError("forged"),
            ),
        ),
      () =>
        verifyRecordingIssues(
          ctx,
          {
            apiKey: "k",
            evidence: { store: "google", purchaseToken: random() },
          },
          () =>
            Promise.reject(
              new PlayStoreVerificationError(
                new PlayStorePurchaseNotFoundError(),
              ),
            ),
        ),
      () =>
        verifyRecordingIssues(
          ctx,
          {
            apiKey: "k",
            evidence: { store: "horizon", userId: random(), sku: "gem" },
          },
          () =>
            Promise.resolve({
              isValid: false,
              state: HarmonizedPurchaseState.INAUTHENTIC,
              productId: "gem",
            }),
        ),
      () =>
        verifyRecordingIssues(
          ctx,
          {
            apiKey: "k",
            evidence: { store: "amazon", userId: "u", receiptId: random() },
          },
          () =>
            Promise.resolve({
              isValid: false,
              state: HarmonizedPurchaseState.INAUTHENTIC,
            }),
        ),
    ];
    for (let attempt = 0; attempt < 300; attempt += 1) {
      for (const fail of unrecognized) await fail().catch(() => undefined);
    }
    vi.useRealTimers();

    // One evidence row plus one throttled row per store.
    expect(runAfter).toHaveBeenCalledTimes(5);
    const rows = db.rows("purchaseIssues");
    expect(rows.map((row) => [row.store, row.cause])).toEqual([
      ["google", "PRODUCT_MISMATCH"],
      ["apple", "INAUTHENTIC"],
      ["google", "INAUTHENTIC"],
      ["horizon", "INAUTHENTIC"],
      ["amazon", "INAUTHENTIC"],
    ]);
    expect(rows[0]).toMatchObject({
      fingerprint: fingerprint(sha256("real-token")),
      productId: "premium",
      claimedProductId: "other",
    });
    expect(rows[3].fingerprint).toBe(
      fingerprint(await projectIssueDigest("horizon", "INAUTHENTIC")),
    );
    // A project row names no purchase, so it keeps no product.
    expect(rows.slice(1).every((row) => row.productId === undefined)).toBe(
      true,
    );
  });

  it("collapses failures before admission into one row per store and cause", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { ctx, db, runAfter } = actionCtx();
    const failures = [
      () => new AppStoreInvalidJWSFormatError(),
      () => new AppStoreBundleIdMismatchError("a", "b"),
      () =>
        new ConvexError({
          code: "RATE_LIMITED",
          message: "Too many verification requests",
          retryAfterSec: 1,
        }),
    ];
    for (let attempt = 0; attempt < 50; attempt += 1) {
      for (const failure of failures) {
        await verifyRecordingIssues(
          ctx,
          {
            apiKey: "k",
            evidence: { store: "apple", jws: randomBytes(48).toString("hex") },
            expectedProductId: randomBytes(8).toString("hex"),
          },
          () => Promise.reject(failure()),
        ).catch(() => undefined);
      }
    }

    // Each project row is written once a minute however often it repeats.
    expect(runAfter).toHaveBeenCalledTimes(3);
    vi.setSystemTime(1_000_000 + PROJECT_ISSUE_THROTTLE_MS);
    for (const failure of failures) {
      await verifyRecordingIssues(
        ctx,
        { apiKey: "k", evidence: { store: "apple", jws: "x" } },
        () => Promise.reject(failure()),
      ).catch(() => undefined);
    }
    vi.useRealTimers();

    const rows = db.rows("purchaseIssues");
    expect(rows.map((row) => [row.cause, row.count])).toEqual([
      ["MALFORMED_EVIDENCE", 2],
      ["APP_MISMATCH", 2],
      ["RATE_LIMITED", 2],
    ]);
    expect(rows[0].fingerprint).toBe(
      fingerprint(await projectIssueDigest("apple", "MALFORMED_EVIDENCE")),
    );
    // A project row names no purchase, so it keeps no claimed product.
    expect(rows.every((row) => row.claimedProductId === undefined)).toBe(true);
  });

  it("records nothing for an unknown key", async () => {
    const { ctx, runAfter } = actionCtx();
    await verifyRecordingIssues(
      ctx,
      { apiKey: "unknown", evidence: { store: "google", purchaseToken: "t" } },
      () =>
        Promise.resolve({
          isValid: false,
          state: HarmonizedPurchaseState.INAUTHENTIC,
        }),
    );
    expect(runAfter).not.toHaveBeenCalled();
  });

  it("returns a failing verdict unchanged and labels the store-verified product", async () => {
    const { ctx, scheduled } = actionCtx();
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
    expect(scheduled).toEqual([
      {
        projectId: PROJECT,
        issue: {
          cause: "PRODUCT_MISMATCH",
          store: "google",
          digest: sha256("token-value"),
          productId: "premium",
          claimedProductId: "other",
          environment: "Sandbox",
        },
      },
    ]);
  });

  it("schedules nothing for a valid verdict and survives a failed schedule", async () => {
    const { ctx, runAfter, runQuery } = actionCtx();
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
    expect(runQuery).not.toHaveBeenCalled();
    expect(runAfter).not.toHaveBeenCalled();

    runAfter.mockRejectedValueOnce(new Error("scheduler unavailable"));
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
