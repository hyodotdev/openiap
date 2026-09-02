import { describe, expect, it, vi } from "vitest";

import {
  drainSubscriptionUserErasurePage,
  pruneCompletedSubscriptionUserErasureJobsHandler,
  USER_ERASURE_JOB_RETENTION_MS,
} from "./internal";

type Row = Record<string, unknown> & { _id: string };

class IndexBuilder {
  predicates: Array<(row: Row) => boolean> = [];

  eq(field: string, value: unknown): this {
    this.predicates.push((row) => row[field] === value);
    return this;
  }

  lt(field: string, value: number): this {
    this.predicates.push((row) => Number(row[field]) < value);
    return this;
  }
}

class TestQuery {
  constructor(private readonly rows: Row[]) {}

  withIndex(_name: string, build: (q: IndexBuilder) => IndexBuilder) {
    const query = build(new IndexBuilder());
    return new TestQuery(
      this.rows.filter((row) =>
        query.predicates.every((predicate) => predicate(row)),
      ),
    );
  }

  async take(limit: number): Promise<Row[]> {
    return this.rows.slice(0, limit);
  }

  async collect(): Promise<Row[]> {
    return this.rows;
  }
}

class TestDb {
  constructor(readonly tables: Record<string, Row[]>) {}

  async get(id: string): Promise<Row | null> {
    return (
      Object.values(this.tables)
        .flat()
        .find((row) => row._id === id) ?? null
    );
  }

  query(table: string): TestQuery {
    return new TestQuery(this.tables[table] ?? []);
  }

  async patch(id: string, patch: Record<string, unknown>): Promise<void> {
    const row = await this.get(id);
    if (!row) throw new Error(`Unknown row: ${id}`);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete row[key];
      else row[key] = value;
    }
  }

  async delete(id: string): Promise<void> {
    for (const rows of Object.values(this.tables)) {
      const index = rows.findIndex((row) => row._id === id);
      if (index !== -1) {
        rows.splice(index, 1);
        return;
      }
    }
    throw new Error(`Unknown row: ${id}`);
  }
}

describe("subscription user erasure", () => {
  it("drains bounded pages and removes the raw user id from the completed job", async () => {
    const userId = "private-user";
    const projectId = "projects_1";
    const db = new TestDb({
      subscriptionUserErasureJobs: [
        {
          _id: "subscriptionUserErasureJobs_1",
          projectId,
          userId,
          userIdHash: "digest",
          status: "queued",
          subscriptionsErased: 0,
          commerceEventsErased: 0,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      subscriptions: [
        ...Array.from({ length: 101 }, (_, index) => ({
          _id: `subscriptions_${index}`,
          projectId,
          userId,
        })),
        { _id: "subscriptions_other", projectId, userId: "other-user" },
      ],
      commerceEvents: [
        ...Array.from({ length: 101 }, (_, index) => ({
          _id: `commerceEvents_${index}`,
          projectId,
          userId,
          eventType:
            index === 0 ? "entitlement.granted" : "subscription.renewed",
        })),
        {
          _id: "commerceEvents_other",
          projectId,
          userId: "other-user",
          eventType: "subscription.renewed",
        },
      ],
      outboundDeliveries: [
        {
          _id: "outboundDeliveries_private",
          eventId: "commerceEvents_0",
        },
        {
          _id: "outboundDeliveries_other",
          eventId: "commerceEvents_other",
        },
      ],
    });
    const scheduler = { runAfter: vi.fn().mockResolvedValue(undefined) };
    const ctx = { db, scheduler } as never;
    const jobId = "subscriptionUserErasureJobs_1" as never;

    await expect(
      drainSubscriptionUserErasurePage(ctx, jobId),
    ).resolves.toMatchObject({
      done: false,
      subscriptionsErased: 100,
      commerceEventsErased: 100,
    });
    expect(scheduler.runAfter).toHaveBeenCalledTimes(1);

    await expect(
      drainSubscriptionUserErasurePage(ctx, jobId),
    ).resolves.toMatchObject({
      done: true,
      subscriptionsErased: 101,
      commerceEventsErased: 101,
    });

    expect(
      db.tables.subscriptions.filter((row) => row.userId === userId),
    ).toEqual([]);
    expect(
      db.tables.commerceEvents.filter((row) => row.userId === userId),
    ).toEqual([]);
    expect(db.tables.subscriptions.at(-1)?.userId).toBe("other-user");
    expect(db.tables.commerceEvents.at(-1)?.userId).toBe("other-user");
    expect(db.tables.commerceEvents.map((row) => row._id)).not.toContain(
      "commerceEvents_0",
    );
    expect(db.tables.outboundDeliveries.map((row) => row._id)).toEqual([
      "outboundDeliveries_other",
    ]);
    expect(db.tables.subscriptionUserErasureJobs[0]).toMatchObject({
      status: "completed",
      subscriptionsErased: 101,
      commerceEventsErased: 101,
      userIdHash: "digest",
    });
    expect(db.tables.subscriptionUserErasureJobs[0]).not.toHaveProperty(
      "userId",
    );
  });

  it("prunes completed job metadata after the polling window", async () => {
    const now = Date.now();
    const expiredAt = now - USER_ERASURE_JOB_RETENTION_MS - 1;
    // A margin the handler's own Date.now() cannot cross under CI load; +1 ms
    // flaked whenever more than a millisecond passed before the call.
    const retainedAt = now - USER_ERASURE_JOB_RETENTION_MS + 60_000;
    const db = new TestDb({
      subscriptionUserErasureJobs: [
        {
          _id: "expired",
          status: "completed",
          updatedAt: expiredAt,
        },
        {
          _id: "retained",
          status: "completed",
          updatedAt: retainedAt,
        },
        {
          _id: "running",
          status: "running",
          updatedAt: expiredAt,
        },
      ],
    });
    const scheduler = { runAfter: vi.fn().mockResolvedValue(undefined) };

    await expect(
      pruneCompletedSubscriptionUserErasureJobsHandler({
        db,
        scheduler,
      } as never),
    ).resolves.toEqual({ pruned: 1 });
    expect(db.tables.subscriptionUserErasureJobs.map((row) => row._id)).toEqual(
      ["retained", "running"],
    );
    expect(scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("does not complete while an outbound body containing the user is claimed", async () => {
    const userId = "private-user";
    const projectId = "projects_1";
    const db = new TestDb({
      subscriptionUserErasureJobs: [
        {
          _id: "job",
          projectId,
          userId,
          userIdHash: "digest",
          status: "running",
          subscriptionsErased: 0,
          commerceEventsErased: 0,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      subscriptions: [],
      commerceEvents: [
        {
          _id: "event",
          projectId,
          userId,
          eventType: "subscription.renewed",
        },
      ],
      outboundDeliveries: [
        {
          _id: "delivery",
          eventId: "event",
          status: "delivering",
        },
      ],
    });
    const scheduler = { runAfter: vi.fn().mockResolvedValue(undefined) };
    const ctx = { db, scheduler } as never;

    await expect(
      drainSubscriptionUserErasurePage(ctx, "job" as never),
    ).resolves.toMatchObject({ done: false, commerceEventsErased: 0 });
    expect(db.tables.commerceEvents[0].userId).toBe(userId);
    expect(db.tables.subscriptionUserErasureJobs[0].status).toBe("running");
    expect(scheduler.runAfter).toHaveBeenLastCalledWith(
      1_000,
      expect.anything(),
      {
        jobId: "job",
      },
    );

    db.tables.outboundDeliveries[0].status = "delivered";
    await expect(
      drainSubscriptionUserErasurePage(ctx, "job" as never),
    ).resolves.toMatchObject({ done: true, commerceEventsErased: 1 });
    expect(db.tables.commerceEvents[0]).not.toHaveProperty("userId");
    expect(db.tables.subscriptionUserErasureJobs[0].status).toBe("completed");
  });
});
