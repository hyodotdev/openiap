import { describe, expect, test } from "vitest";

import { testableFunction } from "../test.setup";
import {
  applyAmazonReconciliationVerdict,
  claimAmazonPurchasesForReconciliation,
  rescheduleAmazonPurchaseReconciliation,
} from "./internal";
import { HarmonizedPurchaseState } from "./purchaseState";
import { AMAZON_RECONCILE_LEASE_MS, AMAZON_RECONCILE_RETRY_MS } from "./shared";

type Row = Record<string, unknown> & { _id: string };

class IndexBuilder {
  readonly predicates: Array<(row: Row) => boolean> = [];

  eq(field: string, value: unknown): IndexBuilder {
    this.predicates.push((row) => row[field] === value);
    return this;
  }

  lte(field: string, value: number): IndexBuilder {
    this.predicates.push((row) => {
      const candidate = row[field];
      // Convex indexes optional fields before defined values, so legacy rows
      // without a schedule are included in a numeric upper-bound scan.
      return (
        candidate === undefined ||
        (typeof candidate === "number" && candidate <= value)
      );
    });
    return this;
  }
}

class MemQuery {
  constructor(private rows: Row[]) {}

  withIndex(
    _name: string,
    build: (builder: IndexBuilder) => IndexBuilder,
  ): MemQuery {
    const builder = build(new IndexBuilder());
    return new MemQuery(
      this.rows.filter((row) =>
        builder.predicates.every((predicate) => predicate(row)),
      ),
    );
  }

  order(direction: "asc" | "desc"): MemQuery {
    return new MemQuery(
      [...this.rows].sort((left, right) => {
        const leftAt = left.nextAmazonReconcileAt;
        const rightAt = right.nextAmazonReconcileAt;
        const comparison =
          (typeof leftAt === "number" ? leftAt : -Infinity) -
          (typeof rightAt === "number" ? rightAt : -Infinity);
        return direction === "asc" ? comparison : -comparison;
      }),
    );
  }

  async take(limit: number): Promise<Row[]> {
    return this.rows.slice(0, limit);
  }

  async first(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }
}

describe("MemQuery", () => {
  test("orders optional schedule values in either direction", async () => {
    const query = new MemQuery([
      { _id: "missing" },
      { _id: "earlier", nextAmazonReconcileAt: 100 },
      { _id: "later", nextAmazonReconcileAt: 200 },
    ]);

    await expect(query.order("asc").take(3)).resolves.toEqual([
      { _id: "missing" },
      { _id: "earlier", nextAmazonReconcileAt: 100 },
      { _id: "later", nextAmazonReconcileAt: 200 },
    ]);
    await expect(query.order("desc").take(3)).resolves.toEqual([
      { _id: "later", nextAmazonReconcileAt: 200 },
      { _id: "earlier", nextAmazonReconcileAt: 100 },
      { _id: "missing" },
    ]);
  });
});

class MemDb {
  readonly rows = new Map<string, Row>();
  private insertCounter = 0;

  query(table: string): MemQuery {
    return new MemQuery(
      [...this.rows.values()].filter((row) => row._table === table),
    );
  }

  async get(id: string): Promise<Row | null> {
    return this.rows.get(id) ?? null;
  }

  async patch(id: string, patch: Record<string, unknown>): Promise<void> {
    const row = this.rows.get(id);
    if (!row) throw new Error(`missing row ${id}`);
    Object.assign(row, patch);
  }

  async insert(
    table: string,
    fields: Record<string, unknown>,
  ): Promise<string> {
    const id = `${table}_${++this.insertCounter}`;
    this.seed(id, table, fields);
    return id;
  }

  seed(id: string, table: string, fields: Record<string, unknown>): void {
    this.rows.set(id, { _id: id, _table: table, ...fields });
  }
}

function amazonRequest(sandbox = false) {
  return {
    store: "amazon" as const,
    userId: "amzn1.account.test",
    receiptId: "amzn1.receipt.test",
    sandbox,
  };
}

describe("claimAmazonPurchasesForReconciliation", () => {
  test("atomically leases only due active Amazon rows, including legacy rows", async () => {
    const db = new MemDb();
    db.seed("projects_1", "projects", {
      amazonSandboxEnabled: true,
      amazonSharedSecret: "secret",
    });
    db.seed("purchases_legacy", "purchases", {
      projectId: "projects_1",
      store: "amazon",
      applicationId: "com.example.amazon",
      remoteId: "production:legacy",
      requestData: amazonRequest(),
      state: HarmonizedPurchaseState.ENTITLED,
      isValid: true,
    });
    db.seed("purchases_due", "purchases", {
      projectId: "projects_1",
      store: "amazon",
      applicationId: "com.example.amazon",
      remoteId: "sandbox:due",
      requestData: amazonRequest(true),
      state: HarmonizedPurchaseState.READY_TO_CONSUME,
      isValid: true,
      nextAmazonReconcileAt: 900,
    });
    db.seed("purchases_future", "purchases", {
      projectId: "projects_1",
      store: "amazon",
      applicationId: "com.example.amazon",
      remoteId: "production:future",
      requestData: amazonRequest(),
      state: HarmonizedPurchaseState.ENTITLED,
      isValid: true,
      nextAmazonReconcileAt: 2_000,
    });
    db.seed("purchases_invalid", "purchases", {
      projectId: "projects_1",
      store: "amazon",
      applicationId: "com.example.amazon",
      remoteId: "production:invalid",
      requestData: amazonRequest(),
      state: HarmonizedPurchaseState.CANCELED,
      isValid: false,
      nextAmazonReconcileAt: 800,
    });
    db.seed("purchases_google", "purchases", {
      projectId: "projects_1",
      store: "google",
      applicationId: "com.example.google",
      remoteId: "google-token",
      requestData: { store: "google", purchaseToken: "token" },
      state: HarmonizedPurchaseState.ENTITLED,
      isValid: true,
      nextAmazonReconcileAt: 700,
    });

    const handler = testableFunction(
      claimAmazonPurchasesForReconciliation,
    )._handler;
    const first = await handler({ db }, { now: 1_000, limit: 20 });
    expect(first.map((row) => row.purchaseId)).toEqual([
      "purchases_legacy",
      "purchases_due",
    ]);
    expect(first[1]).toMatchObject({
      amazonSandboxEnabled: true,
      amazonSharedSecret: "secret",
      leaseUntil: 1_000 + AMAZON_RECONCILE_LEASE_MS,
    });
    expect(db.rows.get("purchases_legacy")?.nextAmazonReconcileAt).toBe(
      1_000 + AMAZON_RECONCILE_LEASE_MS,
    );

    const overlapping = await handler(
      { db },
      {
        now: 1_000,
        limit: 20,
      },
    );
    expect(overlapping).toEqual([]);
  });

  test("defers unusable due rows for the retry interval", async () => {
    const db = new MemDb();
    db.seed("purchases_missing_project", "purchases", {
      projectId: "projects_missing",
      store: "amazon",
      applicationId: "com.example.amazon",
      remoteId: "production:missing-project",
      requestData: amazonRequest(),
      state: HarmonizedPurchaseState.ENTITLED,
      isValid: true,
      nextAmazonReconcileAt: 900,
    });

    const handler = testableFunction(
      claimAmazonPurchasesForReconciliation,
    )._handler;
    await expect(handler({ db }, { now: 1_000, limit: 20 })).resolves.toEqual(
      [],
    );
    expect(
      db.rows.get("purchases_missing_project")?.nextAmazonReconcileAt,
    ).toBe(1_000 + AMAZON_RECONCILE_RETRY_MS);
  });
});

describe("Amazon reconciliation compare-and-set mutations", () => {
  test("reschedules only the worker that still owns the lease", async () => {
    const db = new MemDb();
    db.seed("purchases_due", "purchases", {
      store: "amazon",
      isValid: true,
      nextAmazonReconcileAt: 10_000,
    });
    const handler = testableFunction(
      rescheduleAmazonPurchaseReconciliation,
    )._handler;

    await expect(
      handler(
        { db },
        {
          purchaseId: "purchases_due" as never,
          claimedLeaseUntil: 9_000,
          retryAt: 20_000,
        },
      ),
    ).resolves.toBe(false);
    expect(db.rows.get("purchases_due")?.nextAmazonReconcileAt).toBe(10_000);

    await expect(
      handler(
        { db },
        {
          purchaseId: "purchases_due" as never,
          claimedLeaseUntil: 10_000,
          retryAt: 20_000,
        },
      ),
    ).resolves.toBe(true);
    expect(db.rows.get("purchases_due")?.nextAmazonReconcileAt).toBe(20_000);
  });

  test("does not apply a stale verdict after foreground verify or deletion", async () => {
    const db = new MemDb();
    db.seed("purchases_due", "purchases", {
      projectId: "projects_1",
      store: "amazon",
      applicationId: "com.example.amazon",
      remoteId: "production:due",
      requestData: amazonRequest(),
      state: HarmonizedPurchaseState.ENTITLED,
      isValid: true,
      // Foreground verification has already replaced the worker's 10_000
      // lease with a fresh 48-hour schedule.
      nextAmazonReconcileAt: 99_000,
    });
    const handler = testableFunction(applyAmazonReconciliationVerdict)._handler;
    const args = {
      purchaseId: "purchases_due" as never,
      claimedLeaseUntil: 10_000,
      remoteResponse: JSON.stringify({
        productId: "premium.monthly",
        productType: "SUBSCRIPTION",
      }),
      state: HarmonizedPurchaseState.CANCELED,
    };

    await expect(handler({ db }, args)).resolves.toBe(false);
    expect(db.rows.get("purchases_due")?.state).toBe(
      HarmonizedPurchaseState.ENTITLED,
    );

    db.rows.delete("purchases_due");
    await expect(handler({ db }, args)).resolves.toBe(false);
    expect(db.rows.has("purchases_due")).toBe(false);
  });

  test("applies an owned deterministic verdict and flips validity atomically", async () => {
    const db = new MemDb();
    db.seed("organizations_1", "organizations", {
      pendingDeletion: false,
    });
    db.seed("projects_1", "projects", {
      organizationId: "organizations_1",
      pendingDeletion: false,
    });
    db.seed("purchaseStats_1", "purchaseStats", {
      projectId: "projects_1",
      organizationId: "organizations_1",
      total: 1,
      apple: 0,
      google: 0,
      googleOrders: 0,
      valid: 1,
      invalid: 0,
      updatedAt: 1,
    });
    db.seed("purchases_due", "purchases", {
      projectId: "projects_1",
      store: "amazon",
      applicationId: "com.example.amazon",
      remoteId: "production:due",
      requestData: amazonRequest(),
      remoteResponse: JSON.stringify({
        productId: "premium.monthly",
        productType: "SUBSCRIPTION",
      }),
      state: HarmonizedPurchaseState.ENTITLED,
      isValid: true,
      statsCounted: true,
      nextAmazonReconcileAt: 10_000,
    });
    const handler = testableFunction(applyAmazonReconciliationVerdict)._handler;

    await expect(
      handler(
        {
          db,
          scheduler: { runAfter: async () => undefined },
        },
        {
          purchaseId: "purchases_due" as never,
          claimedLeaseUntil: 10_000,
          remoteResponse: JSON.stringify({
            error: "AMAZON_RECEIPT_INVALID",
            details: { status: 410 },
          }),
          state: HarmonizedPurchaseState.CANCELED,
        },
      ),
    ).resolves.toBe(true);

    expect(db.rows.get("purchases_due")).toMatchObject({
      state: HarmonizedPurchaseState.CANCELED,
      isValid: false,
      environment: "Production",
    });
    expect(db.rows.get("purchaseStats_1")).toMatchObject({
      valid: 0,
      invalid: 1,
    });
  });
});
