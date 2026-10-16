import { afterEach, describe, expect, test, vi } from "vitest";
import Ajv from "ajv/dist/2020.js";
import {
  commerceEventSchema,
  primitivesSchema,
} from "@hyodotdev/openiap-commerce-protocol";

import { testableFunction } from "../test.setup";
import {
  saveAmazonVerdictHandler,
  applyAmazonRtnVerdictHandler,
  applyAmazonReconciliationVerdict,
  claimAmazonPurchasesForReconciliation,
  rescheduleAmazonPurchaseReconciliation,
  boundPurchasesForUser,
} from "./internal";
import {
  bindSubscriptionToUserHandler,
  rebindSubscriptionToUserHandler,
} from "../subscriptions/internal";
import { bindUser } from "../subscriptions/mutation";
import { MAX_BOUND_PURCHASES_PER_USER } from "../subscriptions/limits";
import { amazonSubscriptionToken } from "../subscriptions/amazon";
import { buildEventPayload } from "../commerce/deliveryState";
import { HarmonizedPurchaseState } from "./purchaseState";
import { markReceiptInvalid } from "./mutation";
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

  filter(
    build: (query: {
      field: (name: string) => string;
      eq: (field: string, value: unknown) => (row: Row) => boolean;
    }) => (row: Row) => boolean,
  ): MemQuery {
    return new MemQuery(
      this.rows.filter(
        build({
          field: (name) => name,
          eq: (field, value) => (row) => row[field] === value,
        }),
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

  async unique(): Promise<Row | null> {
    if (this.rows.length > 1) throw new Error("duplicate rows");
    return this.rows[0] ?? null;
  }

  async collect(): Promise<Row[]> {
    return [...this.rows];
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
    this.rows.set(id, {
      _id: id,
      _creationTime: Date.now(),
      _table: table,
      ...fields,
    });
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

afterEach(() => vi.useRealTimers());

describe("Amazon canonical lifecycle", () => {
  function setup() {
    vi.useFakeTimers({ now: 100_000 });
    const db = new MemDb();
    db.seed("organizations_test", "organizations", {});
    db.seed("projects_test", "projects", {
      organizationId: "organizations_test",
    });
    const ctx = { db, scheduler: { runAfter: vi.fn() } } as never;
    return { db, ctx };
  }

  function verdict(
    sequence: number,
    receipt: Record<string, unknown> = {},
    valid = true,
  ) {
    return {
      projectId: "projects_test",
      applicationId: "dev.hyo.martie",
      remoteId: "production:user:receipt",
      requestData: {
        store: "amazon",
        userId: "user",
        receiptId: "receipt",
        sandbox: false,
      },
      state: valid
        ? HarmonizedPurchaseState.ENTITLED
        : HarmonizedPurchaseState.CANCELED,
      environment: "Sandbox",
      amazonRvsSequence: sequence,
      remoteResponse: JSON.stringify({
        receiptId: "receipt",
        productId: "premium",
        productType: "SUBSCRIPTION",
        cancelDate: valid ? null : 99_000,
        renewalDate: 90_000,
        autoRenewing: true,
        ...receipt,
      }),
    } as Parameters<typeof saveAmazonVerdictHandler>[1];
  }

  const rows = (db: MemDb, table: string) =>
    [...db.rows.values()].filter((row) => row._table === table);

  const ajv = new Ajv({ strict: true, allErrors: true });
  ajv.addSchema(primitivesSchema, "primitives.schema.json");
  const validateEvent = ajv.compile(commerceEventSchema);

  function expectValidEvents(db: MemDb): void {
    for (const row of rows(db, "commerceEvents")) {
      expect(
        validateEvent(buildEventPayload(row as never)),
        JSON.stringify(validateEvent.errors),
      ).toBe(true);
    }
  }

  test("renewalDate is not expiry, auto-renew off keeps access, and a verified cancellation revokes once", async () => {
    const { db, ctx } = setup();
    await saveAmazonVerdictHandler(ctx, verdict(1));
    const sub = rows(db, "subscriptions")[0];
    expect(sub).toMatchObject({
      store: "amazon",
      state: "Active",
      renewsAt: 90_000,
    });
    expect(sub.expiresAt).toBeUndefined();
    await bindSubscriptionToUserHandler(ctx, {
      projectId: "projects_test" as never,
      purchaseToken: amazonSubscriptionToken("production:user:receipt"),
      userId: "app-user",
    });
    await saveAmazonVerdictHandler(ctx, verdict(2, { autoRenewing: false }));
    expect(rows(db, "subscriptions")[0]).toMatchObject({
      state: "Active",
      willRenew: false,
    });
    expect(
      rows(db, "commerceEvents").filter(
        (row) => row.eventType === "entitlement.revoked",
      ),
    ).toHaveLength(0);
    await saveAmazonVerdictHandler(ctx, verdict(3, { cancelReason: 1 }, false));
    await saveAmazonVerdictHandler(ctx, verdict(4, { cancelReason: 1 }, false));
    expect(rows(db, "subscriptions")[0].state).toBe("Revoked");
    expect(
      rows(db, "commerceEvents").filter(
        (row) => row.eventType === "entitlement.revoked",
      ),
    ).toHaveLength(1);
    expect(
      rows(db, "commerceEvents").every((row) => row.store === "amazon"),
    ).toBe(true);
    expect(
      rows(db, "commerceEvents").every((row) => row.amountMicros === undefined),
    ).toBe(true);
  });

  test("a delayed earlier verdict cannot restore a revoked purchase or subscription", async () => {
    const { db, ctx } = setup();
    await saveAmazonVerdictHandler(ctx, verdict(1));
    await saveAmazonVerdictHandler(ctx, verdict(3, { cancelReason: 2 }, false));
    const before = rows(db, "commerceEvents").length;
    expect(await saveAmazonVerdictHandler(ctx, verdict(2))).toMatchObject({
      isValid: false,
      state: "CANCELED",
    });
    expect(rows(db, "subscriptions")[0].state).toBe("Revoked");
    expect(rows(db, "commerceEvents")).toHaveLength(before);
  });

  test.each([undefined, null, 0, 99])(
    "RVS expiry with cancelReason %s emits expiry once before a later RTN",
    async (cancelReason) => {
      const { db, ctx } = setup();
      await saveAmazonVerdictHandler(ctx, verdict(1));
      await saveAmazonVerdictHandler(ctx, verdict(2, { cancelReason }, false));
      await saveAmazonVerdictHandler(ctx, verdict(3, { cancelReason }, false));
      await applyAmazonRtnVerdictHandler(ctx, {
        ...verdict(4, { cancelReason }, false),
        amazonNotice: {
          messageId: "sns-expiry-after-rvs",
          notificationType: "SUBSCRIPTION_EXPIRED",
          occurredAt: 100_000,
          rawSignedPayload: "signed-fixture",
        },
      });
      expect(rows(db, "subscriptions")[0].state).toBe("Expired");
      expect(
        rows(db, "commerceEvents").filter(
          (row) => row.eventType === "subscription.expired",
        ),
      ).toHaveLength(1);
      expect(
        rows(db, "commerceEvents").some(
          (row) => row.eventType === "subscription.revoked",
        ),
      ).toBe(false);
    },
  );

  test.each([undefined, null, 0, 1, 2])(
    "an ended receipt first observed by RVS with cancelReason %s records no historical transition",
    async (cancelReason) => {
      const { db, ctx } = setup();
      await saveAmazonVerdictHandler(ctx, verdict(1, { cancelReason }, false));
      expect(rows(db, "subscriptions")[0].state).toBe(
        cancelReason === 1 || cancelReason === 2 ? "Revoked" : "Expired",
      );
      expect(rows(db, "webhookEvents")).toMatchObject([
        { type: "ReceiptRechecked" },
      ]);
      expect(rows(db, "commerceEvents")).toHaveLength(0);
    },
  );

  test("an invalid receipt without an RVS body revokes previously active access", async () => {
    const { db, ctx } = setup();
    await saveAmazonVerdictHandler(ctx, verdict(1));
    await saveAmazonVerdictHandler(ctx, {
      ...verdict(2, {}, false),
      remoteResponse: "null",
    });
    expect(rows(db, "subscriptions")[0].state).toBe("Revoked");
    expect(rows(db, "commerceEvents")).toMatchObject([
      { eventType: "subscription.started" },
      { eventType: "subscription.revoked" },
    ]);
  });

  test("an explicit cancellation notice preserves revocation when the reason is unavailable", async () => {
    const { db, ctx } = setup();
    await applyAmazonRtnVerdictHandler(ctx, {
      ...verdict(1, { cancelReason: 0 }, false),
      amazonNotice: {
        messageId: "sns-cancel-first",
        notificationType: "SUBSCRIPTION_CANCELLED",
        occurredAt: 100_000,
        rawSignedPayload: "signed-fixture",
      },
    });
    expect(rows(db, "subscriptions")[0].state).toBe("Revoked");
    expect(rows(db, "commerceEvents")).toMatchObject([
      { eventType: "subscription.revoked" },
    ]);
  });

  test("an unknown notification does not invent a first-observed historical expiry", async () => {
    const { db, ctx } = setup();
    await applyAmazonRtnVerdictHandler(ctx, {
      ...verdict(1, {}, false),
      amazonNotice: {
        messageId: "sns-unknown-first",
        notificationType: "FUTURE_NOTIFICATION",
        occurredAt: 100_000,
        rawSignedPayload: "signed-fixture",
      },
    });
    expect(rows(db, "subscriptions")[0].state).toBe("Expired");
    expect(rows(db, "webhookEvents")).toMatchObject([
      { type: "ReceiptRechecked" },
    ]);
    expect(rows(db, "commerceEvents")).toHaveLength(0);
  });

  test.each([
    ["SUBSCRIPTION_CANCELLED", 0, "Revoked"],
    ["SUBSCRIPTION_EXPIRED", 1, "Expired"],
    ["SUBSCRIPTION_EXPIRED", 2, "Expired"],
  ] as const)(
    "%s terminal state survives later RVS-only checks with reason %s",
    async (notificationType, cancelReason, state) => {
      const { db, ctx } = setup();
      await saveAmazonVerdictHandler(ctx, verdict(1));
      await applyAmazonRtnVerdictHandler(ctx, {
        ...verdict(2, { cancelReason }, false),
        amazonNotice: {
          messageId: "sns-terminal",
          notificationType,
          occurredAt: 100_000,
          rawSignedPayload: "signed-fixture",
        },
      });
      const eventType =
        state === "Expired" ? "subscription.expired" : "subscription.revoked";
      expect(
        rows(db, "commerceEvents").filter((row) => row.eventType === eventType),
      ).toHaveLength(1);
      expect(
        rows(db, "commerceEvents").filter(
          (row) =>
            row.eventType === "subscription.expired" ||
            row.eventType === "subscription.revoked",
        ),
      ).toHaveLength(1);
      const before = rows(db, "commerceEvents").length;
      await saveAmazonVerdictHandler(ctx, verdict(3, { cancelReason }, false));
      expect(rows(db, "subscriptions")[0].state).toBe(state);
      expect(rows(db, "commerceEvents")).toHaveLength(before);
      await saveAmazonVerdictHandler(ctx, verdict(4));
      expect(rows(db, "subscriptions")[0].state).toBe("Active");
      expectValidEvents(db);
    },
  );

  test("a fresh terminal notice corrects the prior RVS cause without revoking access twice", async () => {
    const { db, ctx } = setup();
    await saveAmazonVerdictHandler(ctx, verdict(1));
    await bindSubscriptionToUserHandler(ctx, {
      projectId: "projects_test" as never,
      purchaseToken: amazonSubscriptionToken("production:user:receipt"),
      userId: "app-user",
    });
    await saveAmazonVerdictHandler(ctx, verdict(2, {}, false));
    const args = {
      ...verdict(3, { cancelReason: 0 }, false),
      amazonNotice: {
        messageId: "sns-corrected-terminal",
        notificationType: "SUBSCRIPTION_CANCELLED",
        occurredAt: 100_000,
        rawSignedPayload: "signed-fixture",
      },
    };
    await applyAmazonRtnVerdictHandler(ctx, args);
    await applyAmazonRtnVerdictHandler(ctx, args);
    expect(rows(db, "subscriptions")[0].state).toBe("Revoked");
    for (const type of [
      "subscription.expired",
      "subscription.revoked",
      "entitlement.revoked",
    ])
      expect(
        rows(db, "commerceEvents").filter((row) => row.eventType === type),
      ).toHaveLength(1);
    expectValidEvents(db);
  });

  test.each(["first", "recovered", "renewal", "extended"] as const)(
    "%s observation in grace emits a schema-valid snapshot",
    async (observation) => {
      const { db, ctx } = setup();
      if (observation === "recovered") {
        await saveAmazonVerdictHandler(ctx, verdict(1));
        await saveAmazonVerdictHandler(ctx, verdict(2, {}, false));
      }
      if (observation === "renewal" || observation === "extended")
        await saveAmazonVerdictHandler(
          ctx,
          verdict(1, { gracePeriodEndDate: 110_000 }),
        );
      if (observation === "extended") {
        vi.setSystemTime(120_000);
        await db.patch(rows(db, "subscriptions")[0]._id, {
          updatedAt: 120_000,
        });
      }
      await applyAmazonRtnVerdictHandler(ctx, {
        ...verdict(3, {
          gracePeriodEndDate: observation === "extended" ? 130_000 : 110_000,
        }),
        amazonNotice: {
          messageId: "sns-grace-observation",
          notificationType: "SUBSCRIPTION_RENEWED",
          occurredAt: observation === "extended" ? 120_000 : 100_000,
          rawSignedPayload: "signed-fixture",
        },
      });
      expect(rows(db, "subscriptions")[0].state).toBe("InGracePeriod");
      expect(
        rows(db, "commerceEvents").filter(
          (row) => row.eventType === "subscription.entered_grace_period",
        ),
      ).toHaveLength(observation === "extended" ? 2 : 1);
      expectValidEvents(db);
    },
  );

  test("grace deadline and fresh RVS recovery produce the correct access delta", async () => {
    const { db, ctx } = setup();
    await saveAmazonVerdictHandler(
      ctx,
      verdict(1, { gracePeriodEndDate: 110_000 }),
    );
    await bindSubscriptionToUserHandler(ctx, {
      projectId: "projects_test" as never,
      purchaseToken: amazonSubscriptionToken("production:user:receipt"),
      userId: "app-user",
    });
    vi.setSystemTime(120_000);
    await saveAmazonVerdictHandler(ctx, verdict(2, {}, false));
    expect(
      rows(db, "commerceEvents").some(
        (row) => row.eventType === "entitlement.revoked",
      ),
    ).toBe(true);
    await saveAmazonVerdictHandler(ctx, verdict(3));
    expect(rows(db, "subscriptions")[0]).toMatchObject({
      state: "Active",
      expiresAt: undefined,
    });
    expect(
      rows(db, "commerceEvents").filter(
        (row) => row.eventType === "entitlement.granted",
      ),
    ).toHaveLength(2);
  });

  test("SNS renewal and expiry are idempotent and include Amazon store provenance", async () => {
    const { db, ctx } = setup();
    await saveAmazonVerdictHandler(ctx, verdict(1));
    const notice = {
      messageId: "sns-renew",
      notificationType: "SUBSCRIPTION_RENEWED",
      occurredAt: 100_000,
      rawSignedPayload: "signed-fixture",
    };
    const args = { ...verdict(2), amazonNotice: notice };
    await expect(applyAmazonRtnVerdictHandler(ctx, args)).resolves.toEqual({
      type: "SubscriptionRenewed",
      deduped: false,
    });
    await expect(applyAmazonRtnVerdictHandler(ctx, args)).resolves.toEqual({
      type: "SubscriptionRenewed",
      deduped: true,
    });
    expect(
      rows(db, "commerceEvents").filter(
        (row) => row.eventType === "subscription.renewed",
      ),
    ).toHaveLength(1);
    await applyAmazonRtnVerdictHandler(ctx, {
      ...verdict(3, {}, false),
      amazonNotice: {
        ...notice,
        messageId: "sns-expire",
        notificationType: "SUBSCRIPTION_EXPIRED",
      },
    });
    expect(rows(db, "subscriptions")[0].state).toBe("Expired");
  });

  test("one-time SNS notifications persist a retry receipt without creating a subscription", async () => {
    const { db, ctx } = setup();
    const args = {
      ...verdict(1, { productType: "CONSUMABLE" }),
      amazonNotice: {
        messageId: "sns-consumable",
        notificationType: "CONSUMABLE_PURCHASED",
        occurredAt: 100_000,
        rawSignedPayload: "signed-fixture",
      },
    };
    await applyAmazonRtnVerdictHandler(ctx, args);
    await expect(
      applyAmazonRtnVerdictHandler(ctx, args),
    ).resolves.toMatchObject({ deduped: true });
    expect(rows(db, "subscriptions")).toHaveLength(0);
    expect(rows(db, "webhookEvents")).toHaveLength(1);
    expect(rows(db, "webhookEvents")[0].appliedAt).toBe(100_000);
  });

  test("a superseded SNS verdict retains subscription retry metadata", async () => {
    const { db, ctx } = setup();
    await saveAmazonVerdictHandler(ctx, verdict(2));
    await applyAmazonRtnVerdictHandler(ctx, {
      ...verdict(1, {}, false),
      amazonNotice: {
        messageId: "sns-superseded",
        notificationType: "SUBSCRIPTION_EXPIRED",
        occurredAt: 100_000,
        rawSignedPayload: "signed-fixture",
      },
    });
    expect(rows(db, "subscriptions")[0].state).toBe("Active");
    const event = rows(db, "webhookEvents").find(
      (row) => row.sourceNotificationId === "sns-superseded",
    );
    expect(event).toMatchObject({
      type: "ReceiptRechecked",
      productKind: "subscription",
      purchaseToken: amazonSubscriptionToken("production:user:receipt"),
      appliedAt: 100_000,
    });
  });

  test("an older SNS notice still refreshes RVS without relabeling current lifecycle state", async () => {
    const { db, ctx } = setup();
    const notice = {
      messageId: "newer",
      notificationType: "SUBSCRIPTION_RENEWED",
      occurredAt: 100_000,
      rawSignedPayload: "signed-fixture",
    };
    await applyAmazonRtnVerdictHandler(ctx, {
      ...verdict(1),
      amazonNotice: notice,
    });
    await applyAmazonRtnVerdictHandler(ctx, {
      ...verdict(2, { autoRenewing: false }),
      amazonNotice: {
        ...notice,
        messageId: "older",
        notificationType: "SUBSCRIPTION_EXPIRED",
        occurredAt: 90_000,
      },
    });
    expect(rows(db, "subscriptions")[0]).toMatchObject({
      state: "Active",
      willRenew: false,
      lastAmazonNotificationAt: 100_000,
    });
    expect(
      rows(db, "commerceEvents").some(
        (row) => row.eventType === "subscription.expired",
      ),
    ).toBe(false);
  });

  test.each(["unbound", "foreign", "erased"] as const)(
    "an immediate verified replacement respects the new receipt's %s association",
    async (association) => {
      const { db, ctx } = setup();
      await saveAmazonVerdictHandler(ctx, verdict(1));
      const previous = rows(db, "purchases")[0];
      await db.patch(previous._id, { appUserId: "previous-owner" });
      await bindSubscriptionToUserHandler(ctx, {
        projectId: "projects_test" as never,
        purchaseToken: amazonSubscriptionToken("production:user:receipt"),
        userId: "previous-owner",
      });
      const replacement = {
        ...verdict(3, { receiptId: "replacement", productId: "upgraded" }),
        remoteId: "production:user:replacement",
        requestData: {
          store: "amazon" as const,
          userId: "user",
          receiptId: "replacement",
        },
      };
      if (association !== "unbound") {
        await saveAmazonVerdictHandler(ctx, {
          ...replacement,
          amazonRvsSequence: 2,
        });
        const purchase = rows(db, "purchases").find(
          (row) => row.remoteId === replacement.remoteId,
        )!;
        if (association === "foreign") {
          await db.patch(purchase._id, { appUserId: "another-owner" });
          await bindSubscriptionToUserHandler(ctx, {
            projectId: "projects_test" as never,
            purchaseToken: amazonSubscriptionToken(replacement.remoteId),
            userId: "another-owner",
          });
        } else {
          await db.patch(purchase._id, { accountErased: true });
          const subscription = rows(db, "subscriptions").find(
            (row) =>
              row.purchaseToken ===
              amazonSubscriptionToken(replacement.remoteId),
          )!;
          await db.patch(subscription._id, {
            accountErased: true,
            userId: undefined,
          });
        }
      }
      await applyAmazonRtnVerdictHandler(ctx, {
        ...replacement,
        relatedReceipt: verdict(3, { cancelReason: 1 }, false),
        amazonNotice: {
          messageId: "replacement-notice",
          notificationType: "SUBSCRIPTION_MODIFIED_IMMEDIATE",
          occurredAt: 100_000,
          rawSignedPayload: "signed-fixture",
        },
      });
      const next = rows(db, "subscriptions").find(
        (row) =>
          row.purchaseToken === amazonSubscriptionToken(replacement.remoteId),
      );
      expect(
        rows(db, "subscriptions").find(
          (row) =>
            row.purchaseToken ===
            amazonSubscriptionToken("production:user:receipt"),
        )?.state,
      ).toBe("Revoked");
      expect(next?.userId).toBe(
        association === "unbound"
          ? "previous-owner"
          : association === "foreign"
            ? "another-owner"
            : undefined,
      );
    },
  );

  test.each(["matching", "newer-invalid", "newer-valid"] as const)(
    "replacement at the binding cap uses the %s predecessor verdict",
    async (freshness) => {
      const { db, ctx } = setup();
      await saveAmazonVerdictHandler(ctx, verdict(1));
      await bindSubscriptionToUserHandler(ctx, {
        projectId: "projects_test" as never,
        purchaseToken: amazonSubscriptionToken("production:user:receipt"),
        userId: "owner",
      });
      for (let i = 1; i < MAX_BOUND_PURCHASES_PER_USER; i++)
        db.seed(`other_${i}`, "purchases", {
          projectId: "projects_test",
          store: "horizon",
          remoteId: `proof_${i}`,
          appUserId: "owner",
          isValid: true,
        });
      if (freshness !== "matching")
        await saveAmazonVerdictHandler(
          ctx,
          verdict(4, {}, freshness === "newer-valid"),
        );
      await applyAmazonRtnVerdictHandler(ctx, {
        ...verdict(3, { receiptId: "replacement", productId: "upgraded" }),
        remoteId: "production:user:replacement",
        requestData: {
          store: "amazon",
          userId: "user",
          receiptId: "replacement",
        },
        relatedReceipt: verdict(3, {}, false),
        amazonNotice: {
          messageId: "cap-replacement",
          notificationType: "SUBSCRIPTION_MODIFIED_IMMEDIATE",
          occurredAt: 100_000,
          rawSignedPayload: "signed-fixture",
        },
      });
      const current = await testableFunction(boundPurchasesForUser)._handler(
        ctx,
        { projectId: "projects_test" as never, userId: "owner" },
      );
      expect(current).toHaveLength(MAX_BOUND_PURCHASES_PER_USER);
      expect(
        current.some((row) => row.remoteId === "production:user:replacement"),
      ).toBe(freshness !== "newer-valid");
      expect(
        current.some((row) => row.remoteId === "production:user:receipt"),
      ).toBe(freshness === "newer-valid");
    },
  );

  test("operator rebind moves both entitlement sources and a later replacement to the new owner", async () => {
    const { db, ctx } = setup();
    await saveAmazonVerdictHandler(ctx, verdict(1));
    const token = amazonSubscriptionToken("production:user:receipt");
    await bindSubscriptionToUserHandler(ctx, {
      projectId: "projects_test" as never,
      purchaseToken: token,
      userId: "alice",
    });
    await expect(
      rebindSubscriptionToUserHandler(ctx, {
        projectId: "projects_test" as never,
        purchaseToken: token,
        userId: "bob",
      }),
    ).resolves.toMatchObject({ notified: true });
    const read = testableFunction(boundPurchasesForUser)._handler;
    await expect(
      read(ctx, { projectId: "projects_test" as never, userId: "alice" }),
    ).resolves.toEqual([]);
    await expect(
      read(ctx, { projectId: "projects_test" as never, userId: "bob" }),
    ).resolves.toMatchObject([{ productId: "premium" }]);
    expect(rows(db, "subscriptions")[0].userId).toBe("bob");
    await applyAmazonRtnVerdictHandler(ctx, {
      ...verdict(2, { receiptId: "replacement", productId: "upgraded" }),
      remoteId: "production:user:replacement",
      requestData: {
        store: "amazon",
        userId: "user",
        receiptId: "replacement",
      },
      relatedReceipt: verdict(2, {}, false),
      amazonNotice: {
        messageId: "rebound-replacement",
        notificationType: "SUBSCRIPTION_MODIFIED_IMMEDIATE",
        occurredAt: 100_000,
        rawSignedPayload: "signed-fixture",
      },
    });
    await expect(
      read(ctx, { projectId: "projects_test" as never, userId: "alice" }),
    ).resolves.toEqual([]);
    await expect(
      read(ctx, { projectId: "projects_test" as never, userId: "bob" }),
    ).resolves.toMatchObject([{ productId: "upgraded" }]);
  });

  test("a publishable legacy subscription binder cannot preempt Amazon's server binding", async () => {
    const { db, ctx } = setup();
    await saveAmazonVerdictHandler(ctx, verdict(1));
    db.seed("apiKeys_public", "apiKeys", {
      key: "publishable",
      keyType: "publishable",
      isActive: true,
      projectId: "projects_test",
      organizationId: "organizations_test",
    });
    for (const userId of ["", " ", "a".repeat(257)]) {
      for (const remoteId of ["production:user:receipt", "missing"]) {
        await expect(
          testableFunction(bindUser)._handler(ctx, {
            apiKey: "publishable",
            purchaseToken: amazonSubscriptionToken(remoteId),
            userId,
          }),
        ).rejects.toMatchObject({ data: { code: "INSUFFICIENT_SCOPE" } });
      }
    }
    await expect(
      testableFunction(bindUser)._handler(ctx, {
        apiKey: "publishable",
        purchaseToken: amazonSubscriptionToken("production:user:receipt"),
        userId: "attacker",
      }),
    ).rejects.toMatchObject({ data: { code: "INSUFFICIENT_SCOPE" } });
    expect(rows(db, "subscriptions")[0].userId).toBeUndefined();
    expect(rows(db, "purchases")[0].appUserId).toBeUndefined();
    await expect(
      bindSubscriptionToUserHandler(ctx, {
        projectId: "projects_test" as never,
        purchaseToken: amazonSubscriptionToken("production:user:receipt"),
        userId: "owner",
      }),
    ).resolves.not.toBeNull();
    expect(rows(db, "purchases")[0].appUserId).toBe("owner");
  });

  test("operator invalidation supersedes an already in-flight verification", async () => {
    const { db, ctx } = setup();
    await saveAmazonVerdictHandler(ctx, verdict(1));
    await db.patch("projects_test", { amazonRvsSequence: 2 });
    const purchase = rows(db, "purchases")[0];
    await testableFunction(markReceiptInvalid)._handler(ctx, {
      purchaseId: purchase._id as never,
    });
    await expect(
      saveAmazonVerdictHandler(ctx, verdict(2)),
    ).resolves.toMatchObject({ isValid: false, state: "INAUTHENTIC" });
    expect(rows(db, "subscriptions")[0].state).toBe("Revoked");
  });

  test("reverification cannot relink an erased account", async () => {
    const { db, ctx } = setup();
    await saveAmazonVerdictHandler(ctx, verdict(1));
    const purchase = rows(db, "purchases")[0];
    const subscription = rows(db, "subscriptions")[0];
    await db.patch(String(purchase._id), { accountErased: true });
    await db.patch(String(subscription._id), {
      accountErased: true,
      state: "Revoked",
    });
    await saveAmazonVerdictHandler(ctx, verdict(2));
    expect(subscription).toMatchObject({
      accountErased: true,
      state: "Revoked",
    });
    expect(subscription.userId).toBeUndefined();
  });
});

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
