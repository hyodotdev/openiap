import { beforeEach, describe, expect, it } from "vitest";

import { savePurchaseInternal } from "./internal";
import { HarmonizedPurchaseState } from "./purchaseState";
import { readPurchaseStats } from "./stats";

/**
 * Regression guard for the dedup behavior that keeps IAPKit's
 * `purchases` table from double-counting. The production report from
 * Adam (the prior maintainer) — "3x more purchases in IAPKit than in
 * Google Play console" — was reproduced on Black Dust
 * (`com.actnone.blackdust`): 848 google rows, 848 distinct
 * `purchaseToken`s, but Play Console reported 197 orders. Google
 * reissues `purchaseToken` for the same logical order across
 * re-validations and state transitions, so primary dedup on
 * `purchaseToken` alone can't collapse them. `savePurchaseInternal`
 * now uses Google's stable `orderId` as a secondary dedup key when
 * the response surfaces one.
 *
 * These tests pin the contract:
 *
 *   - same (projectId, remoteId) is ALWAYS an upsert, never a second
 *     row. If this fails, re-validation inflates the purchase table.
 *   - stats.total moves only on the first insert, never on subsequent
 *     re-validations, regardless of whether state changes.
 *   - different remoteIds under the same project but SAME orderId
 *     collapse onto the first row (Google token reissue case).
 *   - different remoteIds under the same project with DIFFERENT
 *     orderIds ARE separate rows — the dedup must not merge distinct
 *     purchases.
 *   - different remoteIds with NO orderId in the response stay as
 *     separate rows (pre-acknowledgement responses have no orderId to
 *     correlate on).
 *   - orderId dedup is gated to `store === "google"`; Apple receipts
 *     go by the stable `originalTransactionId` already and must not
 *     be affected even if an `orderId` field sneaks into their
 *     payload.
 *   - a missing remoteId disables dedup (every call inserts). This
 *     mirrors current behavior and protects the failure-mode path.
 */

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

class MemQuery {
  constructor(private rows: Row[]) {}

  withIndex(_name: string, cb?: (q: IndexBuilder) => IndexBuilder): MemQuery {
    if (!cb) return this;
    const builder = new IndexBuilder();
    cb(builder);
    const filtered = this.rows.filter((row) =>
      builder.predicates.every((pred) => pred(row)),
    );
    return new MemQuery(filtered);
  }

  filter(_cb: unknown): MemQuery {
    void _cb;
    return this;
  }

  async first(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }

  async unique(): Promise<Row | null> {
    if (this.rows.length > 1) {
      throw new Error("unique() called on a query that returned > 1 row");
    }
    return this.rows[0] ?? null;
  }

  async collect(): Promise<Row[]> {
    return [...this.rows];
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Row> {
    for (const row of this.rows) {
      yield row;
    }
  }
}

class IndexBuilder {
  predicates: Array<(row: Row) => boolean> = [];
  eq(field: string, value: unknown): IndexBuilder {
    this.predicates.push((row) => row[field] === value);
    return this;
  }
}

class MemDb {
  tables = new Map<string, Map<string, Row>>();
  private counter = 0;

  private table(name: string): Map<string, Row> {
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

  async insert(
    tableName: string,
    doc: Record<string, unknown>,
  ): Promise<string> {
    const id = `${tableName}_${++this.counter}`;
    const row: Row = {
      ...doc,
      _id: id,
      _creationTime: Date.now(),
    };
    this.table(tableName).set(id, row);
    return id;
  }

  async get(id: string): Promise<Row | null> {
    for (const table of this.tables.values()) {
      const row = table.get(id);
      if (row) return row;
    }
    return null;
  }

  async patch(id: string, patch: Record<string, unknown>): Promise<void> {
    for (const table of this.tables.values()) {
      const row = table.get(id);
      if (row) {
        Object.assign(row, patch);
        return;
      }
    }
    throw new Error(`patch: no doc with id ${id}`);
  }

  async delete(id: string): Promise<void> {
    for (const table of this.tables.values()) {
      if (table.delete(id)) return;
    }
    throw new Error(`delete: no doc with id ${id}`);
  }

  // Helpers for test setup (not part of the ctx.db contract).
  seedOrg(id: string, doc: Record<string, unknown> = {}): string {
    this.table("organizations").set(id, {
      _id: id,
      _creationTime: Date.now(),
      name: "Test Org",
      slug: "test-org",
      monthlyRequestCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...doc,
    } as Row);
    return id;
  }

  seedProject(id: string, organizationId: string): string {
    this.table("projects").set(id, {
      _id: id,
      _creationTime: Date.now(),
      organizationId,
      name: "Test Project",
      slug: "test-project",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as Row);
    return id;
  }

  purchaseCount(): number {
    return this.tables.get("purchases")?.size ?? 0;
  }
}

function makeCtx(db: MemDb) {
  // `savePurchaseInternal` schedules the first-receipt mixpanel emit
  // via `ctx.scheduler.runAfter(...)`; stub it with a no-op async so
  // the unit tests don't need to reach into Convex's scheduler.
  const scheduler = {
    runAfter: async () => undefined,
  };
  return { db, scheduler } as unknown as Parameters<
    typeof savePurchaseInternal
  >[0]["ctx"];
}

const ORG_ID = "organizations_seed_1";
const PROJECT_ID = "projects_seed_1";
const TOKEN = "token_ABCDEF123";

const GOOGLE_REQUEST = {
  store: "google" as const,
  purchaseToken: TOKEN,
};

function buildArgs(overrides: {
  remoteId?: string;
  state?: HarmonizedPurchaseState;
  isValid?: boolean;
  remoteResponse?: string;
  store?: "apple" | "google" | "horizon";
  applicationId?: string;
  requestData?:
    | { store: "google"; purchaseToken: string }
    | { store: "apple"; jws: string }
    | { store: "horizon"; userId: string; sku: string };
}) {
  return {
    projectId: PROJECT_ID as never,
    store: overrides.store ?? ("google" as const),
    applicationId: overrides.applicationId ?? "com.test.app",
    remoteId: overrides.remoteId,
    requestData: (overrides.requestData ?? GOOGLE_REQUEST) as never,
    remoteResponse:
      overrides.remoteResponse ??
      // Intentionally NO orderId: mirrors the pending-acknowledgement
      // shape where Google hasn't assigned a stable identifier yet.
      // Tests that exercise orderId-based dedup pass an explicit
      // response with `orderId` set.
      JSON.stringify({
        productLineItem: [{ productId: "premium_monthly" }],
      }),
    state: overrides.state ?? HarmonizedPurchaseState.ENTITLED,
    isValid: overrides.isValid ?? true,
  };
}

describe("savePurchaseInternal — idempotency regression guard", () => {
  let db: MemDb;
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(() => {
    db = new MemDb();
    db.seedOrg(ORG_ID);
    db.seedProject(PROJECT_ID, ORG_ID);
    ctx = makeCtx(db);
  });

  it("same (projectId, remoteId) twice produces exactly one purchase row", async () => {
    await savePurchaseInternal({ ctx, ...buildArgs({ remoteId: TOKEN }) });
    await savePurchaseInternal({ ctx, ...buildArgs({ remoteId: TOKEN }) });

    expect(db.purchaseCount()).toBe(1);
  });

  it("re-validation with the same remoteId does NOT re-increment stats.total", async () => {
    await savePurchaseInternal({ ctx, ...buildArgs({ remoteId: TOKEN }) });

    const afterFirst = await readPurchaseStats(
      ctx as never,
      PROJECT_ID as never,
    );
    expect(afterFirst.total).toBe(1);
    expect(afterFirst.google).toBe(1);

    // Simulate a re-validation pass: same token, possibly changed state.
    await savePurchaseInternal({ ctx, ...buildArgs({ remoteId: TOKEN }) });
    await savePurchaseInternal({ ctx, ...buildArgs({ remoteId: TOKEN }) });

    const afterRepeat = await readPurchaseStats(
      ctx as never,
      PROJECT_ID as never,
    );
    expect(afterRepeat.total).toBe(1);
    expect(afterRepeat.google).toBe(1);
  });

  it("re-validation with a validity flip updates state without inserting a new row", async () => {
    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        remoteId: TOKEN,
        state: HarmonizedPurchaseState.ENTITLED,
        isValid: true,
      }),
    });

    // Flip to invalid (e.g. purchase was later revoked / refund).
    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        remoteId: TOKEN,
        state: HarmonizedPurchaseState.CANCELED,
        isValid: false,
      }),
    });

    expect(db.purchaseCount()).toBe(1);

    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    // Total stays at 1. Valid moves 1 → 0, invalid moves 0 → 1.
    expect(stats.total).toBe(1);
    expect(stats.valid).toBe(0);
    expect(stats.invalid).toBe(1);
  });

  it("different remoteIds under the same project produce distinct rows", async () => {
    await savePurchaseInternal({
      ctx,
      ...buildArgs({ remoteId: "token_AAA" }),
    });
    await savePurchaseInternal({
      ctx,
      ...buildArgs({ remoteId: "token_BBB" }),
    });

    expect(db.purchaseCount()).toBe(2);
    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(stats.total).toBe(2);
    expect(stats.google).toBe(2);
  });

  it("omitting remoteId disables dedup — every call inserts a new row", async () => {
    // The verification path currently always sets remoteId to the
    // purchaseToken, but the fallback path (no identifier at all)
    // should keep behaving as an append — critical for failure modes
    // that can't extract an identifier yet.
    await savePurchaseInternal({ ctx, ...buildArgs({ remoteId: undefined }) });
    await savePurchaseInternal({ ctx, ...buildArgs({ remoteId: undefined }) });

    expect(db.purchaseCount()).toBe(2);
  });

  it("two google receipts sharing an orderId collapse onto a single row even when purchaseToken changes", async () => {
    // Adam's 3x inflation on Black Dust came from Google reissuing
    // `purchaseToken` for the same logical order between
    // re-validations. Primary dedup by remoteId misses; the secondary
    // (projectId, applicationId, orderId) key is what collapses them.
    const response = JSON.stringify({
      kind: "androidpublisher#productPurchase",
      orderId: "GPA.3328-5001-2345-67890",
      acknowledgementState: "ACKNOWLEDGMENT_STATE_ACKNOWLEDGED",
      productLineItem: [{ productId: "dlc_mt_karnak" }],
    });

    await savePurchaseInternal({
      ctx,
      ...buildArgs({ remoteId: "token_initial", remoteResponse: response }),
    });
    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        remoteId: "token_after_reissue",
        remoteResponse: response,
      }),
    });

    expect(db.purchaseCount()).toBe(1);

    // The surviving row should carry the latest purchaseToken so a
    // future client replay hits the primary dedup branch instead of
    // landing back on the secondary one.
    const rows = await db.query("purchases").collect();
    expect(rows[0]?.remoteId).toBe("token_after_reissue");
    expect(rows[0]?.orderId).toBe("GPA.3328-5001-2345-67890");

    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(stats.total).toBe(1);
    expect(stats.google).toBe(1);
    // Distinct Play Console orders: exactly one, because the two
    // purchaseTokens collapsed onto the same orderId.
    expect(stats.googleOrders).toBe(1);
  });

  it("different orderIds under the same project stay as distinct rows", async () => {
    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        remoteId: "token_order_A",
        remoteResponse: JSON.stringify({
          orderId: "GPA.order-A",
          productLineItem: [{ productId: "dlc_mt_karnak" }],
        }),
      }),
    });
    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        remoteId: "token_order_B",
        remoteResponse: JSON.stringify({
          orderId: "GPA.order-B",
          productLineItem: [{ productId: "dlc_mt_karnak" }],
        }),
      }),
    });

    expect(db.purchaseCount()).toBe(2);
    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(stats.total).toBe(2);
    expect(stats.google).toBe(2);
    expect(stats.googleOrders).toBe(2);
  });

  it("pending-acknowledgement google responses (no orderId) still produce separate rows", async () => {
    // Regression guard: the majority of Black Dust's rows come from
    // Google responses that haven't been acknowledged yet and so have
    // no orderId. Those must fall through to insert exactly as they
    // did before the secondary dedup landed — otherwise two genuinely
    // different purchases with different tokens would collide on
    // "no orderId" and get merged.
    await savePurchaseInternal({
      ctx,
      ...buildArgs({ remoteId: "token_pending_1" }),
    });
    await savePurchaseInternal({
      ctx,
      ...buildArgs({ remoteId: "token_pending_2" }),
    });

    expect(db.purchaseCount()).toBe(2);

    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    // Two rows but no distinct orders yet — googleOrders stays at 0
    // until a later re-verify surfaces an orderId.
    expect(stats.google).toBe(2);
    expect(stats.googleOrders).toBe(0);
  });

  it("pre-ack row that later gains an orderId bumps googleOrders on the second verify", async () => {
    // Same purchaseToken, first call lands pre-ack (no orderId),
    // second call returns an orderId. Primary dedup hits on both
    // calls; the stats delta on the second call must move
    // googleOrders from 0 -> 1 even though no new row was inserted.
    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        remoteId: "token_same",
        state: HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT,
      }),
    });

    const beforeAck = await readPurchaseStats(
      ctx as never,
      PROJECT_ID as never,
    );
    expect(beforeAck.googleOrders).toBe(0);

    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        remoteId: "token_same",
        state: HarmonizedPurchaseState.ENTITLED,
        remoteResponse: JSON.stringify({
          kind: "androidpublisher#productPurchase",
          orderId: "GPA.newly-issued",
          acknowledgementState: "ACKNOWLEDGMENT_STATE_ACKNOWLEDGED",
          productLineItem: [{ productId: "premium_monthly" }],
        }),
      }),
    });

    expect(db.purchaseCount()).toBe(1);
    const afterAck = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(afterAck.google).toBe(1);
    expect(afterAck.googleOrders).toBe(1);
    expect(afterAck.total).toBe(1);
  });

  it("orderId secondary dedup does not apply to apple receipts", async () => {
    // Apple's `originalTransactionId` is the stable primary key and
    // is already used as `remoteId`. The orderId path must stay
    // Google-only — if it ever kicked in for apple, two apple
    // receipts from different devices that happen to share a field
    // Google would call `orderId` could silently merge.
    const sameResponse = JSON.stringify({
      productId: "pro_monthly",
      orderId: "GPA.spurious-order-id-in-apple-payload",
    });

    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        store: "apple",
        requestData: { store: "apple", jws: "JWS_A" },
        remoteId: "original_txn_A",
        remoteResponse: sameResponse,
      }),
    });
    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        store: "apple",
        requestData: { store: "apple", jws: "JWS_B" },
        remoteId: "original_txn_B",
        remoteResponse: sameResponse,
      }),
    });

    expect(db.purchaseCount()).toBe(2);
  });

  it("re-verify returning an error body (no orderId) preserves googleOrders on an already-acked row", async () => {
    // persistFailedGoogleReceipt stores a `{ errorCode, ... }` envelope
    // when Google returns 4xx on a re-verify. The stored `orderId`
    // column is intentionally preserved (patch only writes orderId
    // when a new one is present), so `googleOrders` — the distinct-
    // orderId counter — must stay put too.
    const ackResponse = JSON.stringify({
      kind: "androidpublisher#productPurchase",
      orderId: "GPA.order-stable",
      acknowledgementState: "ACKNOWLEDGMENT_STATE_ACKNOWLEDGED",
      productLineItem: [{ productId: "premium_monthly" }],
    });

    await savePurchaseInternal({
      ctx,
      ...buildArgs({ remoteId: TOKEN, remoteResponse: ackResponse }),
    });

    const beforeError = await readPurchaseStats(
      ctx as never,
      PROJECT_ID as never,
    );
    expect(beforeError.googleOrders).toBe(1);

    // A later re-verify gets a transient Google failure — we persist
    // an error body that carries no orderId. The patch leaves the
    // stored orderId untouched on disk.
    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        remoteId: TOKEN,
        state: HarmonizedPurchaseState.INAUTHENTIC,
        isValid: false,
        remoteResponse: JSON.stringify({
          errorCode: "PLAYSTORE_PURCHASE_VERIFICATION_FAILED",
          message: "Google returned 500",
        }),
      }),
    });

    const rows = await db.query("purchases").collect();
    expect(rows[0]?.orderId).toBe("GPA.order-stable");

    const afterError = await readPurchaseStats(
      ctx as never,
      PROJECT_ID as never,
    );
    // googleOrders must stay at 1: the distinct orderId on this row
    // is still present in the database, just not in the latest
    // response payload.
    expect(afterError.googleOrders).toBe(1);
  });

  it("primary dedup resolves orderId conflicts — late pre-ack→ack patch cannot create two rows with the same orderId", async () => {
    // Narrow race: a pre-ack row exists under token_initial (no
    // orderId). An ack row for the same logical order already landed
    // under token_reissue (orderId=O1). Now a delayed client replay
    // with token_initial comes back and Google still resolves it with
    // orderId=O1. Primary dedup would patch the pre-ack row to
    // orderId=O1 — without the conflict guard this leaves TWO rows
    // both claiming O1 and breaks the per-orderId invariant.
    const ackResponse = JSON.stringify({
      kind: "androidpublisher#productPurchase",
      orderId: "GPA.only-one-logical-order",
      acknowledgementState: "ACKNOWLEDGMENT_STATE_ACKNOWLEDGED",
      productLineItem: [{ productId: "premium_monthly" }],
    });

    // Step 1: pre-ack row on token_initial (no orderId)
    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        remoteId: "token_initial",
        state: HarmonizedPurchaseState.PENDING_ACKNOWLEDGMENT,
      }),
    });
    // Step 2: ack row on token_reissue carrying the orderId
    await savePurchaseInternal({
      ctx,
      ...buildArgs({ remoteId: "token_reissue", remoteResponse: ackResponse }),
    });
    expect(db.purchaseCount()).toBe(2);

    // Step 3: delayed replay with token_initial returns orderId=O1
    await savePurchaseInternal({
      ctx,
      ...buildArgs({ remoteId: "token_initial", remoteResponse: ackResponse }),
    });

    // The pre-existing ack row under token_reissue was collapsed into
    // the primary-dedup survivor (token_initial) — one row, one
    // orderId, googleOrders stays at 1 instead of drifting to 2.
    expect(db.purchaseCount()).toBe(1);
    const rows = await db.query("purchases").collect();
    expect(rows[0]?.remoteId).toBe("token_initial");
    expect(rows[0]?.orderId).toBe("GPA.only-one-logical-order");

    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(stats.google).toBe(1);
    expect(stats.googleOrders).toBe(1);
    expect(stats.total).toBe(1);
  });

  it("orderId dedup scopes by applicationId — same orderId under different apps do not collide", async () => {
    // applicationId is packageName for Google. Two different apps
    // owned by the same project config would be a misconfiguration,
    // but if it ever happens the secondary key must not cross that
    // boundary.
    const response = (orderId: string) =>
      JSON.stringify({
        orderId,
        productLineItem: [{ productId: "pro_monthly" }],
      });

    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        applicationId: "com.app.one",
        remoteId: "token_app_one",
        remoteResponse: response("GPA.same-order-id"),
      }),
    });
    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        applicationId: "com.app.two",
        remoteId: "token_app_two",
        remoteResponse: response("GPA.same-order-id"),
      }),
    });

    expect(db.purchaseCount()).toBe(2);
  });

  it("failed verify + successful re-verify under same remoteId yields one row with the final state", async () => {
    // Simulates: transient Google 5xx → persistFailedGoogleReceipt
    // saves INAUTHENTIC; retry succeeds → success path patches the
    // same row back to ENTITLED. Stats must not double-count.
    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        remoteId: TOKEN,
        state: HarmonizedPurchaseState.INAUTHENTIC,
        isValid: false,
      }),
    });
    await savePurchaseInternal({
      ctx,
      ...buildArgs({
        remoteId: TOKEN,
        state: HarmonizedPurchaseState.ENTITLED,
        isValid: true,
      }),
    });

    expect(db.purchaseCount()).toBe(1);

    const rows = await db.query("purchases").collect();
    expect(rows[0]?.state).toBe(HarmonizedPurchaseState.ENTITLED);
    expect(rows[0]?.isValid).toBe(true);

    const stats = await readPurchaseStats(ctx as never, PROJECT_ID as never);
    expect(stats.total).toBe(1);
    expect(stats.valid).toBe(1);
    expect(stats.invalid).toBe(0);
  });
});
