import { describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getAuthUserId: vi.fn() }));
vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMocks.getAuthUserId,
}));

import type { Id } from "../_generated/dataModel";
import {
  cancelProductSync as registeredCancelProductSync,
  enqueueProductSync as registeredEnqueueProductSync,
  getSyncJobById as registeredGetSyncJobById,
  PRODUCT_SYNC_FAILURES_CAP,
  PRODUCT_SYNC_MANUAL_ACTIONS_CAP,
  PRODUCT_SYNC_FAILED_RETENTION_MS,
  PRODUCT_SYNC_JOB_DEADLINE_MS,
  PRODUCT_SYNC_REAPER_GRACE_MS,
  PRODUCT_SYNC_SUCCEEDED_RETENTION_MS,
  getJobForWorker as registeredGetJobForWorker,
  isCancelRequested as registeredIsCancelRequested,
  markJobRunning as registeredMarkJobRunning,
  markJobSucceeded as registeredMarkJobSucceeded,
  reapStaleProductSyncJobs as registeredReapStaleProductSyncJobs,
  truncateFailures,
  truncateManualActions,
} from "./jobs";
import {
  PRODUCT_SYNC_DEADLINE_SAFETY_MS,
  isProductSyncDeadlineReached,
  truncatePlannedWrites,
} from "./syncResult";
import { testableFunction } from "../test.setup";

const getSyncJobById = testableFunction(registeredGetSyncJobById);
const getJobForWorker = testableFunction(registeredGetJobForWorker);
const isCancelRequested = testableFunction(registeredIsCancelRequested);
const markJobRunning = testableFunction(registeredMarkJobRunning);
const markJobSucceeded = testableFunction(registeredMarkJobSucceeded);
const cancelProductSync = testableFunction(registeredCancelProductSync);
const enqueueProductSync = testableFunction(registeredEnqueueProductSync);
const reapStaleProductSyncJobs = testableFunction(
  registeredReapStaleProductSyncJobs,
);

describe("queued jobs never hold the platform slot forever", () => {
  function makeCtx(job: Record<string, unknown>) {
    const rows = new Map<string, Record<string, unknown>>([
      [
        "job_a",
        { _id: "job_a", projectId: "project_a", platform: "IOS", ...job },
      ],
      [
        "project_a",
        {
          _id: "project_a",
          organizationId: "organization_a",
          activeSyncJobIds: { IOS: "job_a" },
        },
      ],
      ["organization_a", { _id: "organization_a" }],
    ]);
    const db = {
      get: vi.fn(async (id: string) => rows.get(id) ?? null),
      normalizeId: (_table: string, id: string) => id,
      patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
        Object.assign(rows.get(id) ?? {}, value);
      }),
      query: (table: string) => ({
        withIndex: (
          _name: string,
          build: (q: {
            eq: (field: string, value: unknown) => unknown;
            lt: (field: string, value: number) => unknown;
          }) => unknown,
        ) => {
          const filters: Array<(row: Record<string, unknown>) => boolean> = [];
          const q = {
            eq: (field: string, value: unknown) => {
              filters.push((row) => row[field] === value);
              return q;
            },
            // Convex sorts a missing field before every number.
            lt: (field: string, value: number) => {
              filters.push(
                (row) =>
                  row[field] === undefined ||
                  (typeof row[field] === "number" && row[field] < value),
              );
              return q;
            },
          };
          build(q);
          const matches = () =>
            [...rows.values()].filter(
              (row) =>
                (table !== "productSyncJobs" || row._id === "job_a") &&
                filters.every((filter) => filter(row)),
            );
          return {
            take: async (count: number) => matches().slice(0, count),
            first: async () =>
              table === "organizationMembers"
                ? { role: "admin", userId: "user_a" }
                : (matches()[0] ?? null),
          };
        },
      }),
    };
    return { ctx: { db }, rows };
  }

  it("reaps a queued job whose worker never started", async () => {
    const { ctx, rows } = makeCtx({
      status: "queued",
      expectedDeadline: Date.now() - PRODUCT_SYNC_REAPER_GRACE_MS - 1,
    });

    await expect(reapStaleProductSyncJobs._handler(ctx, {})).resolves.toEqual({
      reaped: 1,
    });
    expect(rows.get("job_a")).toMatchObject({ status: "failed" });
    expect(rows.get("project_a")?.activeSyncJobIds).toEqual({
      IOS: undefined,
    });
  });

  it("gives a job queued before deadlines existed the default deadline", async () => {
    const fresh = makeCtx({ status: "queued", createdAt: Date.now() });
    await expect(
      reapStaleProductSyncJobs._handler(fresh.ctx, {}),
    ).resolves.toEqual({ reaped: 0 });
    expect(fresh.rows.get("job_a")).toMatchObject({ status: "queued" });

    const old = makeCtx({
      status: "queued",
      createdAt:
        Date.now() -
        PRODUCT_SYNC_JOB_DEADLINE_MS -
        PRODUCT_SYNC_REAPER_GRACE_MS -
        1,
    });
    await expect(
      reapStaleProductSyncJobs._handler(old.ctx, {}),
    ).resolves.toEqual({ reaped: 1 });
  });

  it("gives a newly queued job a deadline", async () => {
    authMocks.getAuthUserId.mockResolvedValue("user_a");
    const { ctx, rows } = makeCtx({ status: "succeeded" });
    const inserted: Record<string, unknown>[] = [];
    const queueCtx = {
      ...ctx,
      db: {
        ...ctx.db,
        insert: vi.fn(
          async (_table: string, value: Record<string, unknown>) => {
            inserted.push(value);
            rows.set("job_new", { _id: "job_new", ...value });
            return "job_new";
          },
        ),
      },
      scheduler: { runAfter: vi.fn() },
    };

    await enqueueProductSync._handler(queueCtx, {
      projectId: "project_a" as Id<"projects">,
      platform: "IOS",
    });

    expect(inserted[0]).toMatchObject({ status: "queued" });
    expect(inserted[0]?.expectedDeadline).toBeGreaterThan(Date.now());
  });

  it("releases the slot when an operator cancels a queued job", async () => {
    authMocks.getAuthUserId.mockResolvedValue("user_a");
    const { ctx, rows } = makeCtx({ status: "queued" });

    await expect(
      cancelProductSync._handler(ctx, {
        projectId: "project_a" as Id<"projects">,
        jobId: "job_a",
      }),
    ).resolves.toEqual({ ok: true });
    expect(rows.get("job_a")).toMatchObject({
      status: "failed",
      error: "Cancelled by operator",
    });
    expect(rows.get("project_a")?.activeSyncJobIds).toEqual({
      IOS: undefined,
    });
  });
});

describe("truncateFailures", () => {
  it("returns the original array unchanged when under the cap", () => {
    const failures = Array.from({ length: 10 }, (_, i) => ({
      productId: `p${i}`,
      reason: "boom",
    }));
    const { items, truncated } = truncateFailures(failures);
    expect(items).toBe(failures);
    expect(truncated).toBe(false);
  });

  it("caps the array and flips the flag when over", () => {
    const failures = Array.from(
      { length: PRODUCT_SYNC_FAILURES_CAP + 50 },
      (_, i) => ({ productId: `p${i}`, reason: "boom" }),
    );
    const { items, truncated } = truncateFailures(failures);
    expect(items.length).toBe(PRODUCT_SYNC_FAILURES_CAP);
    expect(items[0]?.productId).toBe("p0");
    expect(truncated).toBe(true);
  });

  it("preserves order when truncating", () => {
    const failures = Array.from(
      { length: PRODUCT_SYNC_FAILURES_CAP + 1 },
      (_, i) => ({ productId: `p${i}`, reason: "boom" }),
    );
    const { items } = truncateFailures(failures);
    for (let i = 0; i < items.length; i += 1) {
      expect(items[i]?.productId).toBe(`p${i}`);
    }
  });
});

describe("truncateManualActions", () => {
  it("caps action count and individual upstream messages", () => {
    const actions = Array.from(
      { length: PRODUCT_SYNC_MANUAL_ACTIONS_CAP + 1 },
      (_, index) => ({
        productId: `product-${index}`,
        code: "app_version_required",
        message: "x".repeat(2_000),
      }),
    );

    const { items, truncated } = truncateManualActions(actions);

    expect(items).toHaveLength(PRODUCT_SYNC_MANUAL_ACTIONS_CAP);
    expect(items[0]?.message.length).toBeLessThanOrEqual(1_000);
    expect(items[0]?.message.endsWith("…")).toBe(true);
    expect(truncated).toBe(true);
  });

  it("preserves an already bounded action array", () => {
    const actions = [
      {
        productId: "coins",
        code: "app_version_required",
        message: "Submit with an app version",
      },
    ];

    expect(truncateManualActions(actions)).toEqual({
      items: actions,
      truncated: false,
    });
  });
});

describe("truncatePlannedWrites", () => {
  it("bounds count and verbose dry-run details", () => {
    const writes = Array.from({ length: 400 }, (_, index) => ({
      productId: `product-${index}`,
      step: "create",
      detail: "x".repeat(1_000),
    }));
    const { items, truncated } = truncatePlannedWrites(writes);
    expect(items).toHaveLength(300);
    expect(items[0]?.detail?.length).toBeLessThanOrEqual(512);
    expect(truncated).toBe(true);
  });
});

describe("retention constants", () => {
  // Sanity-check the bounds the reaper / pruner crons rely on.
  // Without these the worker timeout is meaningless and the pruner
  // could delete failed jobs before the operator can read them.
  it("reaper grace is shorter than the worker deadline", () => {
    expect(PRODUCT_SYNC_REAPER_GRACE_MS).toBeLessThan(
      PRODUCT_SYNC_JOB_DEADLINE_MS,
    );
  });

  it("failed retention outlives succeeded retention", () => {
    expect(PRODUCT_SYNC_FAILED_RETENTION_MS).toBeGreaterThan(
      PRODUCT_SYNC_SUCCEEDED_RETENTION_MS,
    );
  });

  it("reserves cleanup time before the action deadline", () => {
    const deadline = 1_000_000;
    expect(
      isProductSyncDeadlineReached(
        deadline - PRODUCT_SYNC_DEADLINE_SAFETY_MS - 1,
        deadline,
      ),
    ).toBe(false);
    expect(
      isProductSyncDeadlineReached(
        deadline - PRODUCT_SYNC_DEADLINE_SAFETY_MS,
        deadline,
      ),
    ).toBe(true);
  });
});

describe("worker deadline persistence", () => {
  it("returns the same deadline written to the job row", async () => {
    const rows = new Map<string, Record<string, unknown>>([
      [
        "job_a",
        {
          _id: "job_a",
          projectId: "project_a",
          status: "queued",
        },
      ],
      [
        "project_a",
        {
          _id: "project_a",
          organizationId: "organization_a",
        },
      ],
      ["organization_a", { _id: "organization_a" }],
    ]);
    const patch = vi.fn(async (_id: string, value: Record<string, unknown>) =>
      Object.assign(rows.get("job_a")!, value),
    );
    const ctx = {
      db: {
        get: vi.fn(async (id: string) => rows.get(id) ?? null),
        patch,
      },
    };

    const deadline = await markJobRunning._handler(ctx, {
      jobId: "job_a" as never,
    });

    expect(deadline).toBe(rows.get("job_a")?.expectedDeadline);
    expect(deadline).toBeGreaterThan(Date.now());
  });
});

describe("pending-deletion worker guards", () => {
  for (const pendingOwner of ["project", "organization"] as const) {
    it(`stops workers and terminal writes when the ${pendingOwner} is pending deletion`, async () => {
      const rows = new Map<string, Record<string, unknown>>([
        [
          "job_a",
          {
            _id: "job_a",
            projectId: "project_a",
            platform: "IOS",
            status: "running",
          },
        ],
        [
          "project_a",
          {
            _id: "project_a",
            organizationId: "organization_a",
            pendingDeletion: pendingOwner === "project",
          },
        ],
        [
          "organization_a",
          {
            _id: "organization_a",
            pendingDeletion: pendingOwner === "organization",
          },
        ],
      ]);
      const patch = vi.fn();
      const ctx = {
        db: {
          get: vi.fn(async (id: string) => rows.get(id) ?? null),
          patch,
        },
      };

      await expect(
        getJobForWorker._handler(ctx as never, { jobId: "job_a" as never }),
      ).resolves.toBeNull();
      await expect(
        isCancelRequested._handler(ctx as never, {
          jobId: "job_a" as never,
        }),
      ).resolves.toBe(true);
      await expect(
        markJobSucceeded._handler(ctx as never, {
          jobId: "job_a" as never,
          pulled: 1,
          pushed: 1,
          failures: [],
        }),
      ).resolves.toBeUndefined();
      expect(patch).not.toHaveBeenCalled();
    });
  }

  it("reads a malformed sync-job id as not found, not a crash", async () => {
    // Ids arrive from URL paths; normalizeId turns garbage into the same
    // "Sync job not found" ConvexError a missing job raises (a 400 at the
    // route) instead of failing argument validation into a 500.
    const rows = new Map<string, unknown>([
      ["project_a", { _id: "project_a", organizationId: "organization_a" }],
      ["organization_a", { _id: "organization_a" }],
    ]);
    const normalizeId = vi.fn().mockReturnValue(null);
    const ctx = {
      db: {
        normalizeId,
        get: vi.fn(async (id: string) => rows.get(id) ?? null),
        query: vi.fn(() => ({
          withIndex: () => ({
            first: async () => ({
              _id: "key_a",
              projectId: "project_a",
              organizationId: "organization_a",
              keyType: "secret",
            }),
            unique: async () => null,
          }),
        })),
      },
    };
    await expect(
      getSyncJobById._handler(ctx as never, {
        apiKey: "openiap-kit_sk_x",
        jobId: "not-a-convex-id",
      }),
    ).rejects.toMatchObject({ data: { message: "Sync job not found" } });
    expect(normalizeId).toHaveBeenCalledWith(
      "productSyncJobs",
      "not-a-convex-id",
    );
  });

  it("treats a job deleted by the cascade as canceled", async () => {
    const ctx = { db: { get: vi.fn().mockResolvedValue(null) } };
    await expect(
      isCancelRequested._handler(ctx as never, { jobId: "job_gone" as never }),
    ).resolves.toBe(true);
  });
});
