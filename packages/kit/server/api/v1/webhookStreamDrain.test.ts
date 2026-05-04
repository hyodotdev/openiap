import { describe, expect, it } from "vitest";

import { drainWebhookEventBatches } from "./webhookStreamDrain";

type EventRow = {
  id: string;
  receivedAt: number;
  _creationTime: number;
};

function makeSeen(initialIds: string[] = []) {
  const seen = new Set(initialIds);
  return {
    has: (id: string) => seen.has(id),
    add: (id: string) => {
      seen.add(id);
    },
  };
}

function makePagedLoader(events: EventRow[]) {
  return async ({
    sinceMs,
    afterCreationTime,
    limit,
  }: {
    sinceMs: number;
    afterCreationTime?: number;
    limit: number;
  }) =>
    events
      .filter((event) => {
        if (event.receivedAt > sinceMs) return true;
        if (event.receivedAt !== sinceMs) return false;
        return (
          afterCreationTime === undefined ||
          event._creationTime > afterCreationTime
        );
      })
      .slice(0, limit);
}

describe("drainWebhookEventBatches", () => {
  it("walks beyond the first 500-event page with a moving cursor", async () => {
    const events = Array.from({ length: 1_201 }, (_, index) => ({
      id: `event-${index}`,
      receivedAt: 1_000 + index + 1,
      _creationTime: 10_000 + index,
    }));
    const delivered: string[] = [];

    const result = await drainWebhookEventBatches({
      initialCursor: { sinceMs: 1_000 },
      maxIterations: 10,
      loadBatch: makePagedLoader(events),
      seen: makeSeen(),
      writeEvent: async (_event, id) => {
        delivered.push(id);
      },
    });

    expect(delivered).toHaveLength(1_201);
    expect(delivered.at(0)).toBe("event-0");
    expect(delivered.at(-1)).toBe("event-1200");
    expect(result.cursor).toEqual({
      sinceMs: 2_201,
      afterCreationTime: 11_200,
    });
    expect(result.hitIterationLimit).toBe(false);
  });

  it("advances through a same-receivedAt cohort larger than one page", async () => {
    const events = Array.from({ length: 1_001 }, (_, index) => ({
      id: `same-ms-${index}`,
      receivedAt: 2_000,
      _creationTime: index + 1,
    }));
    const delivered: string[] = [];

    const result = await drainWebhookEventBatches({
      initialCursor: { sinceMs: 2_000, afterCreationTime: 0 },
      maxIterations: 10,
      loadBatch: makePagedLoader(events),
      seen: makeSeen(),
      writeEvent: async (_event, id) => {
        delivered.push(id);
      },
    });

    expect(delivered).toHaveLength(1_001);
    expect(result.cursor).toEqual({
      sinceMs: 2_000,
      afterCreationTime: 1_001,
    });
  });

  it("steps past a saturated millisecond cohort hidden by the query cap", async () => {
    // Simulate the original webhookEventsSince bug shape: a same-
    // millisecond burst that fills exactly `limit` rows so the helper
    // keeps looping, then the next query at (sinceMs, afterCreationTime)
    // lies and returns []  (mirroring an in-memory filter that drops
    // the rest of the cohort past the take() cap). Without the
    // saturated-cohort fallback the helper would declare drain
    // complete and miss the post-cohort event.
    const limit = 5;
    const cohort = Array.from({ length: limit }, (_, index) => ({
      id: `cohort-${index}`,
      receivedAt: 5_000,
      _creationTime: index + 1,
    }));
    const postCohort = {
      id: "post-cohort",
      receivedAt: 5_001,
      _creationTime: 100,
    };
    const loadBatch = async ({
      sinceMs,
      afterCreationTime,
    }: {
      sinceMs: number;
      afterCreationTime?: number;
      limit: number;
    }) => {
      if (sinceMs === 5_000 && afterCreationTime === undefined) {
        return cohort;
      }
      if (sinceMs === 5_000 && afterCreationTime !== undefined) {
        // The buggy underlying query: claims the cohort is exhausted
        // even though we've only walked a take()-capped slice.
        return [];
      }
      if (sinceMs >= 5_001) {
        return [postCohort];
      }
      return [];
    };

    const delivered: string[] = [];
    const result = await drainWebhookEventBatches({
      initialCursor: { sinceMs: 5_000 },
      limit,
      maxIterations: 10,
      loadBatch,
      seen: makeSeen(),
      writeEvent: async (_event, id) => {
        delivered.push(id);
      },
    });

    expect(delivered).toEqual([
      "cohort-0",
      "cohort-1",
      "cohort-2",
      "cohort-3",
      "cohort-4",
      "post-cohort",
    ]);
    expect(result.cursor.sinceMs).toBe(5_001);
  });

  it("advances the cursor even when duplicate ids are skipped", async () => {
    const events = [
      { id: "already-sent", receivedAt: 2_001, _creationTime: 1 },
      { id: "new-event", receivedAt: 2_002, _creationTime: 2 },
    ];
    const delivered: string[] = [];

    const result = await drainWebhookEventBatches({
      initialCursor: { sinceMs: 2_000 },
      maxIterations: 10,
      loadBatch: makePagedLoader(events),
      seen: makeSeen(["already-sent"]),
      writeEvent: async (_event, id) => {
        delivered.push(id);
      },
    });

    expect(delivered).toEqual(["new-event"]);
    expect(result.cursor).toEqual({
      sinceMs: 2_002,
      afterCreationTime: 2,
    });
  });
});
