import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { userId: "users_1" as string | null };
vi.mock(import("@convex-dev/auth/server"), async (importOriginal) => ({
  ...(await importOriginal()),
  getAuthUserId: async () => auth.userId as never,
}));

const { MemoryDb, seedProject } = await import("../test.memoryDb");
const { testableFunction } = await import("../test.setup");
const { userTimeline } = await import("./query");
const { getReceiptsByProject } = await import("../purchases/query");

type Db = InstanceType<typeof MemoryDb>;
const ctxOf = (db: Db) => ({ db }) as never;
const timeline = testableFunction(userTimeline)._handler;
const listPurchases = testableFunction(getReceiptsByProject)._handler;

beforeEach(() => {
  auth.userId = "users_1";
});

async function seed(db: Db): Promise<void> {
  seedProject(db, "member");
  await db.insert("purchases", {
    projectId: "projects_1",
    store: "amazon",
    appUserId: "user-a",
    applicationId: "com.example",
    remoteId: "receipt-1",
    requestData: {
      store: "amazon",
      userId: "amzn-1",
      receiptId: "receipt-secret",
    },
    remoteResponse: "{}",
    requestIp: "198.51.100.7",
    state: "ENTITLED",
    isValid: true,
    productId: "coins",
    updatedAt: 100,
  });
  await db.insert("purchases", {
    projectId: "projects_1",
    store: "amazon",
    appUserId: "user-b",
    applicationId: "com.example",
    requestData: { store: "amazon", userId: "amzn-2", receiptId: "r2" },
    state: "ENTITLED",
    isValid: true,
    productId: "gems",
    updatedAt: 150,
  });
  await db.insert("subscriptions", {
    projectId: "projects_1",
    purchaseToken: "token-a",
    userId: "user-a",
    productId: "premium",
    platform: "Android",
    state: "Active",
    expiresAt: 900,
    startedAt: 1,
    updatedAt: 300,
  });
  await db.insert("commerceEvents", {
    projectId: "projects_1",
    userId: "user-a",
    eventType: "entitlement.granted",
    eventVersion: "1.0",
    store: "google",
    environment: "production",
    productId: "premium",
    occurredAt: 200,
    processedAt: 201,
  });
  await db.insert("purchaseIssues", {
    projectId: "projects_1",
    cause: "OWNERSHIP_CONFLICT",
    store: "google",
    fingerprint: "a".repeat(64),
    shard: 10,
    productId: "premium",
    appUserId: "user-a",
    correlationId: "corr-1",
    count: 2,
    firstSeenAt: 240,
    lastSeenAt: 250,
  });
}

describe("userTimeline", () => {
  it("merges one user's rows newest first without receipt evidence", async () => {
    const db = new MemoryDb();
    await seed(db);
    const result = await timeline(ctxOf(db), {
      projectId: "projects_1" as never,
      appUserId: "user-a",
    });
    expect(result.items.map((item) => [item.kind, item.at])).toEqual([
      ["subscription", 300],
      ["issue", 250],
      ["event", 200],
      ["purchase", 100],
    ]);
    expect(result.items[1]).toEqual({
      kind: "issue",
      id: db.rows("purchaseIssues")[0]._id,
      at: 250,
      store: "google",
      cause: "OWNERSHIP_CONFLICT",
      productId: "premium",
      count: 2,
    });
    expect(result.truncated).toBe(false);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("receipt-secret");
    expect(serialized).not.toContain("198.51.100.7");
    expect(serialized).not.toContain("token-a");
  });

  it("rejects a blank app user id", async () => {
    const db = new MemoryDb();
    await seed(db);
    await expect(
      timeline(ctxOf(db), { projectId: "projects_1" as never, appUserId: " " }),
    ).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
  });

  it("caps purchases by their displayed time, including legacy rows", async () => {
    const db = new MemoryDb();
    await seed(db);
    const [oldest] = db.rows("purchases");
    await db.patch(oldest._id, { updatedAt: 1000 });
    for (let i = 1; i <= 51; i++) {
      await db.insert("purchases", {
        projectId: "projects_1",
        appUserId: "user-a",
        store: "google",
        state: "ENTITLED",
        updatedAt: i,
      });
    }
    const legacy = await db.insert("purchases", {
      projectId: "projects_1",
      appUserId: "user-a",
      store: "google",
      state: "ENTITLED",
    });
    const result = await timeline(ctxOf(db), {
      projectId: "projects_1" as never,
      appUserId: "user-a",
    });
    const purchases = result.items.filter((item) => item.kind === "purchase");
    expect(purchases).toHaveLength(50);
    expect(purchases[0].id).toBe(oldest._id);
    expect(purchases[1].id).toBe(legacy);
    expect(purchases.at(-1)?.at).toBe(4);
    expect(result.truncated).toBe(true);
  });

  it("caps commerce events by occurrence time before sorting the timeline", async () => {
    const db = new MemoryDb();
    await seed(db);
    const [recent] = db.rows("commerceEvents");
    await db.patch(recent._id, { occurredAt: 1000 });
    for (let i = 1; i <= 51; i++) {
      await db.insert("commerceEvents", {
        projectId: "projects_1",
        userId: "user-a",
        store: "google",
        eventType: "subscription.renewed",
        occurredAt: i,
      });
    }
    const result = await timeline(ctxOf(db), {
      projectId: "projects_1" as never,
      appUserId: "user-a",
    });
    const events = result.items.filter((item) => item.kind === "event");
    expect(events).toHaveLength(50);
    expect(events[0].id).toBe(recent._id);
    expect(events.at(-1)?.at).toBe(3);
    expect(result.truncated).toBe(true);
  });
});

describe("purchase list filters", () => {
  const list = async (db: Db, filters: Record<string, unknown>) =>
    (
      await listPurchases(ctxOf(db), {
        projectId: "projects_1" as never,
        paginationOpts: { numItems: 25, cursor: null },
        ...filters,
      })
    ).page.map((row) => row.productId);

  it("filters by app user, product and creation date", async () => {
    const db = new MemoryDb();
    await seed(db);
    const [first, second] = db.rows("purchases");
    expect(await list(db, { appUserId: "user-a" })).toEqual(["coins"]);
    expect(await list(db, { productId: "gems" })).toEqual(["gems"]);
    expect(await list(db, { createdFrom: second._creationTime })).toEqual([
      "gems",
    ]);
    expect(await list(db, { createdTo: first._creationTime })).toEqual([
      "coins",
    ]);
    expect(await list(db, { appUserId: "user-a", productId: "gems" })).toEqual(
      [],
    );
    expect(
      await list(db, { store: "amazon", createdFrom: second._creationTime }),
    ).toEqual(["gems"]);
  });

  it("reads a product filter from its own index only in creation order", async () => {
    const db = new MemoryDb();
    await seed(db);
    // A later "gems" purchase, last updated before the earlier one.
    await db.insert("purchases", {
      projectId: "projects_1",
      store: "amazon",
      applicationId: "com.example",
      requestData: { store: "amazon", userId: "amzn-3", receiptId: "r3" },
      state: "ENTITLED",
      isValid: true,
      productId: "gems",
      updatedAt: 120,
    });
    const [, older, newer] = db.rows("purchases");
    const query = db.query.bind(db);
    const indexes: string[] = [];
    vi.spyOn(db, "query").mockImplementation((table) => {
      const scan = query(table);
      const withIndex = scan.withIndex.bind(scan);
      vi.spyOn(scan, "withIndex").mockImplementation((name, range) => {
        if (table === "purchases") indexes.push(name);
        return withIndex(name, range);
      });
      return scan;
    });
    const ids = async (filters: Record<string, unknown>) =>
      (
        await listPurchases(ctxOf(db), {
          projectId: "projects_1" as never,
          paginationOpts: { numItems: 25, cursor: null },
          ...filters,
        })
      ).page.map((row) => row._id);

    // Another sort keeps its own order and filters the product.
    expect(await ids({ productId: "gems", sortField: "updatedAt" })).toEqual([
      older._id,
      newer._id,
    ]);
    expect(await ids({ productId: "gems" })).toEqual([newer._id, older._id]);
    expect(
      await ids({ productId: "gems", createdTo: older._creationTime - 1 }),
    ).toEqual([]);
    expect(indexes).toEqual([
      "by_project_updatedAt",
      "by_project_and_productId",
      "by_project_and_productId",
    ]);
  });
});
