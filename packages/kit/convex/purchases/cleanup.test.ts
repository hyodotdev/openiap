import { beforeEach, describe, expect, it } from "vitest";

import { collapseDuplicatePurchasesByOrderIdHandler } from "./cleanup";

/**
 * Regression guard for `collapseDuplicatePurchasesByOrderId`'s
 * defensive store filter. The mutation walks the
 * `by_project_app_orderId` index to find sibling groups, but the
 * index doesn't carry the `store` field, so a non-Google row that
 * (for whatever reason — manual write, corruption, a future schema
 * change) happens to carry an `orderId` could land in the same
 * group key as Google siblings. The cleanup code narrows the
 * candidate set to `store === "google"` with a non-empty `orderId`
 * before picking a survivor and emitting deletions, which these
 * tests pin.
 *
 * The minimal in-memory `ctx.db` stand-in mirrors the slice used by
 * other unit tests in this folder — `withIndex` applies `.eq()`
 * predicates, `paginate` returns the whole table in a single page,
 * and everything else is a simple Map lookup.
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

  async collect(): Promise<Row[]> {
    return [...this.rows];
  }

  async first(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }

  async paginate(opts: {
    cursor: string | null;
    numItems: number;
  }): Promise<{ page: Row[]; continueCursor: string | null; isDone: boolean }> {
    // Single-page fixture — cursor handling isn't exercised by the
    // tests and the collapse logic itself doesn't care about it.
    void opts;
    return {
      page: [...this.rows],
      continueCursor: null,
      isDone: true,
    };
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
  private tables = new Map<string, Map<string, Row>>();
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
      _creationTime:
        typeof doc._creationTime === "number" ? doc._creationTime : Date.now(),
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

  seedProject(id: string, organizationId: string): string {
    this.table("projects").set(id, {
      _id: id,
      _creationTime: Date.now(),
      organizationId,
      name: "Test Project",
      slug: "test-project",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as Row);
    return id;
  }

  seedPurchase(attrs: {
    id: string;
    projectId: string;
    store: "apple" | "google" | "horizon";
    applicationId: string;
    orderId?: string;
    creationTime: number;
    isValid?: boolean;
  }): void {
    this.table("purchases").set(attrs.id, {
      _id: attrs.id,
      _creationTime: attrs.creationTime,
      projectId: attrs.projectId,
      store: attrs.store,
      applicationId: attrs.applicationId,
      orderId: attrs.orderId,
      isValid: attrs.isValid ?? true,
      state: "ENTITLED",
    } as Row);
  }

  allPurchases(): Row[] {
    return [...(this.tables.get("purchases")?.values() ?? [])];
  }

  countPurchases(): number {
    return this.tables.get("purchases")?.size ?? 0;
  }
}

function makeCtx(
  db: MemDb,
): Parameters<typeof collapseDuplicatePurchasesByOrderIdHandler>[0] {
  return { db } as unknown as Parameters<
    typeof collapseDuplicatePurchasesByOrderIdHandler
  >[0];
}

const handler = collapseDuplicatePurchasesByOrderIdHandler;

const PROJECT = "projects_seed_1";
const APP = "com.test.app";

describe("collapseDuplicatePurchasesByOrderId — defensive store filter", () => {
  let db: MemDb;

  beforeEach(() => {
    db = new MemDb();
    db.seedProject(PROJECT, "organizations_seed_1");
  });

  it("collapses a pure Google duplicate group to the newest sibling", async () => {
    db.seedPurchase({
      id: "p_google_old",
      projectId: PROJECT,
      store: "google",
      applicationId: APP,
      orderId: "GPA.order-A",
      creationTime: 100,
    });
    db.seedPurchase({
      id: "p_google_new",
      projectId: PROJECT,
      store: "google",
      applicationId: APP,
      orderId: "GPA.order-A",
      creationTime: 200,
    });

    const result = await handler(makeCtx(db), {});

    expect(result.duplicateGroupsProcessed).toBe(1);
    expect(result.rowsDeleted).toBe(1);
    expect(db.countPurchases()).toBe(1);
    expect(db.allPurchases()[0]?._id).toBe("p_google_new");
  });

  it("leaves non-Google siblings alone even when they share the group key", async () => {
    // Worst-case manual-write / corruption scenario: an Apple row
    // somehow ended up with the same (projectId, applicationId,
    // orderId) as a pair of Google rows. The mutation must NEVER
    // delete the Apple row, and must NEVER pick it as the survivor
    // of the Google group.
    db.seedPurchase({
      id: "p_apple",
      projectId: PROJECT,
      store: "apple",
      applicationId: APP,
      orderId: "GPA.order-X",
      creationTime: 500, // newest by creationTime
    });
    db.seedPurchase({
      id: "p_google_old",
      projectId: PROJECT,
      store: "google",
      applicationId: APP,
      orderId: "GPA.order-X",
      creationTime: 100,
    });
    db.seedPurchase({
      id: "p_google_new",
      projectId: PROJECT,
      store: "google",
      applicationId: APP,
      orderId: "GPA.order-X",
      creationTime: 200,
    });

    const result = await handler(makeCtx(db), {});

    expect(result.duplicateGroupsProcessed).toBe(1);
    expect(result.rowsDeleted).toBe(1);
    expect(db.countPurchases()).toBe(2);

    const remaining = db
      .allPurchases()
      .map((r) => r._id)
      .sort();
    // Apple row survives untouched; Google group collapsed to newest.
    expect(remaining).toEqual(["p_apple", "p_google_new"]);
  });

  it("does nothing when the group has one Google row and several non-Google rows", async () => {
    // No Google duplicates → nothing to collapse, even though the
    // index-level group has multiple members.
    db.seedPurchase({
      id: "p_google_only",
      projectId: PROJECT,
      store: "google",
      applicationId: APP,
      orderId: "GPA.order-Y",
      creationTime: 100,
    });
    db.seedPurchase({
      id: "p_horizon",
      projectId: PROJECT,
      store: "horizon",
      applicationId: APP,
      orderId: "GPA.order-Y",
      creationTime: 200,
    });

    const result = await handler(makeCtx(db), {});

    expect(result.duplicateGroupsProcessed).toBe(0);
    expect(result.rowsDeleted).toBe(0);
    expect(db.countPurchases()).toBe(2);
  });

  it("dryRun reports what would be deleted without mutating the table", async () => {
    db.seedPurchase({
      id: "p_google_old",
      projectId: PROJECT,
      store: "google",
      applicationId: APP,
      orderId: "GPA.order-Z",
      creationTime: 100,
    });
    db.seedPurchase({
      id: "p_google_new",
      projectId: PROJECT,
      store: "google",
      applicationId: APP,
      orderId: "GPA.order-Z",
      creationTime: 200,
    });

    const result = await handler(makeCtx(db), { dryRun: true });

    expect(result.duplicateGroupsProcessed).toBe(1);
    expect(result.rowsDeleted).toBe(1);
    expect(result.dryRun).toBe(true);
    expect(db.countPurchases()).toBe(2);
  });

  it("ignores Google rows with an empty-string orderId", async () => {
    // An empty `orderId` never represents a real Google order; the
    // cleanup filter must drop these so the extractor / backfill /
    // mutation helpers stay in agreement.
    db.seedPurchase({
      id: "p_google_empty",
      projectId: PROJECT,
      store: "google",
      applicationId: APP,
      orderId: "",
      creationTime: 100,
    });
    db.seedPurchase({
      id: "p_google_real",
      projectId: PROJECT,
      store: "google",
      applicationId: APP,
      orderId: "",
      creationTime: 200,
    });

    const result = await handler(makeCtx(db), {});

    expect(result.duplicateGroupsProcessed).toBe(0);
    expect(result.rowsDeleted).toBe(0);
    expect(db.countPurchases()).toBe(2);
  });
});
