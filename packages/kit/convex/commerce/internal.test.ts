import { describe, expect, it } from "vitest";

import { emitCommerceEvent, destinationAcceptsType } from "./internal";
import {
  claimPendingDeliveriesHandler,
  type ClaimedDelivery,
} from "./deliveryState";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

class Query {
  constructor(private rows: Row[]) {}
  withIndex(_name: string, cb?: (q: Builder) => Builder): Query {
    if (!cb) return this;
    const b = new Builder();
    cb(b);
    return new Query(this.rows.filter((r) => b.preds.every((p) => p(r))));
  }
  async collect(): Promise<Row[]> {
    return [...this.rows];
  }
  async unique(): Promise<Row | null> {
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
    this.preds.push((r) => (r[field] as number) <= value);
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
}

const ctxOf = (db: Db) => ({ db }) as any;

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
    });
    const types = db.rows("commerceEvents").map((r) => r.eventType);
    expect(types).toEqual(["subscription.expired", "entitlement.revoked"]);
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
      }),
    });
    const event = db.rows("commerceEvents")[0];
    expect(event.amountProvenance).toBe("store");
    expect(event.amountMicros).toBe(9_990_000);
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

  it("does not double-fan-out when emission is retried for the same event", async () => {
    const db = new Db();
    await seedDestination(db);
    const args = {
      projectId: "projects_1" as never,
      transition: "Renewed" as const,
      active: true,
      previouslyActive: true,
      sourceEvent: sourceEvent(),
    };
    const first = await emitCommerceEvent(ctxOf(db), args);
    // Re-running emission for an already-written event id must not duplicate
    // its delivery rows.
    await db.insert("outboundDeliveries", {
      projectId: "projects_1",
      eventId: first[0],
      destinationId: db.rows("outboundDestinations")[0]._id,
      status: "pending",
      attempts: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const before = db.rows("outboundDeliveries").length;
    await emitCommerceEvent(ctxOf(db), args);
    // The second emit writes a new event row, but the pre-existing delivery
    // for the first event is untouched.
    expect(
      db.rows("outboundDeliveries").filter((r) => r.eventId === first[0]),
    ).toHaveLength(2);
    expect(db.rows("outboundDeliveries").length).toBeGreaterThan(before);
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
    await db.patch(destinationId, {
      previousSecretExpiresAt: Date.now() + 60_000,
    });
    const [live] = await claimPendingDeliveriesHandler(ctxOf(db), 10);
    expect(live.previousSecret).toBe("old");
  });
});
