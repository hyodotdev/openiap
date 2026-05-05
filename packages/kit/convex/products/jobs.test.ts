import { describe, expect, it } from "vitest";

import {
  PRODUCT_SYNC_FAILURES_CAP,
  PRODUCT_SYNC_FAILED_RETENTION_MS,
  PRODUCT_SYNC_JOB_DEADLINE_MS,
  PRODUCT_SYNC_REAPER_GRACE_MS,
  PRODUCT_SYNC_SUCCEEDED_RETENTION_MS,
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
