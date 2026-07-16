import { describe, expect, it, vi } from "vitest";

import {
  PRODUCT_SYNC_FAILURES_CAP,
  PRODUCT_SYNC_FAILED_RETENTION_MS,
  PRODUCT_SYNC_JOB_DEADLINE_MS,
  PRODUCT_SYNC_REAPER_GRACE_MS,
  PRODUCT_SYNC_SUCCEEDED_RETENTION_MS,
  getJobForWorker,
  isCancelRequested,
  markJobSucceeded,
  truncateFailures,
} from "./jobs";

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

  it("treats a job deleted by the cascade as canceled", async () => {
    const ctx = { db: { get: vi.fn().mockResolvedValue(null) } };
    await expect(
      isCancelRequested._handler(ctx as never, { jobId: "job_gone" as never }),
    ).resolves.toBe(true);
  });
});
