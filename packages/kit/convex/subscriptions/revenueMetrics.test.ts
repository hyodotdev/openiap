import { foldAccessHistory } from "./accessHistory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFunctionName,
  type SchedulableFunctionReference,
} from "convex/server";

import type { Doc } from "../_generated/dataModel";
import {
  ROLLUP_DEFINITIONS_VERSION,
  applyEventToBucket,
  bucketKey,
  commitRevenueMetricsDays,
  isActiveAt,
  recomputeAllRevenueMetrics,
  recomputeRevenueMetricsForProject,
  recomputeRevenueMetricsPage,
  seedRevenueMetricsProject,
  startOfUtcDay,
  utcDayKey,
  type RecomputeRevenueMetricsPageArgs,
  type RollupBucket,
} from "./revenueMetrics";
import {
  getRevenueMetrics as registeredGetRevenueMetrics,
  metricsSummary,
} from "./query";
import { recomputeRevenueCohortsPage } from "./revenueCohorts";
import { STATS_DEFINITIONS_VERSION, recomputeSubscriptionStats } from "./stats";
import { testableFunction } from "../test.setup";
import { getConvexSize, type Value } from "convex/values";

// Every chain reads `Date.now()` for its run start; tests pin it per run.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
});

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

  it("Google SubscriptionRevoked is not a refund: its voided purchase is", () => {
    // Play sends both for one refund; counting both doubled Refunds.
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "SubscriptionRevoked",
        source: "GooglePlayRealTimeDeveloperNotifications",
        platform: "Android",
        cancellationReason: "Refunded",
        priceAmountMicros: 9_990_000,
      }),
    );
    expect(bucket).toEqual(emptyBucket());
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

  it("a free promotional period is neither a trial nor a charge", () => {
    // Apple prices a free promotional, offer-code or win-back period at 0.
    for (const type of [
      "SubscriptionStarted",
      "SubscriptionRenewed",
    ] as const) {
      const bucket = emptyBucket();
      applyEventToBucket(
        bucket,
        makeEvent({ type, freeTrial: false, priceAmountMicros: 0 }),
      );
      expect(bucket).toEqual(emptyBucket());
    }
    // Its end is not churn either.
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({
        type: "SubscriptionExpired",
        freeTrial: false,
        priceAmountMicros: 0,
      }),
    );
    expect(bucket.expirations).toBe(0);
  });

  it("counts a free start stored before the trial flag as a new subscription", () => {
    const bucket = emptyBucket();
    applyEventToBucket(
      bucket,
      makeEvent({ type: "SubscriptionStarted", priceAmountMicros: 0 }),
    );
    expect(bucket).toEqual({ ...emptyBucket(), newSubs: 1 });
  });

  it("books a Google replacement Play charged at once as a renewal, never a start", () => {
    const replacement = {
      type: "SubscriptionStarted" as const,
      platform: "Android" as const,
      linkedPurchaseToken: "old-token",
      priceAmountMicros: 9_990_000,
    };
    const charged = emptyBucket("2026-03-15", "sub.monthly", "USD", "Android");
    applyEventToBucket(
      charged,
      makeEvent({ ...replacement, replacementCharged: true }),
    );
    expect(charged).toMatchObject({
      newSubs: 0,
      directPaidStarts: 0,
      renewals: 1,
      revenueMicros: 9_990_000,
    });
    // Other modes charge the new plan when it renews.
    const deferred = emptyBucket("2026-03-15", "sub.monthly", "USD", "Android");
    applyEventToBucket(deferred, makeEvent(replacement));
    expect(deferred).toEqual(
      emptyBucket("2026-03-15", "sub.monthly", "USD", "Android"),
    );
  });

  it("books an Apple resubscribe as a reactivation, not a new subscription", () => {
    const resubscribe = {
      type: "SubscriptionStarted" as const,
      resubscribe: true,
      freeTrial: false,
      priceAmountMicros: 9_990_000,
    };
    const reactivated = emptyBucket();
    applyEventToBucket(reactivated, makeEvent(resubscribe));
    expect(reactivated).toMatchObject({
      newSubs: 0,
      directPaidStarts: 0,
      renewals: 1,
      revenueMicros: 9_990_000,
    });
    // The first charge after a trial IAPKit saw lapse is a direct start.
    const afterTrial = emptyBucket();
    applyEventToBucket(
      afterTrial,
      makeEvent({ ...resubscribe, paidStart: "direct" }),
    );
    expect(afterTrial).toMatchObject({
      newSubs: 1,
      directPaidStarts: 1,
      renewals: 0,
      revenueMicros: 9_990_000,
    });
    // A free trial on a resubscribe starts nothing.
    const freeTrial = emptyBucket();
    applyEventToBucket(
      freeTrial,
      makeEvent({ ...resubscribe, freeTrial: true }),
    );
    expect(freeTrial).toEqual(emptyBucket());
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
  it("does not reconstruct access from a legacy current-state row", () => {
    expect(
      isActiveAt(
        makeSub({ state: "Active", expiresAt: Date.UTC(2026, 3, 1) }),
        dayEnd,
      ),
    ).toBe(false);
  });
  it("uses the observed period even when current state has since expired", () => {
    const started = Date.UTC(2026, 2, 1);
    const sub = makeSub({
      state: "Expired",
      analytics: {
        paidMicros: 0,
        refundedMicros: 0,
        accessHistory: foldAccessHistory(
          undefined,
          [
            {
              effectiveAt: started,
              sourceAt: started,
              sourceCreatedAt: started,
              active: true,
              expiresAt: Date.UTC(2026, 3, 1),
            },
          ],
          Date.UTC(2026, 3, 2),
        ),
      },
    });
    expect(isActiveAt(sub, dayEnd)).toBe(true);
    expect(isActiveAt(sub, Date.UTC(2026, 3, 2))).toBe(false);
  });
  it("keeps a non-renewing Apple pass out of subscription counts", () => {
    expect(isActiveAt(makeSub({ state: "Active" }), dayEnd)).toBe(false);
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

type PageHook = (numItems: number, page: Row[]) => void;

class MemQuery {
  constructor(
    private rows: Row[],
    private indexName?: string,
    private onPage?: PageHook,
  ) {}

  withIndex(_name: string, cb?: (q: IndexBuilder) => IndexBuilder): MemQuery {
    if (!cb) return new MemQuery(this.rows, _name, this.onPage);
    const builder = new IndexBuilder();
    cb(builder);
    return new MemQuery(
      this.rows.filter((row) => builder.predicates.every((p) => p(row))),
      _name,
      this.onPage,
    );
  }

  order(direction: "asc" | "desc"): MemQuery {
    const orderField =
      this.indexName === "by_received_at"
        ? "receivedAt"
        : this.indexName === "by_updated_at"
          ? "updatedAt"
          : this.indexName === "by_run_started"
            ? "runStartedAt"
            : "_creationTime";
    // A missing field sorts first, as in a Convex index.
    const value = (row: Row): number =>
      (row[orderField] as number | undefined) ?? -Infinity;
    const sorted = [...this.rows].sort((a, b) =>
      direction === "asc" ? value(a) - value(b) : value(b) - value(a),
    );
    return new MemQuery(sorted, this.indexName, this.onPage);
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
    maximumBytesRead?: number;
  }): Promise<{ page: Row[]; isDone: boolean; continueCursor: string }> {
    const start = opts.cursor === null ? 0 : Number.parseInt(opts.cursor, 10);
    let end = start;
    let bytes = 0;
    while (end < this.rows.length && end - start < opts.numItems) {
      bytes += getConvexSize(this.rows[end] as Value);
      end++;
      if (bytes >= (opts.maximumBytesRead ?? Infinity)) break;
    }
    const page = this.rows.slice(start, end);
    this.onPage?.(opts.numItems, page);
    const isDone = end >= this.rows.length;
    return { page, isDone, continueCursor: String(end) };
  }
}

class MemDb {
  tables = new Map<string, Map<string, Row>>();
  private counter = 0;
  // Sees every page read; a throw fails the reading mutation.
  onPage?: (table: string, numItems: number, page: Row[]) => void;

  constructor() {
    // Rollup tests isolate recomputation after legacy discovery has finished.
    this.table("revenueMetricsDiscovery").set("discovery", {
      _id: "discovery",
      _creationTime: 0,
      phase: "done",
      cursor: null,
      since: 0,
    });
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
    return new MemQuery(
      [...this.table(tableName).values()],
      undefined,
      (numItems, page) => this.onPage?.(tableName, numItems, page),
    );
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
        // As in Convex, an undefined value removes the field.
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) delete row[key];
          else row[key] = value;
        }
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

const chainedPage = testableFunction(recomputeRevenueMetricsPage);
const chainedCommit = testableFunction(commitRevenueMetricsDays);
const kickoff = testableFunction(recomputeRevenueMetricsForProject);
const picker = testableFunction(recomputeAllRevenueMetrics);
const seedProject = testableFunction(seedRevenueMetricsProject);

// Convex rejects a scheduled call whose arguments hold an array over 8,192
// items; the fake scheduler enforces the same limit.
function assertArrayLimit(value: unknown): void {
  if (Array.isArray(value)) {
    expect(value.length).toBeLessThanOrEqual(8_192);
    value.forEach(assertArrayLimit);
  } else if (value !== null && typeof value === "object") {
    Object.values(value).forEach(assertArrayLimit);
  }
}

// Runs the rollup's own chained mutations inline and records every other
// follow-up (catch-ups, stats and cohort jobs) for the test to inspect.
function makeCtx(db: MemDb, scheduled: ScheduledCall[] = []) {
  const ctx = {
    db,
    scheduler: {
      runAfter: async (
        _delayMs: number,
        fn: SchedulableFunctionReference,
        args: Record<string, unknown>,
      ) => {
        assertArrayLimit(args);
        const name = getFunctionName(fn);
        if (name.endsWith(":seedRevenueMetricsProject")) {
          await seedProject._handler(
            ctx,
            args as Parameters<typeof seedProject._handler>[1],
          );
        } else if (name.endsWith(":recomputeRevenueMetricsPage")) {
          await chainedPage._handler(
            ctx,
            args as RecomputeRevenueMetricsPageArgs,
          );
        } else if (name.endsWith(":commitRevenueMetricsDays")) {
          await chainedCommit._handler(
            ctx,
            args as Parameters<typeof chainedCommit._handler>[1],
          );
        } else {
          scheduled.push({ name, args });
        }
      },
    },
  };
  return ctx;
}

type TestCtx = ReturnType<typeof makeCtx>;

// One rollup run for PROJECT_ID starting at `at`, as the cron kicks it off.
async function recompute(
  ctx: TestCtx,
  at: number = NOW,
  fromDay?: string,
): Promise<void> {
  vi.setSystemTime(at);
  await kickoff._handler(ctx, {
    projectId: PROJECT_ID,
    ...(fromDay !== undefined ? { fromDay } : {}),
  });
}

// The projects one cron tick at `at` kicks off, in order.
async function pickProjects(
  db: MemDb,
  batchSize: number,
  at: number = NOW,
): Promise<unknown[]> {
  const scheduled: ScheduledCall[] = [];
  vi.setSystemTime(at);
  await picker._handler(makeCtx(db, scheduled), { batchSize });
  return scheduled
    .filter((call) => call.name.endsWith(":recomputeRevenueMetricsForProject"))
    .map((call) => call.args.projectId);
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
  const start = Math.min(
    partial.startedAt ?? Date.UTC(2026, 1, 1),
    partial.analytics?.firstPaidAt ?? Infinity,
    partial.analytics?.trialStartedAt ?? Infinity,
  );
  const accessHistory = foldAccessHistory(
    undefined,
    [
      {
        effectiveAt: start,
        sourceAt: start,
        sourceCreatedAt: start,
        active:
          partial.state === "Active" ||
          partial.state === "InGracePeriod" ||
          partial.state === "Expired" ||
          partial.state === "InBillingRetry",
        ...(partial.expiresAt !== undefined
          ? { expiresAt: partial.expiresAt }
          : {}),
      },
    ],
    NOW,
  );
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
    analytics: {
      paidMicros: 0,
      refundedMicros: 0,
      ...partial.analytics,
      accessHistory,
      ...(partial.analytics?.firstPaidAt !== undefined
        ? { firstPaidAnchorKnown: true }
        : {}),
      ...(partial.analytics?.trialStartedAt !== undefined
        ? { trialAnchorKnown: true }
        : {}),
    },
  });
}

async function rollupRows(db: MemDb): Promise<Row[]> {
  return await db.query("revenueMetricsDaily").collect();
}

describe("recomputeAllRevenueMetrics picker", () => {
  let db: MemDb;

  beforeEach(() => {
    vi.setSystemTime(NOW - 1000);
    db = new MemDb();
    db.tables.get("revenueMetricsDiscovery")?.clear();
  });

  it("discovers projects with recent webhooks even when stale status rows fill the batch", async () => {
    await db.insert("revenueMetricsRunStatus", {
      projectId: "p_old_1",
      runStartedAt: 1,
      lastRunAt: 1,
    });
    await db.insert("revenueMetricsRunStatus", {
      projectId: "p_old_2",
      runStartedAt: 2,
      lastRunAt: 2,
    });
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      projectId: PROJECT_ID,
      receivedAt: NOW,
    });

    const projects = await pickProjects(db, 2);

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

    await pickProjects(db, 2); // Empty event page advances discovery to stats.
    const projects = await pickProjects(db, 2);

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

    const projects = await pickProjects(db, 10);

    expect(
      projects.filter((projectId) => projectId === PROJECT_ID),
    ).toHaveLength(1);
  });

  it("finishes a checkpointed bootstrap past 300 equal-time events and never rereads them", async () => {
    for (let i = 0; i < 351; i++) {
      await seedEvent(db, {
        type: "SubscriptionRenewed",
        receivedAt: NOW,
        rawSignedPayload: "synthetic".repeat(256),
      });
    }
    const readSizes: number[] = [];
    db.onPage = (table, _limit, page) => {
      if (table === "webhookEvents") readSizes.push(page.length);
    };
    for (let i = 0; i < 5; i++) await pickProjects(db, 10);
    expect(readSizes).toEqual([100, 100, 100, 51]);
    expect(await db.query("revenueMetricsDiscovery").unique()).toMatchObject({
      phase: "done",
      cursor: null,
    });
    expect(await db.query("revenueMetricsRunStatus").collect()).toHaveLength(1);
    for (let i = 0; i < 3; i++) await pickProjects(db, 10);
    expect(readSizes).toEqual([100, 100, 100, 51]);
  });

  it("finishes a fixed historical window even while new raw events keep arriving", async () => {
    for (let i = 0; i < 251; i++)
      await seedEvent(db, { type: "SubscriptionRenewed", receivedAt: NOW });
    const reads: number[] = [];
    db.onPage = (table, _limit, page) => {
      if (table === "webhookEvents") reads.push(page.length);
    };
    for (let tick = 0; tick < 5; tick++) {
      await pickProjects(db, 10, NOW + tick * 60_000);
      for (let i = 0; i < 120; i++)
        await seedEvent(db, {
          type: "SubscriptionRenewed",
          receivedAt: NOW + tick * 60_000 + 1,
        });
    }
    expect(reads).toEqual([100, 100, 51]);
    expect(await db.query("revenueMetricsDiscovery").unique()).toMatchObject({
      phase: "done",
      through: NOW,
    });
  });

  it("does not seed projects undergoing deletion during legacy discovery", async () => {
    await db.patch(PROJECT_ID, { pendingDeletion: true });
    await seedEvent(db, { type: "SubscriptionRenewed" });
    expect(await pickProjects(db, 10)).toEqual([]);
    expect(await db.query("revenueMetricsRunStatus").collect()).toEqual([]);
  });

  it("does not seed work from legacy Meta Horizon reconciler events", async () => {
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      source: "MetaHorizonReconciler",
      projectId: PROJECT_ID,
      receivedAt: NOW,
    });

    expect(await pickProjects(db, 10)).toEqual([]);
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
    runStartedAt: NOW - 10 * 60 * 1000,
    definitionsVersion: ROLLUP_DEFINITIONS_VERSION,
    definitionsFromDay: "2026-02-14",
    lastNotificationAt: { Production: NOW - 10 * 60 * 1000 },
    cohortsRequestedAt: NOW,
    statsDefinitionsVersion: STATS_DEFINITIONS_VERSION,
    statsUpdatedAt: NOW,
    statsValidUntil: null,
    ...fields,
  });
}

async function runStatus(db: MemDb): Promise<Row | null> {
  return db.query("revenueMetricsRunStatus").first();
}

// One mutation as Convex runs it: a throw rolls back its writes alone.
async function transaction(
  db: MemDb,
  mutation: () => Promise<unknown>,
): Promise<void> {
  const saved = structuredClone(db.tables);
  try {
    await mutation();
  } catch (error) {
    db.tables = saved;
    throw error;
  }
}

// A rollup run's chain, one scheduled mutation per step, each in its own
// transaction. Other follow-ups (catch-ups, stats and cohort jobs) are dropped.
function rollupChain(db: MemDb) {
  const queue: ScheduledCall[] = [];
  const ctx = {
    db,
    scheduler: {
      runAfter: async (
        _delayMs: number,
        fn: SchedulableFunctionReference,
        args: Record<string, unknown>,
      ) => {
        queue.push({ name: getFunctionName(fn), args });
      },
    },
  };
  return {
    queue,
    async start(at: number, fromDay?: string): Promise<void> {
      vi.setSystemTime(at);
      await transaction(db, () =>
        kickoff._handler(ctx, {
          projectId: PROJECT_ID,
          ...(fromDay !== undefined ? { fromDay } : {}),
        }),
      );
    },
    async step(): Promise<void> {
      const call = queue.shift();
      if (!call) return;
      const { name, args } = call;
      if (name.endsWith(":recomputeRevenueMetricsPage")) {
        await transaction(db, () =>
          chainedPage._handler(ctx, args as RecomputeRevenueMetricsPageArgs),
        );
      } else if (name.endsWith(":commitRevenueMetricsDays")) {
        await transaction(db, () =>
          chainedCommit._handler(
            ctx,
            args as Parameters<typeof chainedCommit._handler>[1],
          ),
        );
      }
    },
  };
}

// One rollup run at `at` to its end. A failed mutation ends the chain, as a
// throwing scheduled function does.
async function runChain(
  db: MemDb,
  at: number = NOW,
  fromDay?: string,
): Promise<boolean> {
  const chain = rollupChain(db);
  try {
    await chain.start(at, fromDay);
    while (chain.queue.length > 0) await chain.step();
    return true;
  } catch {
    return false;
  }
}

const HOUR = 60 * 60 * 1000;

describe("rollup run — round-trip integration", () => {
  let db: MemDb;
  let ctx: TestCtx;

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

    await recompute(ctx);
    expect(await rollupRows(db)).toEqual([]);
    expect((await runStatus(db))?.lastRunAt).toBe(NOW - 10 * 60 * 1000);
  });

  it("empty project → no rollup rows written", async () => {
    await recompute(ctx);
    expect(await rollupRows(db)).toEqual([]);
  });

  it("single SubscriptionStarted on today → newSubs=1, revenue=price", async () => {
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await recompute(ctx);

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

    await recompute(ctx);

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

    await recompute(ctx);

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

    await recompute(ctx);

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

    await recompute(ctx);

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

  it("counts each refund once; revocations never count", async () => {
    await seedEvent(db, {
      type: "PurchaseRefunded",
      cancellationReason: "Refunded",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    // Family Sharing removal.
    await seedEvent(db, {
      type: "SubscriptionRevoked",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T11:30:00Z`),
    });

    await recompute(ctx);
    const rows = await rollupRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ refunds: 1, refundedMicros: 9_990_000 });
  });

  it("counts a Play refund once, under its subscription's product and environment", async () => {
    // Play reports one refund as SUBSCRIPTION_REVOKED plus a voided purchase
    // that names no product, price or test flag.
    await seedSub(db, {
      state: "Revoked",
      purchaseToken: "play-token",
      platform: "Android",
      productId: "sub.yearly",
      currency: "EUR",
      environment: "Sandbox",
    });
    await seedSub(db, {
      state: "Revoked",
      purchaseToken: "play-token-2",
      platform: "Android",
      productId: "sub.yearly",
      currency: "EUR",
    });
    for (const purchaseToken of ["play-token", "play-token-2"]) {
      await seedEvent(db, {
        type: "SubscriptionRevoked",
        source: "GooglePlayRealTimeDeveloperNotifications",
        platform: "Android",
        purchaseToken,
        productId: "sub.yearly",
        currency: "EUR",
        cancellationReason: "Refunded",
        priceAmountMicros: 49_990_000,
        receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
      });
      await seedEvent(db, {
        type: "PurchaseRefunded",
        source: "GooglePlayRealTimeDeveloperNotifications",
        platform: "Android",
        purchaseToken,
        productId: undefined,
        currency: undefined,
        cancellationReason: "Refunded",
        receivedAt: Date.parse(`${TODAY}T10:01:00Z`),
      });
    }

    await recompute(ctx);
    const refunds = (await rollupRows(db))
      .filter((row) => row.refunds !== 0)
      .map((row) => ({
        environment: row.environment,
        productId: row.productId,
        currency: row.currency,
        refunds: row.refunds,
      }));
    expect(refunds).toEqual(
      expect.arrayContaining([
        {
          environment: "Sandbox",
          productId: "sub.yearly",
          currency: "EUR",
          refunds: 1,
        },
        {
          environment: "Production",
          productId: "sub.yearly",
          currency: "EUR",
          refunds: 1,
        },
      ]),
    );
    expect(refunds).toHaveLength(2);
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

    await recompute(ctx);
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

    await recompute(ctx);

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

    await recompute(ctx);

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

    await recompute(ctx);

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

    await recompute(ctx);
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

    await recompute(ctx);
    expect(await rollupRows(db)).toEqual([]);
  });

  it("events outside trailing window are NOT included", async () => {
    // 4 days ago — outside the 3-day window (today + 2 prior).
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${OUT_OF_WINDOW}T10:00:00Z`),
    });

    await recompute(ctx);
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

    await recompute(ctx);
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

    await recompute(ctx);

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

    await recompute(ctx);
    const byDay = new Map(
      (await rollupRows(db)).map((r) => [r.day, r.activeSubs]),
    );
    expect(byDay.get(D2)).toBe(1);
    expect(byDay.get(D1)).toBe(1);
    expect(byDay.get(TODAY)).toBe(0); // Explicit zero prevents a stale active snapshot carrying forward.
  });

  it("counts today's subscriptions as of the run, not midnight", async () => {
    // NOW is noon; it renews this evening, so it is active today.
    await seedSub(db, {
      state: "Active",
      startedAt: Date.UTC(2026, 1, 1),
      expiresAt: Date.parse(`${TODAY}T18:00:00Z`),
    });

    await recompute(ctx);
    const byDay = new Map(
      (await rollupRows(db)).map((r) => [r.day, r.activeSubs]),
    );
    expect(byDay.get(TODAY)).toBe(1);
  });

  it("activeSubs respects start mid-window", async () => {
    // Sub started D1 noon — only active on D1 + TODAY, NOT on D2.
    await seedSub(db, {
      state: "Active",
      startedAt: Date.parse(`${D1}T12:00:00Z`),
      expiresAt: Date.UTC(2026, 3, 1),
    });

    await recompute(ctx);
    const byDay = new Map(
      (await rollupRows(db)).map((r) => [r.day, r.activeSubs]),
    );
    expect(byDay.get(D2)).toBe(0);
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

    await recompute(ctx);
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

    await recompute(ctx);
    expect((await rollupRows(db)).map((row) => row.activeSubs)).toEqual([
      0, 0, 0,
    ]);
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

    await recompute(ctx);
    const first = (await rollupRows(db)).map((r) => ({
      day: r.day,
      productId: r.productId,
      currency: r.currency,
      newSubs: r.newSubs,
      renewals: r.renewals,
      revenueMicros: r.revenueMicros,
      activeSubs: r.activeSubs,
    }));

    await recompute(ctx);
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
    await recompute(ctx);

    let row = (await rollupRows(db)).find((r) => r.day === D1);
    expect(row?.newSubs).toBe(1);

    // Late RENEWED event for D1 arrives between ticks (within
    // trailing window).
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${D1}T15:00:00Z`),
    });

    await recompute(ctx);
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

    await recompute(ctx);
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

    await recompute(ctx);
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

    await recompute(ctx);
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

    await recompute(ctx);
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
    await recompute(ctx, NOW + 60_000, "2026-03-05");
    expect(await rollupRows(db)).toMatchObject([
      { day: "2026-03-05", newSubs: 1, revenueMicros: 9_990_000 },
    ]);
    expect(await runStatus(db)).toMatchObject({
      pendingLateEvents: 0,
      coverage: [{ at: NOW + 60_000, fromDay: "2026-03-05" }],
    });

    // A regular tick afterwards sees the event as covered.
    await recompute(ctx, NOW + 120_000);
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

    await recompute(ctx);
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

    await recompute(ctx);
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

    await recompute(ctx);
    const rows = await rollupRows(db);
    const old = rows.find((r) => r.day === "2026-02-15");
    expect(old?.newSubs).toBe(3);
  });
});

describe("rollup run — definitions rebuild", () => {
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

    await recompute(ctx);

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
      lastRunAt: NOW,
      definitionsVersion: ROLLUP_DEFINITIONS_VERSION,
      definitionsFromDay: "2026-02-14",
      coverage: [{ at: NOW, fromDay: "2026-02-14" }],
      cohortsRequestedAt: NOW,
    });
    expect(scheduled.map((call) => call.name)).toEqual([
      "subscriptions/stats:recomputeSubscriptionStats",
      "subscriptions/revenueCohorts:recomputeRevenueCohortsPage",
    ]);

    // The next tick covers only the trailing days and keeps the boundary.
    await recompute(ctx, NOW + 600_000);
    expect(await runStatus(db)).toMatchObject({
      definitionsFromDay: "2026-02-14",
    });
    expect((await rollupRows(db)).map((row) => row.day)).toEqual([
      "2026-03-05",
    ]);
  });

  it("rebuilds more product combinations than one 30-day carry could hold", async () => {
    // 300 products × 30 days is 9,000 buckets: one array of them is over
    // Convex's 8,192-item limit, which used to fail every rebuild.
    const db = new MemDb();
    const ctx = makeCtx(db);
    for (let i = 0; i < 300; i++) {
      await seedSub(db, {
        state: "Active",
        productId: `sub.${i}`,
        expiresAt: Date.UTC(2026, 3, 1),
      });
    }

    await recompute(ctx);

    const rows = await rollupRows(db);
    expect(rows).toHaveLength(300 * 30);
    expect(new Set(rows.map((row) => row.day)).size).toBe(30);
    expect(await runStatus(db)).toMatchObject({
      lastRunAt: NOW,
      definitionsVersion: ROLLUP_DEFINITIONS_VERSION,
      definitionsFromDay: "2026-02-14",
    });
  });
});

describe("rollup run — event reads", () => {
  it("counts a late event on its day in a 30-day rebuild", async () => {
    const db = new MemDb();
    let eventsRead = 0;
    db.onPage = (table, _numItems, page) => {
      if (table === "webhookEvents") eventsRead += page.length;
    };
    // One renewal on each retained day.
    for (let i = 0; i < 30; i++) {
      const day = Date.parse("2026-02-14T10:00:00Z") + i * 86_400_000;
      await seedEvent(db, {
        type: "SubscriptionRenewed",
        priceAmountMicros: 9_990_000,
        receivedAt: day,
      });
    }
    // Happened in the first slice, arrived in the last.
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse("2026-02-15T10:00:00Z"),
      receivedAt: Date.parse(`${TODAY}T11:00:00Z`),
    });

    await recompute(makeCtx(db));

    // Each slice reads the events received from its first day on: the event
    // of day d in ⌊d/3⌋ + 1 slices, and the late one in all 10.
    expect(eventsRead).toBe((3 * (10 * 11)) / 2 + 10);
    const renewals = async (day: string) =>
      (await rollupRows(db)).find((row) => row.day === day)?.renewals;
    expect(await renewals("2026-02-14")).toBe(1);
    expect(await renewals("2026-02-15")).toBe(2);
    expect(await renewals(TODAY)).toBe(1);
    expect(await runStatus(db)).toMatchObject({
      lastRunAt: NOW,
      pendingLateEvents: 0,
    });
  });
});

describe("rollup run — failures and follow-ups", () => {
  it("keeps a failed first page's run stamp, so the picker waits", async () => {
    const db = new MemDb();
    await seedCurrentRunStatus(db);
    db.onPage = (table) => {
      if (table === "webhookEvents") throw new Error("Too many bytes read");
    };

    expect(await runChain(db)).toBe(false);

    expect(await runStatus(db)).toMatchObject({ runStartedAt: NOW });
    expect(await pickProjects(db, 10, NOW + 10 * 60 * 1000)).toEqual([]);
  });

  it("halves its pages after each failed run and waits longer to retry", async () => {
    const db = new MemDb();
    await seedCurrentRunStatus(db);
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    // Pages above 100 events exceed the read limit.
    const pageSizes: number[] = [];
    db.onPage = (table, numItems) => {
      if (table !== "webhookEvents") return;
      pageSizes.push(numItems);
      if (numItems > 100) throw new Error("Too many bytes read");
    };

    expect(await runChain(db, NOW)).toBe(false);
    expect(await pickProjects(db, 10, NOW + 59 * 60 * 1000)).toEqual([]);
    expect(await pickProjects(db, 10, NOW + HOUR)).toEqual([PROJECT_ID]);

    expect(await runChain(db, NOW + HOUR)).toBe(false);
    expect(await pickProjects(db, 10, NOW + 2.9 * HOUR)).toEqual([]);
    expect(await pickProjects(db, 10, NOW + 3 * HOUR)).toEqual([PROJECT_ID]);

    expect(await runChain(db, NOW + 3 * HOUR)).toBe(true);
    expect(pageSizes).toEqual([400, 200, 100]);
    expect(await runStatus(db)).toMatchObject({ lastRunAt: NOW + 3 * HOUR });
    expect(await runStatus(db)).not.toHaveProperty("failedRuns");
    expect(
      (await rollupRows(db)).find((row) => row.day === TODAY),
    ).toMatchObject({ newSubs: 1 });
  });

  it("backs a failed run off for an hour instead of re-picking it every tick", async () => {
    const db = new MemDb();
    // Started at NOW and never finished: a later page threw.
    await seedCurrentRunStatus(db, { runStartedAt: NOW });
    await db.insert("revenueMetricsRunStatus", {
      projectId: "p_healthy",
      lastRunAt: NOW - 30 * 60 * 1000,
      runStartedAt: NOW - 30 * 60 * 1000,
    });

    expect(await pickProjects(db, 10, NOW + 10 * 60 * 1000)).toEqual([
      "p_healthy",
    ]);
    expect(await pickProjects(db, 10, NOW + 61 * 60 * 1000)).toEqual([
      "p_healthy",
      PROJECT_ID,
    ]);
  });

  it("stamps the run start before the chain and records the run only when every slice is written", async () => {
    const db = new MemDb();
    const scheduled: ScheduledCall[] = [];
    const ctx = makeCtx(db, scheduled);
    await seedCurrentRunStatus(db);
    let statusDuringChain: Row | null = null;
    const observing = {
      ...ctx,
      scheduler: {
        runAfter: async (
          delayMs: number,
          fn: SchedulableFunctionReference,
          args: Record<string, unknown>,
        ) => {
          const status = await runStatus(db);
          statusDuringChain ??= status && { ...status };
          await ctx.scheduler.runAfter(delayMs, fn, args);
        },
      },
    };
    vi.setSystemTime(NOW);
    await kickoff._handler(observing, { projectId: PROJECT_ID });

    expect(statusDuringChain).toMatchObject({
      runStartedAt: NOW,
      lastRunAt: NOW - 10 * 60 * 1000,
    });
    expect(await runStatus(db)).toMatchObject({
      runStartedAt: NOW,
      lastRunAt: NOW,
    });
  });

  it("requests one stats rebuild per definitions version, which drops sandbox from live counts", async () => {
    const db = new MemDb();
    const scheduled: ScheduledCall[] = [];
    const ctx = makeCtx(db, scheduled);
    await seedCurrentRunStatus(db, { statsDefinitionsVersion: undefined });
    await seedSub(db, { state: "Active", expiresAt: Date.UTC(2026, 3, 1) });
    await seedSub(db, {
      state: "Active",
      environment: "Sandbox",
      expiresAt: Date.UTC(2026, 3, 1),
    });
    // Totals stored before sandbox was excluded.
    await db.insert("subscriptionStats", {
      projectId: PROJECT_ID,
      currency: "USD",
      activeSubs: 2,
      inGracePeriod: 0,
      inBillingRetry: 0,
      mrrMicros: 2 * 9_990_000,
      updatedAt: NOW - 86_400_000,
    });
    const statsRebuilds = () =>
      scheduled.filter(
        (call) =>
          call.name.endsWith(":recomputeSubscriptionStats") &&
          !("ifExpired" in call.args),
      );

    await recompute(ctx);
    await recompute(ctx, NOW + 10 * 60 * 1000);
    expect(statsRebuilds()).toEqual([
      {
        name: "subscriptions/stats:recomputeSubscriptionStats",
        args: { projectId: PROJECT_ID },
      },
    ]);

    vi.setSystemTime(NOW + 11 * 60 * 1000);
    await testableFunction(recomputeSubscriptionStats)._handler(ctx, {
      projectId: PROJECT_ID,
    });
    expect(await db.query("subscriptionStats").collect()).toMatchObject([
      { currency: "USD", activeSubs: 1 },
    ]);
    expect(await runStatus(db)).toMatchObject({
      statsDefinitionsVersion: STATS_DEFINITIONS_VERSION,
    });

    // Past the retry interval nothing is requested once the version matches.
    await recompute(ctx, NOW + 7 * 60 * 60 * 1000);
    expect(statsRebuilds()).toHaveLength(1);
  });
});

describe("rollup run — slow runs", () => {
  const MINUTE = 60 * 1000;

  // A 30-day rebuild crosses ten scheduled slices.
  async function startRebuild(
    db: MemDb,
  ): Promise<ReturnType<typeof rollupChain>> {
    await seedCurrentRunStatus(db, { definitionsVersion: undefined });
    const chain = rollupChain(db);
    await chain.start(NOW);
    return chain;
  }

  it("leaves a run that keeps committing pages past an hour to finish", async () => {
    const db = new MemDb();
    const chain = await startRebuild(db);

    let at = NOW;
    while (chain.queue.length > 0) {
      expect(await pickProjects(db, 10, at)).toEqual([]);
      at += 4 * MINUTE;
      vi.setSystemTime(at);
      await chain.step();
    }

    expect(at - NOW).toBeGreaterThan(HOUR);
    expect(await runStatus(db)).toMatchObject({
      lastRunAt: NOW,
      definitionsVersion: ROLLUP_DEFINITIONS_VERSION,
    });
  });

  it("retries a run an hour after its last committed page", async () => {
    const db = new MemDb();
    const chain = await startRebuild(db);
    const lastPageAt = NOW + 30 * MINUTE;
    for (let at = NOW + 5 * MINUTE; at <= lastPageAt; at += 5 * MINUTE) {
      vi.setSystemTime(at);
      await chain.step();
    }

    expect(await pickProjects(db, 10, lastPageAt + 59 * MINUTE)).toEqual([]);
    expect(await pickProjects(db, 10, lastPageAt + HOUR)).toEqual([PROJECT_ID]);
  });

  it("does not count a run replaced while still moving as failed", async () => {
    const db = new MemDb();
    const chain = await startRebuild(db);
    vi.setSystemTime(NOW + 10 * MINUTE);
    await chain.step();

    await rollupChain(db).start(NOW + 20 * MINUTE);

    expect(await runStatus(db)).toMatchObject({
      runStartedAt: NOW + 20 * MINUTE,
    });
    expect(await runStatus(db)).not.toHaveProperty("failedRuns");
  });
});

describe("rollup run — concurrent subscription changes", () => {
  it("counts a subscription once when its state changes after the first subscription page", async () => {
    const db = new MemDb();
    await seedCurrentRunStatus(db);
    await seedSub(db, { state: "Active", expiresAt: NOW + 24 * HOUR });
    const sub = (await db.query("subscriptions").first())!;
    const chain = rollupChain(db);
    await chain.start(NOW);
    while (
      chain.queue[0]?.args.cursor &&
      (chain.queue[0].args.cursor as RecomputeRevenueMetricsPageArgs["cursor"])
        .phase !== "subs"
    ) {
      await chain.step();
    }
    await chain.step();
    await db.patch(sub._id, { state: "InGracePeriod", updatedAt: NOW + 1 });
    while (chain.queue.length > 0) await chain.step();
    for (const row of await rollupRows(db)) expect(row.activeSubs).toBe(1);
    expect(await rollupRows(db)).toHaveLength(3);
  });

  it("keeps page boundaries stable when subscriptions change state and update time", async () => {
    const db = new MemDb();
    await seedCurrentRunStatus(db, {
      lastRunAt: NOW - 24 * HOUR,
      runStartedAt: NOW - HOUR,
      failedRuns: 8,
    });
    for (let i = 0; i < 26; i++) {
      await seedSub(db, { state: "Active", expiresAt: NOW + 24 * HOUR });
    }
    const subs = await db.query("subscriptions").collect();
    const pages: number[] = [];
    db.onPage = (table, _size, page) => {
      if (table === "subscriptions") pages.push(page.length);
    };
    const chain = rollupChain(db);
    await chain.start(NOW);
    while (pages.length === 0) await chain.step();
    expect(pages).toEqual([25]);

    await db.patch(subs[0]._id, { state: "InGracePeriod", updatedAt: NOW + 1 });
    await db.patch(subs[25]._id, { state: "Expired", updatedAt: NOW + 2 });
    while (chain.queue.length > 0) await chain.step();

    expect(pages).toEqual([25, 1]);
    const rows = await rollupRows(db);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.activeSubs).toBe(26);
  });

  it("restarts legacy state cursors without losing event totals", async () => {
    const db = new MemDb();
    await seedCurrentRunStatus(db);
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
    });
    await seedSub(db, { state: "Active", expiresAt: NOW + 24 * HOUR });
    const chain = rollupChain(db);
    await chain.start(NOW);
    while (
      (chain.queue[0].args.cursor as RecomputeRevenueMetricsPageArgs["cursor"])
        .phase !== "subs"
    ) {
      await chain.step();
    }
    const args = chain.queue[0].args as RecomputeRevenueMetricsPageArgs;
    args.cursor = {
      phase: "subs",
      stateIdx: 2,
      paginationCursor: "legacy-index-cursor",
    };
    for (const bucket of args.buckets) {
      bucket.activeSubs = 8;
      bucket.activeTrials = 4;
    }
    while (chain.queue.length > 0) await chain.step();

    const rows = await rollupRows(db);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.activeSubs).toBe(1);
      expect(row.activeTrials).toBe(0);
    }
    expect(rows.reduce((sum, row) => sum + (row.renewals as number), 0)).toBe(
      1,
    );
    expect(
      rows.reduce((sum, row) => sum + (row.revenueMicros as number), 0),
    ).toBe(9_990_000);
  });
});

describe("rollup run — overlapping runs", () => {
  // A first 30-day rebuild stalls after its first slice (2026-02-14 to 16) is
  // written; the picker's retry an hour later runs to the end; then the
  // stalled run resumes.
  async function stallRetryResume(db: MemDb): Promise<void> {
    const stalled = rollupChain(db);
    await stalled.start(NOW);
    const nextSliceFirst = () =>
      (stalled.queue[0]?.args.days as string[] | undefined)?.[0];
    while (stalled.queue.length > 0 && nextSliceFirst() !== "2026-02-17") {
      await stalled.step();
    }
    expect(nextSliceFirst()).toBe("2026-02-17");

    expect(await runChain(db, NOW + HOUR)).toBe(true);

    while (stalled.queue.length > 0) await stalled.step();
  }
  const renewalsOn = async (db: MemDb, day: string) =>
    (await rollupRows(db))
      .filter((row) => row.day === day)
      .reduce((sum, row) => sum + (row.renewals as number), 0);

  it("never counts an event twice", async () => {
    const db = new MemDb();
    // Happened in the first slice, arrived in the second.
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse("2026-02-15T10:00:00Z"),
      receivedAt: Date.parse("2026-02-18T10:00:00Z"),
    });

    await stallRetryResume(db);

    expect(await renewalsOn(db, "2026-02-15")).toBe(1);
  });

  it("stops the replaced run before it overwrites newer counts", async () => {
    const db = new MemDb();
    // Arrived after the stalled run started, before the retry did.
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
      receivedAt: NOW + 30 * 60 * 1000,
    });

    await stallRetryResume(db);

    expect(await renewalsOn(db, TODAY)).toBe(1);
    expect(await runStatus(db)).toMatchObject({
      lastRunAt: NOW + HOUR,
      runStartedAt: NOW + HOUR,
    });
  });
});

describe("rollup run — late events", () => {
  it("counts a late event once however many slices read it", async () => {
    const db = new MemDb();
    await seedCurrentRunStatus(db);
    // Before the catch-up's window; every one of its four slices reads it.
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse("2026-03-02T10:00:00Z"),
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await recompute(makeCtx(db), NOW, "2026-03-05");

    expect(await runStatus(db)).toMatchObject({
      pendingLateEvents: 1,
      oldestPendingLateDay: "2026-03-02",
    });
  });

  it("retries a failed catch-up over its whole window", async () => {
    const db = new MemDb();
    await seedCurrentRunStatus(db);
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse("2026-03-05T03:00:00Z"),
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    db.onPage = (table) => {
      if (table === "subscriptions") throw new Error("Too many bytes read");
    };
    expect(await runChain(db, NOW, "2026-03-05")).toBe(false);
    db.onPage = undefined;

    // The picker's retry passes no `fromDay`.
    expect(await runChain(db, NOW + HOUR)).toBe(true);

    expect(
      (await rollupRows(db)).find((row) => row.day === "2026-03-05"),
    ).toMatchObject({ newSubs: 1, revenueMicros: 9_990_000 });
    expect(await runStatus(db)).toMatchObject({
      pendingLateEvents: 0,
      coverage: [{ at: NOW + HOUR, fromDay: "2026-03-05" }],
    });
  });

  it("does not hold an event that a run counted while its day was in the window", async () => {
    // Occurred the day before D2 and arrived on D2: the run on D2 counted it.
    const db = new MemDb();
    const scheduled: ScheduledCall[] = [];
    const ctx = makeCtx(db, scheduled);
    await seedCurrentRunStatus(db, { coverage: [] });
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse(`${OUT_OF_WINDOW}T23:59:00Z`),
      receivedAt: Date.parse(`${D2}T00:30:00Z`),
    });

    await recompute(ctx, Date.parse(`${D2}T12:00:00Z`));
    expect(
      (await rollupRows(db)).find((row) => row.day === OUT_OF_WINDOW),
    ).toMatchObject({ renewals: 1 });

    await recompute(ctx);
    expect(await runStatus(db)).toMatchObject({ pendingLateEvents: 0 });
    expect(scheduled).toEqual([]);
  });

  it("keeps an earlier wider catch-up's coverage after a narrower one", async () => {
    const db = new MemDb();
    const scheduled: ScheduledCall[] = [];
    const ctx = makeCtx(db, scheduled);
    await seedCurrentRunStatus(db, { coverage: [] });
    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse("2026-03-02T10:00:00Z"),
      receivedAt: Date.parse(`${TODAY}T08:00:00Z`),
    });
    await recompute(ctx, NOW, "2026-03-02");

    await seedEvent(db, {
      type: "SubscriptionRenewed",
      priceAmountMicros: 9_990_000,
      occurredAt: Date.parse("2026-03-08T10:00:00Z"),
      receivedAt: Date.parse(`${TODAY}T13:00:00Z`),
    });
    await recompute(ctx, NOW + 2 * 60 * 60 * 1000, "2026-03-08");
    expect(await runStatus(db)).toMatchObject({
      pendingLateEvents: 0,
      coverage: [
        { at: NOW, fromDay: "2026-03-02" },
        { at: NOW + 2 * 60 * 60 * 1000, fromDay: "2026-03-08" },
      ],
    });

    // A regular tick finds neither event late, so no wide recompute repeats.
    await recompute(ctx, NOW + 3 * 60 * 60 * 1000);
    expect(await runStatus(db)).toMatchObject({ pendingLateEvents: 0 });
    expect(scheduled).toEqual([]);
  });
});

describe("rollup run — churn", () => {
  it("does not count a free trial that ended unpaid as churn", async () => {
    const db = new MemDb();
    const ctx = makeCtx(db);
    await seedCurrentRunStatus(db);
    // Play: the expiry carries no trial flag; the subscription's facts show a
    // trial and no paid charge.
    await seedSub(db, {
      state: "Expired",
      purchaseToken: "lapsed-trial",
      platform: "Android",
      expiresAt: Date.parse(`${D1}T08:00:00Z`),
      analytics: {
        trialStartedAt: Date.parse("2026-03-07T08:00:00Z"),
        paidMicros: 0,
        refundedMicros: 0,
      },
    });
    await seedSub(db, {
      state: "Expired",
      purchaseToken: "paid-then-churned",
      platform: "Android",
      expiresAt: Date.parse(`${D1}T08:00:00Z`),
      analytics: {
        trialStartedAt: Date.parse("2026-02-07T08:00:00Z"),
        firstPaidAt: Date.parse("2026-02-14T08:00:00Z"),
        firstPaidEventType: "SubscriptionRenewed",
        currency: "USD",
        paidMicros: 9_990_000,
        refundedMicros: 0,
      },
    });
    for (const purchaseToken of ["lapsed-trial", "paid-then-churned"]) {
      await seedEvent(db, {
        type: "SubscriptionExpired",
        platform: "Android",
        source: "GooglePlayRealTimeDeveloperNotifications",
        purchaseToken,
        receivedAt: Date.parse(`${D1}T08:00:01Z`),
      });
    }
    // Apple flags the period that ended.
    await seedEvent(db, {
      type: "SubscriptionExpired",
      freeTrial: true,
      receivedAt: Date.parse(`${D1}T09:00:00Z`),
    });
    await seedEvent(db, {
      type: "SubscriptionExpired",
      freeTrial: false,
      receivedAt: Date.parse(`${D1}T09:30:00Z`),
    });

    await recompute(ctx);

    const expirations = (await rollupRows(db))
      .filter((row) => row.day === D1)
      .reduce((total, row) => total + (row.expirations as number), 0);
    expect(expirations).toBe(2);
  });
});

describe("rollup run — Google replacements", () => {
  // Play replaced "old-token" (sub.monthly) with "new-token" (sub.yearly).
  async function seedReplacement(db: MemDb): Promise<void> {
    await db.insert("subscriptionTokenAliases", {
      projectId: PROJECT_ID,
      purchaseToken: "old-token",
      successorPurchaseToken: "new-token",
      predecessorProductId: "sub.monthly",
      createdAt: NOW,
      updatedAt: NOW,
    });
    await seedSub(db, {
      state: "Active",
      purchaseToken: "new-token",
      platform: "Android",
      productId: "sub.yearly",
      expiresAt: Date.UTC(2027, 0, 1),
      analytics: {
        firstPaidAt: Date.parse("2026-02-01T08:00:00Z"),
        firstPaidEventType: "SubscriptionStarted",
        currency: "USD",
        paidMicros: 9_990_000,
        refundedMicros: 0,
      },
    });
  }
  const google = {
    platform: "Android" as const,
    source: "GooglePlayRealTimeDeveloperNotifications" as const,
  };

  it("counts a plan change as neither churn nor a new subscription", async () => {
    const db = new MemDb();
    await seedCurrentRunStatus(db);
    await seedReplacement(db);
    await seedEvent(db, {
      ...google,
      type: "SubscriptionStarted",
      purchaseToken: "new-token",
      linkedPurchaseToken: "old-token",
      productId: "sub.yearly",
      priceAmountMicros: 99_990_000,
      receivedAt: Date.parse(`${D1}T08:00:00Z`),
    });
    await seedEvent(db, {
      ...google,
      type: "SubscriptionExpired",
      purchaseToken: "old-token",
      productId: "sub.monthly",
      receivedAt: Date.parse(`${D1}T08:00:01Z`),
    });

    await recompute(makeCtx(db));

    const day = (await rollupRows(db)).filter((row) => row.day === D1);
    const total = (counter: string) =>
      day.reduce((sum, row) => sum + (row[counter] as number), 0);
    expect(total("expirations")).toBe(0);
    expect(total("newSubs")).toBe(0);
    expect(total("directPaidStarts")).toBe(0);
    expect(total("revenueMicros")).toBe(0);
    expect(total("activeSubs")).toBe(1);
  });

  it("counts a refund of the replaced token under the product it was for", async () => {
    const db = new MemDb();
    await seedCurrentRunStatus(db);
    await seedReplacement(db);
    // A voided purchase names no product and no environment.
    await seedEvent(db, {
      ...google,
      type: "PurchaseRefunded",
      cancellationReason: "Refunded",
      purchaseToken: "old-token",
      productId: undefined,
      currency: undefined,
      environmentDefaulted: true,
      receivedAt: Date.parse(`${D1}T09:00:00Z`),
    });

    await recompute(makeCtx(db));

    expect(
      (await rollupRows(db)).find((row) => row.refunds === 1),
    ).toMatchObject({
      day: D1,
      productId: "sub.monthly",
      currency: "USD",
      environment: "Production",
    });
  });
});

describe("rollup run — production and sandbox", () => {
  it("marks a Play notification without an environment collected only for its subscription's", async () => {
    const db = new MemDb();
    await seedCurrentRunStatus(db, { lastNotificationAt: {} });
    await seedSub(db, {
      state: "Active",
      purchaseToken: "tester",
      platform: "Android",
      environment: "Sandbox",
      expiresAt: Date.UTC(2026, 3, 1),
    });
    const defaulted = {
      platform: "Android" as const,
      source: "GooglePlayRealTimeDeveloperNotifications" as const,
      environment: "Production" as const,
      environmentDefaulted: true,
    };
    await seedEvent(db, {
      ...defaulted,
      type: "SubscriptionCanceled",
      purchaseToken: "tester",
      receivedAt: Date.parse(`${D1}T08:00:00Z`),
    });
    // Neither has a subscription to take an environment from.
    await seedEvent(db, {
      ...defaulted,
      type: "PurchaseRefunded",
      cancellationReason: "Refunded",
      purchaseToken: "unknown",
      productId: undefined,
      receivedAt: Date.parse(`${D1}T09:00:00Z`),
    });
    await seedEvent(db, {
      ...defaulted,
      type: "SubscriptionStarted",
      productKind: "one_time",
      purchaseToken: "consumable",
      receivedAt: Date.parse(`${D1}T10:00:00Z`),
    });

    await recompute(makeCtx(db));

    expect((await runStatus(db))?.lastNotificationAt).toEqual({
      Sandbox: Date.parse(`${D1}T08:00:00Z`),
    });
  });

  it("marks the trial split for a project no earlier run finished", async () => {
    // Stored two days before its first finished run: from before this release.
    const old = new MemDb();
    vi.setSystemTime(NOW - 2 * 24 * 60 * 60 * 1000);
    await seedEvent(old, { type: "SubscriptionStarted" });
    await recompute(makeCtx(old));
    expect((await runStatus(old))?.trialSplitFromDay).toBe("2026-03-16");

    // A new project's first run soon follows its first notification.
    const fresh = new MemDb();
    vi.setSystemTime(NOW - 60 * 60 * 1000);
    await seedEvent(fresh, { type: "SubscriptionStarted" });
    await recompute(makeCtx(fresh));
    expect((await runStatus(fresh))?.trialSplitFromDay).toBeUndefined();

    // A store test notification is not a purchase notification.
    const tested = new MemDb();
    vi.setSystemTime(NOW - 2 * 24 * 60 * 60 * 1000);
    await seedEvent(tested, { type: "TestNotification" });
    await recompute(makeCtx(tested));
    expect((await runStatus(tested))?.trialSplitFromDay).toBeUndefined();
  });

  it("never marks data collected from Amazon, which no counter reads", async () => {
    const db = new MemDb();
    await seedCurrentRunStatus(db, { lastNotificationAt: {} });
    await seedEvent(db, {
      platform: "Android",
      source: "AmazonRealTimeNotifications",
      store: "amazon",
      environment: "Production",
      type: "SubscriptionRenewed",
      receivedAt: Date.parse(`${D1}T08:00:00Z`),
    });

    await recompute(makeCtx(db));

    expect((await runStatus(db))?.lastNotificationAt).toEqual({});
  });

  it("counts a Play event without a reported environment in its subscription's", async () => {
    const db = new MemDb();
    await seedCurrentRunStatus(db);
    await seedSub(db, {
      state: "Expired",
      purchaseToken: "tester",
      platform: "Android",
      environment: "Sandbox",
      expiresAt: Date.parse(`${D1}T08:00:00Z`),
      analytics: {
        firstPaidAt: Date.parse("2026-02-01T08:00:00Z"),
        firstPaidEventType: "SubscriptionStarted",
        currency: "USD",
        paidMicros: 9_990_000,
        refundedMicros: 0,
      },
    });
    // An expiry recorded without a service account: no Play fetch.
    await seedEvent(db, {
      type: "SubscriptionExpired",
      platform: "Android",
      source: "GooglePlayRealTimeDeveloperNotifications",
      purchaseToken: "tester",
      environmentDefaulted: true,
      receivedAt: Date.parse(`${D1}T08:00:01Z`),
    });

    await recompute(makeCtx(db));

    const expiries = (await rollupRows(db)).filter(
      (row) => row.expirations === 1,
    );
    expect(expiries).toMatchObject([{ day: D1, environment: "Sandbox" }]);
  });

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

    await recompute(ctx);

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

describe("rollup run — access, trials and churn", () => {
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

    await recompute(ctx);

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
    expect(byDay.get(TODAY)).toMatchObject({
      activeSubs: 0,
      activeHistoryUnknown: 0,
    });
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

    await recompute(ctx);

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

    await recompute(ctx);

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

  it("tracks whether notifications arrived per environment", async () => {
    const db = new MemDb();
    await seedKey(db);
    // Verify-only production subscription, sandbox notifications only.
    await seedSub(db, { state: "Active", expiresAt: Date.UTC(2026, 3, 1) });
    await seedEvent(db, {
      type: "SubscriptionStarted",
      environment: "Sandbox",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });

    await recompute(makeCtx(db));

    const state = async (environment: "Production" | "Sandbox") =>
      (await getRevenueMetrics._handler({ db }, { ...range, environment }))
        .dataState;
    expect(await state("Production")).toBe("not_collected");
    expect(await state("Sandbox")).toBe("ready");
  });

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

    // Verify-only: active subscriptions give the window rows, but no store
    // notification ever arrived, so its event counters are not real zeros.
    await seedSub(db, {
      state: "Active",
      startedAt: Date.parse(`${D1}T00:00:00Z`),
      expiresAt: Date.UTC(2026, 3, 1),
    });
    await seedEvent(db, {
      type: "ReceiptRechecked",
      source: "StoreResync",
      receivedAt: Date.parse(`${TODAY}T09:00:00Z`),
    });
    await recompute(makeCtx(db));
    expect(await rollupRows(db)).not.toEqual([]);
    expect(await read()).toBe("not_collected");

    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${TODAY}T10:00:00Z`),
    });
    await recompute(makeCtx(db), NOW + 60_000);
    const result = await getRevenueMetrics._handler({ db }, range);
    expect(result).toMatchObject({
      dataState: "ready",
      environment: "Production",
      lastRunAt: NOW + 60_000,
      definitionsFromDay: "2026-02-14",
      pendingLateEvents: 0,
    });
    expect(result.trialSplitFromDay).toBeUndefined();
    expect(result.days.find((day) => day.day === TODAY)).toMatchObject({
      newSubs: 1,
      trialStarts: 0,
      activeSubs: 1,
    });

    const quietRange = { ...range, fromDay: "2026-03-01", toDay: "2026-03-02" };
    expect(
      (await getRevenueMetrics._handler({ db }, quietRange)).dataState,
    ).toBe("ready");
    expect(
      (await getRevenueMetrics._handler({ db }, quietRange)).days.every(
        (row) => row.activeHistoryComplete === false,
      ),
    ).toBe(true);
  });

  it("omits the trial split before the upgrade day of a project rolled up by an earlier release", async () => {
    const db = new MemDb();
    await seedKey(db);
    // A row the previous release finished: no definitions version.
    await db.insert("revenueMetricsRunStatus", {
      projectId: PROJECT_ID,
      lastRunAt: NOW - 60_000,
    });
    await seedEvent(db, {
      type: "SubscriptionStarted",
      priceAmountMicros: 9_990_000,
      receivedAt: Date.parse(`${D2}T10:00:00Z`),
    });
    await recompute(makeCtx(db));
    // The day after the upgrade is the first one ingested with the flags.
    expect(await runStatus(db)).toMatchObject({
      trialSplitFromDay: "2026-03-16",
    });

    await seedEvent(db, {
      type: "SubscriptionStarted",
      freeTrial: true,
      receivedAt: Date.parse("2026-03-16T10:00:00Z"),
    });
    await recompute(makeCtx(db), Date.parse("2026-03-16T12:00:00Z"));
    const result = await getRevenueMetrics._handler(
      { db },
      { ...range, toDay: "2026-03-16" },
    );
    expect(result.trialSplitFromDay).toBe("2026-03-16");
    const day = (key: string) => result.days.find((row) => row.day === key);
    expect(day(D2)).toMatchObject({ newSubs: 1, revenueMicros: 9_990_000 });
    expect(day(D2)).not.toHaveProperty("trialStarts");
    expect(day(D2)).not.toHaveProperty("directPaidStarts");
    expect(day(D2)).not.toHaveProperty("expirations");
    expect(day("2026-03-16")).toMatchObject({ newSubs: 1, trialStarts: 1 });
    // Later runs keep the boundary.
    expect(await runStatus(db)).toMatchObject({
      trialSplitFromDay: "2026-03-16",
    });
  });

  it("reads production rows past a window full of sandbox rows", async () => {
    const db = new MemDb();
    await seedKey(db);
    await seedCurrentRunStatus(db, { lastRunAt: NOW });
    const row = {
      projectId: PROJECT_ID,
      day: TODAY,
      currency: "USD",
      platform: "IOS",
      activeSubs: 1,
      newSubs: 0,
      renewals: 0,
      cancellations: 0,
      refunds: 0,
      revenueMicros: 0,
      updatedAt: NOW,
    };
    for (let i = 0; i < 20_000; i++) {
      await db.insert("revenueMetricsDaily", {
        ...row,
        productId: `sandbox.${i}`,
        environment: "Sandbox",
      });
    }
    await db.insert("revenueMetricsDaily", {
      ...row,
      productId: "sub.monthly",
      environment: "Production",
    });

    const result = await getRevenueMetrics._handler({ db }, range);
    expect(result.truncated).toBe(false);
    expect(result.days.map((day) => day.productId)).toEqual(["sub.monthly"]);
  });

  it("uses a full fallback instead of trusting a partial legacy cache", async () => {
    const db = new MemDb();
    await seedKey(db);
    vi.setSystemTime(NOW);
    await seedSub(db, { state: "Active", expiresAt: NOW + 86_400_000 });
    await db.insert("subscriptionStats", {
      projectId: PROJECT_ID,
      currency: "USD",
      activeSubs: 999,
      inGracePeriod: 0,
      inBillingRetry: 0,
      mrrMicros: 999_000_000,
      updatedAt: NOW,
    });
    const summary = await testableFunction(metricsSummary)._handler(
      { db },
      { apiKey: API_KEY },
    );
    expect(summary).toMatchObject({
      activeSubs: 1,
      stats: { state: "current", asOf: NOW },
      recentCountsTruncated: false,
    });
  });

  it("does not present a bounded fallback as complete", async () => {
    const db = new MemDb();
    await seedKey(db);
    vi.setSystemTime(NOW);
    await seedSub(db, {
      state: "Refunded",
      updatedAt: NOW - 1,
      purchaseToken: "older-refund",
    });
    for (let i = 0; i < 10_000; i++)
      await seedSub(db, {
        state: "Active",
        expiresAt: NOW + 86_400_000,
        purchaseToken: `cap-${i}`,
      });
    const summary = await testableFunction(metricsSummary)._handler(
      { db },
      { apiKey: API_KEY },
    );
    expect(summary.stats.state).toBe("incomplete");
    expect(summary.activeSubs).toBeGreaterThan(0);
    expect(summary.activeSubs).toBeLessThan(10_000);
    expect(summary.recentCountsTruncated).toBe(true);
    expect(summary.refunded30d).toBe(0);
  });

  it("re-evaluates an expired cache before its scheduler catches up", async () => {
    const db = new MemDb();
    await seedKey(db);
    vi.setSystemTime(NOW);
    await seedSub(db, { state: "Active", expiresAt: NOW + 5 });
    await testableFunction(recomputeSubscriptionStats)._handler(makeCtx(db), {
      projectId: PROJECT_ID,
    });
    vi.setSystemTime(NOW + 10);
    const summary = await testableFunction(metricsSummary)._handler(
      { db },
      { apiKey: API_KEY },
    );
    expect(summary).toMatchObject({
      activeSubs: 0,
      stats: { state: "current", asOf: NOW + 10 },
    });
  });

  it("echoes that live counts and MRR are production only", async () => {
    const db = new MemDb();
    await seedKey(db);
    const summary = await testableFunction(metricsSummary)._handler(
      { db },
      { apiKey: API_KEY },
    );
    expect(summary.environment).toBe("Production");
  });

  it("stops at Convex's array limit and says the result is truncated", async () => {
    const db = new MemDb();
    await seedKey(db);
    await seedCurrentRunStatus(db, { lastRunAt: NOW });
    // The cap cuts into an older day; that partial day is left out whole.
    for (let i = 0; i < 10; i++) {
      await db.insert("revenueMetricsDaily", {
        projectId: PROJECT_ID,
        day: D2,
        productId: `sku.old.${i}`,
        currency: "USD",
        platform: "IOS",
        environment: "Production",
        activeSubs: 1,
        newSubs: 0,
        renewals: 0,
        cancellations: 0,
        refunds: 0,
        revenueMicros: 0,
        updatedAt: NOW,
      });
    }
    for (let i = 0; i < 8_190; i++) {
      await db.insert("revenueMetricsDaily", {
        projectId: PROJECT_ID,
        day: TODAY,
        productId: `sku.${i}`,
        currency: "USD",
        platform: "IOS",
        environment: "Production",
        activeSubs: 1,
        newSubs: 0,
        renewals: 0,
        cancellations: 0,
        refunds: 0,
        revenueMicros: 0,
        updatedAt: NOW,
      });
    }

    const result = await getRevenueMetrics._handler({ db }, range);
    expect(result.days).toHaveLength(8_190);
    expect(result.days.every((day) => day.day === TODAY)).toBe(true);
    expect(result.truncated).toBe(true);
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

    // Legacy rows are scanned after production ones yet keep day order.
    await db.insert("revenueMetricsDaily", {
      ...row,
      environment: "Production",
    });
    await db.insert("revenueMetricsDaily", { ...row, day: D2 });
    const ordered = await getRevenueMetrics._handler({ db }, range);
    expect(ordered.days.map((day) => day.day)).toEqual([D2, TODAY, TODAY]);
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

    await testableFunction(recomputeRevenueCohortsPage)._handler(ctx, {
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
    expect(result.cohorts).toMatchObject([
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
