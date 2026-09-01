import { describe, expect, it } from "vitest";

import { emitCommerceEvent, destinationAcceptsType } from "./internal";
import {
  buildEventPayload,
  claimPendingDeliveriesHandler,
  pruneCommerceHistoryHandler,
  recordDeliveryResultHandler,
  replayDeliveryHandler,
  type ClaimedDelivery,
} from "./deliveryState";
import { COMMERCE_EVENT_SCHEMA_VERSION } from "./contract";
import { LEASE_MS, MAX_DELIVERY_ATTEMPTS } from "./signing";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

class Query {
  constructor(private rows: Row[]) {}
  withIndex(name: string, cb?: (q: Builder) => Builder): Query {
    if (!cb) return this;
    const b = new Builder();
    cb(b);
    const rows = this.rows.filter((r) => b.preds.every((p) => p(r)));
    if (name === "by_next_claim") {
      rows.sort(
        (a, b) => (a.nextClaimAt as number) - (b.nextClaimAt as number),
      );
    }
    return new Query(rows);
  }
  async collect(): Promise<Row[]> {
    return [...this.rows];
  }
  async unique(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }
  async first(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }
  async take(n: number): Promise<Row[]> {
    return this.rows.slice(0, n);
  }
}

class Builder {
  preds: Array<(r: Row) => boolean> = [];
  eq(field: string, value: unknown): Builder {
    this.preds.push((r) => r[field] === value);
    return this;
  }
  lte(field: string, value: number): Builder {
    this.preds.push(
      (r) => r[field] === undefined || (r[field] as number) <= value,
    );
    return this;
  }
  gt(field: string, value: unknown): Builder {
    this.preds.push((r) =>
      value === undefined
        ? r[field] !== undefined
        : (r[field] as number) > (value as number),
    );
    return this;
  }
  lt(field: string, value: number): Builder {
    this.preds.push((r) => (r[field] as number) < value);
    return this;
  }
}

class Db {
  tables = new Map<string, Row[]>();
  private n = 0;
  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }
  query(table: string) {
    return new Query(this.rows(table));
  }
  async insert(table: string, doc: Record<string, unknown>): Promise<string> {
    this.n += 1;
    const _id = `${table}_${this.n}`;
    this.rows(table).push({ ...doc, _id, _creationTime: Date.now() });
    return _id;
  }
  async get(id: string): Promise<Row | null> {
    for (const rows of this.tables.values()) {
      const hit = rows.find((r) => r._id === id);
      if (hit) return hit;
    }
    return null;
  }
  async patch(id: string, patch: Record<string, unknown>): Promise<void> {
    const row = await this.get(id);
    if (row) Object.assign(row, patch);
  }
  async delete(id: string): Promise<void> {
    for (const rows of this.tables.values()) {
      const index = rows.findIndex((row) => row._id === id);
      if (index >= 0) {
        rows.splice(index, 1);
        return;
      }
    }
  }
}

const ctxOf = (db: Db) =>
  ({ db, scheduler: { runAfter: async () => undefined } }) as any;

function seedWritableProject(db: Db): void {
  if (db.rows("projects").some((row) => row._id === "projects_1")) return;
  db.rows("organizations").push({
    _id: "organizations_1",
    _creationTime: Date.now(),
  });
  db.rows("projects").push({
    _id: "projects_1",
    _creationTime: Date.now(),
    organizationId: "organizations_1",
  });
}

function sourceEvent(overrides: Record<string, unknown> = {}) {
  return {
    _id: "webhookEvents_1",
    _creationTime: Date.now(),
    projectId: "projects_1",
    platform: "IOS",
    environment: "Production",
    occurredAt: 1_700_000_000_000,
    purchaseToken: "tok-1",
    productId: "com.example.premium",
    ...overrides,
  } as any;
}

async function seedDestination(db: Db, extra: Record<string, unknown> = {}) {
  return db.insert("outboundDestinations", {
    projectId: "projects_1",
    url: "https://hooks.example.com/iapkit",
    secret: "s3cret",
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...extra,
  });
}

describe("emitCommerceEvent", () => {
  it("emits a lifecycle event for a real transition", async () => {
    const db = new Db();
    const ids = await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Renewed",
      active: true,
      previouslyActive: true,
      sourceEvent: sourceEvent(),
    });
    expect(ids).toHaveLength(1);
    const event = db.rows("commerceEvents")[0];
    expect(event.eventType).toBe("subscription.renewed");
    expect(event.eventVersion).toBe("1.0");
    expect(event.store).toBe("apple");
    expect(event.environment).toBe("production");
    expect(event.sourceEventId).toBe("webhookEvents_1");
    expect(event.transactionId).toBeUndefined();
    expect(event.prunableAt as number).toBeGreaterThan(
      event.processedAt as number,
    );
  });

  it("publishes real provider transaction identifiers, never a purchase token", async () => {
    const db = new Db();
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Renewed",
      active: true,
      previouslyActive: true,
      sourceEvent: sourceEvent({
        purchaseToken: "stable-purchase-token",
        transactionId: "transaction-99",
        originalTransactionId: "transaction-1",
      }),
    });
    expect(db.rows("commerceEvents")[0]).toMatchObject({
      transactionId: "transaction-99",
      originalTransactionId: "transaction-1",
    });
    expect(JSON.stringify(db.rows("commerceEvents"))).not.toContain(
      "stable-purchase-token",
    );
  });

  it("publishes application and previous-product identity when available", async () => {
    const db = new Db();
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "ProductChanged",
      active: true,
      previouslyActive: true,
      previousProductId: "premium.monthly",
      sourceEvent: sourceEvent({
        applicationId: "com.example.app",
        productId: "premium.yearly",
      }),
    });
    expect(db.rows("commerceEvents")[0]).toMatchObject({
      applicationId: "com.example.app",
      previousProductId: "premium.monthly",
      productId: "premium.yearly",
    });
  });

  it("falls back to the canonical product when a refund omits it", async () => {
    const db = new Db();
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Refunded",
      active: false,
      previouslyActive: true,
      sourceEvent: sourceEvent({ productId: undefined }),
      subscription: {
        state: "Refunded",
        productId: "com.example.premium",
      },
    });
    expect(db.rows("commerceEvents")[0]).toMatchObject({
      eventType: "subscription.refunded",
      productId: "com.example.premium",
    });
  });

  it("emits nothing for a no-op transition with no entitlement change", async () => {
    const db = new Db();
    const ids = await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Ignored",
      active: false,
      previouslyActive: false,
      sourceEvent: sourceEvent(),
    });
    expect(ids).toHaveLength(0);
    expect(db.rows("commerceEvents")).toHaveLength(0);
  });

  it("adds entitlement.granted when the gate opens", async () => {
    const db = new Db();
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Started",
      active: true,
      previouslyActive: false,
      sourceEvent: sourceEvent(),
      subscription: {
        state: "Active",
        productId: "com.example.premium",
        userId: "user-1",
      },
    });
    const types = db.rows("commerceEvents").map((r) => r.eventType);
    expect(types).toEqual(["subscription.started", "entitlement.granted"]);
  });

  it("adds entitlement.revoked when the gate closes", async () => {
    const db = new Db();
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Expired",
      active: false,
      previouslyActive: true,
      sourceEvent: sourceEvent(),
      subscription: {
        state: "Expired",
        productId: "com.example.premium",
        userId: "user-1",
      },
    });
    const types = db.rows("commerceEvents").map((r) => r.eventType);
    expect(types).toEqual(["subscription.expired", "entitlement.revoked"]);
  });

  it("defers an entitlement delta until the purchase has a user binding", async () => {
    const db = new Db();
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Started",
      active: true,
      previouslyActive: false,
      sourceEvent: sourceEvent(),
    });
    expect(db.rows("commerceEvents").map((row) => row.eventType)).toEqual([
      "subscription.started",
    ]);
  });

  it("marks a store-provided amount as store-authoritative", async () => {
    const db = new Db();
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Renewed",
      active: true,
      previouslyActive: true,
      sourceEvent: sourceEvent({
        currency: "USD",
        priceAmountMicros: 9_990_000,
        amountProvenance: "store",
      }),
    });
    const event = db.rows("commerceEvents")[0];
    expect(event.amountProvenance).toBe("store");
    expect(event.amountMicros).toBe(9_990_000);
  });

  it("preserves catalog provenance for prepaid subscription pricing", async () => {
    const db = new Db();
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Started",
      active: true,
      previouslyActive: false,
      sourceEvent: sourceEvent({
        currency: "USD",
        priceAmountMicros: 4_990_000,
        amountProvenance: "catalog",
      }),
    });
    expect(db.rows("commerceEvents")[0]).toMatchObject({
      amountMicros: 4_990_000,
      amountProvenance: "catalog",
    });
  });

  it("leaves provenance unset when the store asserted no amount", async () => {
    const db = new Db();
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Renewed",
      active: true,
      previouslyActive: true,
      sourceEvent: sourceEvent(),
    });
    expect(db.rows("commerceEvents")[0].amountProvenance).toBeUndefined();
  });

  it("never carries the raw signed store payload", async () => {
    const db = new Db();
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Renewed",
      active: true,
      previouslyActive: true,
      sourceEvent: sourceEvent({ rawSignedPayload: "eyJhbGciOi.SECRET" }),
    });
    expect(JSON.stringify(db.rows("commerceEvents"))).not.toContain("SECRET");
  });

  it("fans out one delivery per enabled destination", async () => {
    const db = new Db();
    await seedDestination(db);
    await seedDestination(db, { url: "https://second.example.com/hook" });
    await seedDestination(db, {
      url: "https://off.example.com/hook",
      enabled: false,
    });
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Renewed",
      active: true,
      previouslyActive: true,
      sourceEvent: sourceEvent(),
    });
    expect(db.rows("outboundDeliveries")).toHaveLength(2);
  });

  it("respects a destination event-type filter", async () => {
    const db = new Db();
    await seedDestination(db, { eventTypes: ["subscription.expired"] });
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Renewed",
      active: true,
      previouslyActive: true,
      sourceEvent: sourceEvent(),
    });
    expect(db.rows("outboundDeliveries")).toHaveLength(0);
  });

  it("writes exactly one delivery per destination per event", async () => {
    const db = new Db();
    await seedDestination(db);
    await emitCommerceEvent(ctxOf(db), {
      projectId: "projects_1" as never,
      transition: "Started",
      active: true,
      previouslyActive: false,
      sourceEvent: sourceEvent(),
      subscription: {
        state: "Active",
        productId: "com.example.premium",
        userId: "user-1",
      },
    });
    // Started + entitlement.granted are two events, so two deliveries — one
    // per event, not two per event.
    const deliveries = db.rows("outboundDeliveries");
    expect(deliveries).toHaveLength(2);
    expect(new Set(deliveries.map((r) => r.eventId)).size).toBe(2);
  });
});

describe("destinationAcceptsType", () => {
  it("accepts everything when no filter is set", () => {
    expect(destinationAcceptsType({}, "subscription.renewed")).toBe(true);
    expect(
      destinationAcceptsType({ eventTypes: [] }, "subscription.renewed"),
    ).toBe(true);
  });

  it("honours an explicit allow list", () => {
    const dest = { eventTypes: ["entitlement.granted"] };
    expect(destinationAcceptsType(dest, "entitlement.granted")).toBe(true);
    expect(destinationAcceptsType(dest, "subscription.renewed")).toBe(false);
  });
});

describe("claimPendingDeliveries", () => {
  async function seedDue(db: Db, overrides: Record<string, unknown> = {}) {
    seedWritableProject(db);
    const queue = db
      .rows("outboundDeliveryQueues")
      .find((row) => row.projectId === "projects_1");
    if (!queue) {
      await db.insert("outboundDeliveryQueues", {
        projectId: "projects_1",
        nextClaimAt: Date.now() - 1_000,
        updatedAt: Date.now(),
      });
    } else {
      queue.nextClaimAt = Date.now() - 1_000;
    }
    const destinationId = await seedDestination(db);
    const eventId = await db.insert("commerceEvents", {
      projectId: "projects_1",
      eventType: "subscription.renewed",
      eventVersion: "1.0",
      store: "apple",
      environment: "production",
      occurredAt: 1,
      processedAt: 1,
    });
    await db.insert("outboundDeliveries", {
      projectId: "projects_1",
      eventId,
      destinationId,
      status: "pending",
      attempts: 0,
      nextAttemptAt: Date.now() - 1_000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });
    return { destinationId, eventId };
  }

  it("leases a due delivery out of pending so a second tick cannot take it", async () => {
    const db = new Db();
    await seedDue(db);
    const first: ClaimedDelivery[] = await claimPendingDeliveriesHandler(
      ctxOf(db),
      10,
    );
    expect(first).toHaveLength(1);
    expect(db.rows("outboundDeliveries")[0].status).toBe("delivering");
    const second = await claimPendingDeliveriesHandler(ctxOf(db), 10);
    expect(second).toHaveLength(0);
  });

  it("serializes a body without the destination secret", async () => {
    const db = new Db();
    await seedDue(db);
    const [claim] = await claimPendingDeliveriesHandler(ctxOf(db), 10);
    expect(claim.body).not.toContain("s3cret");
    expect(JSON.parse(claim.body).eventType).toBe("subscription.renewed");
  });

  it("fails the row when its destination was disabled after queueing", async () => {
    const db = new Db();
    const { destinationId } = await seedDue(db);
    await db.patch(destinationId, { enabled: false });
    const claimed = await claimPendingDeliveriesHandler(ctxOf(db), 10);
    expect(claimed).toHaveLength(0);
    expect(db.rows("outboundDeliveries")[0].status).toBe("failed");
    expect(db.rows("outboundDeliveries")[0].lastError).toBe(
      "destination disabled",
    );
  });

  it("suppresses a queued event removed from the destination filter", async () => {
    const db = new Db();
    const { destinationId } = await seedDue(db);
    await db.patch(destinationId, { eventTypes: ["subscription.expired"] });

    await expect(claimPendingDeliveriesHandler(ctxOf(db), 10)).resolves.toEqual(
      [],
    );
    expect(db.rows("outboundDeliveries")).toHaveLength(0);
    expect(db.rows("commerceEvents")[0].prunableAt).toBeGreaterThan(Date.now());
  });

  it("preserves the attempted response when the breaker disables a destination", async () => {
    const db = new Db();
    const { destinationId } = await seedDue(db, {
      attempts: 1,
      lastStatusCode: 503,
      lastError: "upstream unavailable",
    });
    await db.patch(destinationId, { enabled: false });

    await claimPendingDeliveriesHandler(ctxOf(db), 10);
    expect(db.rows("outboundDeliveries")[0]).toMatchObject({
      status: "failed",
      lastStatusCode: 503,
      lastError: "upstream unavailable",
    });
  });

  it("fences an expired attempt when its destination is disabled", async () => {
    const db = new Db();
    const { destinationId } = await seedDue(db);
    const [first] = await claimPendingDeliveriesHandler(ctxOf(db), 10);
    const row = db.rows("outboundDeliveries")[0];

    await db.patch(row._id, { leaseExpiresAt: Date.now() - 1 });
    await db.patch(destinationId, { enabled: false });
    db.rows("outboundDeliveryQueues")[0].nextClaimAt = Date.now() - 1;
    expect(await claimPendingDeliveriesHandler(ctxOf(db), 10)).toEqual([]);
    expect(row).toMatchObject({
      status: "failed",
      lastError: "destination disabled",
      leaseExpiresAt: undefined,
      leaseToken: undefined,
    });

    await recordDeliveryResultHandler(ctxOf(db), {
      deliveryId: row._id as never,
      leaseToken: first.leaseToken,
      ok: true,
      statusCode: 200,
      retryable: false,
    });
    expect(row.status).toBe("failed");
    expect(row.attempts).toBe(0);
  });

  it("stops queued sends as soon as project deletion begins", async () => {
    const db = new Db();
    await seedDue(db);
    await db.patch("projects_1", { pendingDeletion: true });

    await expect(claimPendingDeliveriesHandler(ctxOf(db), 10)).resolves.toEqual(
      [],
    );
    expect(db.rows("outboundDeliveries")[0]).toMatchObject({
      status: "failed",
      lastError: "project unavailable",
    });
  });

  it("reclaims a delivery whose lease expired after a crashed attempt", async () => {
    const db = new Db();
    await seedDue(db);
    await claimPendingDeliveriesHandler(ctxOf(db), 10);
    const row = db.rows("outboundDeliveries")[0];
    expect(row.status).toBe("delivering");

    // Simulate the action dying before it could record a result.
    await db.patch(row._id, { leaseExpiresAt: Date.now() - 1 });
    db.rows("outboundDeliveryQueues")[0].nextClaimAt = Date.now() - 1;
    const reclaimed = await claimPendingDeliveriesHandler(ctxOf(db), 10);
    expect(reclaimed).toHaveLength(1);
  });

  it("reclaims an expired lease ahead of a full pending backlog", async () => {
    const db = new Db();
    await seedDue(db);
    const [first] = await claimPendingDeliveriesHandler(ctxOf(db), 10);
    const stale = db.rows("outboundDeliveries")[0];
    await db.patch(stale._id, { leaseExpiresAt: Date.now() - 1 });
    for (let index = 0; index < 10; index += 1) await seedDue(db);

    const [reclaimed] = await claimPendingDeliveriesHandler(ctxOf(db), 10);
    expect(reclaimed.deliveryId).toBe(first.deliveryId);
  });

  it("rotates claims across projects instead of draining one tenant first", async () => {
    const db = new Db();
    const firstSeed = await seedDue(db);
    db.rows("projects").push({
      _id: "projects_2",
      _creationTime: Date.now(),
      organizationId: "organizations_1",
    });
    const destinationId = await db.insert("outboundDestinations", {
      projectId: "projects_2",
      url: "https://second.example.com/iapkit",
      secret: "second-secret",
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const eventId = await db.insert("commerceEvents", {
      projectId: "projects_2",
      eventType: "subscription.renewed",
      eventVersion: "1.0",
      store: "google",
      environment: "production",
      occurredAt: 1,
      processedAt: 1,
    });
    await db.insert("outboundDeliveries", {
      projectId: "projects_2",
      eventId,
      destinationId,
      status: "pending",
      attempts: 0,
      nextAttemptAt: Date.now() - 1_000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await db.insert("outboundDeliveryQueues", {
      projectId: "projects_2",
      nextClaimAt: Date.now() - 1_000,
      updatedAt: Date.now(),
    });

    const [first] = await claimPendingDeliveriesHandler(ctxOf(db), 10);
    const [second] = await claimPendingDeliveriesHandler(ctxOf(db), 10);
    expect(new Set([first.eventId, second.eventId])).toEqual(
      new Set([firstSeed.eventId, eventId]),
    );
  });

  it("deletes idle queues so they cannot starve newly awakened work", async () => {
    const db = new Db();
    const { eventId } = await seedDue(db);
    const activeQueue = db.rows("outboundDeliveryQueues")[0];
    activeQueue.nextClaimAt = Date.now() - 1;
    for (let index = 0; index < 26; index += 1) {
      await db.insert("outboundDeliveryQueues", {
        projectId: `idle_project_${index}`,
        nextClaimAt: Date.now() - 10_000 + index,
        updatedAt: Date.now(),
      });
    }

    await expect(claimPendingDeliveriesHandler(ctxOf(db), 25)).resolves.toEqual(
      [],
    );
    expect(db.rows("outboundDeliveryQueues")).toHaveLength(2);

    const [claimed] = await claimPendingDeliveriesHandler(ctxOf(db), 25);
    expect(claimed.eventId).toBe(eventId);
    expect(
      db
        .rows("outboundDeliveryQueues")
        .some((row) => String(row.projectId).startsWith("idle_project_")),
    ).toBe(false);
  });

  it("does not steal a delivery whose lease is still held", async () => {
    const db = new Db();
    await seedDue(db);
    await claimPendingDeliveriesHandler(ctxOf(db), 10);
    const row = db.rows("outboundDeliveries")[0];
    await db.patch(row._id, { leaseExpiresAt: Date.now() + 60_000 });
    expect(await claimPendingDeliveriesHandler(ctxOf(db), 10)).toHaveLength(0);
  });

  it("only offers the previous secret while its rotation window is open", async () => {
    const db = new Db();
    const { destinationId } = await seedDue(db);
    await db.patch(destinationId, {
      previousSecret: "old",
      previousSecretExpiresAt: Date.now() - 1,
    });
    const [expired] = await claimPendingDeliveriesHandler(ctxOf(db), 10);
    expect(expired.previousSecret).toBeUndefined();

    await db.patch(db.rows("outboundDeliveries")[0]._id, { status: "pending" });
    db.rows("outboundDeliveryQueues")[0].nextClaimAt = Date.now() - 1;
    await db.patch(destinationId, {
      previousSecret: "old",
      previousSecretExpiresAt: Date.now() + 60_000,
    });
    const [live] = await claimPendingDeliveriesHandler(ctxOf(db), 10);
    expect(live.previousSecret).toBe("old");
  });
});

const LEASE_TOKEN = "lease-token-1";

describe("recordDeliveryResult", () => {
  async function seedClaimed(db: Db, attempts = 0) {
    seedWritableProject(db);
    const destinationId = await seedDestination(db, {
      consecutiveFailures: 0,
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
      status: "delivering",
      attempts,
      nextAttemptAt: Date.now(),
      leaseExpiresAt: Date.now() + LEASE_MS,
      leaseToken: LEASE_TOKEN,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { deliveryId, destinationId };
  }

  it("marks a 2xx as delivered and clears the destination failure streak", async () => {
    const db = new Db();
    const { deliveryId, destinationId } = await seedClaimed(db);
    await db.patch(destinationId, { consecutiveFailures: 5 });
    await recordDeliveryResultHandler(ctxOf(db), {
      deliveryId: deliveryId as never,
      leaseToken: LEASE_TOKEN,
      ok: true,
      statusCode: 200,
      retryable: false,
    });
    const delivery = await db.get(deliveryId);
    expect(delivery?.status).toBe("delivered");
    expect(delivery?.attempts).toBe(1);
    expect(delivery?.leaseExpiresAt).toBeUndefined();
    const destination = await db.get(destinationId);
    expect(destination?.consecutiveFailures).toBe(0);
    expect(destination?.lastSuccessAt).toBeDefined();
  });

  it("requeues a retryable failure with a later attempt time", async () => {
    const db = new Db();
    const { deliveryId } = await seedClaimed(db);
    const before = Date.now();
    await recordDeliveryResultHandler(ctxOf(db), {
      deliveryId: deliveryId as never,
      leaseToken: LEASE_TOKEN,
      ok: false,
      statusCode: 503,
      retryable: true,
    });
    const delivery = await db.get(deliveryId);
    expect(delivery?.status).toBe("pending");
    expect(delivery?.nextAttemptAt as number).toBeGreaterThan(before);
  });

  it("dead-letters a permanent failure immediately", async () => {
    const db = new Db();
    const { deliveryId } = await seedClaimed(db);
    await recordDeliveryResultHandler(ctxOf(db), {
      deliveryId: deliveryId as never,
      leaseToken: LEASE_TOKEN,
      ok: false,
      statusCode: 400,
      retryable: false,
    });
    expect((await db.get(deliveryId))?.status).toBe("failed");
  });

  it("keeps only the latest mutually-exclusive failure diagnostic", async () => {
    const db = new Db();
    const { deliveryId } = await seedClaimed(db);
    await db.patch(deliveryId, { lastError: "old transport failure" });
    await recordDeliveryResultHandler(ctxOf(db), {
      deliveryId: deliveryId as never,
      leaseToken: LEASE_TOKEN,
      ok: false,
      statusCode: 400,
      retryable: false,
    });
    expect(await db.get(deliveryId)).toMatchObject({
      lastStatusCode: 400,
      lastError: undefined,
    });
  });

  it("dead-letters once the attempt budget is exhausted", async () => {
    const db = new Db();
    const { deliveryId } = await seedClaimed(db, MAX_DELIVERY_ATTEMPTS - 1);
    await recordDeliveryResultHandler(ctxOf(db), {
      deliveryId: deliveryId as never,
      leaseToken: LEASE_TOKEN,
      ok: false,
      statusCode: 500,
      retryable: true,
    });
    const delivery = await db.get(deliveryId);
    expect(delivery?.attempts).toBe(MAX_DELIVERY_ATTEMPTS);
    expect(delivery?.status).toBe("failed");
  });

  it("truncates a long error so one bad response cannot bloat the row", async () => {
    const db = new Db();
    const { deliveryId } = await seedClaimed(db);
    await recordDeliveryResultHandler(ctxOf(db), {
      deliveryId: deliveryId as never,
      leaseToken: LEASE_TOKEN,
      ok: false,
      error: "x".repeat(2000),
      retryable: true,
    });
    expect((await db.get(deliveryId))?.lastError as string).toHaveLength(500);
  });

  it("trips the breaker and disables the destination after repeated failures", async () => {
    const db = new Db();
    const { deliveryId, destinationId } = await seedClaimed(db);
    await db.patch(destinationId, { consecutiveFailures: 19 });
    await recordDeliveryResultHandler(ctxOf(db), {
      deliveryId: deliveryId as never,
      leaseToken: LEASE_TOKEN,
      ok: false,
      statusCode: 500,
      retryable: true,
    });
    const destination = await db.get(destinationId);
    expect(destination?.enabled).toBe(false);
    expect(destination?.disabledReason as string).toContain("auto-disabled");
  });

  it("ignores a result from a lease that was already reclaimed", async () => {
    const db = new Db();
    const { deliveryId } = await seedClaimed(db);
    // The row was reclaimed and handed to a newer attempt.
    await db.patch(deliveryId, { leaseToken: "lease-token-2" });
    await recordDeliveryResultHandler(ctxOf(db), {
      deliveryId: deliveryId as never,
      leaseToken: LEASE_TOKEN,
      ok: true,
      statusCode: 200,
      retryable: false,
    });
    const delivery = await db.get(deliveryId);
    expect(delivery?.status).toBe("delivering");
    expect(delivery?.attempts).toBe(0);
    expect(delivery?.leaseToken).toBe("lease-token-2");
  });

  it("is a no-op for a delivery that no longer exists", async () => {
    const db = new Db();
    await expect(
      recordDeliveryResultHandler(ctxOf(db), {
        deliveryId: "outboundDeliveries_missing" as never,
        leaseToken: LEASE_TOKEN,
        ok: true,
        retryable: false,
      }),
    ).resolves.toBeNull();
  });
});

describe("replayDelivery", () => {
  async function seedFailed(db: Db) {
    const destinationId = await seedDestination(db);
    const eventId = await db.insert("commerceEvents", {
      projectId: "projects_1",
      eventType: "subscription.renewed",
      eventVersion: "1.0",
      store: "apple",
      environment: "production",
      occurredAt: 1,
      processedAt: 1,
    });
    return db.insert("outboundDeliveries", {
      projectId: "projects_1",
      eventId,
      destinationId,
      status: "failed",
      attempts: MAX_DELIVERY_ATTEMPTS,
      nextAttemptAt: Date.now(),
      lastError: "boom",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  it("requeues a dead-lettered delivery with a fresh attempt budget", async () => {
    const db = new Db();
    const deliveryId = await seedFailed(db);
    await db.patch(deliveryId, {
      leaseExpiresAt: Date.now() - 1,
      leaseToken: "stale-token",
      lastStatusCode: 503,
    });
    expect(await replayDeliveryHandler(ctxOf(db), deliveryId as never)).toBe(
      true,
    );
    const delivery = await db.get(deliveryId);
    expect(delivery?.status).toBe("pending");
    expect(delivery?.attempts).toBe(0);
    expect(delivery?.lastError).toBeUndefined();
    expect(delivery?.lastStatusCode).toBeUndefined();
    expect(delivery?.leaseExpiresAt).toBeUndefined();
    expect(delivery?.leaseToken).toBeUndefined();
  });

  it("refuses to replay a delivery that is not dead-lettered", async () => {
    const db = new Db();
    const deliveryId = await seedFailed(db);
    await db.patch(deliveryId, { status: "delivered" });
    expect(await replayDeliveryHandler(ctxOf(db), deliveryId as never)).toBe(
      false,
    );
  });
});

describe("pruneCommerceHistory", () => {
  it("removes old successes while preserving dead letters and their events", async () => {
    const db = new Db();
    const old = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const deliveredEvent = await db.insert("commerceEvents", {
      projectId: "projects_1",
      processedAt: old,
      prunableAt: Date.now() - 1,
    });
    const failedEvent = await db.insert("commerceEvents", {
      projectId: "projects_1",
      processedAt: old,
    });
    const unassignedEvent = await db.insert("commerceEvents", {
      projectId: "projects_1",
      processedAt: old,
    });
    await db.insert("outboundDeliveries", {
      eventId: deliveredEvent,
      status: "delivered",
      updatedAt: old,
    });
    await db.insert("outboundDeliveries", {
      eventId: failedEvent,
      status: "failed",
      updatedAt: old,
    });

    await expect(
      pruneCommerceHistoryHandler(ctxOf(db), 30 * 24 * 60 * 60 * 1000, 200),
    ).resolves.toEqual({ deletedDeliveries: 1, deletedEvents: 1 });
    expect(db.rows("outboundDeliveries")).toMatchObject([
      { eventId: failedEvent, status: "failed" },
    ]);
    expect(db.rows("commerceEvents")).toMatchObject([
      { _id: failedEvent },
      { _id: unassignedEvent },
    ]);
  });
});

describe("buildEventPayload", () => {
  const row = {
    _id: "commerceEvents_1",
    _creationTime: 0,
    projectId: "projects_1",
    eventType: "subscription.renewed",
    eventVersion: COMMERCE_EVENT_SCHEMA_VERSION,
    store: "apple",
    environment: "production",
    userId: "user_1",
    applicationId: "com.example.app",
    productId: "premium.monthly",
    previousProductId: "premium.weekly",
    transactionId: "txn_1",
    subscriptionId: "subscriptions_1",
    subscription: {
      state: "Active",
      productId: "premium.monthly",
      expiresAt: 2_000,
      renewsAt: 2_000,
      willRenew: true,
      storageOnly: "must-not-leak",
    },
    entitlementActive: true,
    currency: "USD",
    amountMicros: 9_990_000,
    amountProvenance: "store",
    sourceEventId: "webhookEvents_1",
    sourceStoreNotificationId: "notif-uuid-1",
    occurredAt: 1_000,
    processedAt: 1_500,
  } as never;

  it("emits exactly the published contract shape", () => {
    expect(buildEventPayload(row)).toEqual({
      eventId: "commerceEvents_1",
      eventType: "subscription.renewed",
      eventVersion: COMMERCE_EVENT_SCHEMA_VERSION,
      occurredAt: 1_000,
      processedAt: 1_500,
      store: "apple",
      environment: "production",
      projectId: "projects_1",
      userId: "user_1",
      applicationId: "com.example.app",
      productId: "premium.monthly",
      previousProductId: "premium.weekly",
      transactionId: "txn_1",
      subscription: {
        state: "Active",
        productId: "premium.monthly",
        expiresAt: 2_000,
        renewsAt: 2_000,
        willRenew: true,
        active: true,
      },
      price: {
        currency: "USD",
        amountMicros: 9_990_000,
        provenance: "store",
      },
      sourceStoreEventId: "notif-uuid-1",
    });
  });

  it("keeps internal identifiers off the wire", () => {
    const payload = buildEventPayload(row) as Record<string, unknown>;
    expect(payload.subscriptionId).toBeUndefined();
    expect(payload.sourceEventId).toBeUndefined();
    expect(payload.entitlementActive).toBeUndefined();
  });
});
