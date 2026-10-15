import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { userId: "users_1" as string | null };
vi.mock(import("@convex-dev/auth/server"), async (importOriginal) => ({
  ...(await importOriginal()),
  getAuthUserId: async () => auth.userId as never,
}));

const { FakeDb, seedProject } = await import("../test.fakeDb");
const { testableFunction } = await import("../test.setup");
const { userTimeline } = await import("./query");
const { getReceiptsByProject } = await import("../purchases/query");

type Db = InstanceType<typeof FakeDb>;
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
}

describe("userTimeline", () => {
  it("merges one user's rows newest first without receipt evidence", async () => {
    const db = new FakeDb();
    await seed(db);
    const result = await timeline(ctxOf(db), {
      projectId: "projects_1" as never,
      appUserId: "user-a",
    });
    expect(result.items.map((item) => [item.kind, item.at])).toEqual([
      ["subscription", 300],
      ["event", 200],
      ["purchase", 100],
    ]);
    expect(result.truncated).toBe(false);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("receipt-secret");
    expect(serialized).not.toContain("198.51.100.7");
    expect(serialized).not.toContain("token-a");
  });

  it("rejects a blank app user id", async () => {
    const db = new FakeDb();
    await seed(db);
    await expect(
      timeline(ctxOf(db), { projectId: "projects_1" as never, appUserId: " " }),
    ).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
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
    const db = new FakeDb();
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
});
