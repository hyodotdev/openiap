import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { userId: "users_1" as string | null };
vi.mock(import("@convex-dev/auth/server"), async (importOriginal) => ({
  ...(await importOriginal()),
  getAuthUserId: async () => auth.userId as never,
}));

const { MemoryDb, seedProject } = await import("../test.memoryDb");
const {
  listDeliveriesHandler,
  recordDeliveryResultHandler,
  replayDeliveryHandler,
  resendDeliveryHandler,
} = await import("./deliveryState");
const { sha256Hex } = await import("../utils/sha256");
const {
  DELIVERY_HISTORY_LIMIT,
  RESEND_LIMIT_PER_MINUTE,
  classifyDeliveryError,
} = await import("./signing");

type Db = InstanceType<typeof MemoryDb>;
const ctxOf = (db: Db) => ({ db }) as never;
const page = { numItems: 25, cursor: null };

async function seedDelivery(
  db: Db,
  overrides: Record<string, unknown> = {},
): Promise<{ deliveryId: string; eventId: string; destinationId: string }> {
  const destinationId = await db.insert("outboundDestinations", {
    projectId: "projects_1",
    url: "https://hooks.example.com/iapkit?token=receiver-secret",
    secret: "whsec_test",
    enabled: true,
    description: "Billing backend",
    createdAt: 1,
    updatedAt: 1,
  });
  const eventId = await db.insert("commerceEvents", {
    projectId: "projects_1",
    eventType: "subscription.renewed",
    eventVersion: "1.0",
    store: "apple",
    environment: "production",
    occurredAt: 1,
    processedAt: 1,
  });
  const deliveryId = await db.insert("outboundDeliveries", {
    projectId: "projects_1",
    eventId,
    destinationId,
    eventType: "subscription.renewed",
    status: "delivered",
    attempts: 1,
    nextAttemptAt: 1,
    deliveredAt: 1,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  });
  return { deliveryId, eventId, destinationId };
}

async function seedSecretKey(db: Db, projectId: string): Promise<string> {
  const key = `openiap-kit_sk_${projectId}`;
  db.rows("apiKeys").push({
    _id: `apiKeys_${projectId}`,
    _creationTime: 0,
    projectId,
    organizationId: "organizations_1",
    keyHash: await sha256Hex(key),
    keyType: "secret",
    isActive: true,
  });
  return key;
}

beforeEach(() => {
  auth.userId = "users_1";
  vi.useRealTimers();
});

describe("delivery attempt history", () => {
  it("keeps the newest attempts, classified, without error text", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const { deliveryId } = await seedDelivery(db, {
      status: "delivering",
      attempts: 0,
    });
    const attempts = DELIVERY_HISTORY_LIMIT + 5;
    for (let index = 0; index < attempts; index += 1) {
      await db.patch(deliveryId, {
        status: "delivering",
        leaseToken: `lease-${index}`,
        attempts: 0,
      });
      await recordDeliveryResultHandler(ctxOf(db), {
        deliveryId: deliveryId as never,
        leaseToken: `lease-${index}`,
        ok: false,
        statusCode: index % 2 === 0 ? 503 : undefined,
        latencyMs: index,
        error: "connect ECONNREFUSED 203.0.113.9:443",
        errorClass: index % 2 === 0 ? undefined : "connection_refused",
        retryable: true,
      });
    }
    const row = await db.get(deliveryId);
    const history = row?.attemptHistory as Array<Record<string, unknown>>;
    expect(history).toHaveLength(DELIVERY_HISTORY_LIMIT);
    expect(history.at(-1)).toMatchObject({ latencyMs: attempts - 1 });
    expect(history[0]).toMatchObject({ latencyMs: 5 });
    expect(history.every((entry) => entry.outcome === "retrying")).toBe(true);
    expect(JSON.stringify(history)).not.toContain("203.0.113.9");
  });

  it("marks the exhausting and successful attempts", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const { deliveryId } = await seedDelivery(db, {
      status: "delivering",
      leaseToken: "lease-a",
      attempts: 0,
    });
    await recordDeliveryResultHandler(ctxOf(db), {
      deliveryId: deliveryId as never,
      leaseToken: "lease-a",
      ok: false,
      statusCode: 410,
      retryable: false,
    });
    await db.patch(deliveryId, { status: "delivering", leaseToken: "lease-b" });
    await recordDeliveryResultHandler(ctxOf(db), {
      deliveryId: deliveryId as never,
      leaseToken: "lease-b",
      ok: true,
      statusCode: 204,
      latencyMs: 42,
      retryable: false,
    });
    const history = (await db.get(deliveryId))?.attemptHistory;
    expect(history).toEqual([
      expect.objectContaining({ outcome: "failed", statusCode: 410 }),
      expect.objectContaining({
        outcome: "delivered",
        statusCode: 204,
        latencyMs: 42,
      }),
    ]);
  });

  it("classifies transport failures without keeping their messages", () => {
    const failure = (code: string, message = "boom") =>
      Object.assign(new Error(message), { code });
    expect(classifyDeliveryError(new Error("request timed out"))).toBe(
      "timeout",
    );
    expect(classifyDeliveryError(failure("ENOTFOUND"))).toBe("dns");
    expect(classifyDeliveryError(failure("ECONNREFUSED"))).toBe(
      "connection_refused",
    );
    expect(classifyDeliveryError(failure("ECONNRESET"))).toBe(
      "connection_reset",
    );
    expect(classifyDeliveryError(failure("CERT_HAS_EXPIRED"))).toBe("tls");
    expect(
      classifyDeliveryError(
        new Error("destination resolved to a non-public address"),
      ),
    ).toBe("non_public_address");
    expect(classifyDeliveryError("weird")).toBe("network");
  });
});

describe("resend", () => {
  it("requeues a delivered row with the same event id", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const { deliveryId, eventId } = await seedDelivery(db);
    const result = await resendDeliveryHandler(ctxOf(db), { deliveryId });
    expect(result).toEqual({ deliveryId, eventId, status: "pending" });
    const row = await db.get(deliveryId);
    expect(row).toMatchObject({
      eventId,
      status: "pending",
      attempts: 0,
      lastResendAt: expect.any(Number),
    });
    // A re-sent row that then dead-letters must not still read "delivered".
    expect(row).not.toHaveProperty("deliveredAt");
    expect(db.rows("outboundDeliveries")).toHaveLength(1);
    expect(db.rows("outboundDeliveryQueues")).toEqual([
      expect.objectContaining({ projectId: "projects_1" }),
    ]);
  });

  it("refuses members and lets a secret key re-send", async () => {
    const db = new MemoryDb();
    seedProject(db, "member");
    const { deliveryId } = await seedDelivery(db);
    await expect(
      resendDeliveryHandler(ctxOf(db), { deliveryId }),
    ).rejects.toMatchObject({ data: { code: "INSUFFICIENT_PERMISSIONS" } });

    auth.userId = null;
    const apiKey = await seedSecretKey(db, "projects_1");
    await expect(
      resendDeliveryHandler(ctxOf(db), { deliveryId, apiKey }),
    ).resolves.toMatchObject({ status: "pending" });
  });

  it("hides another project's delivery from a secret key", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    db.rows("projects").push({
      _id: "projects_2",
      _creationTime: 0,
      organizationId: "organizations_1",
    });
    const { deliveryId } = await seedDelivery(db);
    const apiKey = await seedSecretKey(db, "projects_2");
    await expect(
      resendDeliveryHandler(ctxOf(db), { deliveryId, apiKey }),
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  });

  it("explains a pruned event and an in-flight row", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const pruned = await seedDelivery(db);
    await db.delete(pruned.eventId);
    await expect(
      resendDeliveryHandler(ctxOf(db), { deliveryId: pruned.deliveryId }),
    ).rejects.toMatchObject({ data: { code: "EVENT_PRUNED" } });

    const queued = await seedDelivery(db, { status: "pending" });
    await expect(
      resendDeliveryHandler(ctxOf(db), { deliveryId: queued.deliveryId }),
    ).rejects.toMatchObject({ data: { code: "NOT_RESENDABLE" } });

    await expect(
      resendDeliveryHandler(ctxOf(db), {
        deliveryId: "outboundDeliveries_999",
      }),
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  });

  it("refuses a disabled destination", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const { deliveryId, destinationId } = await seedDelivery(db);
    await db.patch(destinationId, { enabled: false });
    await expect(
      resendDeliveryHandler(ctxOf(db), { deliveryId }),
    ).rejects.toMatchObject({ data: { code: "DESTINATION_DISABLED" } });
  });

  it("limits re-sends per row and per project", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T00:00:00.000Z"));
    const db = new MemoryDb();
    seedProject(db, "admin");
    const first = await seedDelivery(db);
    await resendDeliveryHandler(ctxOf(db), { deliveryId: first.deliveryId });
    await db.patch(first.deliveryId, { status: "delivered" });
    await expect(
      resendDeliveryHandler(ctxOf(db), { deliveryId: first.deliveryId }),
    ).rejects.toMatchObject({
      data: { code: "RATE_LIMITED", retryAfterSec: 60 },
    });

    for (let index = 1; index < RESEND_LIMIT_PER_MINUTE; index += 1) {
      vi.advanceTimersByTime(100);
      const { deliveryId } = await seedDelivery(db);
      await resendDeliveryHandler(ctxOf(db), { deliveryId });
    }
    const overflow = await seedDelivery(db);
    vi.advanceTimersByTime(10_000);
    await expect(
      resendDeliveryHandler(ctxOf(db), { deliveryId: overflow.deliveryId }),
    ).rejects.toMatchObject({
      data: { code: "RATE_LIMITED", retryAfterSec: 48 },
    });

    vi.advanceTimersByTime(60_000);
    await expect(
      resendDeliveryHandler(ctxOf(db), { deliveryId: overflow.deliveryId }),
    ).resolves.toMatchObject({ status: "pending" });
  });

  it("keeps the operator replay working for dead letters only", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const delivered = await seedDelivery(db);
    const failed = await seedDelivery(db, { status: "failed", attempts: 14 });
    await expect(
      replayDeliveryHandler(ctxOf(db), delivered.deliveryId as never),
    ).resolves.toBe(false);
    await expect(
      replayDeliveryHandler(ctxOf(db), failed.deliveryId as never),
    ).resolves.toBe(true);
    expect(await db.get(failed.deliveryId)).toMatchObject({
      status: "pending",
      attempts: 0,
    });
  });
});

describe("listDeliveries", () => {
  it("lets members read history with the destination host only", async () => {
    const db = new MemoryDb();
    seedProject(db, "member");
    const { deliveryId } = await seedDelivery(db, {
      attemptHistory: [{ at: 1, outcome: "delivered", statusCode: 200 }],
    });
    const result = await listDeliveriesHandler(ctxOf(db), {
      projectId: "projects_1" as never,
      paginationOpts: page,
    });
    expect(result.page).toEqual([
      expect.objectContaining({
        _id: deliveryId,
        destinationHost: "hooks.example.com",
        resendable: true,
        attemptHistory: [{ at: 1, outcome: "delivered", statusCode: 200 }],
      }),
    ]);
    expect(result.page[0]).not.toHaveProperty("destinationDescription");
    expect(JSON.stringify(result)).not.toContain("receiver-secret");
    expect(JSON.stringify(result)).not.toContain("whsec_");
  });

  it("gives members the error class and admins and secret keys the receiver's text", async () => {
    const lastError = "connect ECONNREFUSED 203.0.113.9:443";
    const failed = {
      status: "failed",
      lastError,
      attemptHistory: [
        { at: 1, outcome: "failed", errorClass: "connection_refused" },
      ],
    };
    const list = async (role: "member" | "admin", apiKey?: string) => {
      const db = new MemoryDb();
      seedProject(db, role);
      await seedDelivery(db, failed);
      const key = apiKey ? await seedSecretKey(db, "projects_1") : undefined;
      if (key) auth.userId = null;
      const result = await listDeliveriesHandler(
        ctxOf(db),
        key
          ? { apiKey: key, paginationOpts: page }
          : { projectId: "projects_1" as never, paginationOpts: page },
      );
      return result.page[0];
    };

    const member = await list("member");
    expect(member).toMatchObject({ lastErrorClass: "connection_refused" });
    expect(member).not.toHaveProperty("lastError");
    expect(JSON.stringify(member)).not.toContain("203.0.113.9");
    expect(await list("admin")).toMatchObject({
      lastError,
      lastErrorClass: "connection_refused",
      destinationDescription: "Billing backend",
    });
    expect(await list("member", "secret")).toMatchObject({
      lastError,
      destinationDescription: "Billing backend",
    });
  });

  it("reads each filter combination from its own index", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const first = await seedDelivery(db);
    const delivery = (eventType: string, status: string) =>
      db.insert("outboundDeliveries", {
        projectId: "projects_1",
        eventId: first.eventId,
        destinationId: first.destinationId,
        eventType,
        status,
        attempts: 1,
        nextAttemptAt: 1,
        createdAt: 1,
        updatedAt: 1,
      });
    const failedRenewed = await delivery("subscription.renewed", "failed");
    const failedRevoked = await delivery("entitlement.revoked", "failed");
    const deliveredRevoked = await delivery("entitlement.revoked", "delivered");
    const elsewhere = await seedDelivery(db, { status: "failed" });

    // Which index each delivery query used, and whether it dropped rows after.
    const reads: { index?: string; filtered: boolean }[] = [];
    const query = db.query.bind(db);
    db.query = (table) => {
      const q = query(table);
      if (table !== "outboundDeliveries") return q;
      const read: (typeof reads)[number] = { filtered: false };
      reads.push(read);
      const withIndex = q.withIndex.bind(q);
      const filter = q.filter.bind(q);
      q.withIndex = (name, range) => {
        read.index = name;
        return withIndex(name, range);
      };
      q.filter = (build) => {
        read.filtered = true;
        return filter(build);
      };
      return q;
    };
    const list = async (filters: Record<string, unknown>) => {
      reads.length = 0;
      const result = await listDeliveriesHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        paginationOpts: page,
        ...filters,
      });
      return { ids: result.page.map((row) => row._id), reads: [...reads] };
    };
    const destinationId = first.destinationId;

    expect(await list({ destinationId, status: "failed" })).toEqual({
      ids: [failedRevoked, failedRenewed],
      reads: [{ index: "by_destination_and_status", filtered: false }],
    });
    expect(
      await list({ destinationId, eventType: "entitlement.revoked" }),
    ).toEqual({
      ids: [deliveredRevoked, failedRevoked],
      reads: [{ index: "by_destination_and_event_type", filtered: false }],
    });
    expect(
      await list({
        destinationId,
        eventType: "entitlement.revoked",
        status: "failed",
      }),
    ).toEqual({
      ids: [failedRevoked],
      reads: [
        {
          index: "by_destination_and_event_type_and_status",
          filtered: false,
        },
      ],
    });
    expect(
      await list({ eventType: "subscription.renewed", status: "failed" }),
    ).toEqual({
      ids: [elsewhere.deliveryId, failedRenewed],
      reads: [
        { index: "by_project_and_event_type_and_status", filtered: false },
      ],
    });
  });

  it("filters by status, event type, destination and event id", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    const delivered = await seedDelivery(db);
    const failed = await seedDelivery(db, {
      status: "failed",
      eventType: "entitlement.revoked",
    });
    const list = async (filters: Record<string, unknown>) =>
      (
        await listDeliveriesHandler(ctxOf(db), {
          projectId: "projects_1" as never,
          paginationOpts: page,
          ...filters,
        })
      ).page.map((row) => row._id);

    expect(await list({ status: "failed" })).toEqual([failed.deliveryId]);
    expect(await list({ eventType: "subscription.renewed" })).toEqual([
      delivered.deliveryId,
    ]);
    expect(await list({ destinationId: failed.destinationId })).toEqual([
      failed.deliveryId,
    ]);
    expect(await list({ eventId: delivered.eventId })).toEqual([
      delivered.deliveryId,
    ]);
    expect(await list({ eventId: "not-an-id" })).toEqual([]);
    // An event id still honors the other filters.
    expect(
      await list({
        eventId: delivered.eventId,
        destinationId: failed.destinationId,
      }),
    ).toEqual([]);
    expect(
      await list({
        eventId: delivered.eventId,
        eventType: "entitlement.revoked",
      }),
    ).toEqual([]);
    expect(
      await list({
        eventId: delivered.eventId,
        destinationId: delivered.destinationId,
        eventType: "subscription.renewed",
      }),
    ).toEqual([delivered.deliveryId]);
  });

  it("rejects non-members", async () => {
    const db = new MemoryDb();
    seedProject(db, "admin");
    auth.userId = "users_2";
    await expect(
      listDeliveriesHandler(ctxOf(db), {
        projectId: "projects_1" as never,
        paginationOpts: page,
      }),
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  });
});
