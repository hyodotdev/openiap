// Bounded-parallelism mapper. Replaces a plain `Promise.all(items.map(fn))`
// pattern with one that limits in-flight calls to `concurrency` —
// useful for fan-outs against external APIs that throttle aggressively
// (App Store Connect, Meta Graph, etc.) where unbounded parallelism
// would trip 429s, but sequential `for await` would balloon wall-clock
// time on large batches.
//
// Output preserves input order regardless of completion order so the
// caller can pair results back to their source items by index.
export async function mapWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  let stopped = false;
  let firstError: unknown;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length)) },
    async () => {
      while (!stopped) {
        const idx = cursor++;
        if (idx >= items.length) return;
        try {
          out[idx] = await fn(items[idx], idx);
        } catch (error) {
          if (firstError === undefined) firstError = error;
          // Do not start more work, but let every already-running worker reach
          // its own cleanup before this mapper rejects.
          stopped = true;
          return;
        }
      }
    },
  );
  await Promise.all(workers);
  if (firstError !== undefined) {
    throw firstError instanceof Error
      ? firstError
      : new Error("Concurrent worker failed with a non-Error rejection");
  }
  return out;
}
