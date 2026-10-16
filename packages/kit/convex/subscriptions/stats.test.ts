import { SUBSCRIPTION_SCAN_PAGE_SIZE } from "./accessHistory";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareValues, type Value } from "convex/values";

import type { Doc, Id, TableNames } from "../_generated/dataModel";
import schema from "../schema";
import { HarmonizedPurchaseState } from "../purchases/purchaseState";
import { MemoryDb } from "../test.memoryDb";
import { testableFunction } from "../test.setup";
import {
  findSubscriptionByToken,
  persistSubscriptionSnapshot,
  recordVerifiedSubscription,
} from "./internal";
import {
  recomputeAllSubscriptionStats,
  recomputeSubscriptionStats,
  runRecomputePage,
} from "./stats";

type Row = Record<string, Value | undefined> & {
  _id: string;
  _creationTime: number;
};

function indexFields(table: TableNames, name: string): string[] {
  if (name === "by_creation_time") return [];
  const indexes = schema.tables[table][" indexes"]();
  const index = indexes.find((candidate) => candidate.indexDescriptor === name);
  if (!index) throw new Error(`${table} has no index ${name}`);
  return index.fields;
}

// Orders and ranges rows the way Convex does: by the schema's index fields in
// Convex's value order, then `_creationTime`.
class IndexedQuery {
  private fields: string[] = [];
  private filters: Array<(row: Row) => boolean> = [];
  private descending = false;

  constructor(
    private table: TableNames,
    private source: Row[],
  ) {}

  withIndex(name: string, range?: (q: RangeBuilder) => unknown): this {
    this.fields = indexFields(this.table, name);
    const q: RangeBuilder = {
      eq: (field, value) => {
        this.filters.push((row) => compareValues(row[field], value) === 0);
        return q;
      },
      gt: (field, value) => {
        this.filters.push((row) => compareValues(row[field], value) > 0);
        return q;
      },
    };
    range?.(q);
    return this;
  }

  order(direction: "asc" | "desc"): this {
    this.descending = direction === "desc";
    return this;
  }

  private results(): Row[] {
    const rows = this.source
      .filter((row) => this.filters.every((matches) => matches(row)))
      .sort((a, b) => {
        for (const field of [...this.fields, "_creationTime"]) {
          const order = compareValues(a[field], b[field]);
          if (order !== 0) return order;
        }
        return 0;
      });
    return this.descending ? rows.reverse() : rows;
  }

  async take(count: number): Promise<Row[]> {
    return this.results().slice(0, count);
  }

  async first(): Promise<Row | null> {
    return this.results()[0] ?? null;
  }

  async collect(): Promise<Row[]> {
    return this.results();
  }

  async unique(): Promise<Row | null> {
    const rows = this.results();
    if (rows.length > 1) throw new Error("unique() matched several rows");
    return rows[0] ?? null;
  }

  async paginate(): Promise<{
    page: Row[];
    isDone: boolean;
    continueCursor: string;
  }> {
    return { page: this.results(), isDone: true, continueCursor: "" };
  }
}

type RangeBuilder = {
  eq: (field: string, value: Value) => RangeBuilder;
  gt: (field: string, value: Value) => RangeBuilder;
};

class FakeDb {
  private tables = new Map<TableNames, Row[]>();
  private counter = 0;

  private table(name: TableNames): Row[] {
    let rows = this.tables.get(name);
    if (!rows) {
      rows = [];
      this.tables.set(name, rows);
    }
    return rows;
  }

  rows(name: TableNames): Row[] {
    return this.table(name);
  }

  query(name: TableNames): IndexedQuery {
    return new IndexedQuery(name, this.table(name));
  }

  async insert(
    name: TableNames,
    doc: Record<string, Value | undefined>,
  ): Promise<string> {
    const _id = `${name}_${++this.counter}`;
    this.table(name).push({ ...doc, _id, _creationTime: this.counter });
    return _id;
  }

  async get(id: string): Promise<Row | null> {
    for (const rows of this.tables.values()) {
      const row = rows.find((candidate) => candidate._id === id);
      if (row) return row;
    }
    return null;
  }

  async patch(
    id: string,
    fields: Record<string, Value | undefined>,
  ): Promise<void> {
    const row = await this.get(id);
    if (!row) throw new Error(`patch: no doc ${id}`);
    Object.assign(row, fields);
  }

  async delete(id: string): Promise<void> {
    for (const rows of this.tables.values()) {
      const index = rows.findIndex((candidate) => candidate._id === id);
      if (index >= 0) rows.splice(index, 1);
    }
  }
}

const DAY = 86_400_000;
const PROJECTS = ["projects_a", "projects_b", "projects_c"] as Id<"projects">[];
const [PROJECT_A, PROJECT_B, PROJECT_C] = PROJECTS;

function makeCtx(db: FakeDb, scheduled: string[]) {
  return {
    db,
    scheduler: {
      runAfter: async (
        _delayMs: number,
        _fn: unknown,
        args: { projectId: string },
      ) => {
        scheduled.push(args.projectId);
      },
    },
  };
}

async function seedProjects(db: FakeDb): Promise<void> {
  const organizationId = await db.insert("organizations", {});
  for (const projectId of PROJECTS) {
    db.rows("projects").push({
      _id: projectId,
      _creationTime: 0,
      organizationId,
    });
  }
}

async function verifyNewSubscription(
  ctx: ReturnType<typeof makeCtx>,
  projectId: Id<"projects">,
  purchaseToken: string,
): Promise<void> {
  await testableFunction(recordVerifiedSubscription)._handler(ctx, {
    projectId,
    platform: "Android",
    purchaseToken,
    productId: "premium_monthly",
    purchaseState: HarmonizedPurchaseState.ENTITLED,
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    expiresAt: Date.now() + 30 * DAY,
    currency: "USD",
    priceAmountMicros: 9_990_000,
  });
}

async function pickProjects(
  ctx: ReturnType<typeof makeCtx>,
  scheduled: string[],
  batchSize: number,
): Promise<string[]> {
  scheduled.length = 0;
  await testableFunction(recomputeAllSubscriptionStats)._handler(ctx, {
    batchSize,
  });
  return [...scheduled];
}

async function recompute(
  ctx: ReturnType<typeof makeCtx>,
  projectId: Id<"projects">,
): Promise<void> {
  await testableFunction(recomputeSubscriptionStats)._handler(ctx, {
    projectId,
  });
}

describe("recomputeAllSubscriptionStats", () => {
  let db: FakeDb;
  let scheduled: string[];
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(DAY);
    db = new FakeDb();
    scheduled = [];
    ctx = makeCtx(db, scheduled);
    await seedProjects(db);
  });

  afterEach(() => vi.useRealTimers());

  it("still picks a project with daily activity once it is the least recently recomputed", async () => {
    for (const projectId of [...PROJECTS].reverse()) {
      await verifyNewSubscription(ctx, projectId, `${projectId}-first`);
    }
    for (const [day, projectId] of PROJECTS.entries()) {
      vi.setSystemTime((day + 2) * DAY);
      await recompute(ctx, projectId);
    }

    // Project a gains a subscriber every day, rewriting its stats row.
    for (let day = 5; day < 10; day += 1) {
      vi.setSystemTime(day * DAY);
      await verifyNewSubscription(ctx, PROJECT_A, `a-day-${day}`);
    }

    expect(await pickProjects(ctx, scheduled, 1)).toEqual([PROJECT_A]);
  });

  it("works through projects never recomputed, then sends each to the back", async () => {
    for (const projectId of PROJECTS) {
      await verifyNewSubscription(ctx, projectId, `${projectId}-first`);
    }
    vi.setSystemTime(2 * DAY);
    await verifyNewSubscription(ctx, PROJECT_A, "a-second");

    expect(await pickProjects(ctx, scheduled, 1)).toEqual([PROJECT_A]);
    await recompute(ctx, PROJECT_A);
    expect(await pickProjects(ctx, scheduled, 3)).toEqual([
      PROJECT_B,
      PROJECT_C,
      PROJECT_A,
    ]);
    expect(db.rows("subscriptionStats")).toContainEqual(
      expect.objectContaining({ projectId: PROJECT_A, activeSubs: 2 }),
    );
  });
});

describe("recomputeSubscriptionStats under concurrent writes", () => {
  const PROJECT = "projects_busy" as Id<"projects">;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DAY);
  });
  afterEach(() => vi.useRealTimers());

  type PageArgs = {
    projectId: Id<"projects">;
    startedAt: number;
    cursor: string | null;
  };

  // Records each chained page instead of running it, so writes can land
  // between pages.
  function memoryCtx(db: MemoryDb, pages: PageArgs[]) {
    return {
      db,
      scheduler: {
        runAfter: async (_delayMs: number, _fn: unknown, args: PageArgs) => {
          pages.push(args);
        },
      },
    };
  }

  // A store event moving `token` to `state`, as the webhook path writes it.
  async function write(
    ctx: ReturnType<typeof memoryCtx>,
    token: string,
    state: Doc<"subscriptions">["state"],
  ): Promise<void> {
    await persistSubscriptionSnapshot(ctx as never, {
      projectId: PROJECT,
      platform: "Android",
      purchaseToken: token,
      existing: await findSubscriptionByToken(ctx as never, PROJECT, token),
      next: {
        state,
        productId: "premium",
        expiresAt: 40 * DAY,
        currency: "USD",
        priceAmountMicros: 1_000_000,
      },
      now: Date.now(),
    });
  }

  async function rebuild(ctx: ReturnType<typeof memoryCtx>): Promise<void> {
    await testableFunction(recomputeSubscriptionStats)._handler(ctx, {
      projectId: PROJECT,
    });
  }

  it("commits totals that include writes made while it ran", async () => {
    const db = new MemoryDb();
    db.seed("organizations", { _id: "organizations_busy" });
    db.seed("projects", {
      _id: PROJECT,
      organizationId: "organizations_busy",
    });
    db.seed("products", {
      projectId: PROJECT,
      platform: "Android",
      productId: "premium",
      type: "Subscription",
      billingPeriod: "P1M",
    });
    const sub = {
      projectId: PROJECT,
      productKind: "subscription",
      productId: "premium",
      platform: "Android",
      state: "Active",
      expiresAt: 40 * DAY,
      currency: "USD",
      priceAmountMicros: 1_000_000,
      environment: "Production",
      startedAt: 0,
      updatedAt: 0,
    };
    // Two pages of production subscriptions and a sandbox tester that an
    // earlier release counted.
    for (let i = 0; i < SUBSCRIPTION_SCAN_PAGE_SIZE + 1; i++) {
      db.seed("subscriptions", { ...sub, purchaseToken: `token-${i}` });
    }
    db.seed("subscriptions", {
      ...sub,
      purchaseToken: "tester",
      environment: "Sandbox",
    });
    db.seed("subscriptionStats", {
      projectId: PROJECT,
      currency: "USD",
      activeSubs: SUBSCRIPTION_SCAN_PAGE_SIZE + 2,
      inGracePeriod: 0,
      inBillingRetry: 0,
      mrrMicros: (SUBSCRIPTION_SCAN_PAGE_SIZE + 2) * 1_000_000,
      updatedAt: 0,
    });
    const pages: PageArgs[] = [];
    const ctx = memoryCtx(db, pages);

    await rebuild(ctx);
    expect(pages).toHaveLength(1);
    // Between pages: a scanned row expires, an unscanned one enters grace,
    // and a new subscription starts.
    await write(ctx, "token-0", "Expired");
    await write(ctx, `token-${SUBSCRIPTION_SCAN_PAGE_SIZE}`, "InGracePeriod");
    await write(ctx, "token-new", "Active");
    await testableFunction(runRecomputePage)._handler(ctx, pages[0]);

    const committed = db.rows("subscriptionStats");
    expect(committed).toMatchObject([
      {
        currency: "USD",
        activeSubs: SUBSCRIPTION_SCAN_PAGE_SIZE,
        inGracePeriod: 1,
        mrrMicros: SUBSCRIPTION_SCAN_PAGE_SIZE * 1_000_000,
      },
    ]);
    expect(db.rows("subscriptionStatsRebuilds")).toEqual([]);

    // A quiet rebuild agrees.
    await rebuild(ctx);
    await testableFunction(runRecomputePage)._handler(ctx, pages[1]);
    expect(db.rows("subscriptionStats")).toMatchObject([
      {
        activeSubs: SUBSCRIPTION_SCAN_PAGE_SIZE,
        inGracePeriod: 1,
        mrrMicros: SUBSCRIPTION_SCAN_PAGE_SIZE * 1_000_000,
      },
    ]);
  });
});
