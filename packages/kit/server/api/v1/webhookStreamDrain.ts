export type WebhookStreamCursor = {
  sinceMs: number;
  afterCreationTime?: number;
};

export type WebhookStreamSeenSet = {
  has(id: string): boolean;
  add(id: string): void;
};

export type DrainWebhookEventBatchesOptions = {
  initialCursor: WebhookStreamCursor;
  limit?: number;
  maxIterations: number;
  isAborted?: () => boolean;
  loadBatch: (
    cursor: WebhookStreamCursor & { limit: number },
  ) => Promise<Array<Record<string, unknown>>>;
  seen: WebhookStreamSeenSet;
  writeEvent: (event: Record<string, unknown>, id: string) => Promise<void>;
  onIterationLimit?: (state: {
    iterations: number;
    cursor: WebhookStreamCursor;
  }) => void;
};

export type DrainWebhookEventBatchesResult = {
  cursor: WebhookStreamCursor;
  delivered: number;
  iterations: number;
  hitIterationLimit: boolean;
};

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

  while (!options.isAborted?.()) {
    if (iterations >= options.maxIterations) {
      hitIterationLimit = true;
      options.onIterationLimit?.({ iterations, cursor: { ...cursor } });
      break;
    }
    iterations += 1;

    const batch = await options.loadBatch({ ...cursor, limit });
    if (!batch.length) {
      break;
    }

    let advanced = false;
    for (const event of batch) {
      if (options.isAborted?.()) break;

      if (advanceCursor(cursor, event)) {
        advanced = true;
      }

      const id = typeof event.id === "string" ? event.id : null;
      if (!id || options.seen.has(id)) {
        continue;
      }
      options.seen.add(id);
      await options.writeEvent(event, id);
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
  event: Record<string, unknown>,
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
