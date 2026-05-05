import { beforeEach, describe, expect, it } from "vitest";

import type { Doc } from "../_generated/dataModel";
import {
  applyEventToBucket,
  bucketKey,
  isActiveAt,
  runRecompute,
  startOfUtcDay,
  utcDayKey,
  type RollupBucket,
} from "./revenueMetrics";

// ──────────────────────────────────────────────────────────────────────
// Pure helper tests — no DB needed.
// ──────────────────────────────────────────────────────────────────────

describe("utcDayKey", () => {
  it("converts an epoch ms to ISO date in UTC", () => {
    // 2026-03-15T07:30:00Z → "2026-03-15" regardless of host timezone.
    const ts = Date.UTC(2026, 2, 15, 7, 30, 0);
    expect(utcDayKey(ts)).toBe("2026-03-15");
  });

  it("does not roll into next day at 23:59:59 UTC", () => {
    const ts = Date.UTC(2026, 2, 15, 23, 59, 59);
    expect(utcDayKey(ts)).toBe("2026-03-15");
  });

  it("rolls into next day at 00:00:00 UTC", () => {
    const ts = Date.UTC(2026, 2, 16, 0, 0, 0);
    expect(utcDayKey(ts)).toBe("2026-03-16");
  });
});

describe("startOfUtcDay", () => {
  it("returns midnight UTC for the given timestamp", () => {
    const ts = Date.UTC(2026, 2, 15, 7, 30, 0);
    expect(startOfUtcDay(ts)).toBe(Date.UTC(2026, 2, 15));
  });

  it("is idempotent — startOfUtcDay(startOfUtcDay(ts)) === startOfUtcDay(ts)", () => {
    const ts = Date.UTC(2026, 2, 15, 7, 30, 0);
    const once = startOfUtcDay(ts);
    expect(startOfUtcDay(once)).toBe(once);
  });
});

describe("bucketKey", () => {
  it("composes day + productId + currency + platform uniquely", () => {
    expect(bucketKey("2026-03-15", "sub.monthly", "USD", "IOS")).toBe(
      "2026-03-15|sub.monthly|USD|IOS",
    );
  });

  it("differs when ANY component differs (including platform)", () => {
    const a = bucketKey("2026-03-15", "sub.monthly", "USD", "IOS");
    const b = bucketKey("2026-03-16", "sub.monthly", "USD", "IOS");
    const c = bucketKey("2026-03-15", "sub.yearly", "USD", "IOS");
    const d = bucketKey("2026-03-15", "sub.monthly", "EUR", "IOS");
    const e = bucketKey("2026-03-15", "sub.monthly", "USD", "Android");
    expect(new Set([a, b, c, d, e]).size).toBe(5);
  });
});

// ──────────────────────────────────────────────────────────────────────
// applyEventToBucket — every event-type branch.
// ──────────────────────────────────────────────────────────────────────

function emptyBucket(
  day = "2026-03-15",
  productId = "sub.monthly",
  currency = "USD",
  platform: "IOS" | "Android" = "IOS",
): RollupBucket {
  return {
    day,
    productId,
    currency,
    platform,
    activeSubs: 0,
    newSubs: 0,
    renewals: 0,
    cancellations: 0,
    refunds: 0,
    revenueMicros: 0,
  };
}

function makeEvent(
  partial: Partial<Doc<"webhookEvents">> & Pick<Doc<"webhookEvents">, "type">,
): Doc<"webhookEvents"> {
  // Cast — only the fields the helper reads matter. The rest of the
  // shape is satisfied with sensible defaults so the test stays
  // compact.
  return {
    _id: "we_1" as never,
    _creationTime: 0,
    projectId: "p_1" as never,
    source: "AppleAppStoreServerNotificationsV2",
    platform: "IOS",
    environment: "Production",
    sourceNotificationId: "notif_1",
    occurredAt: 0,
    receivedAt: 0,
    ...partial,
  };
}

describe("applyEventToBucket", () => {
  it("SubscriptionStarted → newSubs++ and revenueMicros += price", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({ type: "SubscriptionStarted", priceAmountMicros: 9_990_000 }),
    );
    expect(bucket.newSubs).toBe(1);
    expect(bucket.revenueMicros).toBe(9_990_000);
    // No other counter moved.
    expect(bucket.renewals).toBe(0);
    expect(bucket.cancellations).toBe(0);
    expect(bucket.refunds).toBe(0);
  });

  it("SubscriptionRenewed → renewals++ and revenueMicros += price", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({ type: "SubscriptionRenewed", priceAmountMicros: 9_990_000 }),
    );
    expect(bucket.renewals).toBe(1);
    expect(bucket.revenueMicros).toBe(9_990_000);
    expect(bucket.newSubs).toBe(0);
  });

  it("SubscriptionStarted with no priceAmountMicros → newSubs++ but revenue stays 0", () => {
    const bucket = emptyBucket();
    applyEventToBucket(bucket, makeEvent({ type: "SubscriptionStarted" }));
    expect(bucket.newSubs).toBe(1);
    expect(bucket.revenueMicros).toBe(0);
  });

  it("SubscriptionCanceled → cancellations++", () => {
    const bucket = emptyBucket();
    applyEventToBucket(bucket, makeEvent({ type: "SubscriptionCanceled" }));
    expect(bucket.cancellations).toBe(1);
  });

  it("SubscriptionUncanceled → cancellations--", () => {
    const bucket = { ...emptyBucket(), cancellations: 2 };
    applyEventToBucket(bucket, makeEvent({ type: "SubscriptionUncanceled" }));
    expect(bucket.cancellations).toBe(1);
  });

  it("Cancel followed by Uncancel within same window nets to 0", () => {
    const bucket = emptyBucket();
    applyEventToBucket(bucket, makeEvent({ type: "SubscriptionCanceled" }));
    applyEventToBucket(bucket, makeEvent({ type: "SubscriptionUncanceled" }));
    expect(bucket.cancellations).toBe(0);
  });

  it("Uncancel without prior cancel clamps at 0 (no negative cancellations)", () => {
    const bucket = emptyBucket();
    applyEventToBucket(bucket, makeEvent({ type: "SubscriptionUncanceled" }));
    expect(bucket.cancellations).toBe(0);
  });

  it("PurchaseRefunded → refunds++", () => {
    const bucket = emptyBucket();
    applyEventToBucket(bucket, makeEvent({ type: "PurchaseRefunded" }));
    expect(bucket.refunds).toBe(1);
  });

  it("SubscriptionRevoked → refunds++ (store-issued reversal)", () => {
    const bucket = emptyBucket();
    applyEventToBucket(bucket, makeEvent({ type: "SubscriptionRevoked" }));
    expect(bucket.refunds).toBe(1);
  });

  it("SubscriptionExpired does NOT bump any financial counter", () => {
    const bucket = emptyBucket();
    applyEventToBucket(bucket, makeEvent({ type: "SubscriptionExpired" }));
    expect(bucket).toEqual(emptyBucket());
  });

  it("SubscriptionInGracePeriod / SubscriptionPaused / SubscriptionPriceChange ignored", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({ type: "SubscriptionInGracePeriod" }),
    );
    applyEventToBucket(bucket, makeEvent({ type: "SubscriptionPaused" }));
    applyEventToBucket(bucket, makeEvent({ type: "SubscriptionPriceChange" }));
    expect(bucket).toEqual(emptyBucket());
  });

  it("TestNotification ignored", () => {
    const bucket = emptyBucket();
    applyEventToBucket(bucket, makeEvent({ type: "TestNotification" }));
    expect(bucket).toEqual(emptyBucket());
  });

  it("multiple renewals accumulate priceAmountMicros", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({ type: "SubscriptionRenewed", priceAmountMicros: 5_000_000 }),
    );
    applyEventToBucket(
      bucket,
      makeEvent({ type: "SubscriptionRenewed", priceAmountMicros: 9_990_000 }),
    );
    expect(bucket.renewals).toBe(2);
    expect(bucket.revenueMicros).toBe(14_990_000);
  });
});

// ──────────────────────────────────────────────────────────────────────
// isActiveAt — end-of-day snapshot logic.
// ──────────────────────────────────────────────────────────────────────

function makeSub(
  partial: Partial<Doc<"subscriptions">> & Pick<Doc<"subscriptions">, "state">,
): Doc<"subscriptions"> {
  return {
    _id: "s_1" as never,
    _creationTime: 0,
    projectId: "p_1" as never,
    purchaseToken: "tok_1",
    productId: "sub.monthly",
    platform: "IOS",
    startedAt: Date.UTC(2026, 2, 1),
    updatedAt: Date.UTC(2026, 2, 1),
    ...partial,
  };
}

describe("isActiveAt", () => {
  const dayEnd = Date.parse("2026-03-15T23:59:59.999Z");

  it("active sub started before dayEnd and not yet expired → true", () => {
    const sub = makeSub({
      state: "Active",
      startedAt: Date.UTC(2026, 2, 1),
      expiresAt: Date.UTC(2026, 3, 1),
    });
    expect(isActiveAt(sub, dayEnd)).toBe(true);
  });

  it("sub started AFTER dayEnd → false (no time-travel)", () => {
    const sub = makeSub({
      state: "Active",
      startedAt: Date.UTC(2026, 2, 16),
    });
    expect(isActiveAt(sub, dayEnd)).toBe(false);
  });

  it("sub expired BEFORE dayEnd → false", () => {
    const sub = makeSub({
      state: "Active",
      startedAt: Date.UTC(2026, 2, 1),
      expiresAt: Date.UTC(2026, 2, 10),
    });
    expect(isActiveAt(sub, dayEnd)).toBe(false);
  });

  it("InGracePeriod sub with expiresAt > dayEnd → true", () => {
    const sub = makeSub({
      state: "InGracePeriod",
      startedAt: Date.UTC(2026, 2, 1),
      expiresAt: Date.UTC(2026, 3, 1),
    });
    expect(isActiveAt(sub, dayEnd)).toBe(true);
  });

  it("InBillingRetry counts as active for snapshot purposes", () => {
    const sub = makeSub({
      state: "InBillingRetry",
      startedAt: Date.UTC(2026, 2, 1),
      expiresAt: Date.UTC(2026, 3, 1),
    });
    expect(isActiveAt(sub, dayEnd)).toBe(true);
  });

  it("Expired / Revoked / Refunded / Paused → false even if still in window", () => {
    for (const state of [
      "Expired",
      "Revoked",
      "Refunded",
      "Paused",
      "Unknown",
    ] as const) {
      const sub = makeSub({
        state,
        startedAt: Date.UTC(2026, 2, 1),
        expiresAt: Date.UTC(2026, 3, 1),
      });
      expect(isActiveAt(sub, dayEnd), `state=${state}`).toBe(false);
    }
  });

  it("undefined expiresAt + counted state → still active (matches steady-state semantics)", () => {
    const sub = makeSub({
      state: "Active",
      startedAt: Date.UTC(2026, 2, 1),
      expiresAt: undefined,
    });
    expect(isActiveAt(sub, dayEnd)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Round-trip integration via in-memory DB. Same MemDb pattern as
// `purchases/stats-integration.test.ts`, extended for index range
// predicates (gte/lte) since revenueMetrics.ts uses them.
// ──────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

class IndexBuilder {
  predicates: Array<(row: Row) => boolean> = [];
  eq(field: string, value: unknown): IndexBuilder {
    this.predicates.push((row) => row[field] === value);
    return this;
  }
  gte(field: string, value: unknown): IndexBuilder {
    this.predicates.push((row) => (row[field] as number) >= (value as number));
    return this;
  }
  lte(field: string, value: unknown): IndexBuilder {
    this.predicates.push((row) => (row[field] as number) <= (value as number));
    return this;
  }
  gt(field: string, value: unknown): IndexBuilder {
    this.predicates.push((row) => (row[field] as number) > (value as number));
    return this;
  }
  lt(field: string, value: unknown): IndexBuilder {
    this.predicates.push((row) => (row[field] as number) < (value as number));
    return this;
  }
}

class MemQuery {
  constructor(private rows: Row[]) {}

  withIndex(_name: string, cb?: (q: IndexBuilder) => IndexBuilder): MemQuery {
    if (!cb) return this;
    const builder = new IndexBuilder();
    cb(builder);
    return new MemQuery(
      this.rows.filter((row) => builder.predicates.every((p) => p(row))),
    );
  }

  order(direction: "asc" | "desc"): MemQuery {
    // Approximate Convex's index-order behaviour for our scans:
    // sort by `_creationTime` ascending or descending. The
    // production code never depends on a more specific tiebreak, so
    // this is sufficient for round-trip correctness.
    const sorted = [...this.rows].sort((a, b) =>
      direction === "asc"
        ? a._creationTime - b._creationTime
        : b._creationTime - a._creationTime,
    );
    return new MemQuery(sorted);
  }

  filter(_cb: unknown): MemQuery {
    // No-op `.filter()` would let a future production code path that
    // narrows results via `.filter()` silently pass against the
    // in-memory harness while real Convex returned a different set.
    // Throw so the next caller is forced to wire predicate support
    // up explicitly instead of running a green test on a broken
    // assumption.
    void _cb;
    throw new Error(
      "MemQuery.filter is not implemented — wire it up before adding a .filter() call to production code under test.",
    );
  }

  async first(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }

  async take(n: number): Promise<Row[]> {
    return this.rows.slice(0, n);
  }

  async collect(): Promise<Row[]> {
    return [...this.rows];
  }

  async unique(): Promise<Row | null> {
    if (this.rows.length > 1) {
      throw new Error(`unique: expected ≤1 row, got ${this.rows.length}`);
    }
    return this.rows[0] ?? null;
  }
}

class MemDb {
  tables = new Map<string, Map<string, Row>>();
  private counter = 0;

  private table(name: string): Map<string, Row> {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  query(tableName: string): MemQuery {
    return new MemQuery([...this.table(tableName).values()]);
  }

  async insert(
    tableName: string,
    doc: Record<string, unknown>,
  ): Promise<string> {
    const id = `${tableName}_${++this.counter}`;
    const row: Row = {
      ...doc,
      _id: id,
      _creationTime: Date.now() + this.counter, // ensure deterministic ordering
    };
    this.table(tableName).set(id, row);
    return id;
  }

  async get(id: string): Promise<Row | null> {
    for (const table of this.tables.values()) {
      const row = table.get(id);
      if (row) return row;
    }
    return null;
  }

  async patch(id: string, patch: Record<string, unknown>): Promise<void> {
    for (const table of this.tables.values()) {
      const row = table.get(id);
      if (row) {
        Object.assign(row, patch);
        return;
      }
    }
    throw new Error(`patch: no doc with id ${id}`);
  }

  async delete(id: string): Promise<void> {
    for (const table of this.tables.values()) {
      if (table.delete(id)) return;
    }
    throw new Error(`delete: no doc with id ${id}`);
  }
}

// Shared fixture: anchor "now" at a known UTC instant so day-key
// math is deterministic across test runs / hosts. Picking 12:00 UTC
// avoids any near-midnight edge case from leaking into assertions.
const NOW = Date.UTC(2026, 2, 15, 12, 0, 0); // 2026-03-15T12:00:00Z

// Trailing window the populator covers: [today-2, today-1, today].
const TODAY = "2026-03-15";
const D1 = "2026-03-14";
const D2 = "2026-03-13";
const OUT_OF_WINDOW = "2026-03-12";

const PROJECT_ID = "p_test" as never;

function makeCtx(db: MemDb) {
  return { db } as unknown as Parameters<typeof runRecompute>[0];
}

async function seedEvent(
  db: MemDb,
  partial: Partial<Doc<"webhookEvents">> & Pick<Doc<"webhookEvents">, "type">,
): Promise<void> {
  // Default `occurredAt` to `receivedAt` if the test only set the
  // latter — older tests use `receivedAt` to control which day the
  // event belongs to, and the production code now buckets by
  // `occurredAt`. Mirroring the values keeps those tests valid
  // without forcing each one to specify both timestamps.
  const receivedAt = partial.receivedAt ?? NOW;
  const occurredAt = partial.occurredAt ?? receivedAt;
  await db.insert("webhookEvents", {
    projectId: PROJECT_ID,
    source: "AppleAppStoreServerNotificationsV2",
    platform: "IOS",
    environment: "Production",
    sourceNotificationId: `notif_${Math.random()}`,
    productId: "sub.monthly",
    currency: "USD",
    ...partial,
    receivedAt,
    occurredAt,
  });
}

async function seedSub(
  db: MemDb,
  partial: Partial<Doc<"subscriptions">> & Pick<Doc<"subscriptions">, "state">,
): Promise<void> {
  await db.insert("subscriptions", {
    projectId: PROJECT_ID,
    purchaseToken: `tok_${Math.random()}`,
    productId: "sub.monthly",
    platform: "IOS",
    currency: "USD",
    priceAmountMicros: 9_990_000,
    startedAt: Date.UTC(2026, 1, 1),
    updatedAt: NOW,
    ...partial,
  });
}

async function rollupRows(db: MemDb): Promise<Row[]> {
  return await db.query("revenueMetricsDaily").collect();
}

describe("runRecompute — round-trip integration", () => {
  let db: MemDb;
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(() => {
    db = new MemDb();
    ctx = makeCtx(db);
  });

  it("empty project → no rollup rows written", async () => {
    await runRecompute(ctx, PROJECT_ID, NOW);
    expect(await rollupRows(db)).toEqual([]);
  });

  it("single SubscriptionStarted on today → newSubs=1, revenue=price", async () => {
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    const rows = await rollupRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      day: TODAY,
      productId: "sub.monthly",
      currency: "USD",
      newSubs: 1,
      renewals: 0,
      cancellations: 0,
      refunds: 0,
      revenueMicros: 9_990_000,
      activeSubs: 0,
    });
  });

  it("renewals are counted (the v2-deferred-then-fixed regression test)", async () => {
    // The whole reason renewals matter: a sub started months ago,
    // renewed today. The `subscriptions` table only knows the
    // current state — webhookEvents is the canonical source.
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    const rows = await rollupRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      renewals: 1,
      revenueMicros: 9_990_000,
      newSubs: 0,
    });
  });

  it("Refunded + Revoked both flow into refunds counter", async () => {
    await seedEvent(db, {
      type: "PurchaseRefunded",
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionRevoked",
      receivedAt: Date.parse(`${TODAY}T11:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    const rows = await rollupRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ refunds: 2 });
  });

  it("Cancel + Uncancel within same day net to zero (skipped as empty)", async () => {
    await seedEvent(db, {
      type: "SubscriptionCanceled",
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionUncanceled",
      receivedAt: Date.parse(`${TODAY}T11:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    // All-zero buckets are intentionally skipped.
    expect(await rollupRows(db)).toEqual([]);
  });

  it("multi-platform events on same day produce separate rows (per-store split)", async () => {
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      platform: "IOS",
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 5_000_000,
      platform: "Android",
      receivedAt: Date.parse(`${TODAY}T11:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    const rows = await rollupRows(db);
    expect(rows).toHaveLength(2);
    const ios = rows.find((r) => r.platform === "IOS");
    const android = rows.find((r) => r.platform === "Android");
    expect(ios?.revenueMicros).toBe(9_990_000);
    expect(android?.revenueMicros).toBe(5_000_000);
  });

  it("activeSubs is split by platform — same productId on iOS + Android counts twice", async () => {
    await seedSub(db, {
      state: "Active",
      platform: "IOS",
      startedAt: Date.UTC(2026, 1, 1),
      expiresAt: Date.UTC(2026, 3, 1),
    });
    await seedSub(db, {
      state: "Active",
      platform: "Android",
      startedAt: Date.UTC(2026, 1, 1),
      expiresAt: Date.UTC(2026, 3, 1),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    const rows = await rollupRows(db);
    // 3 days × 2 platforms = 6 rows.
    expect(rows).toHaveLength(6);
    const todayRows = rows.filter((r) => r.day === TODAY);
    expect(todayRows).toHaveLength(2);
    expect(todayRows.find((r) => r.platform === "IOS")?.activeSubs).toBe(1);
    expect(todayRows.find((r) => r.platform === "Android")?.activeSubs).toBe(1);
  });

  it("multi-currency events on same day produce separate rows (no cross-FX summing)", async () => {
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      currency: "USD",
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 8_500_000,
      currency: "EUR",
      receivedAt: Date.parse(`${TODAY}T11:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    const rows = await rollupRows(db);
    expect(rows).toHaveLength(2);
    const usd = rows.find((r) => r.currency === "USD");
    const eur = rows.find((r) => r.currency === "EUR");
    expect(usd?.revenueMicros).toBe(9_990_000);
    expect(eur?.revenueMicros).toBe(8_500_000);
  });

  it("multi-product events on same day produce separate rows", async () => {
    await seedEvent(db, {
      type: "SubscriptionStarted",
      productId: "sub.monthly",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionStarted",
      productId: "sub.yearly",
      priceAmountMicros: 99_990_000,
      receivedAt: Date.parse(`${TODAY}T11:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    const rows = await rollupRows(db);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.productId === "sub.yearly")?.revenueMicros).toBe(
      99_990_000,
    );
  });

  it("event without productId is silently skipped (TestNotification path)", async () => {
    await seedEvent(db, {
      type: "TestNotification",
      productId: undefined,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    expect(await rollupRows(db)).toEqual([]);
  });

  it("events outside trailing window are NOT included", async () => {
    // 4 days ago — outside the 3-day window (today + 2 prior).
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${OUT_OF_WINDOW}T10:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    expect(await rollupRows(db)).toEqual([]);
  });

  it("events spanning all 3 days produce per-day rows", async () => {
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${D2}T10:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${D1}T10:00:00Z`),
    });
    await seedEvent(db, {
      type: "PurchaseRefunded",
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    const rows = await rollupRows(db);
    const byDay = new Map(rows.map((r) => [r.day, r]));
    expect(byDay.get(D2)).toMatchObject({ newSubs: 1 });
    expect(byDay.get(D1)).toMatchObject({ renewals: 1 });
    expect(byDay.get(TODAY)).toMatchObject({ refunds: 1 });
  });

  it("activeSubs end-of-day snapshot from subscriptions table", async () => {
    // Sub active across the whole window — should show up on every
    // day's activeSubs.
    await seedSub(db, {
      state: "Active",
      startedAt: Date.UTC(2026, 1, 1), // way before window
      expiresAt: Date.UTC(2026, 3, 1), // after window
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    const rows = await rollupRows(db);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.activeSubs).toBe(1);
    }
  });

  it("activeSubs respects expiry mid-window", async () => {
    // Sub expires at midnight UTC on TODAY — active on D2 and D1 (their
    // dayEnd is 23:59:59.999 of those days, which is before the sub's
    // expiresAt), inactive on TODAY (dayEnd 23:59:59.999 > expiresAt).
    await seedSub(db, {
      state: "Active",
      startedAt: Date.UTC(2026, 1, 1),
      expiresAt: Date.UTC(2026, 2, 15), // 2026-03-15T00:00:00Z
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    const byDay = new Map(
      (await rollupRows(db)).map((r) => [r.day, r.activeSubs]),
    );
    expect(byDay.get(D2)).toBe(1);
    expect(byDay.get(D1)).toBe(1);
    expect(byDay.get(TODAY)).toBeUndefined(); // empty bucket → skipped
  });

  it("activeSubs respects start mid-window", async () => {
    // Sub started D1 noon — only active on D1 + TODAY, NOT on D2.
    await seedSub(db, {
      state: "Active",
      startedAt: Date.parse(`${D1}T12:00:00Z`),
      expiresAt: Date.UTC(2026, 3, 1),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    const byDay = new Map(
      (await rollupRows(db)).map((r) => [r.day, r.activeSubs]),
    );
    expect(byDay.get(D2)).toBeUndefined();
    expect(byDay.get(D1)).toBe(1);
    expect(byDay.get(TODAY)).toBe(1);
  });

  it("expired sub does not contribute to activeSubs even if window-overlapping", async () => {
    await seedSub(db, {
      state: "Expired",
      startedAt: Date.UTC(2026, 1, 1),
      expiresAt: Date.UTC(2026, 3, 1),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    expect(await rollupRows(db)).toEqual([]);
  });

  it("idempotent: running twice produces the same set of rows", async () => {
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    await seedSub(db, {
      state: "Active",
      startedAt: Date.UTC(2026, 1, 1),
      expiresAt: Date.UTC(2026, 3, 1),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    const first = (await rollupRows(db)).map((r) => ({
      day: r.day,
      productId: r.productId,
      currency: r.currency,
      newSubs: r.newSubs,
      renewals: r.renewals,
      revenueMicros: r.revenueMicros,
      activeSubs: r.activeSubs,
    }));

    await runRecompute(ctx, PROJECT_ID, NOW);
    const second = (await rollupRows(db)).map((r) => ({
      day: r.day,
      productId: r.productId,
      currency: r.currency,
      newSubs: r.newSubs,
      renewals: r.renewals,
      revenueMicros: r.revenueMicros,
      activeSubs: r.activeSubs,
    }));

    expect(second).toEqual(first);
  });

  it("late-arriving event in trailing window updates the existing day's bucket", async () => {
    // First tick: 1 new sub.
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${D1}T10:00:00Z`),
    });
    await runRecompute(ctx, PROJECT_ID, NOW);

    let row = (await rollupRows(db)).find((r) => r.day === D1);
    expect(row?.newSubs).toBe(1);

    // Late RENEWED event for D1 arrives between ticks (within
    // trailing window).
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${D1}T15:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    row = (await rollupRows(db)).find((r) => r.day === D1);
    expect(row?.newSubs).toBe(1);
    expect(row?.renewals).toBe(1);
    expect(row?.revenueMicros).toBe(2 * 9_990_000);
  });

  it("project isolation — events in another project don't leak into rollup", async () => {
    // Same productId but different projectId.
    await db.insert("webhookEvents", {
      projectId: "p_other",
      source: "AppleAppStoreServerNotificationsV2",
      platform: "IOS",
      environment: "Production",
      sourceNotificationId: "notif_other",
      type: "SubscriptionStarted",
      productId: "sub.monthly",
      currency: "USD",
      priceAmountMicros: 9_990_000,
      occurredAt: NOW,
      receivedAt: NOW,
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    expect(await rollupRows(db)).toEqual([]);
  });

  it("delete-before-insert: stale rows in window are wiped on recompute", async () => {
    // Pre-seed a stale rollup row in the window for a productId that
    // no longer has any events. After recompute it must be GONE.
    await db.insert("revenueMetricsDaily", {
      projectId: PROJECT_ID,
      day: TODAY,
      productId: "sub.deprecated",
      currency: "USD",
      activeSubs: 0,
      newSubs: 5,
      renewals: 0,
      cancellations: 0,
      refunds: 0,
      revenueMicros: 50_000_000,
      updatedAt: NOW - 86400000,
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    expect(await rollupRows(db)).toEqual([]);
  });

  it("event arrived late (receivedAt > occurredAt) buckets by occurredAt", async () => {
    // The whole point of separating `occurredAt` from `receivedAt`:
    // a renewal that fired on D2 but landed in our webhook log today
    // must contribute to D2's bucket, not today's. Otherwise a
    // retry-delayed notification visibly flips its day on the
    // dashboard.
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse(`${D2}T03:00:00Z`),
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    const rows = await rollupRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day: D2, renewals: 1 });
  });

  it("event whose occurredAt falls outside the trailing window is skipped", async () => {
    // receivedAt is in the scan window (yesterday), but occurredAt
    // is 10 days ago — outside [D2, TODAY]. The bucket for that
    // older day isn't being recomputed this tick, so writing into
    // it would either duplicate or stomp on a row not in the
    // delete-then-insert window. Skip is correct.
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse("2026-03-05T03:00:00Z"),
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    expect(await rollupRows(db)).toEqual([]);
  });

  it("event scan reaches back beyond the bucket window for late deliveries", async () => {
    // receivedAt = D2 - 4 days (well outside the 3-day bucket
    // window) but occurredAt = D2. Without the LATE_DELIVERY_GRACE
    // backward extension on the scan, this event would be missed
    // on every recompute after its tick of arrival, and the
    // delete-then-insert in commitBuckets would erase it
    // permanently. Verifies the grace window is wide enough to
    // catch real Apple ASN v2 / Google RTDN retry tails.
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse(`${D2}T03:00:00Z`),
      receivedAt: Date.parse(`${D2}T03:00:00Z`) - 4 * 86400000,
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    const rows = await rollupRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day: D2, newSubs: 1 });
  });

  it("rollup rows OUTSIDE window are preserved (not blanket-deleted)", async () => {
    // Old row from 30 days ago — must survive a daily recompute.
    await db.insert("revenueMetricsDaily", {
      projectId: PROJECT_ID,
      day: "2026-02-15",
      productId: "sub.monthly",
      currency: "USD",
      activeSubs: 0,
      newSubs: 3,
      renewals: 0,
      cancellations: 0,
      refunds: 0,
      revenueMicros: 30_000_000,
      updatedAt: Date.UTC(2026, 1, 16),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    const rows = await rollupRows(db);
    const old = rows.find((r) => r.day === "2026-02-15");
    expect(old?.newSubs).toBe(3);
  });
});
