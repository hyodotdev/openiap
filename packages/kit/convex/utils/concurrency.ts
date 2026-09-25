// `Promise.all(items.map(fn))` with at most `concurrency` calls in flight, for
// APIs that throttle (App Store Connect, Meta Graph) where unbounded calls trip
// 429s and a sequential loop is too slow. Results keep input order.
export async function mapWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  let stopped = false;
  let hasError = false;
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
          if (!hasError) {
            hasError = true;
            firstError = error;
          }
          // Do not start more work, but let every already-running worker reach
          // its own cleanup before this mapper rejects.
          stopped = true;
          return;
        }
      }
    },
  );
  await Promise.all(workers);
  if (hasError) {
    throw firstError instanceof Error
      ? firstError
      : new Error("Concurrent worker failed with a non-Error rejection");
  }
  return out;
}
