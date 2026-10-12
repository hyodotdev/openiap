import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consume,
  ENTITLEMENT_RECHECK_CAPACITY,
  evaluateVerificationAdmission,
  VERIFICATION_ADMISSION_CAPACITY,
} from "./verificationAdmission";
import { getVerificationProjectByApiKey } from "./shared";
import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";

afterEach(() => vi.useRealTimers());

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

  it("admits a project immediately after authoritative key lookup", async () => {
    const project = { _id: "projects_1" };
    const ctx = {
      runQuery: vi.fn().mockResolvedValue(project),
      runMutation: vi.fn().mockResolvedValue(null),
    };

    await expect(
      getVerificationProjectByApiKey(ctx as never, "openiap-kit_pk_project"),
    ).resolves.toBe(project);
    expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), {
      projectId: "projects_1",
    });
    expect(ctx.runQuery.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.runMutation.mock.invocationCallOrder[0],
    );
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
