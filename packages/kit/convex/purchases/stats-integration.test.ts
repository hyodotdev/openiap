import { beforeEach, describe, expect, it } from "vitest";

import {
  applyPurchaseStatsDelta,
  deletePurchaseStatsForProject,
  deltaForMissingPurchaseStats,
  deltaForInsert,
  deltaForUpdate,
  mergePurchaseStatsDeltas,
  readPurchaseStats,
  recomputePurchaseStatsForProject,
} from "./stats";
import {
  backfillPurchaseStatsFromPurchases,
  backfillPurchaseStatsStoreBuckets,
} from "../migrations";
import { testableFunction } from "../test.setup";

const runStoreBucketBackfill = testableFunction(
  backfillPurchaseStatsStoreBuckets,
);
const runBaseStatsBackfill = testableFunction(
  backfillPurchaseStatsFromPurchases,
);

/**
 * Minimal in-memory stand-in for the slice of `ctx.db` the stats helpers
 * touch. Intentionally narrow — just enough to exercise `withIndex(name, cb)
 * → .first() / async iterate`, plus insert/patch/get/delete.
 *
 * Not a substitute for `convex-test`; scoped to the write/read paths that
 * this refactor introduced so a regression (counter drift, missing cascade
 * delete, etc.) is caught by unit tests before it ships.
 */
type Row = Record<string, unknown> & { _id: string; _creationTime: number };

class MemQuery {
  constructor(private rows: Row[]) {}

  withIndex(_name: string, cb?: (q: IndexBuilder) => IndexBuilder): MemQuery {
    if (!cb) return this;
    const builder = new IndexBuilder();
    cb(builder);
    const filtered = this.rows.filter((row) =>
      builder.predicates.every((pred) => pred(row)),
    );
    return new MemQuery(filtered);
  }

  filter(_cb: unknown): MemQuery {
    // Our stats helpers don't chain .filter() — noop for safety.
    void _cb;
    return this;
  }

  async first(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }

  async collect(): Promise<Row[]> {
    return [...this.rows];
  }

  async paginate(args: { cursor: string | null; numItems: number }): Promise<{
    continueCursor: string;
    isDone: boolean;
    page: Row[];
  }> {
    const start = args.cursor === null ? 0 : Number(args.cursor);
    const end = Math.min(start + args.numItems, this.rows.length);
    return {
      continueCursor: String(end),
      isDone: end >= this.rows.length,
      page: this.rows.slice(start, end),
    };
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Row> {
    for (const row of this.rows) {
      yield row;
    }
  }
}

class IndexBuilder {
  predicates: Array<(row: Row) => boolean> = [];
  eq(field: string, value: unknown): IndexBuilder {
    this.predicates.push((row) => row[field] === value);
    return this;
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
      _creationTime: Date.now(),
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

  async patch(
    tableOrId: string,
    idOrPatch: string | Record<string, unknown>,
    migrationPatch?: Record<string, unknown>,
  ): Promise<void> {
    // Convex supports both db.patch(id, value) and the table-explicit form
    // used by @convex-dev/migrations: db.patch(table, id, value).
    const id = migrationPatch
      ? typeof idOrPatch === "string"
        ? idOrPatch
        : (() => {
            throw new Error("patch: migration id must be a string");
          })()
      : tableOrId;
    const patch = migrationPatch ?? (idOrPatch as Record<string, unknown>);
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

// Cast to satisfy the helpers' `MutationCtx` parameter types without
// pulling convex-test in. The helpers only touch `ctx.db`.
function makeCtx(db: MemDb) {
  return { db } as unknown as Parameters<typeof applyPurchaseStatsDelta>[0];
}

const PROJECT_ID = "projects_1";

describe("stats helpers — round-trip integration", () => {
  let db: MemDb;
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(async () => {
    db = new MemDb();
    await db.insert("projects", { organizationId: "organizations_2" });
    await db.insert("organizations", {});
    ctx = makeCtx(db);
  });

  it("readPurchaseStats returns zeros when no row exists yet", async () => {
    const stats = await readPurchaseStats(ctx, PROJECT_ID as never);
    expect(stats).toEqual({
      total: 0,
      apple: 0,
      google: 0,
      horizon: 0,
      amazon: 0,
      googleOrders: 0,
      valid: 0,
      invalid: 0,
    });
  });

  it("treats missing widened store counters on a legacy row as zero", async () => {
    await db.insert("purchaseStats", {
      projectId: PROJECT_ID,
      total: 7,
      apple: 3,
      google: 4,
      googleOrders: 2,
      valid: 5,
      invalid: 2,
      updatedAt: 1,
    });

    await expect(readPurchaseStats(ctx, PROJECT_ID as never)).resolves.toEqual({
      total: 7,
      apple: 3,
      google: 4,
      horizon: 0,
      amazon: 0,
      googleOrders: 2,
      valid: 5,
      invalid: 2,
    });
  });

  it("does not recreate stats after project deletion starts", async () => {
    await db.patch(PROJECT_ID, { pendingDeletion: true });

    await expect(
      applyPurchaseStatsDelta(
        ctx,
        PROJECT_ID as never,
        deltaForInsert("apple", true),
      ),
    ).resolves.toEqual({ wasFirstValidTransition: false });
    expect(await readPurchaseStats(ctx, PROJECT_ID as never)).toEqual({
      total: 0,
      apple: 0,
      google: 0,
      horizon: 0,
      amazon: 0,
      googleOrders: 0,
      valid: 0,
      invalid: 0,
    });
  });

  it("applyPurchaseStatsDelta creates a row on first insert-delta", async () => {
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      deltaForInsert("apple", true),
    );

    const stats = await readPurchaseStats(ctx, PROJECT_ID as never);
    expect(stats).toEqual({
      total: 1,
      apple: 1,
      google: 0,
      horizon: 0,
      amazon: 0,
      googleOrders: 0,
      valid: 1,
      invalid: 0,
    });
  });

  it("accumulates correctly across multiple insert-deltas for mixed stores/validity", async () => {
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      deltaForInsert("apple", true),
    );
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      // pending-ack google insert — row count but no order yet
      deltaForInsert("google", true),
    );
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      // invalid google with orderId — order but marked invalid
      deltaForInsert("google", false, true),
    );
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      deltaForInsert("apple", false),
    );
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      deltaForInsert("horizon", true),
    );
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      deltaForInsert("amazon", false),
    );

    const stats = await readPurchaseStats(ctx, PROJECT_ID as never);
    expect(stats).toEqual({
      total: 6,
      apple: 2,
      google: 2,
      horizon: 1,
      amazon: 1,
      // only the second google insert had an orderId
      googleOrders: 1,
      valid: 3,
      invalid: 3,
    });
  });

  it("markReceiptInvalid-style flip preserves total and moves valid -> invalid", async () => {
    // Seed: one apple valid receipt.
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      deltaForInsert("apple", true),
    );

    // Simulate `markReceiptInvalid` — same store, valid flips off.
    // Apple receipts don't carry a Google orderId, so the last two
    // args are false/false.
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      deltaForUpdate("apple", true, "apple", false, false, false),
    );

    const stats = await readPurchaseStats(ctx, PROJECT_ID as never);
    expect(stats).toEqual({
      total: 1,
      apple: 1,
      google: 0,
      horizon: 0,
      amazon: 0,
      googleOrders: 0,
      valid: 0,
      invalid: 1,
    });
  });

  it("markReceiptInvalid claims an uncounted legacy row before invalidating it", async () => {
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      mergePurchaseStatsDeltas(
        deltaForMissingPurchaseStats("amazon", true, false, false, false),
        deltaForUpdate("amazon", true, "amazon", false),
      ),
    );

    await expect(readPurchaseStats(ctx, PROJECT_ID as never)).resolves.toEqual({
      total: 1,
      apple: 0,
      google: 0,
      horizon: 0,
      amazon: 1,
      googleOrders: 0,
      valid: 0,
      invalid: 1,
    });

    // Both sentinels are claimed by markReceiptInvalid, so either later
    // migration order contributes nothing for the now-invalid row.
    expect(
      deltaForMissingPurchaseStats("amazon", false, false, true, true),
    ).toEqual({});
  });

  describe("wasFirstValidTransition", () => {
    it("is true on the insert that bumps valid from 0 to 1", async () => {
      const result = await applyPurchaseStatsDelta(
        ctx,
        PROJECT_ID as never,
        deltaForInsert("apple", true),
      );
      expect(result.wasFirstValidTransition).toBe(true);
    });

    it("is false on a second valid insert (valid was already 1)", async () => {
      await applyPurchaseStatsDelta(
        ctx,
        PROJECT_ID as never,
        deltaForInsert("apple", true),
      );
      const second = await applyPurchaseStatsDelta(
        ctx,
        PROJECT_ID as never,
        deltaForInsert("apple", true),
      );
      expect(second.wasFirstValidTransition).toBe(false);
    });

    it("is false on an invalid insert (valid stayed at 0)", async () => {
      const result = await applyPurchaseStatsDelta(
        ctx,
        PROJECT_ID as never,
        deltaForInsert("apple", false),
      );
      expect(result.wasFirstValidTransition).toBe(false);
    });

    it("is true when a retry flips an existing row from invalid to valid (0 → 1)", async () => {
      // Seed: invalid row → valid:0, invalid:1
      await applyPurchaseStatsDelta(
        ctx,
        PROJECT_ID as never,
        deltaForInsert("google", false),
      );
      // Retry succeeds — deltaForUpdate moves valid 0 → 1
      const flip = await applyPurchaseStatsDelta(
        ctx,
        PROJECT_ID as never,
        deltaForUpdate("google", false, "google", true),
      );
      expect(flip.wasFirstValidTransition).toBe(true);
    });

    it("is false when a valid row is flipped to invalid (1 → 0, not an activation)", async () => {
      await applyPurchaseStatsDelta(
        ctx,
        PROJECT_ID as never,
        deltaForInsert("apple", true),
      );
      const flip = await applyPurchaseStatsDelta(
        ctx,
        PROJECT_ID as never,
        deltaForUpdate("apple", true, "apple", false),
      );
      expect(flip.wasFirstValidTransition).toBe(false);
    });

    it("is false on a no-op delta (early-return branch)", async () => {
      const result = await applyPurchaseStatsDelta(
        ctx,
        PROJECT_ID as never,
        {},
      );
      expect(result.wasFirstValidTransition).toBe(false);
    });
  });

  it("remoteId upsert with unchanged (store, isValid) emits no counter movement", async () => {
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      deltaForInsert("google", true),
    );

    const before = await readPurchaseStats(ctx, PROJECT_ID as never);

    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      deltaForUpdate("google", true, "google", true),
    );

    const after = await readPurchaseStats(ctx, PROJECT_ID as never);
    expect(after).toEqual(before);
  });

  it("clamps counters at zero rather than going negative", async () => {
    // No insert — now simulate a rogue 'valid -> invalid' flip on nothing.
    // Counters should not dip below zero.
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      deltaForUpdate("apple", true, "apple", false),
    );

    const stats = await readPurchaseStats(ctx, PROJECT_ID as never);
    expect(stats.valid).toBe(0);
    expect(stats.invalid).toBe(1);
    expect(stats.total).toBeGreaterThanOrEqual(0);
  });

  it("deletePurchaseStatsForProject removes the stats row", async () => {
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      deltaForInsert("apple", true),
    );

    await deletePurchaseStatsForProject(ctx, PROJECT_ID as never);

    const stats = await readPurchaseStats(ctx, PROJECT_ID as never);
    expect(stats).toEqual({
      total: 0,
      apple: 0,
      google: 0,
      horizon: 0,
      amazon: 0,
      googleOrders: 0,
      valid: 0,
      invalid: 0,
    });
  });

  it("is safe to call delete when no stats row exists", async () => {
    await expect(
      deletePurchaseStatsForProject(ctx as never, PROJECT_ID as never),
    ).resolves.toBeUndefined();
  });

  it("recomputePurchaseStatsForProject rebuilds from the purchases table (backfill path)", async () => {
    // Seed purchases directly — simulates existing data prior to the
    // counter-table rollout.
    await db.insert("purchases", {
      projectId: PROJECT_ID,
      store: "apple",
      isValid: true,
      state: "ENTITLED",
    });
    await db.insert("purchases", {
      projectId: PROJECT_ID,
      store: "apple",
      isValid: false,
      state: "INAUTHENTIC",
    });
    // Google row with an orderId — counts as a distinct Play Console
    // order.
    await db.insert("purchases", {
      projectId: PROJECT_ID,
      store: "google",
      isValid: true,
      state: "ENTITLED",
      orderId: "GPA.order-1",
    });
    // Google pending-ack row — no orderId yet, inflates `google` but
    // not `googleOrders`.
    await db.insert("purchases", {
      projectId: PROJECT_ID,
      store: "google",
      isValid: true,
      state: "PENDING_ACKNOWLEDGMENT",
    });
    // Duplicate of orderId-1 (pre-collapse data shape) — must not
    // double-count toward googleOrders.
    await db.insert("purchases", {
      projectId: PROJECT_ID,
      store: "google",
      isValid: true,
      state: "ENTITLED",
      orderId: "GPA.order-1",
    });
    await db.insert("purchases", {
      projectId: PROJECT_ID,
      store: "horizon",
      isValid: true,
      state: "ENTITLED",
    });
    await db.insert("purchases", {
      projectId: PROJECT_ID,
      store: "amazon",
      isValid: false,
      state: "CANCELED",
    });
    // Different project — must not bleed into this project's stats.
    await db.insert("purchases", {
      projectId: "projects_other",
      store: "google",
      isValid: true,
      state: "ENTITLED",
      orderId: "GPA.order-other",
    });

    const totals = await recomputePurchaseStatsForProject(
      ctx,
      PROJECT_ID as never,
    );
    expect(totals).toEqual({
      total: 7,
      apple: 2,
      google: 3,
      horizon: 1,
      amazon: 1,
      // GPA.order-1 counted once despite two rows; pending-ack row
      // doesn't contribute.
      googleOrders: 1,
      valid: 5,
      invalid: 2,
    });

    // Persisted to the stats table so subsequent reads are O(1).
    const read = await readPurchaseStats(ctx, PROJECT_ID as never);
    expect(read).toEqual(totals);
  });

  it("recompute is idempotent — running twice produces the same counters", async () => {
    await db.insert("purchases", {
      projectId: PROJECT_ID,
      store: "apple",
      isValid: true,
      state: "ENTITLED",
    });
    await db.insert("purchases", {
      projectId: PROJECT_ID,
      store: "google",
      isValid: false,
      state: "INAUTHENTIC",
      orderId: "GPA.order-X",
    });

    const first = await recomputePurchaseStatsForProject(
      ctx,
      PROJECT_ID as never,
    );
    const second = await recomputePurchaseStatsForProject(
      ctx,
      PROJECT_ID as never,
    );
    expect(second).toEqual(first);
  });

  it("repairs legacy store buckets one row at a time without double counting on resume", async () => {
    // This row represents a deployment that completed the original stats
    // migration before Horizon/Amazon buckets existed. The purchase sentinels
    // are already true, so replaying the old row-by-row migration cannot repair
    // it; the new uniquely named store-bucket migration must do so.
    await db.insert("purchaseStats", {
      projectId: PROJECT_ID,
      total: 4,
      apple: 1,
      google: 1,
      googleOrders: 1,
      valid: 3,
      invalid: 1,
      updatedAt: 1,
    });
    const legacyPurchaseIds: string[] = [];
    for (const [store, isValid] of [
      ["apple", true],
      ["google", true],
      ["horizon", true],
      ["amazon", false],
    ] as const) {
      legacyPurchaseIds.push(
        await db.insert("purchases", {
          projectId: PROJECT_ID,
          store,
          isValid,
          state: isValid ? "ENTITLED" : "CANCELED",
          statsCounted: true,
          ...(store === "google" ? { orderId: "GPA.legacy-order" } : {}),
        }),
      );
    }

    const runBatch = async (cursor: string | null) =>
      await runStoreBucketBackfill._handler(ctx, {
        cursor,
        dryRun: false,
        oneBatchOnly: true,
      });

    // Stop after two rows to model an interrupted deployment. Each batch is
    // hard-bounded to one purchase and atomically marks the row it handled.
    await expect(runBatch(null)).resolves.toEqual({
      continueCursor: "1",
      isDone: false,
      processed: 1,
    });
    await expect(runBatch("1")).resolves.toEqual({
      continueCursor: "2",
      isDone: false,
      processed: 1,
    });
    expect((await db.get(legacyPurchaseIds[0]))?.storeStatsCounted).toBe(true);
    expect((await db.get(legacyPurchaseIds[1]))?.storeStatsCounted).toBe(true);
    await expect(
      readPurchaseStats(ctx, PROJECT_ID as never),
    ).resolves.toMatchObject({ horizon: 0, amazon: 0 });

    // A purchase arriving between migration batches has already updated the
    // widened stats row and is born marked. The resumed migration must skip it.
    await db.insert("purchases", {
      projectId: PROJECT_ID,
      store: "amazon",
      isValid: true,
      state: "ENTITLED",
      statsCounted: true,
      storeStatsCounted: true,
    });
    await applyPurchaseStatsDelta(
      ctx,
      PROJECT_ID as never,
      deltaForInsert("amazon", true),
    );

    // Resume at the saved cursor: legacy Horizon and Amazon each contribute
    // once, then the already-counted new Amazon row is skipped.
    await expect(runBatch("2")).resolves.toMatchObject({
      continueCursor: "3",
      processed: 1,
    });
    await expect(runBatch("3")).resolves.toMatchObject({
      continueCursor: "4",
      processed: 1,
    });
    await expect(runBatch("4")).resolves.toEqual({
      continueCursor: "5",
      isDone: true,
      processed: 1,
    });

    await expect(readPurchaseStats(ctx, PROJECT_ID as never)).resolves.toEqual({
      total: 5,
      apple: 1,
      google: 1,
      horizon: 1,
      amazon: 2,
      googleOrders: 1,
      valid: 4,
      invalid: 1,
    });

    // A reset starts from the first row again. Every sentinel makes it a no-op,
    // proving partial retries and deliberate reruns cannot double count.
    let resetCursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const result = await runBatch(resetCursor);
      resetCursor = result.continueCursor;
      isDone = result.isDone;
    }
    await expect(
      readPurchaseStats(ctx, PROJECT_ID as never),
    ).resolves.toMatchObject({ horizon: 1, amazon: 2 });
  });

  it.each(["base-first", "store-first"] as const)(
    "coordinates the base and store migrations in %s order",
    async (order) => {
      for (const [store, requestData] of [
        ["horizon", { store: "horizon", userId: "user-1", sku: "coins" }],
        [
          "amazon",
          { store: "amazon", userId: "user-2", receiptId: "receipt-2" },
        ],
      ] as const) {
        await db.insert("purchases", {
          projectId: PROJECT_ID,
          store,
          applicationId: "dev.hyo.martie",
          requestData,
          isValid: true,
          state: "ENTITLED",
        });
      }

      const drain = async (handler: typeof runBaseStatsBackfill) => {
        let cursor: string | null = null;
        let isDone = false;
        while (!isDone) {
          const result = await handler._handler(ctx, {
            cursor,
            dryRun: false,
            oneBatchOnly: true,
            batchSize: 1,
          });
          if (!result) throw new Error("migration batch returned no cursor");
          cursor = result.continueCursor;
          isDone = result.isDone;
        }
      };

      if (order === "base-first") {
        await drain(runBaseStatsBackfill);
        await drain(runStoreBucketBackfill);
      } else {
        await drain(runStoreBucketBackfill);
        await drain(runBaseStatsBackfill);
      }

      await expect(
        readPurchaseStats(ctx, PROJECT_ID as never),
      ).resolves.toEqual({
        total: 2,
        apple: 0,
        google: 0,
        horizon: 1,
        amazon: 1,
        googleOrders: 0,
        valid: 2,
        invalid: 0,
      });
      for (const purchase of await db.query("purchases").collect()) {
        expect(purchase).toMatchObject({
          statsCounted: true,
          storeStatsCounted: true,
        });
      }
    },
  );
});
