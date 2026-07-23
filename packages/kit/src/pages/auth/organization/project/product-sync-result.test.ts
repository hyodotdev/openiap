import { describe, expect, it } from "vitest";

import {
  formatProductSyncSummary,
  shouldShowProductSyncResult,
} from "./product-sync-result";

describe("shouldShowProductSyncResult", () => {
  it("shows a completed result on the first render after a page reload", () => {
    expect(
      shouldShowProductSyncResult({
        status: "succeeded",
        progress: { phase: "done" },
      }),
    ).toBe(true);
  });

  it("hides active and explicitly dismissed results", () => {
    expect(
      shouldShowProductSyncResult({
        status: "running",
        progress: { phase: "push-drafts" },
      }),
    ).toBe(false);
    expect(
      shouldShowProductSyncResult({
        status: "succeeded",
        progress: { phase: "dismissed" },
      }),
    ).toBe(false);
  });
});

describe("formatProductSyncSummary", () => {
  it("labels every dry-run count as prospective and explicitly read-only", () => {
    expect(
      formatProductSyncSummary({
        dryRun: true,
        direction: "both",
        result: { pulled: 3, pushed: 2 },
      }),
    ).toBe("Dry-run — would pull 3, would push 2 (no writes performed)");
  });

  it("keeps actual sync and reset summaries in past tense", () => {
    expect(
      formatProductSyncSummary({
        dryRun: false,
        direction: "both",
        result: { pulled: 3, pushed: 2, deleted: 1 },
      }),
    ).toBe("Last sync — pulled 3, pushed 2, deleted 1");
    expect(
      formatProductSyncSummary({
        dryRun: false,
        direction: "purge-local",
        result: { pulled: 0, pushed: 0, deleted: 2 },
      }),
    ).toBe("Reset — deleted 2 rows");
  });
});
