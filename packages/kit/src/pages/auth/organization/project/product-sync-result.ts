export interface ProductSyncResultJob {
  status: string;
  progress: { phase: string };
}

export interface ProductSyncSummaryJob {
  dryRun: boolean;
  direction: string;
  result: {
    pulled: number;
    pushed: number;
    deleted?: number;
  };
}

/** Describe actual and dry-run counts without implying previewed writes ran. */
export function formatProductSyncSummary(job: ProductSyncSummaryJob): string {
  if (job.dryRun) {
    return (
      `Dry-run — would pull ${job.result.pulled}, would push ${job.result.pushed}` +
      (job.result.deleted !== undefined
        ? `, would delete ${job.result.deleted}`
        : "") +
      " (no writes performed)"
    );
  }
  if (job.direction === "purge-local" && job.result.deleted !== undefined) {
    return `Reset — deleted ${job.result.deleted} row${
      job.result.deleted === 1 ? "" : "s"
    }`;
  }
  return (
    `Last sync — pulled ${job.result.pulled}, pushed ${job.result.pushed}` +
    (job.result.deleted !== undefined ? `, deleted ${job.result.deleted}` : "")
  );
}

/** Keep the latest terminal result visible across reloads until dismissal. */
export function shouldShowProductSyncResult(
  job: ProductSyncResultJob | null,
): boolean {
  if (!job) return false;
  const terminal = job.status === "succeeded" || job.status === "failed";
  return terminal && job.progress.phase !== "dismissed";
}
