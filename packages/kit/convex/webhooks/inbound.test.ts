import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { userId: "users_1" as string | null };
vi.mock(import("@convex-dev/auth/server"), async (importOriginal) => ({
  ...(await importOriginal()),
  getAuthUserId: async () => auth.userId as never,
}));

const { MemoryDb, seedProject } = await import("../test.memoryDb");
const { listInboundNotificationsHandler } = await import("./inbound");
const { sha256Hex } = await import("../utils/sha256");

type Db = InstanceType<typeof MemoryDb>;
const ctxOf = (db: Db) => ({ db }) as never;
const page = { numItems: 25, cursor: null };
const RAW_JWS = "eyJhbGciOiJFUzI1NiJ9.eyJzZWNyZXQiOiJyYXcifQ.c2lnbmF0dXJl";
const PLAY_TOKEN = "play-token-is-a-credential";

beforeEach(() => {
  auth.userId = "users_1";
});

async function seedEvents(db: Db): Promise<void> {
  await db.insert("webhookEvents", {
    projectId: "projects_1",
    type: "SubscriptionRenewed",
    source: "AppleAppStoreServerNotificationsV2",
    platform: "IOS",
    environment: "Production",
    purchaseToken: "2000000000000001",
    transactionId: "2000000000000009",
    originalTransactionId: "2000000000000001",
    productId: "premium_monthly",
    sourceNotificationId: "asn-uuid-1",
    rawSignedPayload: RAW_JWS,
    occurredAt: 10,
    receivedAt: 11,
    appliedAt: 12,
  });
  await db.insert("webhookEvents", {
    projectId: "projects_1",
    type: "SubscriptionCanceled",
    source: "GooglePlayRealTimeDeveloperNotifications",
    platform: "Android",
    environment: "Sandbox",
    purchaseToken: PLAY_TOKEN,
    productId: "premium_yearly",
    sourceNotificationId: "pubsub-1",
    rawSignedPayload: `{"purchaseToken":"${PLAY_TOKEN}"}`,
    occurredAt: 20,
    receivedAt: 21,
  });
  await db.insert("subscriptions", {
    projectId: "projects_1",
    purchaseToken: PLAY_TOKEN,
    userId: "app-user-7",
    productId: "premium_yearly",
    platform: "Android",
    state: "Active",
    startedAt: 1,
    updatedAt: 1,
  });
}

describe("listInboundNotifications", () => {
  it("lists newest first without raw payloads or purchase tokens", async () => {
    const db = new MemoryDb();
    seedProject(db, "member");
    await seedEvents(db);
    const result = await listInboundNotificationsHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      paginationOpts: page,
    });

    expect(result.page.map((row) => row.sourceNotificationId)).toEqual([
      "pubsub-1",
      "asn-uuid-1",
    ]);
    expect(result.page[0]).toMatchObject({
      store: "google",
      type: "SubscriptionCanceled",
      environment: "Sandbox",
      productId: "premium_yearly",
      userId: "app-user-7",
      status: "pending",
    });
    expect(result.page[1]).toMatchObject({
      store: "apple",
      status: "applied",
      appliedAt: 12,
      payloadFingerprint: (await sha256Hex(RAW_JWS)).slice(0, 16),
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(RAW_JWS);
    expect(serialized).not.toContain(PLAY_TOKEN);
    expect(serialized).not.toContain("rawSignedPayload");
    expect(serialized).not.toContain("purchaseToken");
    // An Apple transaction id is the token bind accepts with a publishable key.
    expect(serialized).not.toContain("2000000000000001");
    expect(serialized).not.toContain("2000000000000009");
  });

  it("shows Apple transaction ids to owners, admins and secret keys", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    await seedEvents(db);
    const apple = { transactionId: "2000000000000009" };
    const viaSession = await listInboundNotificationsHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      paginationOpts: page,
    });
    expect(viaSession.page[1]).toMatchObject({
      ...apple,
      originalTransactionId: "2000000000000001",
    });

    auth.userId = null;
    const key = "openiap-kit_sk_inbound";
    db.seed("apiKeys", {
      projectId: "projects_1",
      organizationId: "organizations_1",
      keyHash: await sha256Hex(key),
      keyType: "secret",
      isActive: true,
    });
    const viaKey = await listInboundNotificationsHandler(ctxOf(db), {
      apiKey: key,
      paginationOpts: page,
    });
    expect(viaKey.page[1]).toMatchObject(apple);
  });

  it("is scoped to the caller's project and membership", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    await seedEvents(db);
    await db.insert("webhookEvents", {
      projectId: "projects_2",
      type: "TestNotification",
      source: "AppleAppStoreServerNotificationsV2",
      platform: "IOS",
      environment: "Sandbox",
      sourceNotificationId: "other-project",
      occurredAt: 30,
      receivedAt: 31,
    });
    const result = await listInboundNotificationsHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      paginationOpts: page,
    });
    expect(result.page).toHaveLength(2);

    auth.userId = "users_2";
    await expect(
      listInboundNotificationsHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        paginationOpts: page,
      }),
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  });

  it("bounds the page size", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    await expect(
      listInboundNotificationsHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        paginationOpts: { numItems: 500, cursor: null },
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
  });
});
