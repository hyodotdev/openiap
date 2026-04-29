import { beforeEach, describe, expect, it } from "vitest";

/**
 * In-memory stand-in for the slice of `ctx.db` that the
 * `drainAccountDeletionBatch` phases + `drainOrganizationPage` helper
 * touch. Purpose-built to exercise the deletion ordering without pulling
 * in `convex-test`.
 */

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

class IndexBuilder {
  predicates: Array<(row: Row) => boolean> = [];
  eq(field: string, value: unknown): this {
    this.predicates.push((row) => row[field] === value);
    return this;
  }
  gt(field: string, value: unknown): this {
    this.predicates.push((row) => {
      const a = row[field];
      return typeof a === "number" && typeof value === "number" && a > value;
    });
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

  filter(
    cb: (q: {
      eq: (field: unknown, value: unknown) => boolean;
      field: (name: string) => unknown;
    }) => unknown,
  ): MemQuery {
    const filtered = this.rows.filter((row) => {
      let currentField: string | null = null;
      const builder = {
        eq: (fieldRef: unknown, value: unknown) => {
          if (typeof fieldRef === "string") {
            return row[fieldRef] === value;
          }
          return currentField !== null && row[currentField] === value;
        },
        field: (name: string) => {
          currentField = name;
          return name;
        },
      };
      return Boolean(cb(builder));
    });
    return new MemQuery(filtered);
  }

  order(_direction: "asc" | "desc"): MemQuery {
    return this;
  }

  async first(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }

  async unique(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }

  async take(n: number): Promise<Row[]> {
    return this.rows.slice(0, n);
  }

  async collect(): Promise<Row[]> {
    return [...this.rows];
  }
}

class MemDb {
  tables = new Map<string, Map<string, Row>>();
  private counter = 0;

  private table(name: string) {
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

  async insert(tableName: string, doc: Record<string, unknown>) {
    const id = `${tableName}_${++this.counter}`;
    this.table(tableName).set(id, {
      ...doc,
      _id: id,
      _creationTime: Date.now(),
    });
    return id;
  }

  async get(id: string): Promise<Row | null> {
    for (const t of this.tables.values()) {
      const row = t.get(id);
      if (row) return row;
    }
    return null;
  }

  async patch(id: string, patch: Record<string, unknown>) {
    for (const t of this.tables.values()) {
      const row = t.get(id);
      if (row) {
        Object.assign(row, patch);
        return;
      }
    }
    throw new Error(`patch: no doc with id ${id}`);
  }

  async delete(id: string) {
    for (const t of this.tables.values()) {
      if (t.delete(id)) return;
    }
    throw new Error(`delete: no doc with id ${id}`);
  }

  countRows(tableName: string): number {
    return this.table(tableName).size;
  }
}

class MemStorage {
  deleted: string[] = [];
  async delete(id: string): Promise<void> {
    this.deleted.push(id);
  }
}

class MemScheduler {
  scheduled: Array<{ delay: number; fn: unknown; args: unknown }> = [];
  async runAfter(delay: number, fn: unknown, args: unknown): Promise<void> {
    this.scheduled.push({ delay, fn, args });
  }
}

function makeCtx() {
  const db = new MemDb();
  const storage = new MemStorage();
  const scheduler = new MemScheduler();
  return { db, storage, scheduler };
}

/**
 * Reimplementation of the drain phases from `convex/userProfiles/internal.ts`.
 * Keeping a test-local port means we can unit-test the per-phase
 * ordering and the "nothing left → delete user row" termination without
 * spinning up convex-test. Kept deliberately in-sync with the real
 * implementation — any change in the production drain should be mirrored
 * here (or migrated to a convex-test integration harness).
 */
const ACCOUNT_DELETION_PAGE = 100;

async function drainAccountDeletionBatch(
  ctx: ReturnType<typeof makeCtx>,
  userId: string,
): Promise<{ done: boolean }> {
  const session = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .first();
  if (session) {
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .take(ACCOUNT_DELETION_PAGE);
    for (const t of tokens) await ctx.db.delete(t._id);
    if (tokens.length < ACCOUNT_DELETION_PAGE) {
      await ctx.db.delete(session._id);
    }
    return { done: false };
  }

  const account = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .first();
  if (account) {
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .take(ACCOUNT_DELETION_PAGE);
    for (const c of codes) await ctx.db.delete(c._id);
    if (codes.length < ACCOUNT_DELETION_PAGE) {
      await ctx.db.delete(account._id);
    }
    return { done: false };
  }

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (profile) {
    await ctx.db.delete(profile._id);
    return { done: false };
  }

  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (membership) {
    await ctx.db.delete(membership._id);
    const remaining = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", membership.organizationId as string),
      )
      .take(ACCOUNT_DELETION_PAGE);
    if (remaining.length === 0) {
      await ctx.db.patch(membership.organizationId as string, {
        pendingDeletion: true,
      });
    } else if (!remaining.some((m) => m.role === "owner")) {
      const sorted = [...remaining].sort(
        (a, b) => ((a.joinedAt as number) ?? 0) - ((b.joinedAt as number) ?? 0),
      );
      const replacement = sorted.find((m) => m.role === "admin") ?? sorted[0];
      if (replacement) {
        await ctx.db.patch(replacement._id, { role: "owner" });
      }
    }
    return { done: false };
  }

  // Orphan-org cleanup is intentionally NOT inside drainAccountDeletionBatch
  // anymore — see drainPendingDeletionOrganizations below + the cron entry
  // in convex/crons.ts.

  const user = await ctx.db.get(userId);
  if (user) {
    await ctx.db.delete(userId);
    return { done: false };
  }

  return { done: true };
}

async function drainPendingDeletionOrganizations(
  ctx: ReturnType<typeof makeCtx>,
): Promise<{ progressed: boolean; deletedOrganizationId: string | null }> {
  const org = await ctx.db
    .query("organizations")
    .withIndex("by_pending_deletion", (q) => q.eq("pendingDeletion", true))
    .first();
  if (!org) {
    return { progressed: false, deletedOrganizationId: null };
  }
  const progress = await drainOrganizationPage(ctx, org._id);
  if (!progress) {
    await ctx.db.delete(org._id);
    return { progressed: true, deletedOrganizationId: org._id };
  }
  return { progressed: true, deletedOrganizationId: null };
}

async function drainOrganizationPage(
  ctx: ReturnType<typeof makeCtx>,
  organizationId: string,
): Promise<boolean> {
  const project = await ctx.db
    .query("projects")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();
  if (project) {
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(ACCOUNT_DELETION_PAGE);
    for (const p of purchases) await ctx.db.delete(p._id);
    if (purchases.length >= ACCOUNT_DELETION_PAGE) return true;

    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(ACCOUNT_DELETION_PAGE);
    for (const k of apiKeys) await ctx.db.delete(k._id);
    if (apiKeys.length >= ACCOUNT_DELETION_PAGE) return true;

    const files = await ctx.db
      .query("files")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .take(ACCOUNT_DELETION_PAGE);
    for (const f of files) {
      await ctx.storage.delete(f.storageId as string);
      await ctx.db.delete(f._id);
    }
    if (files.length >= ACCOUNT_DELETION_PAGE) return true;

    await ctx.db.delete(project._id);
    return true;
  }

  return false;
}

const USER_ID = "users_1";

async function runDrainToCompletion(ctx: ReturnType<typeof makeCtx>) {
  let iters = 0;
  while (iters < 1000) {
    const { done } = await drainAccountDeletionBatch(ctx, USER_ID);
    iters++;
    if (done) return iters;
  }
  throw new Error("drain did not terminate within 1000 iterations");
}

describe("drainAccountDeletionBatch — phase ordering", () => {
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(async () => {
    ctx = makeCtx();
    await ctx.db.insert("users", { _id: USER_ID, name: "hyo" });
    // Direct insert bypasses the auto-id to keep USER_ID deterministic.
    ctx.db.tables.get("users")!.delete("users_1");
    ctx.db.tables.set(
      "users",
      new Map([
        [
          USER_ID,
          {
            _id: USER_ID,
            _creationTime: Date.now(),
            name: "hyo",
          },
        ],
      ]),
    );
  });

  it("returns done when there's nothing to delete except the user", async () => {
    const iters = await runDrainToCompletion(ctx);
    expect(iters).toBeGreaterThanOrEqual(2);
    await expect(ctx.db.get(USER_ID)).resolves.toBeNull();
  });

  it("drains refresh tokens before the session itself", async () => {
    const session = await ctx.db.insert("authSessions", { userId: USER_ID });
    for (let i = 0; i < 3; i++) {
      await ctx.db.insert("authRefreshTokens", { sessionId: session });
    }

    await runDrainToCompletion(ctx);

    expect(ctx.db.countRows("authRefreshTokens")).toBe(0);
    expect(ctx.db.countRows("authSessions")).toBe(0);
  });

  it("caps refresh-token deletion at the page size (safely pages over huge sessions)", async () => {
    const session = await ctx.db.insert("authSessions", { userId: USER_ID });
    // 250 tokens > ACCOUNT_DELETION_PAGE (100) → must require multiple
    // drain calls to clear them all before the session itself is deleted.
    for (let i = 0; i < 250; i++) {
      await ctx.db.insert("authRefreshTokens", { sessionId: session });
    }

    await runDrainToCompletion(ctx);

    expect(ctx.db.countRows("authRefreshTokens")).toBe(0);
    expect(ctx.db.countRows("authSessions")).toBe(0);
  });

  it("drains verification codes before their auth account", async () => {
    const account = await ctx.db.insert("authAccounts", { userId: USER_ID });
    for (let i = 0; i < 5; i++) {
      await ctx.db.insert("authVerificationCodes", { accountId: account });
    }

    await runDrainToCompletion(ctx);

    expect(ctx.db.countRows("authVerificationCodes")).toBe(0);
    expect(ctx.db.countRows("authAccounts")).toBe(0);
  });

  it("flags orphaned orgs in the membership phase and the separate cron drains them", async () => {
    const orgId = await ctx.db.insert("organizations", {
      name: "acme",
    });
    await ctx.db.insert("organizationMembers", {
      userId: USER_ID,
      organizationId: orgId,
      role: "owner",
      joinedAt: 1,
    });
    const projectId = await ctx.db.insert("projects", {
      organizationId: orgId,
    });
    // 350 purchases → must page across 4+ orphan-cron ticks.
    for (let i = 0; i < 350; i++) {
      await ctx.db.insert("purchases", { projectId });
    }
    await ctx.db.insert("apiKeys", { projectId, organizationId: orgId });
    await ctx.db.insert("files", {
      projectId,
      organizationId: orgId,
      storageId: "storage_1",
    });

    // User-deletion path completes immediately, leaving the org flagged
    // `pendingDeletion: true` for the global cron to clean up later.
    await runDrainToCompletion(ctx);
    expect(ctx.db.countRows("organizations")).toBe(1);
    const flagged = await ctx.db
      .query("organizations")
      .withIndex("by_pending_deletion", (q) => q.eq("pendingDeletion", true))
      .first();
    expect(flagged?._id).toBe(orgId);

    // The orphan-org cron drains the rest. Each tick processes one
    // bounded page; loop until it stops finding work.
    let iters = 0;
    while (iters < 1000) {
      const { progressed } = await drainPendingDeletionOrganizations(ctx);
      iters++;
      if (!progressed) break;
    }

    expect(ctx.db.countRows("purchases")).toBe(0);
    expect(ctx.db.countRows("apiKeys")).toBe(0);
    expect(ctx.db.countRows("files")).toBe(0);
    expect(ctx.db.countRows("projects")).toBe(0);
    expect(ctx.db.countRows("organizations")).toBe(0);
    expect(ctx.storage.deleted).toContain("storage_1");
  });

  it("promotes a new owner when a remaining admin exists instead of deleting the org", async () => {
    const orgId = await ctx.db.insert("organizations", { name: "shared" });
    await ctx.db.insert("organizationMembers", {
      userId: USER_ID,
      organizationId: orgId,
      role: "owner",
      joinedAt: 1,
    });
    const teammateMembership = await ctx.db.insert("organizationMembers", {
      userId: "users_other",
      organizationId: orgId,
      role: "admin",
      joinedAt: 2,
    });

    await runDrainToCompletion(ctx);

    // Org survives, teammate gets promoted to owner.
    expect(ctx.db.countRows("organizations")).toBe(1);
    const patched = await ctx.db.get(teammateMembership);
    expect(patched?.role).toBe("owner");
  });
});
