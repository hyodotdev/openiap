export type WebhookStreamCursor = {
  sinceMs: number;
  afterCreationTime?: number;
};

export type WebhookStreamSeenSet = {
  has(id: string): boolean;
  add(id: string): void;
};

// Minimal contract the helper needs from a webhook event row. The
// caller may pass through additional fields (the SSE writer reads
// `type`, the dashboard reads payload bodies etc.); the index
// signature lets those flow through without forcing every callsite
// to widen back to `Record<string, unknown>`.
export type WebhookStreamEvent = {
  id?: unknown;
  receivedAt?: unknown;
  _creationTime?: unknown;
  [key: string]: unknown;
};

export type DrainWebhookEventBatchesOptions = {
  initialCursor: WebhookStreamCursor;
  limit?: number;
  maxIterations: number;
  isAborted?: () => boolean;
  loadBatch: (
    cursor: WebhookStreamCursor & { limit: number },
  ) => Promise<WebhookStreamEvent[]>;
  seen: WebhookStreamSeenSet;
  writeEvent: (event: WebhookStreamEvent, id: string) => Promise<void>;
  onIterationLimit?: (state: {
    iterations: number;
    cursor: WebhookStreamCursor;
  }) => void;
  onSaturatedCohortFallback?: (state: {
    iterations: number;
    cursor: WebhookStreamCursor;
    nextSinceMs: number;
    limit: number;
  }) => void;
};

export type DrainWebhookEventBatchesResult = {
  cursor: WebhookStreamCursor;
  delivered: number;
  iterations: number;
  hitIterationLimit: boolean;
};

/**
 * Drains webhook event pages using a moving `(receivedAt, _creationTime)`
 * cursor. Events are processed sequentially so the caller can preserve SSE
 * ordering and backpressure; an event id is added to `seen` only after
 * `writeEvent` succeeds, leaving failed writes retryable on the next pass.
 * Abort checks stop further work without throwing, and `maxIterations` bounds
 * the loop for safety. When the source query appears to truncate a saturated
 * same-millisecond cohort, the helper reports the fallback and advances
 * `sinceMs` by one millisecond before retrying.
 */
export async function drainWebhookEventBatches(
  options: DrainWebhookEventBatchesOptions,
): Promise<DrainWebhookEventBatchesResult> {
  const limit = options.limit ?? 500;
  const cursor: WebhookStreamCursor = {
    sinceMs: options.initialCursor.sinceMs,
    afterCreationTime: options.initialCursor.afterCreationTime,
  };
  let delivered = 0;
  let iterations = 0;
  let hitIterationLimit = false;
  // Tracks whether the previous iteration *observed* events at
  // `cursor.sinceMs` (delivered or deduped). Used by the saturated-
  // cohort fallback below so a single millisecond's burst that
  // exceeds the underlying query's row cap can still make forward
  // progress even when the whole page was already in `seen`.
  let lastObservedReceivedAt: number | null = null;

  while (!options.isAborted?.()) {
    if (iterations >= options.maxIterations) {
      hitIterationLimit = true;
      options.onIterationLimit?.({ iterations, cursor: { ...cursor } });
      break;
    }
    iterations += 1;

    const batch = await options.loadBatch({ ...cursor, limit });
    if (!batch.length) {
      // Saturated-cohort fallback: if the previous iteration saw
      // events stuck at this millisecond and the next query came back
      // empty, the underlying query may have hidden the rest of that
      // cohort behind its own row cap (e.g. boundaryTail.take(limit)
      // returning a partial slice of a same-ms burst). Advance past
      // the millisecond and try once more before declaring drain
      // complete. We gate on observation rather than delivery so a
      // full page of dedup'd same-ms events still advances the cursor.
      if (lastObservedReceivedAt === cursor.sinceMs) {
        options.onSaturatedCohortFallback?.({
          iterations,
          cursor: { ...cursor },
          nextSinceMs: cursor.sinceMs + 1,
          limit,
        });
        cursor.sinceMs += 1;
        cursor.afterCreationTime = undefined;
        lastObservedReceivedAt = null;
        continue;
      }
      break;
    }

    let advanced = false;
    for (const event of batch) {
      if (options.isAborted?.()) break;

      if (advanceCursor(cursor, event)) {
        advanced = true;
      }
      if (typeof event.receivedAt === "number") {
        lastObservedReceivedAt = event.receivedAt;
      }

      const id = typeof event.id === "string" ? event.id : null;
      if (!id || options.seen.has(id)) {
        continue;
      }
      // Add to `seen` *after* writeEvent succeeds so a thrown writer
      // leaves the event eligible for retry on the next drain pass.
      // The await keeps the loop sequential, so there's no in-batch
      // race where the same id could be dispatched twice.
      await options.writeEvent(event, id);
      options.seen.add(id);
      delivered += 1;
    }

    if (!advanced || batch.length < limit) {
      break;
    }
  }

  return {
    cursor,
    delivered,
    iterations,
    hitIterationLimit,
  };
}

function advanceCursor(
  cursor: WebhookStreamCursor,
  event: WebhookStreamEvent,
): boolean {
  const receivedAt =
    typeof event.receivedAt === "number" ? event.receivedAt : null;
  if (receivedAt === null) {
    return false;
  }

  const creationTime =
    typeof event._creationTime === "number" ? event._creationTime : undefined;

  if (receivedAt > cursor.sinceMs) {
    cursor.sinceMs = receivedAt;
    cursor.afterCreationTime = creationTime;
    return true;
  }

  if (
    receivedAt === cursor.sinceMs &&
    creationTime !== undefined &&
    (cursor.afterCreationTime === undefined ||
      creationTime > cursor.afterCreationTime)
  ) {
    cursor.afterCreationTime = creationTime;
    return true;
  }

  return false;
}
