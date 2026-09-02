import { describe, expect, it, vi } from "vitest";

import {
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
