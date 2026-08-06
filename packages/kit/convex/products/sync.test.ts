import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";

import {
  deletePlatformCatalog as registeredDeletePlatformCatalog,
  deleteRemovedProductRow as registeredDeleteRemovedProductRow,
  isSafePriceAmountMicros,
  listDraftAndroidProducts as registeredListDraftAndroidProducts,
  listDraftIosProducts as registeredListDraftIosProducts,
  listRemovedAndroidProducts as registeredListRemovedAndroidProducts,
  markPushed as registeredMarkPushed,
  shouldPreserveKitRemovedDuringPull,
  upsertFromStore as registeredUpsertFromStore,
} from "./sync";
import { testableFunction } from "../test.setup";

const deletePlatformCatalog = testableFunction(registeredDeletePlatformCatalog);
const deleteRemovedProductRow = testableFunction(
  registeredDeleteRemovedProductRow,
);
const upsertFromStore = testableFunction(registeredUpsertFromStore);
const listDraftAndroidProducts = testableFunction(
  registeredListDraftAndroidProducts,
);
const listDraftIosProducts = testableFunction(registeredListDraftIosProducts);
const listRemovedAndroidProducts = testableFunction(
  registeredListRemovedAndroidProducts,
);
const markPushed = testableFunction(registeredMarkPushed);

type Row = Record<string, unknown> & { _id: string };

class IndexBuilder {
  predicates: Array<(row: Row) => boolean> = [];

  eq(field: string, value: unknown) {
    this.predicates.push((row) => row[field] === value);
    return this;
  }
}

class TestQuery {
  constructor(private readonly rows: Row[]) {}

  withIndex(_name: string, build: (q: IndexBuilder) => IndexBuilder) {
    const builder = build(new IndexBuilder());
    return new TestQuery(
      this.rows.filter((row) => builder.predicates.every((test) => test(row))),
    );
  }

  async unique() {
    if (this.rows.length > 1) throw new Error("Expected unique row");
    return this.rows[0] ?? null;
  }

  async take(limit: number) {
    return this.rows.slice(0, limit);
  }

  async collect() {
    return [...this.rows];
  }
}

class TestDb {
  constructor(readonly tables: Record<string, Row[]>) {}

  async get(id: string) {
    return (
      Object.values(this.tables)
        .flat()
        .find((row) => row._id === id) ?? null
    );
  }

  query(table: string) {
    return new TestQuery(this.tables[table] ?? []);
  }

  async delete(id: string) {
    for (const rows of Object.values(this.tables)) {
      const index = rows.findIndex((row) => row._id === id);
      if (index >= 0) {
        rows.splice(index, 1);
        return;
      }
    }
    throw new Error(`Unknown row: ${id}`);
  }

  async patch(id: string, value: Record<string, unknown>) {
    const row = await this.get(id);
    if (!row) throw new Error(`Unknown row: ${id}`);
    Object.assign(row, value);
  }
}

describe("isSafePriceAmountMicros", () => {
  it("accepts missing and non-negative safe integer prices", () => {
    expect(isSafePriceAmountMicros(undefined)).toBe(true);
    expect(isSafePriceAmountMicros(0)).toBe(true);
    expect(isSafePriceAmountMicros(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it("rejects negative, fractional, and unsafe prices", () => {
    expect(isSafePriceAmountMicros(-1)).toBe(false);
    expect(isSafePriceAmountMicros(1.5)).toBe(false);
    expect(isSafePriceAmountMicros(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });
});

describe("shouldPreserveKitRemovedDuringPull", () => {
  it("preserves kit-authored Removed rows so direction=both can delete them upstream", () => {
    expect(
      shouldPreserveKitRemovedDuringPull({
        state: "Removed",
        origin: "kit",
      }),
    ).toBe(true);
  });

  it("does not preserve store-authored or active rows", () => {
    expect(
      shouldPreserveKitRemovedDuringPull({
        state: "Removed",
        origin: "store",
      }),
    ).toBe(false);
    expect(
      shouldPreserveKitRemovedDuringPull({
        state: "Ready",
        origin: "kit",
      }),
    ).toBe(false);
  });
});

describe("upsertFromStore removal provenance", () => {
  function writableDb(product: Row) {
    return new TestDb({
      organizations: [{ _id: "organization_a", pendingDeletion: false }],
      projects: [
        {
          _id: "project_a",
          organizationId: "organization_a",
          pendingDeletion: false,
        },
      ],
      products: [product],
    });
  }

  it("marks a store-reported removal as store-authored", async () => {
    const product = {
      _id: "product_a",
      projectId: "project_a",
      platform: "Android",
      productId: "legacy_bundle",
      type: "NonConsumable",
      title: "Legacy bundle",
      state: "Active",
      origin: "kit",
      storeRef: "legacy_bundle",
      updatedAt: 1,
    };
    const db = writableDb(product);

    await upsertFromStore._handler(
      { db },
      {
        projectId: "project_a" as never,
        productId: "legacy_bundle",
        platform: "Android",
        type: "NonConsumable",
        title: "Legacy bundle",
        storeRef: "legacy_bundle",
        state: "Removed",
      },
    );

    expect(product).toMatchObject({ state: "Removed", origin: "store" });
    await expect(
      listRemovedAndroidProducts._handler(
        { db },
        { projectId: "project_a" as never },
      ),
    ).resolves.toEqual([]);
  });

  it("preserves an explicit kit removal for the push phase", async () => {
    const product = {
      _id: "product_a",
      projectId: "project_a",
      platform: "Android",
      productId: "legacy_bundle",
      type: "NonConsumable",
      title: "Legacy bundle",
      state: "Removed",
      origin: "kit",
      storeRef: "legacy_bundle",
      updatedAt: 1,
    };
    const db = writableDb(product);

    await upsertFromStore._handler(
      { db },
      {
        projectId: "project_a" as never,
        productId: "legacy_bundle",
        platform: "Android",
        type: "NonConsumable",
        title: "Legacy bundle",
        storeRef: "legacy_bundle",
        state: "Removed",
      },
    );

    expect(product).toMatchObject({ state: "Removed", origin: "kit" });
    await expect(
      listRemovedAndroidProducts._handler(
        { db },
        { projectId: "project_a" as never },
      ),
    ).resolves.toEqual([
      {
        productId: "legacy_bundle",
        platform: "Android",
        type: "NonConsumable",
        storeRef: "legacy_bundle",
      },
    ]);
  });
});

describe("listDraftIosProducts review resumption", () => {
  it("includes Ready rows that have not handled the configured screenshot", async () => {
    const base = {
      projectId: "project_a",
      platform: "IOS",
      type: "Consumable",
      title: "Title",
      origin: "kit",
    };
    const db = new TestDb({
      products: [
        {
          _id: "ready_current",
          ...base,
          productId: "ready.current",
          state: "Ready",
          lastAppleReviewScreenshotFileId: "file_current",
          updatedAt: 300,
        },
        {
          _id: "draft_b",
          ...base,
          productId: "draft.b",
          state: "Draft",
          updatedAt: 300,
        },
        {
          _id: "ready_legacy",
          ...base,
          productId: "ready.legacy",
          state: "Ready",
          storeRef: "iap-ready",
          updatedAt: 100,
        },
        {
          _id: "ready_old",
          ...base,
          productId: "ready.old",
          state: "Ready",
          storeRef: "iap-old",
          lastAppleReviewScreenshotFileId: "file_old",
          updatedAt: 400,
        },
        {
          _id: "pulled",
          ...base,
          origin: "store",
          productId: "pulled",
          state: "Draft",
          storeRef: "iap-pulled",
          updatedAt: 100,
        },
      ],
    });

    await expect(
      listDraftIosProducts._handler(
        { db },
        {
          projectId: "project_a" as never,
          includeReadyForReview: true,
          reviewScreenshotFileId: "file_current" as never,
        },
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        productId: "ready.legacy",
        state: "Ready",
      }),
      expect.objectContaining({
        productId: "ready.old",
        state: "Ready",
      }),
      expect.objectContaining({ productId: "draft.b", state: "Draft" }),
    ]);
  });

  it("uses the persistent file id instead of pull-updated timestamps", async () => {
    const ready = {
      _id: "ready_before_pull",
      projectId: "project_a",
      platform: "IOS",
      productId: "ready.before.pull",
      state: "Ready",
      type: "Consumable",
      title: "Ready",
      origin: "kit",
      storeRef: "iap-ready",
      lastAppleReviewScreenshotFileId: "file_current",
      updatedAt: 100,
    };
    const db = new TestDb({ products: [ready] });
    await expect(
      listDraftIosProducts._handler(
        { db },
        {
          projectId: "project_a" as never,
          includeReadyForReview: true,
          reviewScreenshotFileId: "file_current" as never,
        },
      ),
    ).resolves.toEqual([]);

    // `upsertFromStore` in the pull phase refreshes this timestamp.
    ready.updatedAt = 300;
    await expect(
      listDraftIosProducts._handler(
        { db },
        {
          projectId: "project_a" as never,
          includeReadyForReview: true,
          reviewScreenshotFileId: "file_current" as never,
        },
      ),
    ).resolves.toEqual([]);

    await expect(
      listDraftIosProducts._handler(
        { db },
        {
          projectId: "project_a" as never,
          includeReadyForReview: true,
          reviewScreenshotFileId: "file_replacement" as never,
        },
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        productId: "ready.before.pull",
        state: "Ready",
      }),
    ]);
  });

  it("records the handled screenshot identity when a push completes", async () => {
    const product = {
      _id: "product_a",
      projectId: "project_a",
      platform: "IOS",
      productId: "premium",
      state: "Draft",
      type: "Consumable",
      title: "Premium",
      updatedAt: 100,
    };
    const db = new TestDb({
      organizations: [{ _id: "organization_a" }],
      projects: [{ _id: "project_a", organizationId: "organization_a" }],
      products: [product],
    });

    await expect(
      markPushed._handler(
        { db },
        {
          projectId: "project_a" as never,
          productId: "premium",
          platform: "IOS",
          storeRef: "iap_1",
          reviewScreenshotFileId: "file_current" as never,
        },
      ),
    ).resolves.toBe("product_a");
    expect(product).toEqual(
      expect.objectContaining({
        state: "Ready",
        storeRef: "iap_1",
        lastAppleReviewScreenshotFileId: "file_current",
      }),
    );
  });
});

describe("draft product region worker boundaries", () => {
  const base = {
    projectId: "project_a",
    state: "Draft",
    title: "Title",
    origin: "kit",
  };

  it("never forwards stale region metadata to the iOS worker", async () => {
    const db = new TestDb({
      products: [
        {
          _id: "ios_product",
          ...base,
          platform: "IOS",
          productId: "premium.ios",
          type: "Consumable",
          regions: ["US"],
        },
      ],
    });

    await expect(
      listDraftIosProducts._handler(
        { db },
        { projectId: "project_a" as never },
      ),
    ).resolves.toEqual([
      expect.not.objectContaining({ regions: expect.anything() }),
    ]);
  });

  it("drops empty and subscription footprints before the Play worker", async () => {
    const db = new TestDb({
      products: [
        {
          _id: "empty_product",
          ...base,
          platform: "Android",
          productId: "empty",
          type: "Consumable",
          regions: [],
        },
        {
          _id: "subscription_product",
          ...base,
          platform: "Android",
          productId: "subscription",
          type: "Subscription",
          regions: "all",
        },
        {
          _id: "restricted_product",
          ...base,
          platform: "Android",
          productId: "restricted",
          type: "NonConsumable",
          regions: ["US", "KR"],
        },
      ],
    });

    const rows = await listDraftAndroidProducts._handler(
      { db },
      { projectId: "project_a" as never },
    );
    expect(rows.find((row) => row.productId === "empty")?.regions).toBe(
      undefined,
    );
    expect(rows.find((row) => row.productId === "subscription")?.regions).toBe(
      undefined,
    );
    expect(rows.find((row) => row.productId === "restricted")).toMatchObject({
      regions: ["US", "KR"],
    });
  });
});

describe("catalog deletion client-payload retention", () => {
  it("keeps client metadata after a pushed Removed row is hard-deleted", async () => {
    const db = new TestDb({
      organizations: [{ _id: "organization_a" }],
      projects: [{ _id: "project_a", organizationId: "organization_a" }],
      products: [
        {
          _id: "product_ios",
          projectId: "project_a",
          platform: "IOS",
          productId: "premium",
          state: "Removed",
          origin: "kit",
        },
      ],
      productClientPayloads: [
        {
          _id: "payload_ios",
          projectId: "project_a",
          platform: "IOS",
          productId: "premium",
        },
      ],
      productClientPayloadSummaries: [
        {
          _id: "summary_ios",
          projectId: "project_a",
          platform: "IOS",
          productId: "premium",
        },
      ],
    });

    await expect(
      deleteRemovedProductRow._handler(
        { db },
        {
          projectId: "project_a" as Id<"projects">,
          platform: "IOS",
          productId: "premium",
        },
      ),
    ).resolves.toBe(true);
    expect(db.tables.products).toEqual([]);
    expect(db.tables.productClientPayloads).toHaveLength(1);
    expect(db.tables.productClientPayloadSummaries).toHaveLength(1);
  });

  it("purges only platform catalog rows and never payload rows", async () => {
    const db = new TestDb({
      organizations: [{ _id: "organization_a" }],
      projects: [{ _id: "project_a", organizationId: "organization_a" }],
      products: [
        {
          _id: "product_ios",
          projectId: "project_a",
          platform: "IOS",
        },
        {
          _id: "product_android",
          projectId: "project_a",
          platform: "Android",
        },
      ],
      productClientPayloads: [
        {
          _id: "payload_ios",
          projectId: "project_a",
          platform: "IOS",
        },
        {
          _id: "payload_android",
          projectId: "project_a",
          platform: "Android",
        },
      ],
      productClientPayloadSummaries: [
        {
          _id: "summary_ios",
          projectId: "project_a",
          platform: "IOS",
        },
        {
          _id: "summary_android",
          projectId: "project_a",
          platform: "Android",
        },
      ],
    });

    await expect(
      deletePlatformCatalog._handler(
        { db },
        {
          projectId: "project_a" as Id<"projects">,
          platform: "IOS",
          limit: 100,
        },
      ),
    ).resolves.toEqual({ deleted: 1, hasMore: false });
    expect(db.tables.products).toEqual([
      expect.objectContaining({ _id: "product_android" }),
    ]);
    expect(db.tables.productClientPayloads).toHaveLength(2);
    expect(db.tables.productClientPayloadSummaries).toHaveLength(2);
  });
});

describe("pending-deletion sync write guards", () => {
  for (const pendingOwner of ["project", "organization"] as const) {
    it(`rejects a store-pull upsert while the ${pendingOwner} drains`, async () => {
      const db = new TestDb({
        organizations: [
          {
            _id: "organization_a",
            pendingDeletion: pendingOwner === "organization",
          },
        ],
        projects: [
          {
            _id: "project_a",
            organizationId: "organization_a",
            pendingDeletion: pendingOwner === "project",
          },
        ],
        products: [],
      });

      await expect(
        upsertFromStore._handler(
          { db },
          {
            projectId: "project_a" as never,
            productId: "premium",
            platform: "IOS",
            type: "Subscription",
            title: "Premium",
            storeRef: "store_ref",
            state: "Active",
          },
        ),
      ).rejects.toThrow("Project not found");
      expect(db.tables.products).toEqual([]);
    });
  }
});

describe("upsertFromStore localization preservation", () => {
  const seeded = {
    _id: "product_a",
    projectId: "project_a",
    platform: "IOS",
    productId: "premium",
    type: "Subscription",
    title: "Premium",
    state: "Active",
    origin: "kit",
    storeRef: "store_ref",
    localizations: [{ locale: "ko-KR", title: "프리미엄" }],
    updatedAt: 1,
  };

  function db() {
    return new TestDb({
      organizations: [{ _id: "organization_a", pendingDeletion: false }],
      projects: [
        {
          _id: "project_a",
          organizationId: "organization_a",
          pendingDeletion: false,
        },
      ],
      products: [{ ...seeded }],
    });
  }

  const pull = (extra: Record<string, unknown>) => ({
    projectId: "project_a" as never,
    productId: "premium",
    platform: "IOS" as const,
    type: "Subscription" as const,
    title: "Premium",
    storeRef: "store_ref",
    state: "Active" as const,
    ...extra,
  });

  it("keeps kit-authored locales when the pull reports none", async () => {
    // ASC omits the field entirely (its localizations live on version
    // sub-resources), and Play omits it for a product whose only listing
    // is the base locale. Overwriting here would delete a locale the
    // operator authored in kit, and the push side — which merges rather
    // than replaces — would then have nothing to republish.
    const store = db();
    await upsertFromStore._handler({ db: store }, pull({}));

    expect(store.tables.products[0].localizations).toEqual([
      { locale: "ko-KR", title: "프리미엄" },
    ]);
  });

  it("adopts locales the store does report", async () => {
    const store = db();
    await upsertFromStore._handler(
      { db: store },
      pull({ localizations: [{ locale: "ja-JP", title: "プレミアム" }] }),
    );

    expect(store.tables.products[0].localizations).toEqual([
      { locale: "ja-JP", title: "プレミアム" },
    ]);
  });
});
