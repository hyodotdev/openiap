import { Buffer } from "node:buffer";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consume,
  ENTITLEMENT_RECHECK_CAPACITY,
  evaluateVerificationAdmission,
  VERIFICATION_ADMISSION_CAPACITY,
} from "./verificationAdmission";
import { verifyAmazonReceiptInternalV1 } from "./amazon";
import { verifyGooglePlayReceiptInternalV1 } from "./android";
import { verifyMetaHorizonReceiptInternalV1 } from "./horizon";
import { verifyAppStoreReceiptInternalV1 } from "./ios";
import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const PROJECT_ID = "projects_1" as Id<"projects">;

type BucketRow = {
  _id?: string;
  projectId?: string;
  bucket: string;
  tokens: number;
  refilledAt: number;
};

function admissionCtx(seed: BucketRow[]) {
  const buckets: BucketRow[] = seed.map((row, index) => ({
    _id: `bucket_${index}`,
    projectId: PROJECT_ID,
    ...row,
  }));
  const db = {
    get: vi.fn(async (id: string) => (id === PROJECT_ID ? { _id: id } : null)),
    query: () => ({
      withIndex: (
        _name: string,
        build: (q: { eq: (f: string, v: string) => unknown }) => unknown,
      ) => {
        const match: Record<string, string> = {};
        const q = {
          eq: (field: string, value: string) => {
            match[field] = value;
            return q;
          },
        };
        build(q);
        return {
          unique: async () =>
            buckets.find(
              (row) =>
                row.projectId === match.projectId &&
                row.bucket === match.bucket,
            ) ?? null,
        };
      },
    }),
    insert: vi.fn(async (_table: string, value: BucketRow) => {
      buckets.push({ _id: `bucket_${buckets.length}`, ...value });
    }),
    patch: vi.fn(async (id: string, value: Partial<BucketRow>) => {
      Object.assign(buckets.find((row) => row._id === id) ?? {}, value);
    }),
  };
  return { ctx: { db }, buckets };
}

describe("verification admission", () => {
  it("starts with a full bucket and consumes one token", () => {
    expect(
      evaluateVerificationAdmission({
        tokens: undefined,
        refilledAt: undefined,
        now: 1_000,
      }),
    ).toEqual({
      admitted: true,
      tokens: VERIFICATION_ADMISSION_CAPACITY - 1,
    });
  });

  it("rejects an empty bucket with a retry hint", () => {
    expect(
      evaluateVerificationAdmission({
        tokens: 0,
        refilledAt: 1_000,
        now: 1_000,
      }),
    ).toEqual({ admitted: false, retryAfterSec: 1 });
  });

  it("refills over time without exceeding capacity", () => {
    expect(
      evaluateVerificationAdmission({
        tokens: 0,
        refilledAt: 1_000,
        now: 1_100,
      }),
    ).toEqual({ admitted: true, tokens: 0 });
    expect(
      evaluateVerificationAdmission({
        tokens: VERIFICATION_ADMISSION_CAPACITY,
        refilledAt: 1_000,
        now: 2_000,
      }),
    ).toEqual({
      admitted: true,
      tokens: VERIFICATION_ADMISSION_CAPACITY - 1,
    });
  });

  it("rejects before a store call when the persistent bucket is empty", async () => {
    vi.useFakeTimers({ now: 1_000 });
    const { ctx } = admissionCtx([
      { bucket: "verification", tokens: 0, refilledAt: 1_000 },
    ]);

    await expect(
      testableFunction(consume)._handler(ctx, { projectId: PROJECT_ID }),
    ).rejects.toMatchObject({
      data: {
        code: "RATE_LIMITED",
        retryAfterSec: 1,
      },
    });
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });
});

describe("entitlement recheck admission", () => {
  it("charges a whole read at once and prices the retry by the shortfall", () => {
    expect(
      evaluateVerificationAdmission({
        tokens: 5,
        refilledAt: 1_000,
        now: 1_000,
        cost: 5,
      }),
    ).toEqual({ admitted: true, tokens: 0 });
    expect(
      evaluateVerificationAdmission({
        tokens: 5,
        refilledAt: 1_000,
        now: 1_000,
        cost: 20,
        refillPerSecond: 10,
      }),
    ).toEqual({ admitted: false, retryAfterSec: 2 });
  });

  it("draws on its own bucket and leaves verification admission untouched", async () => {
    vi.useFakeTimers({ now: 5_000 });
    const { ctx, buckets } = admissionCtx([
      { bucket: "verification", tokens: 0, refilledAt: 5_000 },
      { bucket: "entitlementRecheck", tokens: 30, refilledAt: 5_000 },
    ]);
    await testableFunction(consume)._handler(ctx, {
      projectId: PROJECT_ID,
      bucket: "entitlementRecheck",
      cost: 20,
    });
    expect(buckets).toEqual([
      expect.objectContaining({ bucket: "verification", tokens: 0 }),
      expect.objectContaining({ bucket: "entitlementRecheck", tokens: 10 }),
    ]);
    expect(ctx.db.patch).not.toHaveBeenCalledWith(
      PROJECT_ID,
      expect.anything(),
    );
  });

  it("creates a project's bucket on first use without writing the project", async () => {
    vi.useFakeTimers({ now: 5_000 });
    const { ctx, buckets } = admissionCtx([]);

    await testableFunction(consume)._handler(ctx, { projectId: PROJECT_ID });

    expect(buckets).toEqual([
      expect.objectContaining({
        projectId: PROJECT_ID,
        bucket: "verification",
        tokens: 599,
        refilledAt: 5_000,
      }),
    ]);
    expect(ctx.db.patch).not.toHaveBeenCalledWith(
      PROJECT_ID,
      expect.anything(),
    );
  });

  it("rejects a read whose bound purchases exceed the remaining budget", async () => {
    vi.useFakeTimers({ now: 5_000 });
    const { ctx, buckets } = admissionCtx([
      { bucket: "entitlementRecheck", tokens: 0, refilledAt: 5_000 },
    ]);
    await expect(
      testableFunction(consume)._handler(ctx, {
        projectId: PROJECT_ID,
        bucket: "entitlementRecheck",
        cost: 20,
      }),
    ).rejects.toMatchObject({
      data: {
        code: "RATE_LIMITED",
        message: "Too many entitlement rechecks",
        retryAfterSec: 4,
      },
    });
    expect(buckets[0]?.tokens).toBe(0);
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("fills a new recheck bucket to its own capacity", async () => {
    vi.useFakeTimers({ now: 5_000 });
    const { ctx, buckets } = admissionCtx([]);
    await testableFunction(consume)._handler(ctx, {
      projectId: PROJECT_ID,
      bucket: "entitlementRecheck",
      cost: 20,
    });
    expect(buckets).toEqual([
      expect.objectContaining({
        bucket: "entitlementRecheck",
        tokens: ENTITLEMENT_RECHECK_CAPACITY - 20,
        refilledAt: 5_000,
      }),
    ]);
  });

  it("rejects an admission cost outside the bucket", async () => {
    const { ctx } = admissionCtx([]);
    for (const cost of [0, 1.5, ENTITLEMENT_RECHECK_CAPACITY + 1])
      await expect(
        testableFunction(consume)._handler(ctx, {
          projectId: PROJECT_ID,
          bucket: "entitlementRecheck",
          cost,
        }),
      ).rejects.toThrow("outside the bucket capacity");
    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });
});

const API_KEY = "openiap-kit_pk_project";
const APPLE_PROJECT = { iosBundleId: "dev.hyo.martie", iosAppAppleId: 1 };

function appleJws(bundleId: string): string {
  const payload = { bundleId, environment: "Production", transactionId: "1" };
  return [
    "e30",
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "c2ln",
  ].join(".");
}

const verifyApple = (jws: string) => (ctx: unknown) =>
  testableFunction(verifyAppStoreReceiptInternalV1)._handler(ctx, {
    apiKey: API_KEY,
    jws,
  });
const verifyGoogle = (ctx: unknown) =>
  testableFunction(verifyGooglePlayReceiptInternalV1)._handler(ctx, {
    apiKey: API_KEY,
    purchaseToken: "token",
  });
const verifyHorizon = (ctx: unknown) =>
  testableFunction(verifyMetaHorizonReceiptInternalV1)._handler(ctx, {
    apiKey: API_KEY,
    userId: "meta-user",
    sku: "premium",
  });
const verifyAmazon = (sandbox: boolean) => (ctx: unknown) =>
  testableFunction(verifyAmazonReceiptInternalV1)._handler(ctx, {
    apiKey: API_KEY,
    userId: "amzn-user",
    receiptId: "amzn-receipt",
    sandbox,
  });

type StoreCase = {
  name: string;
  project: Record<string, unknown>;
  verify: (ctx: unknown) => Promise<unknown>;
};

// A store context whose only reachable calls are the key lookup, admission,
// and the purchase-issue record a rejection schedules.
function storeContext(project: Record<string, unknown>) {
  vi.useFakeTimers({ now: 1_000 });
  const { ctx: admission } = admissionCtx([
    { bucket: "verification", tokens: 0, refilledAt: 1_000 },
  ]);
  const unexpected = (reference: FunctionReference<"query" | "mutation">) => {
    throw new Error(`unexpected call: ${getFunctionName(reference)}`);
  };
  const issues: Array<{ cause: string }> = [];
  let admissionCalls = 0;
  return {
    issues,
    admissionCalls: () => admissionCalls,
    runQuery: vi.fn(async (reference: FunctionReference<"query">) =>
      getFunctionName(reference) === "projects/internal:getProjectByApiKey"
        ? { _id: PROJECT_ID, ...project }
        : unexpected(reference),
    ),
    runMutation: vi.fn(
      async (
        reference: FunctionReference<"mutation">,
        args: { projectId: Id<"projects"> },
      ) => {
        if (
          getFunctionName(reference) !==
          "purchases/verificationAdmission:consume"
        ) {
          return unexpected(reference);
        }
        admissionCalls += 1;
        return await testableFunction(consume)._handler(admission, args);
      },
    ),
    scheduler: {
      runAfter: vi.fn(
        async (
          _delay: number,
          reference: FunctionReference<"mutation">,
          args: { issue: { cause: string } },
        ) => {
          if (getFunctionName(reference) !== "purchaseIssues/internal:record")
            return unexpected(reference);
          issues.push(args.issue);
        },
      ),
    },
  };
}

describe("verification admission order", () => {
  const rejected: Array<StoreCase & { errorCode: string; cause: string }> = [
    {
      name: "a malformed Apple JWS",
      project: APPLE_PROJECT,
      verify: verifyApple("not-a-jws"),
      errorCode: "APP_STORE_INVALID_JWS_FORMAT",
      cause: "MALFORMED_EVIDENCE",
    },
    {
      name: "an Apple JWS for another app",
      project: APPLE_PROJECT,
      verify: verifyApple(appleJws("com.example.other")),
      errorCode: "APP_STORE_BUNDLE_ID_MISMATCH",
      cause: "APP_MISMATCH",
    },
    {
      name: "a Google request to a project without an Android app",
      project: {},
      verify: verifyGoogle,
      errorCode: "PROJECT_ANDROID_PACKAGE_NAME_NOT_CONFIGURED",
      cause: "STORE_NOT_CONFIGURED",
    },
    {
      name: "a Horizon request to a project without Horizon",
      project: {},
      verify: verifyHorizon,
      errorCode: "META_HORIZON_NOT_ENABLED",
      cause: "STORE_NOT_CONFIGURED",
    },
    {
      name: "an Amazon sandbox request without the opt-in",
      project: { amazonSharedSecret: "secret" },
      verify: verifyAmazon(true),
      errorCode: "AMAZON_SANDBOX_NOT_ENABLED",
      cause: "SANDBOX_NOT_ALLOWED",
    },
  ];

  it.each(rejected)(
    "rejects $name without charging the bucket",
    async ({ project, verify, errorCode, cause }) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const ctx = storeContext(project);

      // An empty bucket would answer RATE_LIMITED if it were charged first.
      await expect(verify(ctx)).rejects.toMatchObject({ errorCode });
      expect(ctx.admissionCalls()).toBe(0);
      expect(ctx.issues.map((issue) => issue.cause)).toEqual([cause]);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  const admitted: StoreCase[] = [
    {
      name: "Apple",
      project: APPLE_PROJECT,
      verify: verifyApple(appleJws("dev.hyo.martie")),
    },
    {
      name: "Google",
      project: { androidPackageName: "com.example.app" },
      verify: verifyGoogle,
    },
    {
      name: "Horizon",
      project: {
        horizonEnabled: true,
        horizonAppId: "1234567890",
        horizonAppSecret: "secret",
      },
      verify: verifyHorizon,
    },
    {
      name: "Amazon",
      project: { amazonSharedSecret: "secret" },
      verify: verifyAmazon(false),
    },
  ];

  it.each(admitted)(
    "charges a well-formed $name request before any store work",
    async ({ project, verify }) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const ctx = storeContext(project);

      await expect(verify(ctx)).rejects.toMatchObject({
        data: { code: "RATE_LIMITED" },
      });
      expect(ctx.admissionCalls()).toBe(1);
      expect(ctx.issues.map((issue) => issue.cause)).toEqual(["RATE_LIMITED"]);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
