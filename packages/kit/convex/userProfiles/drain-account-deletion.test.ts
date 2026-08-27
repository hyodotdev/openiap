import { beforeEach, describe, expect, it } from "vitest";
import {
  drainAccountDeletionBatch as registeredDrainAccountDeletionBatch,
  drainPendingDeletionOrganizations as registeredDrainPendingDeletionOrganizations,
} from "./internal";
import { testableFunction } from "../test.setup";

const productionDrainAccountDeletionBatch = testableFunction(
  registeredDrainAccountDeletionBatch,
);
const productionDrainPendingDeletionOrganizations = testableFunction(
  registeredDrainPendingDeletionOrganizations,
);

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
  missingStorageIds = new Set<string>();
  system = {
    get: async (_table: string, id: string) =>
      this.missingStorageIds.has(id) ? null : { _id: id },
  };

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

async function drainAccountDeletionBatch(
  ctx: ReturnType<typeof makeCtx>,
  userId: string,
): Promise<{ done: boolean }> {
  return await productionDrainAccountDeletionBatch._handler(ctx, {
    userId: userId as never,
  });
}

async function drainPendingDeletionOrganizations(
  ctx: ReturnType<typeof makeCtx>,
): Promise<{ progressed: boolean; deletedOrganizationId: string | null }> {
  return await productionDrainPendingDeletionOrganizations._handler(ctx, {});
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
    // 250 tokens > ACCOUNT_DELETION_PAGE (10) → must require multiple
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
      avatarFileId: "org_avatar_storage",
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
    // Payload rows are not tied to product-row lifetime, but they must not
    // outlive the owning project/account. More than one page exercises the
    // bounded account-deletion cascade.
    for (let i = 0; i < 125; i++) {
      await ctx.db.insert("productClientPayloads", {
        projectId,
        platform: "IOS",
        productId: `premium_${i}`,
        format: "text",
        body: "rule",
        version: 1,
      });
      await ctx.db.insert("productClientPayloadSummaries", {
        projectId,
        platform: "IOS",
        productId: `premium_${i}`,
        format: "text",
        version: 1,
      });
    }
    // Representative rows from every domain that the old account-local
    // cascade missed. The test now invokes the production handler, so these
    // assertions verify account deletion actually delegates to the shared
    // project cascade instead of merely keeping a duplicate test port green.
    const webhookEventId = await ctx.db.insert("webhookEvents", { projectId });
    const commerceEventId = await ctx.db.insert("commerceEvents", {
      projectId,
    });
    const destinationId = await ctx.db.insert("outboundDestinations", {
      projectId,
    });
    await ctx.db.insert("outboundDeliveryQueues", { projectId });
    await ctx.db.insert("outboundDeliveries", {
      projectId,
      eventId: commerceEventId,
      destinationId,
    });
    await ctx.db.insert("webhookIdempotencyKeys", {
      eventId: webhookEventId,
    });
    await ctx.db.insert("subscriptionTokenAliases", { projectId });
    await ctx.db.insert("subscriptions", { projectId });
    await ctx.db.insert("subscriptionStats", { projectId });
    await ctx.db.insert("revenueMetricsDaily", { projectId });
    await ctx.db.insert("revenueMetricsRunStatus", { projectId });
    await ctx.db.insert("products", { projectId });
    await ctx.db.insert("productSyncJobs", { projectId });
    await ctx.db.insert("purchaseStats", { projectId });

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
    expect(ctx.db.countRows("productClientPayloads")).toBe(0);
    expect(ctx.db.countRows("productClientPayloadSummaries")).toBe(0);
    expect(ctx.db.countRows("webhookEvents")).toBe(0);
    expect(ctx.db.countRows("commerceEvents")).toBe(0);
    expect(ctx.db.countRows("outboundDestinations")).toBe(0);
    expect(ctx.db.countRows("outboundDeliveryQueues")).toBe(0);
    expect(ctx.db.countRows("outboundDeliveries")).toBe(0);
    expect(ctx.db.countRows("webhookIdempotencyKeys")).toBe(0);
    expect(ctx.db.countRows("subscriptionTokenAliases")).toBe(0);
    expect(ctx.db.countRows("subscriptions")).toBe(0);
    expect(ctx.db.countRows("subscriptionStats")).toBe(0);
    expect(ctx.db.countRows("revenueMetricsDaily")).toBe(0);
    expect(ctx.db.countRows("revenueMetricsRunStatus")).toBe(0);
    expect(ctx.db.countRows("products")).toBe(0);
    expect(ctx.db.countRows("productSyncJobs")).toBe(0);
    expect(ctx.db.countRows("purchaseStats")).toBe(0);
    expect(ctx.db.countRows("projects")).toBe(0);
    expect(ctx.db.countRows("organizations")).toBe(0);
    expect(ctx.storage.deleted).toContain("storage_1");
    expect(ctx.storage.deleted).toContain("org_avatar_storage");
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

  it("does not promote from the bounded page when an owner exists later", async () => {
    const orgId = await ctx.db.insert("organizations", { name: "large team" });
    await ctx.db.insert("organizationMembers", {
      userId: USER_ID,
      organizationId: orgId,
      role: "owner",
      joinedAt: 0,
    });
    for (let index = 1; index <= 10; index++) {
      await ctx.db.insert("organizationMembers", {
        userId: `users_member_${index}`,
        organizationId: orgId,
        role: index === 1 ? "admin" : "member",
        joinedAt: index,
      });
    }
    const laterOwnerId = await ctx.db.insert("organizationMembers", {
      userId: "users_existing_owner",
      organizationId: orgId,
      role: "owner",
      joinedAt: 11,
    });

    await runDrainToCompletion(ctx);

    const members = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    expect(members.filter((member) => member.role === "owner")).toEqual([
      expect.objectContaining({ _id: laterOwnerId }),
    ]);
  });

  it("completes an orphan-org drain when its avatar blob is already absent", async () => {
    await ctx.db.insert("organizations", {
      name: "avatar already removed",
      pendingDeletion: true,
      avatarFileId: "missing_avatar_storage",
    });
    ctx.db.missingStorageIds.add("missing_avatar_storage");

    await expect(drainPendingDeletionOrganizations(ctx)).resolves.toMatchObject(
      { progressed: true },
    );
    expect(ctx.db.countRows("organizations")).toBe(0);
    expect(ctx.storage.deleted).not.toContain("missing_avatar_storage");
  });

  it("preserves an orphaned organization's avatar blob while another file row still references it", async () => {
    await ctx.db.insert("organizations", {
      name: "avatar shared by legacy file",
      pendingDeletion: true,
      avatarFileId: "shared_avatar_storage",
    });
    await ctx.db.insert("files", {
      organizationId: "organizations_other",
      uploadedBy: "users_other",
      storageId: "shared_avatar_storage",
    });

    await expect(drainPendingDeletionOrganizations(ctx)).resolves.toMatchObject(
      { progressed: true },
    );
    expect(ctx.db.countRows("organizations")).toBe(0);
    expect(ctx.db.countRows("files")).toBe(1);
    expect(ctx.storage.deleted).not.toContain("shared_avatar_storage");
  });
});
