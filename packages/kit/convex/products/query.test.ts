import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";

const projectMocks = vi.hoisted(() => ({
  byApiKey: vi.fn(),
  byProjectId: vi.fn(),
}));

vi.mock("../projects/helpers", () => ({
  resolveProjectByApiKeyFromDb: projectMocks.byApiKey,
  resolveProjectByIdForCurrentUserFromDb: projectMocks.byProjectId,
}));

import {
  getCatalogPriceInternal as registeredGetCatalogPriceInternal,
  getProductClientPayload as registeredGetProductClientPayload,
  getProductClientPayloadIfChanged as registeredGetProductClientPayloadIfChanged,
  getProductClientPayloadEditorState as registeredGetProductClientPayloadEditorState,
  listProductClientPayloadSummaries as registeredListProductClientPayloadSummaries,
  listProducts as registeredListProducts,
  listProductsPage as registeredListProductsPage,
  listProductsWithClientPayloads as registeredListProductsWithClientPayloads,
} from "./query";
import { deletePlatformCatalog as registeredDeletePlatformCatalog } from "./sync";
import { testableFunction } from "../test.setup";

const deletePlatformCatalog = testableFunction(registeredDeletePlatformCatalog);
const getCatalogPriceInternal = testableFunction(
  registeredGetCatalogPriceInternal,
);
const getProductClientPayload = testableFunction(
  registeredGetProductClientPayload,
);
const getProductClientPayloadIfChanged = testableFunction(
  registeredGetProductClientPayloadIfChanged,
);
const getProductClientPayloadEditorState = testableFunction(
  registeredGetProductClientPayloadEditorState,
);
const listProductClientPayloadSummaries = testableFunction(
  registeredListProductClientPayloadSummaries,
);
const listProducts = testableFunction(registeredListProducts);
const listProductsPage = testableFunction(registeredListProductsPage);
const listProductsWithClientPayloads = testableFunction(
  registeredListProductsWithClientPayloads,
);

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

  async collect() {
    return [...this.rows];
  }

  async unique() {
    if (this.rows.length > 1) throw new Error("Expected unique row");
    return this.rows[0] ?? null;
  }

  async take(limit: number) {
    return this.rows.slice(0, limit);
  }

  async paginate(options: { numItems: number; cursor: string | null }) {
    const start = options.cursor ? Number(options.cursor) : 0;
    const end = Math.min(start + options.numItems, this.rows.length);
    return {
      page: this.rows.slice(start, end),
      isDone: end >= this.rows.length,
      continueCursor: String(end),
    };
  }
}

class TestDb {
  queryCounts = new Map<string, number>();

  constructor(readonly tables: Record<string, Row[]>) {}

  async get(id: string) {
    return (
      Object.values(this.tables)
        .flat()
        .find((row) => row._id === id) ?? null
    );
  }

  query(table: string) {
    this.queryCounts.set(table, (this.queryCounts.get(table) ?? 0) + 1);
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
}

const PROJECT_ID = "projects_a" as Id<"projects">;

function product(
  id: string,
  platform: "IOS" | "Android",
  productId: string,
): Row {
  return {
    _id: id,
    projectId: PROJECT_ID,
    platform,
    productId,
    type: "Subscription",
    title: productId,
    state: "Active",
    updatedAt: 10,
  };
}

function payload(
  id: string,
  platform: "IOS" | "Android",
  productId: string,
  body: string,
): Row {
  return {
    _id: id,
    projectId: PROJECT_ID,
    platform,
    productId,
    format: "text",
    body,
    version: 2,
    createdAt: 5,
    updatedAt: 20,
  };
}

function summary(
  id: string,
  platform: "IOS" | "Android",
  productId: string,
): Row {
  return {
    _id: id,
    projectId: PROJECT_ID,
    platform,
    productId,
    format: "text",
    version: 2,
    createdAt: 5,
    updatedAt: 20,
  };
}

describe("catalog pricing", () => {
  it("returns only the exact active platform price", async () => {
    const android: Row = {
      ...product("products_android", "Android", "premium"),
      currency: "USD",
      priceAmountMicros: 4_990_000,
    };
    const ios: Row = {
      ...product("products_ios", "IOS", "premium"),
      currency: "EUR",
      priceAmountMicros: 5_990_000,
    };
    const db = new TestDb({ products: [android, ios] });

    await expect(
      getCatalogPriceInternal._handler(
        { db },
        {
          projectId: PROJECT_ID,
          platform: "Android",
          productId: "premium",
        },
      ),
    ).resolves.toEqual({ currency: "USD", priceAmountMicros: 4_990_000 });

    android.state = "Removed";
    await expect(
      getCatalogPriceInternal._handler(
        { db },
        {
          projectId: PROJECT_ID,
          platform: "Android",
          productId: "premium",
        },
      ),
    ).resolves.toBeNull();
  });
});

describe("product client payload queries", () => {
  beforeEach(() => {
    projectMocks.byApiKey.mockReset();
    projectMocks.byProjectId.mockReset();
    projectMocks.byApiKey.mockResolvedValue({
      project: { _id: PROJECT_ID },
    });
    projectMocks.byProjectId.mockResolvedValue({
      project: { _id: PROJECT_ID },
    });
  });

  it("preserves the default product response and performs no payload lookup", async () => {
    const db = new TestDb({
      products: [product("p1", "IOS", "premium")],
      productClientPayloads: [payload("m1", "IOS", "premium", "secret")],
    });

    const rows = await listProducts._handler({ db }, { apiKey: "key" });

    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("clientPayload");
    expect(db.queryCounts.get("products")).toBe(1);
    expect(db.queryCounts.get("productClientPayloads")).toBeUndefined();
  });

  it("bounds the app-facing default catalog without payload body reads", async () => {
    const products = Array.from({ length: 51 }, (_, index) =>
      product(`p${index}`, "IOS", `product_${index}`),
    );
    const db = new TestDb({
      products,
      productClientPayloads: products.map((row, index) =>
        payload(`m${index}`, "IOS", String(row.productId), `body ${index}`),
      ),
    });

    const page = await listProductsPage._handler(
      { db },
      { apiKey: "key", platform: "IOS", limit: 50 },
    );
    expect(page.products).toHaveLength(50);
    expect(page).toMatchObject({ hasMore: true, nextCursor: "50" });
    expect(db.queryCounts.get("productClientPayloads")).toBeUndefined();

    await expect(
      listProductsPage._handler(
        { db },
        { apiKey: "key", platform: "IOS", limit: 51 },
      ),
    ).rejects.toSatisfy(
      (error: unknown) =>
        (error as { data?: { code?: string } }).data?.code === "INVALID_INPUT",
    );
  });

  it("uses body-free summaries for conditional payload reads", async () => {
    const tables = {
      products: [product("p1", "IOS", "premium")],
      productClientPayloads: [payload("m1", "IOS", "premium", "rules")],
      productClientPayloadSummaries: [summary("s1", "IOS", "premium")],
    };
    const unchangedDb = new TestDb(tables);
    await expect(
      getProductClientPayloadIfChanged._handler(
        { db: unchangedDb },
        {
          apiKey: "key",
          platform: "IOS",
          productId: "premium",
          knownVersion: 2,
        },
      ),
    ).resolves.toEqual({ status: "not_modified", version: 2 });
    expect(
      unchangedDb.queryCounts.get("productClientPayloads"),
    ).toBeUndefined();

    const changedDb = new TestDb(tables);
    await expect(
      getProductClientPayloadIfChanged._handler(
        { db: changedDb },
        {
          apiKey: "key",
          platform: "IOS",
          productId: "premium",
          knownVersion: 1,
        },
      ),
    ).resolves.toEqual({
      status: "found",
      clientPayload: {
        format: "text",
        body: "rules",
        version: 2,
        updatedAt: 20,
      },
    });
    expect(changedDb.queryCounts.get("productClientPayloads")).toBe(1);
  });

  it("pages before exact payload-body lookups and returns an opaque next cursor", async () => {
    const db = new TestDb({
      products: [
        product("p1", "IOS", "premium"),
        product("p2", "IOS", "basic"),
        product("p3", "IOS", "pro"),
        product("p4", "Android", "premium"),
      ],
      productClientPayloads: [
        payload("m1", "IOS", "premium", "ios"),
        payload("m2", "IOS", "basic", "basic"),
        payload("m3", "IOS", "pro", "must stay off page one"),
        payload("m4", "Android", "premium", "wrong platform"),
      ],
    });

    const first = await listProductsWithClientPayloads._handler(
      { db },
      { apiKey: "key", platform: "IOS", limit: 2 },
    );

    expect(first).toMatchObject({ hasMore: true, nextCursor: "2" });
    expect(first.products.map((row) => row.clientPayload?.body)).toEqual([
      "ios",
      "basic",
    ]);
    expect(first.products[0]?.clientPayload).toEqual({
      format: "text",
      body: "ios",
      version: 2,
      updatedAt: 20,
    });
    expect(JSON.stringify(first)).not.toContain("must stay off page one");
    expect(JSON.stringify(first)).not.toContain("wrong platform");
    expect(db.queryCounts.get("products")).toBe(1);
    expect(db.queryCounts.get("productClientPayloads")).toBe(2);

    const second = await listProductsWithClientPayloads._handler(
      { db },
      { apiKey: "key", platform: "IOS", limit: 2, cursor: "2" },
    );
    expect(second).toEqual({
      products: [
        expect.objectContaining({
          clientPayload: {
            body: "must stay off page one",
            format: "text",
            version: 2,
            updatedAt: 20,
          },
        }),
      ],
      hasMore: false,
    });
    expect(db.queryCounts.get("productClientPayloads")).toBe(3);
  });

  it("loads at most the default 25 payload bodies per page", async () => {
    const products = Array.from({ length: 26 }, (_, index) =>
      product(`p${index}`, "IOS", `product_${index}`),
    );
    const db = new TestDb({
      products,
      productClientPayloads: products.map((row, index) =>
        payload(`m${index}`, "IOS", String(row.productId), `body ${index}`),
      ),
    });

    const page = await listProductsWithClientPayloads._handler(
      { db },
      { apiKey: "key", platform: "IOS" },
    );

    expect(page.products).toHaveLength(25);
    expect(page).toMatchObject({ hasMore: true, nextCursor: "25" });
    expect(db.queryCounts.get("productClientPayloads")).toBe(25);
  });

  it("accepts at most 50 products in a payload-inclusive page", async () => {
    const products = Array.from({ length: 51 }, (_, index) =>
      product(`p${index}`, "IOS", `product_${index}`),
    );
    const db = new TestDb({
      products,
      productClientPayloads: products.map((row, index) =>
        payload(`m${index}`, "IOS", String(row.productId), `body ${index}`),
      ),
    });

    const page = await listProductsWithClientPayloads._handler(
      { db },
      { apiKey: "key", platform: "IOS", limit: 50 },
    );
    expect(page.products).toHaveLength(50);
    expect(page).toMatchObject({ hasMore: true, nextCursor: "50" });
    expect(db.queryCounts.get("productClientPayloads")).toBe(50);

    await expect(
      listProductsWithClientPayloads._handler(
        { db },
        { apiKey: "key", platform: "IOS", limit: 51 },
      ),
    ).rejects.toSatisfy(
      (error: unknown) =>
        (error as { data?: { code?: string } }).data?.code === "INVALID_INPUT",
    );
  });

  it("lists dashboard summaries without reading payload body documents", async () => {
    const db = new TestDb({
      productClientPayloads: [
        payload("m1", "IOS", "premium", "x".repeat(16 * 1024)),
      ],
      productClientPayloadSummaries: [
        summary("s1", "IOS", "premium"),
        {
          ...summary("s_deleted", "Android", "removed"),
          deleted: true,
          version: 9,
        },
      ],
    });

    await expect(
      listProductClientPayloadSummaries._handler(
        { db },
        { projectId: PROJECT_ID },
      ),
    ).resolves.toEqual([
      {
        platform: "IOS",
        productId: "premium",
        format: "text",
        version: 2,
        updatedAt: 20,
      },
    ]);
    expect(db.queryCounts.get("productClientPayloadSummaries")).toBe(1);
    expect(db.queryCounts.get("productClientPayloads")).toBeUndefined();
  });

  it("returns a tombstone revision only to the authenticated editor", async () => {
    const db = new TestDb({
      products: [product("p1", "IOS", "premium")],
      productClientPayloads: [],
      productClientPayloadSummaries: [
        {
          ...summary("s_deleted", "IOS", "premium"),
          deleted: true,
          version: 5,
        },
      ],
    });

    await expect(
      getProductClientPayloadEditorState._handler(
        { db },
        {
          projectId: PROJECT_ID,
          platform: "IOS",
          productId: "premium",
        },
      ),
    ).resolves.toEqual({ expectedVersion: 5 });
    await expect(
      getProductClientPayload._handler(
        { db },
        { apiKey: "key", platform: "IOS", productId: "premium" },
      ),
    ).resolves.toBeNull();
    expect(
      JSON.stringify(
        await getProductClientPayloadEditorState._handler(
          { db },
          {
            projectId: PROJECT_ID,
            platform: "IOS",
            productId: "premium",
          },
        ),
      ),
    ).not.toContain("text");
  });

  it("returns a single API-key or authenticated-project payload without metadata leakage", async () => {
    const db = new TestDb({
      products: [
        product("p1", "IOS", "premium"),
        product("p2", "Android", "premium"),
      ],
      productClientPayloads: [
        payload("m1", "IOS", "premium", "ios"),
        payload("m2", "Android", "premium", "android"),
      ],
    });

    await expect(
      getProductClientPayload._handler(
        { db },
        {
          projectId: PROJECT_ID,
          platform: "Android",
          productId: "premium",
        },
      ),
    ).resolves.toEqual({
      format: "text",
      body: "android",
      version: 2,
      updatedAt: 20,
    });

    projectMocks.byApiKey.mockResolvedValueOnce(null);
    await expect(
      getProductClientPayload._handler(
        { db },
        { apiKey: "bad", platform: "IOS", productId: "premium" },
      ),
    ).resolves.toBeNull();
  });

  it("keeps retained payloads private from apps but editable for authenticated Removed rows", async () => {
    const removed = product("p_removed", "Android", "removed");
    removed.state = "Removed";
    const db = new TestDb({
      products: [removed],
      productClientPayloads: [
        payload("m_orphan", "IOS", "orphan", "retained orphan"),
        payload("m_removed", "Android", "removed", "retained removed"),
      ],
    });

    await expect(
      getProductClientPayload._handler(
        { db },
        { apiKey: "key", platform: "IOS", productId: "orphan" },
      ),
    ).resolves.toBeNull();
    await expect(
      getProductClientPayload._handler(
        { db },
        { apiKey: "key", platform: "Android", productId: "removed" },
      ),
    ).resolves.toBeNull();

    const appPage = await listProductsWithClientPayloads._handler(
      { db },
      { apiKey: "key", platform: "Android" },
    );
    expect(appPage.products[0]).not.toHaveProperty("clientPayload");

    await expect(
      getProductClientPayload._handler(
        { db },
        {
          projectId: PROJECT_ID,
          platform: "Android",
          productId: "removed",
        },
      ),
    ).resolves.toMatchObject({ body: "retained removed" });
  });

  it("rejoins a retained payload after purge-local and a matching store pull", async () => {
    const db = new TestDb({
      organizations: [{ _id: "organizations_a" }],
      projects: [{ _id: PROJECT_ID, organizationId: "organizations_a" }],
      products: [product("p1", "IOS", "premium")],
      productClientPayloads: [payload("m1", "IOS", "premium", "retained")],
    });

    await expect(
      deletePlatformCatalog._handler(
        { db },
        { projectId: PROJECT_ID, platform: "IOS", limit: 100 },
      ),
    ).resolves.toEqual({ deleted: 1, hasMore: false });
    expect(db.tables.products).toEqual([]);
    expect(db.tables.productClientPayloads).toHaveLength(1);

    await expect(
      getProductClientPayload._handler(
        { db },
        { apiKey: "key", platform: "IOS", productId: "premium" },
      ),
    ).resolves.toBeNull();

    // Simulate the next store pull inserting the same natural-key product.
    db.tables.products.push(product("p1_recreated", "IOS", "premium"));
    const page = await listProductsWithClientPayloads._handler(
      { db },
      { apiKey: "key", platform: "IOS" },
    );

    expect(page.products).toHaveLength(1);
    expect(page.products[0]?.clientPayload?.body).toBe("retained");
    await expect(
      getProductClientPayload._handler(
        { db },
        { apiKey: "key", platform: "IOS", productId: "premium" },
      ),
    ).resolves.toMatchObject({ body: "retained" });
  });
});
