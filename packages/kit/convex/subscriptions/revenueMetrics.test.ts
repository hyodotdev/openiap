import { beforeEach, describe, expect, it } from "vitest";
import { getFunctionName } from "convex/server";

import type { Doc } from "../_generated/dataModel";
import {
  ROLLUP_DEFINITIONS_VERSION,
  applyEventToBucket,
  bucketKey,
  isActiveAt,
  pickRevenueMetricsProjects,
  runRecompute,
  runRecomputePage,
  startOfUtcDay,
  utcDayKey,
  type RecomputeRevenueMetricsPageArgs,
  type RollupBucket,
} from "./revenueMetrics";
import { getRevenueMetrics as registeredGetRevenueMetrics } from "./query";
import { runRevenueCohortsPage } from "./revenueCohorts";
import { testableFunction } from "../test.setup";

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
  it("composes day + productId + currency + platform + environment uniquely", () => {
    expect(
      bucketKey("2026-03-15", "sub.monthly", "USD", "IOS", "Production"),
    ).toBe("2026-03-15|sub.monthly|USD|IOS|Production");
  });

  it("differs when ANY component differs (including platform and environment)", () => {
    const a = bucketKey(
      "2026-03-15",
      "sub.monthly",
      "USD",
      "IOS",
      "Production",
    );
    const b = bucketKey(
      "2026-03-16",
      "sub.monthly",
      "USD",
      "IOS",
      "Production",
    );
    const c = bucketKey("2026-03-15", "sub.yearly", "USD", "IOS", "Production");
    const d = bucketKey(
      "2026-03-15",
      "sub.monthly",
      "EUR",
      "IOS",
      "Production",
    );
    const e = bucketKey(
      "2026-03-15",
      "sub.monthly",
      "USD",
      "Android",
      "Production",
    );
    const f = bucketKey("2026-03-15", "sub.monthly", "USD", "IOS", "Sandbox");
    expect(new Set([a, b, c, d, e, f]).size).toBe(6);
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
    environment: "Production",
    activeSubs: 0,
    activeTrials: 0,
    newSubs: 0,
    trialStarts: 0,
    trialConversions: 0,
    directPaidStarts: 0,
    renewals: 0,
    cancellations: 0,
    expirations: 0,
    refunds: 0,
    revenueMicros: 0,
    refundedMicros: 0,
  };
}

function makeEvent(
  partial: Partial<Doc<"webhookEvents">> & Pick<Doc<"webhookEvents">, "type">,
): Doc<"webhookEvents"> {
  // Only the fields the helper reads matter.
  return {
    _id: "we_1" as never,
    _creationTime: 0,
    projectId: "p_1" as never,
    source: "AppleAppStoreServerNotificationsV2",
    platform: "IOS",
    environment: "Production",
    sourceNotificationId: "notif_1",
    productKind: "subscription",
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

  it("Uncancel without same-day cancel produces a negative bucket (cross-day offset)", () => {
    // May go negative: a cancel and an uncancel on different days must net to
    // zero over a period.
    const bucket = emptyBucket();
    applyEventToBucket(bucket, makeEvent({ type: "SubscriptionUncanceled" }));
    expect(bucket.cancellations).toBe(-1);
  });

  it("PurchaseRefunded → refunds++ and refundedMicros += store amount", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "PurchaseRefunded",
        cancellationReason: "Refunded",
        priceAmountMicros: 9_990_000,
      }),
    );
    expect(bucket.refunds).toBe(1);
    expect(bucket.refundedMicros).toBe(9_990_000);
    // Gross revenue keeps its meaning; net is revenue − refunded.
    expect(bucket.revenueMicros).toBe(0);
  });

  it("Google SubscriptionRevoked (a refund) → refunds++", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "SubscriptionRevoked",
        source: "GooglePlayRealTimeDeveloperNotifications",
        platform: "Android",
        cancellationReason: "Refunded",
      }),
    );
    expect(bucket.refunds).toBe(1);
  });

  it("Apple REVOKE (Family Sharing removal, no refund reason) is not a refund", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({ type: "SubscriptionRevoked", priceAmountMicros: 9_990_000 }),
    );
    expect(bucket).toEqual(emptyBucket());
  });

  it("Apple REFUND_REVERSED undoes a refund instead of starting a subscription", () => {
    // Regression: it maps to SubscriptionStarted for state, which used to add a
    // new subscription and its price to revenue.
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "PurchaseRefunded",
        cancellationReason: "Refunded",
        priceAmountMicros: 9_990_000,
      }),
    );
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "SubscriptionStarted",
        refundReversal: true,
        priceAmountMicros: 9_990_000,
      }),
    );
    expect(bucket).toEqual(emptyBucket());
  });

  it("SubscriptionRecovered is a real charge: renewals++ and revenue", () => {
    // Regression: billing recovery used to fall through and earn nothing.
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "SubscriptionRecovered",
        priceAmountMicros: 9_990_000,
      }),
    );
    expect(bucket.renewals).toBe(1);
    expect(bucket.revenueMicros).toBe(9_990_000);
  });

  it("a free trial start books no revenue, even with the plan's list price", () => {
    // Regression: Google reports the recurring price on a trial purchase.
    const bucket = emptyBucket("2026-03-15", "sub.monthly", "USD", "Android");
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "SubscriptionStarted",
        platform: "Android",
        freeTrial: true,
        priceAmountMicros: 9_990_000,
      }),
    );
    expect(bucket).toMatchObject({
      newSubs: 1,
      trialStarts: 1,
      revenueMicros: 0,
      directPaidStarts: 0,
    });
  });

  it("a trial's first paid charge is a conversion, not a renewal", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "SubscriptionRenewed",
        paidStart: "trial_conversion",
        priceAmountMicros: 9_990_000,
      }),
    );
    expect(bucket).toMatchObject({
      trialConversions: 1,
      renewals: 0,
      newSubs: 0,
      revenueMicros: 9_990_000,
    });
  });

  it("a direct paid start counts as a new and a direct paid subscription", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "SubscriptionStarted",
        paidStart: "direct",
        freeTrial: false,
        priceAmountMicros: 9_990_000,
      }),
    );
    expect(bucket).toMatchObject({
      newSubs: 1,
      directPaidStarts: 1,
      trialStarts: 0,
      revenueMicros: 9_990_000,
    });
  });

  it("a free promotional renewal is not a charge", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "SubscriptionRenewed",
        freeTrial: true,
        priceAmountMicros: 0,
      }),
    );
    expect(bucket).toEqual(emptyBucket());
  });

  it("SubscriptionExpired → expirations++ and no money", () => {
    const bucket = emptyBucket();
    applyEventToBucket(bucket, makeEvent({ type: "SubscriptionExpired" }));
    expect(bucket).toEqual({ ...emptyBucket(), expirations: 1 });
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

  it("keeps one-time events out of subscription revenue metrics", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "SubscriptionStarted",
        productKind: "one_time",
        priceAmountMicros: 9_990_000,
      }),
    );
    expect(bucket.newSubs).toBe(0);
    expect(bucket.revenueMicros).toBe(0);
  });

  it("uses catalog type to exclude legacy one-time rows", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "SubscriptionStarted",
        productKind: undefined,
        priceAmountMicros: 9_990_000,
      }),
      "Consumable",
    );
    expect(bucket).toEqual(emptyBucket());
  });

  it("conservatively excludes an unclassified legacy row after catalog deletion", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "SubscriptionStarted",
        productKind: undefined,
        priceAmountMicros: 9_990_000,
      }),
    );
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
    productKind: "subscription",
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

  it("InBillingRetry counts only on days before its paid period ended", () => {
    const sub = makeSub({
      state: "InBillingRetry",
      startedAt: Date.UTC(2026, 2, 1),
      expiresAt: Date.UTC(2026, 3, 1),
    });
    expect(isActiveAt(sub, dayEnd)).toBe(true);
    expect(
      isActiveAt({ ...sub, expiresAt: Date.UTC(2026, 2, 10) }, dayEnd),
    ).toBe(false);
  });

  it("InBillingRetry without an expiry has no access (regression)", () => {
    const sub = makeSub({
      state: "InBillingRetry",
      platform: "Android",
      startedAt: Date.UTC(2026, 2, 1),
      expiresAt: undefined,
    });
    expect(isActiveAt(sub, dayEnd)).toBe(false);
  });

  it("Revoked / Refunded / Paused / Unknown → false even if still in window", () => {
    for (const state of ["Revoked", "Refunded", "Paused", "Unknown"] as const) {
      const sub = makeSub({
        state,
        startedAt: Date.UTC(2026, 2, 1),
        expiresAt: Date.UTC(2026, 3, 1),
      });
      expect(isActiveAt(sub, dayEnd), `state=${state}`).toBe(false);
    }
  });

  it("Expired with expiresAt > dayEnd → true (still active on the snapshot day)", () => {
    // Why `Expired` is counted: a sub active at the end of a past day counts
    // for that day.
    const sub = makeSub({
      state: "Expired",
      startedAt: Date.UTC(2026, 2, 1),
      expiresAt: Date.UTC(2026, 3, 1), // April 1, after dayEnd (March 15)
    });
    expect(isActiveAt(sub, dayEnd)).toBe(true);
  });

  it("Expired with expiresAt <= dayEnd → false (already gone by snapshot)", () => {
    const sub = makeSub({
      state: "Expired",
      startedAt: Date.UTC(2026, 2, 1),
      expiresAt: Date.UTC(2026, 2, 10), // March 10, before dayEnd
    });
    expect(isActiveAt(sub, dayEnd)).toBe(false);
  });

  it("Expired with no expiresAt timestamp → false (defensive: no anchor for transition day)", () => {
    const sub = makeSub({
      state: "Expired",
      startedAt: Date.UTC(2026, 2, 1),
      expiresAt: undefined,
    });
    expect(isActiveAt(sub, dayEnd)).toBe(false);
  });

  it("undefined expiresAt + Active counted state → still active (matches steady-state semantics)", () => {
    const sub = makeSub({
      platform: "Android",
      state: "Active",
      startedAt: Date.UTC(2026, 2, 1),
      expiresAt: undefined,
    });
    expect(isActiveAt(sub, dayEnd)).toBe(true);
  });

  it("never counts an iOS row without an expiry (a non-renewing pass)", () => {
    const sub = makeSub({
      platform: "IOS",
      state: "Active",
      startedAt: Date.UTC(2026, 2, 1),
      expiresAt: undefined,
    });
    expect(isActiveAt(sub, dayEnd)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Round-trip integration via an in-memory DB: the MemDb from
// `purchases/stats-integration.test.ts`, plus the gte/lte range predicates
// revenueMetrics.ts uses.
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
  constructor(
    private rows: Row[],
    private indexName?: string,
  ) {}

  withIndex(_name: string, cb?: (q: IndexBuilder) => IndexBuilder): MemQuery {
    if (!cb) return new MemQuery(this.rows, _name);
    const builder = new IndexBuilder();
    cb(builder);
    return new MemQuery(
      this.rows.filter((row) => builder.predicates.every((p) => p(row))),
      _name,
    );
  }

  order(direction: "asc" | "desc"): MemQuery {
    const orderField =
      this.indexName === "by_received_at"
        ? "receivedAt"
        : this.indexName === "by_updated_at"
          ? "updatedAt"
          : this.indexName === "by_run"
            ? "lastRunAt"
            : "_creationTime";
    const sorted = [...this.rows].sort((a, b) =>
      direction === "asc"
        ? (a[orderField] as number) - (b[orderField] as number)
        : (b[orderField] as number) - (a[orderField] as number),
    );
    return new MemQuery(sorted, this.indexName);
  }

  filter(_cb: unknown): MemQuery {
    // Throw rather than no-op, so a production `.filter()` cannot pass here
    // while real Convex returns a different set.
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

  // Stand-in for `paginate()` with the offset as the cursor; the fixtures are
  // too small to need Convex's `_id` tiebreaker.
  async paginate(opts: {
    numItems: number;
    cursor: string | null;
  }): Promise<{ page: Row[]; isDone: boolean; continueCursor: string }> {
    const start = opts.cursor === null ? 0 : Number.parseInt(opts.cursor, 10);
    const end = start + opts.numItems;
    const page = this.rows.slice(start, end);
    const isDone = end >= this.rows.length;
    return { page, isDone, continueCursor: String(end) };
  }
}

class MemDb {
  tables = new Map<string, Map<string, Row>>();
  private counter = 0;

  constructor() {
    this.table("organizations").set("organizations_test", {
      _id: "organizations_test",
      _creationTime: Date.now(),
    });
    this.table("projects").set("p_test", {
      _id: "p_test",
      _creationTime: Date.now(),
      organizationId: "organizations_test",
    });
  }

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

// Noon UTC keeps day-key math deterministic and away from midnight.
const NOW = Date.UTC(2026, 2, 15, 12, 0, 0); // 2026-03-15T12:00:00Z

// Trailing window the populator covers: [today-2, today-1, today].
const TODAY = "2026-03-15";
const D1 = "2026-03-14";
const D2 = "2026-03-13";
const OUT_OF_WINDOW = "2026-03-12";

const PROJECT_ID = "p_test" as never;

type ScheduledCall = { name: string; args: Record<string, unknown> };

// Runs chained rollup pages inline and records every other follow-up (catch-up
// recomputes, cohort jobs) for the test to inspect or run.
function makeCtx(db: MemDb, scheduled: ScheduledCall[] = []) {
  const ctx = {
    db,
    scheduler: {
      runAfter: async (
        _delayMs: number,
        fn: Parameters<typeof getFunctionName>[0],
        args: Record<string, unknown>,
      ) => {
        const name = getFunctionName(fn);
        if (name.endsWith(":recomputeRevenueMetricsPage")) {
          await runRecomputePage(
            ctx as unknown as Parameters<typeof runRecomputePage>[0],
            args as RecomputeRevenueMetricsPageArgs,
          );
          return;
        }
        scheduled.push({ name, args });
      },
    },
  };
  return ctx as unknown as Parameters<typeof runRecompute>[0];
}

function makePickerCtx(db: MemDb) {
  return { db } as unknown as Parameters<typeof pickRevenueMetricsProjects>[0];
}

async function seedEvent(
  db: MemDb,
  partial: Partial<Doc<"webhookEvents">> & Pick<Doc<"webhookEvents">, "type">,
): Promise<void> {
  // occurredAt defaults to receivedAt, so tests that set only receivedAt still
  // pick the event's day.
  const receivedAt = partial.receivedAt ?? NOW;
  const occurredAt = partial.occurredAt ?? receivedAt;
  await db.insert("webhookEvents", {
    projectId: PROJECT_ID,
    source: "AppleAppStoreServerNotificationsV2",
    platform: "IOS",
    environment: "Production",
    sourceNotificationId: `notif_${Math.random()}`,
    productKind: "subscription",
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
    productKind: "subscription",
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

describe("pickRevenueMetricsProjects", () => {
  let db: MemDb;
  let ctx: ReturnType<typeof makePickerCtx>;

  beforeEach(() => {
    db = new MemDb();
    ctx = makePickerCtx(db);
  });

  it("discovers projects with recent webhooks even when stale status rows fill the batch", async () => {
    await db.insert("revenueMetricsRunStatus", {
      projectId: "p_old_1",
      lastRunAt: 1,
    });
    await db.insert("revenueMetricsRunStatus", {
      projectId: "p_old_2",
      lastRunAt: 2,
    });
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      projectId: PROJECT_ID,
      receivedAt: NOW,
    });

    const projects = await pickRevenueMetricsProjects(ctx, 2);

    expect(projects[0]).toBe(PROJECT_ID);
    expect(projects).toContain("p_old_1");
  });

  it("discovers subscriptionStats projects that do not have run status yet", async () => {
    await db.insert("revenueMetricsRunStatus", {
      projectId: "p_seeded",
      lastRunAt: 1,
    });
    await db.insert("subscriptionStats", {
      projectId: "p_seeded",
      currency: "USD",
      activeSubs: 1,
      inGracePeriod: 0,
      inBillingRetry: 0,
      mrrMicros: 9_990_000,
      updatedAt: NOW + 1,
    });
    await db.insert("subscriptionStats", {
      projectId: PROJECT_ID,
      currency: "USD",
      activeSubs: 1,
      inGracePeriod: 0,
      inBillingRetry: 0,
      mrrMicros: 9_990_000,
      updatedAt: NOW,
    });

    const projects = await pickRevenueMetricsProjects(ctx, 2);

    expect(projects).toContain(PROJECT_ID);
    expect(projects).toContain("p_seeded");
  });

  it("dedupes projects seen through both webhook and stats bootstrap sources", async () => {
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      projectId: PROJECT_ID,
      receivedAt: NOW,
    });
    await db.insert("subscriptionStats", {
      projectId: PROJECT_ID,
      currency: "USD",
      activeSubs: 1,
      inGracePeriod: 0,
      inBillingRetry: 0,
      mrrMicros: 9_990_000,
      updatedAt: NOW,
    });

    const projects = await pickRevenueMetricsProjects(ctx, 10);

    expect(
      projects.filter((projectId) => projectId === PROJECT_ID),
    ).toHaveLength(1);
  });

  it("does not seed work from legacy Meta Horizon reconciler events", async () => {
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      source: "MetaHorizonReconciler",
      projectId: PROJECT_ID,
      receivedAt: NOW,
    });

    expect(await pickRevenueMetricsProjects(ctx, 10)).toEqual([]);
  });
});

// A project already on the current definitions, so a tick recomputes only the
// trailing 3 days.
async function seedCurrentRunStatus(
  db: MemDb,
  fields: Record<string, unknown> = {},
): Promise<void> {
  await db.insert("revenueMetricsRunStatus", {
    projectId: PROJECT_ID,
    lastRunAt: NOW - 10 * 60 * 1000,
    definitionsVersion: ROLLUP_DEFINITIONS_VERSION,
    definitionsFromDay: "2026-02-14",
    cohortsRequestedAt: NOW,
    ...fields,
  });
}

async function runStatus(db: MemDb): Promise<Row | null> {
  return db.query("revenueMetricsRunStatus").first();
}

describe("runRecompute — round-trip integration", () => {
  let db: MemDb;
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(async () => {
    db = new MemDb();
    ctx = makeCtx(db);
    await seedCurrentRunStatus(db);
  });

  it("does not recreate rollups after project deletion starts", async () => {
    await db.patch(PROJECT_ID, { pendingDeletion: true });
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    expect(await rollupRows(db)).toEqual([]);
    expect((await runStatus(db))?.lastRunAt).toBe(NOW - 10 * 60 * 1000);
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

  it("retains legacy subscription events while their catalog type is known", async () => {
    await db.insert("products", {
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "sub.monthly",
      type: "Subscription",
    });
    await seedEvent(db, {
      type: "SubscriptionStarted",
      productKind: undefined,
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    expect(await rollupRows(db)).toMatchObject([
      { newSubs: 1, revenueMicros: 9_990_000 },
    ]);
  });

  it("excludes legacy Meta Horizon reconciler events from rollups", async () => {
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 99_000_000,
      source: "MetaHorizonReconciler",
      platform: "Android",
      receivedAt: Date.parse(`${TODAY}T09:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    const rows = await rollupRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      platform: "IOS",
      newSubs: 1,
      revenueMicros: 9_990_000,
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

  it("keeps Amazon lifecycle and active counts out of the Google Play series", async () => {
    for (const type of [
      "SubscriptionStarted",
      "SubscriptionRenewed",
      "SubscriptionCanceled",
      "SubscriptionRevoked",
    ] as const) {
      await seedEvent(db, {
        type,
        store: "amazon",
        platform: "Android",
        currency: undefined,
      });
    }
    await seedSub(db, {
      state: "Active",
      store: "amazon",
      platform: "Android",
      currency: undefined,
      priceAmountMicros: undefined,
    });
    await seedEvent(db, {
      type: "SubscriptionStarted",
      store: "google",
      platform: "Android",
      priceAmountMicros: 9_990_000,
    });
    await seedSub(db, {
      state: "Active",
      store: "google",
      platform: "Android",
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    const rows = await rollupRows(db);
    expect(rows.every((row) => row.currency === "USD")).toBe(true);
    expect(rows.find((row) => row.day === TODAY)).toMatchObject({
      platform: "Android",
      newSubs: 1,
      renewals: 0,
      cancellations: 0,
      refunds: 0,
      revenueMicros: 9_990_000,
      activeSubs: 1,
    });
  });

  it("refunds and refund-driven revocations flow into refunds; Family Sharing revokes do not", async () => {
    await seedEvent(db, {
      type: "PurchaseRefunded",
      cancellationReason: "Refunded",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionRevoked",
      cancellationReason: "Refunded",
      receivedAt: Date.parse(`${TODAY}T11:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionRevoked",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T11:30:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    const rows = await rollupRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ refunds: 2, refundedMicros: 9_990_000 });
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
      cancellationReason: "Refunded",
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

  it("Expired sub with expiresAt past the window contributes to activeSubs (was active on those days)", async () => {
    // Sub expired April 1 — past every day in our window
    // [TODAY-2, TODAY] which is centered on March 15. The sub was
    // genuinely active at end-of-day on each of those days, so it
    // must contribute to the activeSubs snapshot for them.
    await seedSub(db, {
      state: "Expired",
      startedAt: Date.UTC(2026, 1, 1),
      expiresAt: Date.UTC(2026, 3, 1),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    const rows = await rollupRows(db);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.activeSubs).toBe(1);
    }
  });

  it("Expired sub whose expiry predates the window does not contribute", async () => {
    // Expired well before the rollup window — no day in
    // [TODAY-2, TODAY] saw this sub as active.
    await seedSub(db, {
      state: "Expired",
      startedAt: Date.UTC(2026, 1, 1),
      expiresAt: Date.UTC(2026, 2, 10), // March 10, before D2=March 13
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
    // A renewal from D2 that arrived today belongs to D2; otherwise a delayed
    // retry moves its day on the dashboard.
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

  it("event whose occurredAt falls outside the trailing window is held for a catch-up", async () => {
    // Received today but occurred 10 days ago: that day is not recomputed
    // this tick, so writing it would double-count or clobber a row. It is
    // surfaced as pending and a catch-up from its day is requested.
    const scheduled: ScheduledCall[] = [];
    ctx = makeCtx(db, scheduled);
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse("2026-03-05T03:00:00Z"),
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    expect(await rollupRows(db)).toEqual([]);
    expect(await runStatus(db)).toMatchObject({
      pendingLateEvents: 1,
      oldestPendingLateDay: "2026-03-05",
      catchUpRequestedAt: NOW,
    });
    expect(scheduled).toEqual([
      {
        name: "subscriptions/revenueMetrics:recomputeRevenueMetricsForProject",
        args: { projectId: PROJECT_ID, fromDay: "2026-03-05" },
      },
    ]);

    // The catch-up folds the event into its own day and clears the backlog.
    await runRecompute(ctx, PROJECT_ID, NOW + 60_000, "2026-03-05");
    expect(await rollupRows(db)).toMatchObject([
      { day: "2026-03-05", newSubs: 1, revenueMicros: 9_990_000 },
    ]);
    expect(await runStatus(db)).toMatchObject({
      pendingLateEvents: 0,
      lastCatchUpAt: NOW + 60_000,
      lastCatchUpFromDay: "2026-03-05",
    });

    // A regular tick afterwards sees the event as covered.
    await runRecompute(ctx, PROJECT_ID, NOW + 120_000);
    expect(await runStatus(db)).toMatchObject({ pendingLateEvents: 0 });
    expect(
      (await rollupRows(db)).find((row) => row.day === "2026-03-05"),
    ).toMatchObject({ newSubs: 1 });
    expect(scheduled).toHaveLength(1);
  });

  it("drops an event that occurred before the retained window instead of holding it", async () => {
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse("2026-01-05T03:00:00Z"),
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);
    expect(await runStatus(db)).toMatchObject({ pendingLateEvents: 0 });
  });

  it("late-arrival event with receivedAt at end of window still buckets by occurredAt", async () => {
    // The realistic shape (receivers keep receivedAt >= occurredAt): occurred
    // on D2, landed today through the store retry tail, and counts for D2.
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse(`${D2}T03:00:00Z`),
      receivedAt: Date.parse(`${TODAY}T11:00:00Z`),
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

describe("runRecompute — definitions rebuild", () => {
  it("rebuilds the retained 30-day window once, then recomputes 3 days", async () => {
    const db = new MemDb();
    const scheduled: ScheduledCall[] = [];
    const ctx = makeCtx(db, scheduled);
    // Older than the trailing window but inside event retention.
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse("2026-03-05T10:00:00Z"),
    });
    // A row from the old definitions inside the window is replaced.
    await db.insert("revenueMetricsDaily", {
      projectId: PROJECT_ID,
      day: "2026-03-05",
      productId: "sub.monthly",
      currency: "USD",
      platform: "IOS",
      activeSubs: 0,
      newSubs: 7,
      renewals: 0,
      cancellations: 0,
      refunds: 0,
      revenueMicros: 70_000_000,
      updatedAt: NOW - 86_400_000,
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    expect(await rollupRows(db)).toMatchObject([
      {
        day: "2026-03-05",
        environment: "Production",
        newSubs: 1,
        directPaidStarts: 0,
        revenueMicros: 9_990_000,
      },
    ]);
    expect(await runStatus(db)).toMatchObject({
      definitionsVersion: ROLLUP_DEFINITIONS_VERSION,
      definitionsFromDay: "2026-02-14",
      lastCatchUpFromDay: "2026-02-14",
      cohortsRequestedAt: NOW,
    });
    expect(scheduled.map((call) => call.name)).toEqual([
      "subscriptions/revenueCohorts:recomputeRevenueCohortsPage",
    ]);

    // The next tick covers only the trailing days and keeps the boundary.
    await runRecompute(ctx, PROJECT_ID, NOW + 600_000);
    expect(await runStatus(db)).toMatchObject({
      definitionsFromDay: "2026-02-14",
    });
    expect((await rollupRows(db)).map((row) => row.day)).toEqual([
      "2026-03-05",
    ]);
  });
});

describe("runRecompute — production and sandbox", () => {
  it("keeps sandbox events and subscriptions in their own rows", async () => {
    const db = new MemDb();
    const ctx = makeCtx(db);
    await seedCurrentRunStatus(db);
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionStarted",
      environment: "Sandbox",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:05:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      environment: "Xcode",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:10:00Z`),
    });
    await seedSub(db, {
      state: "Active",
      environment: "Sandbox",
      expiresAt: Date.UTC(2026, 3, 1),
    });
    // Rows from before the environment field fall back to the last event.
    await seedSub(db, {
      state: "Active",
      lastEventSource: { environment: "Sandbox" },
      expiresAt: Date.UTC(2026, 3, 1),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    const today = (await rollupRows(db)).filter((row) => row.day === TODAY);
    expect(today.find((row) => row.environment === "Production")).toMatchObject(
      { newSubs: 1, renewals: 0, revenueMicros: 9_990_000, activeSubs: 0 },
    );
    expect(today.find((row) => row.environment === "Sandbox")).toMatchObject({
      newSubs: 1,
      renewals: 1,
      revenueMicros: 2 * 9_990_000,
      activeSubs: 2,
    });
  });
});

describe("runRecompute — access, trials and churn", () => {
  it("keeps a canceled subscription active until its paid period ends", async () => {
    const db = new MemDb();
    const ctx = makeCtx(db);
    await seedCurrentRunStatus(db);
    await seedSub(db, {
      state: "Active",
      willRenew: false,
      cancellationReason: "UserCanceled",
      expiresAt: Date.parse(`${D1}T12:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionCanceled",
      receivedAt: Date.parse(`${D2}T10:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionExpired",
      receivedAt: Date.parse(`${D1}T12:00:01Z`),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    const byDay = new Map((await rollupRows(db)).map((row) => [row.day, row]));
    expect(byDay.get(D2)).toMatchObject({
      activeSubs: 1,
      cancellations: 1,
      expirations: 0,
    });
    expect(byDay.get(D1)).toMatchObject({
      activeSubs: 0,
      cancellations: 0,
      expirations: 1,
    });
    expect(byDay.get(TODAY)).toBeUndefined();
  });

  it("counts subscriptions still in a free trial as active trials", async () => {
    const db = new MemDb();
    const ctx = makeCtx(db);
    await seedCurrentRunStatus(db);
    await seedSub(db, {
      state: "Active",
      expiresAt: Date.UTC(2026, 2, 20),
      analytics: {
        trialStartedAt: Date.parse(`${D2}T08:00:00Z`),
        paidMicros: 0,
        refundedMicros: 0,
      },
      startedAt: Date.parse(`${D2}T08:00:00Z`),
    });
    await seedSub(db, {
      state: "Active",
      expiresAt: Date.UTC(2026, 3, 20),
      analytics: {
        trialStartedAt: Date.UTC(2026, 1, 1),
        firstPaidAt: Date.parse(`${D1}T08:00:00Z`),
        firstPaidEventType: "SubscriptionRenewed",
        currency: "USD",
        paidMicros: 9_990_000,
        refundedMicros: 0,
      },
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    const byDay = new Map((await rollupRows(db)).map((row) => [row.day, row]));
    expect(byDay.get(D2)).toMatchObject({ activeSubs: 2, activeTrials: 2 });
    expect(byDay.get(TODAY)).toMatchObject({ activeSubs: 2, activeTrials: 1 });
  });

  it("fixture: before/after totals for the listed defects", async () => {
    // Before these fixes the same events summed to newSubs 3, renewals 0,
    // refunds 1 and $29.97 of revenue: a Google trial booked its $9.99 list
    // price, a sandbox start counted as production, a refund reversal counted
    // as a new $9.99 subscription, and a billing recovery earned nothing.
    const db = new MemDb();
    const ctx = makeCtx(db);
    await seedCurrentRunStatus(db);
    const at = (hour: number): number => Date.parse(`${TODAY}T0${hour}:00:00Z`);
    await seedEvent(db, {
      type: "SubscriptionStarted",
      platform: "Android",
      freeTrial: true,
      priceAmountMicros: 9_990_000,
      receivedAt: at(1),
    });
    await seedEvent(db, {
      type: "SubscriptionStarted",
      environment: "Sandbox",
      priceAmountMicros: 9_990_000,
      receivedAt: at(2),
    });
    await seedEvent(db, {
      type: "PurchaseRefunded",
      cancellationReason: "Refunded",
      priceAmountMicros: 9_990_000,
      receivedAt: at(3),
    });
    await seedEvent(db, {
      type: "SubscriptionStarted",
      refundReversal: true,
      priceAmountMicros: 9_990_000,
      receivedAt: at(4),
    });
    await seedEvent(db, {
      type: "SubscriptionRecovered",
      priceAmountMicros: 9_990_000,
      receivedAt: at(5),
    });

    await runRecompute(ctx, PROJECT_ID, NOW);

    const production = (await rollupRows(db)).filter(
      (row) => row.environment === "Production",
    );
    const sum = (field: string): number =>
      production.reduce((total, row) => total + (row[field] as number), 0);
    expect({
      newSubs: sum("newSubs"),
      trialStarts: sum("trialStarts"),
      renewals: sum("renewals"),
      refunds: sum("refunds"),
      revenueMicros: sum("revenueMicros"),
      refundedMicros: sum("refundedMicros"),
    }).toEqual({
      newSubs: 1,
      trialStarts: 1,
      renewals: 1,
      refunds: 0,
      revenueMicros: 9_990_000,
      refundedMicros: 0,
    });
  });
});

describe("getRevenueMetrics — data state", () => {
  const getRevenueMetrics = testableFunction(registeredGetRevenueMetrics);
  const API_KEY = "openiap-kit_sk_analytics";
  const range = { apiKey: API_KEY, fromDay: D2, toDay: TODAY };

  async function seedKey(db: MemDb): Promise<void> {
    await db.insert("apiKeys", {
      key: API_KEY,
      keyType: "secret",
      isActive: true,
      projectId: PROJECT_ID,
      organizationId: "organizations_test",
    });
  }

  it("rejects an unknown secret key instead of answering zeros", async () => {
    const db = new MemDb();
    await expect(getRevenueMetrics._handler({ db }, range)).rejects.toSatisfy(
      (error: unknown) =>
        (error as { data?: { code?: string } }).data?.code ===
        "INVALID_API_KEY",
    );
  });

  it("reports not_collected, processing, zero and ready", async () => {
    const db = new MemDb();
    await seedKey(db);
    const read = async (): Promise<string> =>
      (await getRevenueMetrics._handler({ db }, range)).dataState;

    expect(await read()).toBe("not_collected");

    await seedEvent(db, { type: "TestNotification", productId: undefined });
    expect(await read()).toBe("processing");

    await seedCurrentRunStatus(db, { lastRunAt: NOW });
    expect(await read()).toBe("zero");

    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    await runRecompute(makeCtx(db), PROJECT_ID, NOW);
    const result = await getRevenueMetrics._handler({ db }, range);
    expect(result).toMatchObject({
      dataState: "ready",
      environment: "Production",
      lastRunAt: NOW,
      definitionsFromDay: "2026-02-14",
      pendingLateEvents: 0,
    });
    expect(result.days).toMatchObject([{ newSubs: 1, trialStarts: 0 }]);
  });

  it("serves sandbox rows only when asked and keeps legacy rows in production", async () => {
    const db = new MemDb();
    await seedKey(db);
    await seedCurrentRunStatus(db, { lastRunAt: NOW });
    const row = {
      projectId: PROJECT_ID,
      day: TODAY,
      productId: "sub.monthly",
      currency: "USD",
      platform: "IOS",
      activeSubs: 1,
      newSubs: 1,
      renewals: 0,
      cancellations: 0,
      refunds: 0,
      revenueMicros: 1,
      updatedAt: NOW,
    };
    await db.insert("revenueMetricsDaily", { ...row, revenueMicros: 5 });
    await db.insert("revenueMetricsDaily", { ...row, environment: "Sandbox" });

    const production = await getRevenueMetrics._handler({ db }, range);
    const sandbox = await getRevenueMetrics._handler(
      { db },
      {
        ...range,
        environment: "Sandbox",
      },
    );
    expect(production.days.map((day) => day.revenueMicros)).toEqual([5]);
    expect(sandbox.days.map((day) => day.revenueMicros)).toEqual([1]);
    expect(sandbox.environment).toBe("Sandbox");
  });
});

describe("cohort job and read", () => {
  it("replaces the project's cohort rows and serves them with realized LTV", async () => {
    const db = new MemDb();
    const ctx = makeCtx(db);
    await seedCurrentRunStatus(db, { lastRunAt: NOW });
    await db.insert("apiKeys", {
      key: "openiap-kit_sk_cohorts",
      keyType: "secret",
      isActive: true,
      projectId: PROJECT_ID,
      organizationId: "organizations_test",
    });
    await db.insert("revenueCohortsMonthly", {
      projectId: PROJECT_ID,
      environment: "Production",
      month: "2025-01",
      currency: "USD",
      members: 99,
    });
    for (const paidMicros of [3 * 9_990_000, 9_990_000]) {
      await seedSub(db, {
        state: "Active",
        expiresAt: Date.UTC(2026, 3, 1),
        analytics: {
          firstPaidAt: Date.UTC(2026, 0, 10),
          firstPaidEventType: "SubscriptionStarted",
          currency: "USD",
          paidMicros,
          refundedMicros: 0,
        },
      });
    }

    await runRevenueCohortsPage(ctx, {
      projectId: PROJECT_ID,
      asOf: NOW,
      cursor: null,
      buckets: [],
    });

    const read = testableFunction(registeredGetRevenueMetrics);
    const result = await read._handler(
      { db },
      {
        apiKey: "openiap-kit_sk_cohorts",
        fromDay: D2,
        toDay: TODAY,
        includeCohorts: true,
      },
    );
    expect(result.cohorts).toEqual([
      {
        month: "2026-01",
        currency: "USD",
        members: 2,
        revenueMicros: 4 * 9_990_000,
        refundedMicros: 0,
        realizedLtvMicros: 2 * 9_990_000,
        retained: [2, 2, 2],
        trialStarts: 0,
        trialConversions: 0,
        trialsPending: 0,
        observedThrough: TODAY,
      },
    ]);
    expect(result.cohortsComputedAt).toBe(NOW);
  });
});
