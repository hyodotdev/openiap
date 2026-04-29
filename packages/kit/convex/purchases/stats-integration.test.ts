import { beforeEach, describe, expect, it } from "vitest";

import {
  applyPurchaseStatsDelta,
  deletePurchaseStatsForProject,
  deltaForInsert,
  deltaForUpdate,
  readPurchaseStats,
  recomputePurchaseStatsForProject,
} from "./stats";

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

// Cast to satisfy the helpers' `MutationCtx` parameter types without
// pulling convex-test in. The helpers only touch `ctx.db`.
function makeCtx(db: MemDb) {
  return { db } as unknown as Parameters<typeof applyPurchaseStatsDelta>[0];
}

const PROJECT_ID = "projects_1";

describe("stats helpers — round-trip integration", () => {
  let db: MemDb;
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(() => {
    db = new MemDb();
    ctx = makeCtx(db);
  });

  it("readPurchaseStats returns zeros when no row exists yet", async () => {
    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(stats).toEqual({
      total: 0,
      apple: 0,
      google: 0,
      googleOrders: 0,
      valid: 0,
      invalid: 0,
    });
  });

  it("applyPurchaseStatsDelta creates a row on first insert-delta", async () => {
    await applyPurchaseStatsDelta(
      ctx as never,
      PROJECT_ID as never,
      deltaForInsert("apple", true),
    );

    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(stats).toEqual({
      total: 1,
      apple: 1,
      google: 0,
      googleOrders: 0,
      valid: 1,
      invalid: 0,
    });
  });

  it("accumulates correctly across multiple insert-deltas for mixed stores/validity", async () => {
    await applyPurchaseStatsDelta(
      ctx as never,
      PROJECT_ID as never,
      deltaForInsert("apple", true),
    );
    await applyPurchaseStatsDelta(
      ctx as never,
      PROJECT_ID as never,
      // pending-ack google insert — row count but no order yet
      deltaForInsert("google", true),
    );
    await applyPurchaseStatsDelta(
      ctx as never,
      PROJECT_ID as never,
      // invalid google with orderId — order but marked invalid
      deltaForInsert("google", false, true),
    );
    await applyPurchaseStatsDelta(
      ctx as never,
      PROJECT_ID as never,
      deltaForInsert("apple", false),
    );

    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(stats).toEqual({
      total: 4,
      apple: 2,
      google: 2,
      // only the second google insert had an orderId
      googleOrders: 1,
      valid: 2,
      invalid: 2,
    });
  });

  it("markReceiptInvalid-style flip preserves total and moves valid -> invalid", async () => {
    // Seed: one apple valid receipt.
    await applyPurchaseStatsDelta(
      ctx as never,
      PROJECT_ID as never,
      deltaForInsert("apple", true),
    );

    // Simulate `markReceiptInvalid` — same store, valid flips off.
    // Apple receipts don't carry a Google orderId, so the last two
    // args are false/false.
    await applyPurchaseStatsDelta(
      ctx as never,
      PROJECT_ID as never,
      deltaForUpdate("apple", true, "apple", false, false, false),
    );

    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(stats).toEqual({
      total: 1,
      apple: 1,
      google: 0,
      googleOrders: 0,
      valid: 0,
      invalid: 1,
    });
  });

  describe("wasFirstValidTransition", () => {
    it("is true on the insert that bumps valid from 0 to 1", async () => {
      const result = await applyPurchaseStatsDelta(
        ctx as never,
        PROJECT_ID as never,
        deltaForInsert("apple", true),
      );
      expect(result.wasFirstValidTransition).toBe(true);
    });

    it("is false on a second valid insert (valid was already 1)", async () => {
      await applyPurchaseStatsDelta(
        ctx as never,
        PROJECT_ID as never,
        deltaForInsert("apple", true),
      );
      const second = await applyPurchaseStatsDelta(
        ctx as never,
        PROJECT_ID as never,
        deltaForInsert("apple", true),
      );
      expect(second.wasFirstValidTransition).toBe(false);
    });

    it("is false on an invalid insert (valid stayed at 0)", async () => {
      const result = await applyPurchaseStatsDelta(
        ctx as never,
        PROJECT_ID as never,
        deltaForInsert("apple", false),
      );
      expect(result.wasFirstValidTransition).toBe(false);
    });

    it("is true when a retry flips an existing row from invalid to valid (0 → 1)", async () => {
      // Seed: invalid row → valid:0, invalid:1
      await applyPurchaseStatsDelta(
        ctx as never,
        PROJECT_ID as never,
        deltaForInsert("google", false),
      );
      // Retry succeeds — deltaForUpdate moves valid 0 → 1
      const flip = await applyPurchaseStatsDelta(
        ctx as never,
        PROJECT_ID as never,
        deltaForUpdate("google", false, "google", true),
      );
      expect(flip.wasFirstValidTransition).toBe(true);
    });

    it("is false when a valid row is flipped to invalid (1 → 0, not an activation)", async () => {
      await applyPurchaseStatsDelta(
        ctx as never,
        PROJECT_ID as never,
        deltaForInsert("apple", true),
      );
      const flip = await applyPurchaseStatsDelta(
        ctx as never,
        PROJECT_ID as never,
        deltaForUpdate("apple", true, "apple", false),
      );
      expect(flip.wasFirstValidTransition).toBe(false);
    });

    it("is false on a no-op delta (early-return branch)", async () => {
      const result = await applyPurchaseStatsDelta(
        ctx as never,
        PROJECT_ID as never,
        {},
      );
      expect(result.wasFirstValidTransition).toBe(false);
    });
  });

  it("remoteId upsert with unchanged (store, isValid) emits no counter movement", async () => {
    await applyPurchaseStatsDelta(
      ctx as never,
      PROJECT_ID as never,
      deltaForInsert("google", true),
    );

    const before = await readPurchaseStats(ctx as never, PROJECT_ID as never);

    await applyPurchaseStatsDelta(
      ctx as never,
      PROJECT_ID as never,
      deltaForUpdate("google", true, "google", true),
    );

    const after = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(after).toEqual(before);
  });

  it("clamps counters at zero rather than going negative", async () => {
    // No insert — now simulate a rogue 'valid -> invalid' flip on nothing.
    // Counters should not dip below zero.
    await applyPurchaseStatsDelta(
      ctx as never,
      PROJECT_ID as never,
      deltaForUpdate("apple", true, "apple", false),
    );

    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(stats.valid).toBe(0);
    expect(stats.invalid).toBe(1);
    expect(stats.total).toBeGreaterThanOrEqual(0);
  });

  it("deletePurchaseStatsForProject removes the stats row", async () => {
    await applyPurchaseStatsDelta(
      ctx as never,
      PROJECT_ID as never,
      deltaForInsert("apple", true),
    );

    await deletePurchaseStatsForProject(ctx as never, PROJECT_ID as never);

    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(stats).toEqual({
      total: 0,
      apple: 0,
      google: 0,
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
    // Different project — must not bleed into this project's stats.
    await db.insert("purchases", {
      projectId: "projects_other",
      store: "google",
      isValid: true,
      state: "ENTITLED",
      orderId: "GPA.order-other",
    });

    const totals = await recomputePurchaseStatsForProject(
      ctx as never,
      PROJECT_ID as never,
    );
    expect(totals).toEqual({
      total: 5,
      apple: 2,
      google: 3,
      // GPA.order-1 counted once despite two rows; pending-ack row
      // doesn't contribute.
      googleOrders: 1,
      valid: 4,
      invalid: 1,
    });

    // Persisted to the stats table so subsequent reads are O(1).
    const read = await readPurchaseStats(ctx as never, PROJECT_ID as never);
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
      ctx as never,
      PROJECT_ID as never,
    );
    const second = await recomputePurchaseStatsForProject(
      ctx as never,
      PROJECT_ID as never,
    );
    expect(second).toEqual(first);
  });
});
