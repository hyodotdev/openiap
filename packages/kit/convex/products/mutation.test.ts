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
  assertProductClientPayloadVersion,
  MAX_PRODUCT_CLIENT_PAYLOAD_BYTES,
  nextStateForKitProductUpsert,
  removeProduct as registeredRemoveProduct,
  upsertProduct as registeredUpsertProduct,
  removeProductClientPayload as registeredRemoveProductClientPayload,
  removeProductClientPayloadWithApiKey as registeredRemoveProductClientPayloadWithApiKey,
  upsertProductClientPayload as registeredUpsertProductClientPayload,
  upsertProductClientPayloadWithApiKey as registeredUpsertProductClientPayloadWithApiKey,
  validateProductClientPayloadBody,
} from "./mutation";
import { testableFunction } from "../test.setup";

const removeProduct = testableFunction(registeredRemoveProduct);
const upsertProduct = testableFunction(registeredUpsertProduct);
const removeProductClientPayload = testableFunction(
  registeredRemoveProductClientPayload,
);
const removeProductClientPayloadWithApiKey = testableFunction(
  registeredRemoveProductClientPayloadWithApiKey,
);
const upsertProductClientPayload = testableFunction(
  registeredUpsertProductClientPayload,
);
const upsertProductClientPayloadWithApiKey = testableFunction(
  registeredUpsertProductClientPayloadWithApiKey,
);

type Row = Record<string, unknown> & { _id: string };

class QueryBuilder {
  predicates: Array<(row: Row) => boolean> = [];

  eq(field: string, value: unknown) {
    this.predicates.push((row) => row[field] === value);
    return this;
  }
}

class TestQuery {
  constructor(private readonly rows: Row[]) {}

  withIndex(_name: string, build: (q: QueryBuilder) => QueryBuilder) {
    const builder = build(new QueryBuilder());
    return new TestQuery(
      this.rows.filter((row) => builder.predicates.every((test) => test(row))),
    );
  }

  async unique() {
    if (this.rows.length > 1) throw new Error("Expected unique row");
    return this.rows[0] ?? null;
  }
}

class TestDb {
  tables = new Map<string, Map<string, Row>>();
  insertCount = 0;
  patchCount = 0;
  deleteCount = 0;

  seed(table: string, row: Row) {
    this.table(table).set(row._id, row);
  }

  query(table: string) {
    return new TestQuery([...this.table(table).values()]);
  }

  async insert(table: string, value: Record<string, unknown>) {
    this.insertCount += 1;
    const id = `${table}_${this.insertCount}`;
    this.seed(table, { ...value, _id: id });
    return id;
  }

  async patch(id: string, value: Record<string, unknown>) {
    this.patchCount += 1;
    const row = this.find(id);
    if (!row) throw new Error(`Unknown row: ${id}`);
    Object.assign(row, value);
  }

  async delete(id: string) {
    this.deleteCount += 1;
    for (const rows of this.tables.values()) {
      if (rows.delete(id)) return;
    }
    throw new Error(`Unknown row: ${id}`);
  }

  rows(table: string) {
    return [...this.table(table).values()];
  }

  private table(name: string) {
    let rows = this.tables.get(name);
    if (!rows) {
      rows = new Map();
      this.tables.set(name, rows);
    }
    return rows;
  }

  private find(id: string) {
    for (const rows of this.tables.values()) {
      const row = rows.get(id);
      if (row) return row;
    }
    return null;
  }
}

function convexErrorData(error: unknown): Record<string, unknown> {
  return (error as { data?: Record<string, unknown> }).data ?? {};
}

const PROJECT_ID = "projects_a" as Id<"projects">;

function makeCtx(db = new TestDb()) {
  return { db };
}

async function runUpsert(
  ctx: ReturnType<typeof makeCtx>,
  overrides: Partial<{
    projectId: Id<"projects">;
    platform: "IOS" | "Android";
    productId: string;
    format: "toml" | "json" | "text";
    body: string;
    expectedVersion: number;
  }> = {},
) {
  return await upsertProductClientPayload._handler(ctx, {
    projectId: PROJECT_ID,
    platform: "IOS",
    productId: "premium.monthly",
    format: "json",
    body: '{"tier":"premium"}',
    expectedVersion: 0,
    ...overrides,
  });
}

describe("nextStateForKitProductUpsert", () => {
  it("marks edited products as Draft when no explicit state is requested", () => {
    expect(nextStateForKitProductUpsert()).toBe("Draft");
  });

  it("honors explicit state updates", () => {
    expect(nextStateForKitProductUpsert("Active")).toBe("Active");
    expect(nextStateForKitProductUpsert("Removed")).toBe("Removed");
  });
});

describe("product client payload validation", () => {
  it("accepts valid TOML, object JSON, and opaque text without rewriting", () => {
    expect(() =>
      validateProductClientPayloadBody("toml", 'tier = "premium"'),
    ).not.toThrow();
    expect(() =>
      validateProductClientPayloadBody("json", '{"tier":"premium"}'),
    ).not.toThrow();
    expect(() =>
      validateProductClientPayloadBody("text", "arbitrary = [not parsed"),
    ).not.toThrow();
  });

  it("rejects blank, malformed TOML, and non-object JSON bodies", () => {
    for (const [format, body] of [
      ["text", " \n\t"],
      ["toml", "broken = ["],
      ["json", "{"],
      ["json", "null"],
      ["json", "[]"],
      ["json", '"scalar"'],
    ] as const) {
      try {
        validateProductClientPayloadBody(format, body);
        throw new Error("Expected validation failure");
      } catch (error) {
        expect(convexErrorData(error).code).toBe("CLIENT_PAYLOAD_INVALID");
      }
    }
  });

  it("measures the 16 KiB limit in UTF-8 bytes", () => {
    expect(() =>
      validateProductClientPayloadBody(
        "text",
        "é".repeat(MAX_PRODUCT_CLIENT_PAYLOAD_BYTES / 2),
      ),
    ).not.toThrow();

    try {
      validateProductClientPayloadBody(
        "text",
        "é".repeat(MAX_PRODUCT_CLIENT_PAYLOAD_BYTES / 2 + 1),
      );
      throw new Error("Expected byte limit failure");
    } catch (error) {
      expect(convexErrorData(error)).toMatchObject({
        code: "CLIENT_PAYLOAD_INVALID",
        maxBytes: MAX_PRODUCT_CLIENT_PAYLOAD_BYTES,
      });
    }
  });

  it("reports structured optimistic-concurrency conflicts", () => {
    try {
      assertProductClientPayloadVersion(3, 4);
      throw new Error("Expected version conflict");
    } catch (error) {
      expect(convexErrorData(error)).toEqual({
        code: "CLIENT_PAYLOAD_VERSION_CONFLICT",
        message: "Client payload was changed by another request",
        expectedVersion: 3,
        actualVersion: 4,
      });
    }
  });

  it("requires a non-negative safe-integer expected version", () => {
    for (const expectedVersion of [undefined, -1, 1.5, Number.MAX_VALUE]) {
      try {
        assertProductClientPayloadVersion(expectedVersion as never, null);
        throw new Error("Expected version validation failure");
      } catch (error) {
        expect(convexErrorData(error).code).toBe("CLIENT_PAYLOAD_INVALID");
      }
    }
  });
});

describe("product client payload mutations", () => {
  beforeEach(() => {
    projectMocks.byApiKey.mockReset();
    projectMocks.byProjectId.mockReset();
    projectMocks.byProjectId.mockImplementation(
      async (_ctx: unknown, projectId: string) =>
        projectId === PROJECT_ID
          ? { project: { _id: PROJECT_ID }, role: "member", userId: "user_a" }
          : null,
    );
    projectMocks.byApiKey.mockResolvedValue({
      project: { _id: PROJECT_ID },
    });
  });

  it("requires authenticated project access and an exact existing product", async () => {
    const ctx = makeCtx();

    await expect(
      runUpsert(ctx, { projectId: "projects_other" as Id<"projects"> }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        convexErrorData(error).code === "PROJECT_ACCESS_DENIED",
    );
    await expect(runUpsert(ctx)).rejects.toSatisfy(
      (error: unknown) => convexErrorData(error).code === "PRODUCT_NOT_FOUND",
    );

    ctx.db.seed("products", {
      _id: "product_android",
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium.monthly",
    });
    await expect(runUpsert(ctx)).rejects.toSatisfy(
      (error: unknown) => convexErrorData(error).code === "PRODUCT_NOT_FOUND",
    );
    expect(ctx.db.insertCount).toBe(0);
  });

  it("requires admin key access for programmatic payload writes", async () => {
    const ctx = makeCtx();
    ctx.db.seed("products", {
      _id: "product_ios",
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium.monthly",
    });

    await expect(
      upsertProductClientPayloadWithApiKey._handler(ctx, {
        apiKey: "openiap-kit_sk_admin",
        platform: "IOS",
        productId: "premium.monthly",
        format: "toml",
        body: 'rule = "premium"',
      }),
    ).resolves.toMatchObject({ created: true, version: 1 });
    expect(projectMocks.byApiKey).toHaveBeenCalledWith(
      ctx,
      "openiap-kit_sk_admin",
      "admin",
    );

    await expect(
      removeProductClientPayloadWithApiKey._handler(ctx, {
        apiKey: "openiap-kit_sk_admin",
        platform: "IOS",
        productId: "premium.monthly",
      }),
    ).resolves.toEqual({ ok: true });
    expect(projectMocks.byApiKey).toHaveBeenLastCalledWith(
      ctx,
      "openiap-kit_sk_admin",
      "admin",
    );
  });

  it("creates, updates, and leaves an unchanged save fully idempotent", async () => {
    const ctx = makeCtx();
    ctx.db.seed("products", {
      _id: "product_ios",
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium.monthly",
    });
    const now = vi.spyOn(Date, "now").mockReturnValue(100);

    await expect(runUpsert(ctx, { expectedVersion: 0 })).resolves.toEqual({
      id: "productClientPayloads_1",
      created: true,
      changed: true,
      version: 1,
      updatedAt: 100,
    });
    expect(ctx.db.rows("productClientPayloads")[0]).toMatchObject({
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium.monthly",
      format: "json",
      body: '{"tier":"premium"}',
      version: 1,
      createdAt: 100,
      updatedAt: 100,
    });
    expect(ctx.db.rows("productClientPayloadSummaries")[0]).toMatchObject({
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium.monthly",
      format: "json",
      version: 1,
      createdAt: 100,
      updatedAt: 100,
    });

    await expect(runUpsert(ctx, { expectedVersion: 1 })).resolves.toEqual({
      id: "productClientPayloads_1",
      created: false,
      changed: false,
      version: 1,
      updatedAt: 100,
    });
    expect(ctx.db.patchCount).toBe(0);
    expect(now).toHaveBeenCalledOnce();

    now.mockReturnValue(300);
    await expect(
      runUpsert(ctx, {
        body: '{"tier":"premium","rule":2}',
        expectedVersion: 1,
      }),
    ).resolves.toMatchObject({
      created: false,
      changed: true,
      version: 2,
      updatedAt: 300,
    });
    expect(ctx.db.patchCount).toBe(2);
    expect(ctx.db.rows("productClientPayloads")[0]).toMatchObject({
      version: 2,
      createdAt: 100,
      updatedAt: 300,
    });
    expect(ctx.db.rows("productClientPayloadSummaries")[0]).toMatchObject({
      format: "json",
      version: 2,
      createdAt: 100,
      updatedAt: 300,
    });

    now.mockRestore();
  });

  it("rejects stale writes and removes only the matching payload", async () => {
    const ctx = makeCtx();
    ctx.db.seed("products", {
      _id: "product_ios",
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium.monthly",
    });
    ctx.db.seed("productClientPayloads", {
      _id: "payload_ios",
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium.monthly",
      format: "text",
      body: "ios",
      version: 4,
      createdAt: 1,
      updatedAt: 1,
    });
    ctx.db.seed("productClientPayloadSummaries", {
      _id: "summary_ios",
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium.monthly",
      format: "text",
      version: 4,
      createdAt: 1,
      updatedAt: 1,
    });
    ctx.db.seed("productClientPayloadSummaries", {
      _id: "summary_android",
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium.monthly",
      format: "text",
      version: 7,
      createdAt: 1,
      updatedAt: 1,
    });
    ctx.db.seed("productClientPayloads", {
      _id: "payload_android",
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "premium.monthly",
      format: "text",
      body: "android",
      version: 7,
      createdAt: 1,
      updatedAt: 1,
    });

    await expect(runUpsert(ctx, { expectedVersion: 3 })).rejects.toSatisfy(
      (error: unknown) =>
        convexErrorData(error).code === "CLIENT_PAYLOAD_VERSION_CONFLICT",
    );
    expect(ctx.db.patchCount).toBe(0);

    await expect(
      removeProductClientPayload._handler(ctx, {
        projectId: PROJECT_ID,
        platform: "IOS",
        productId: "premium.monthly",
        expectedVersion: 4,
      }),
    ).resolves.toEqual({ ok: true });
    expect(ctx.db.rows("productClientPayloads")).toHaveLength(1);
    expect(ctx.db.rows("productClientPayloads")[0]?._id).toBe(
      "payload_android",
    );
    expect(ctx.db.rows("productClientPayloadSummaries")).toHaveLength(2);
    expect(
      ctx.db
        .rows("productClientPayloadSummaries")
        .find((row) => row._id === "summary_ios"),
    ).toMatchObject({ version: 5, deleted: true });
    const androidSummary = ctx.db
      .rows("productClientPayloadSummaries")
      .find((row) => row._id === "summary_android");
    expect(androidSummary).toMatchObject({ version: 7 });
    expect(androidSummary).not.toHaveProperty("deleted", true);
  });

  it("keeps a monotonic tombstone revision across remove and recreate", async () => {
    const ctx = makeCtx();
    ctx.db.seed("products", {
      _id: "product_ios",
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium.monthly",
    });
    const now = vi.spyOn(Date, "now");
    now.mockReturnValueOnce(100);

    await expect(runUpsert(ctx, { expectedVersion: 0 })).resolves.toMatchObject(
      { version: 1 },
    );
    now.mockReturnValueOnce(200);
    await expect(
      removeProductClientPayload._handler(ctx, {
        projectId: PROJECT_ID,
        platform: "IOS",
        productId: "premium.monthly",
        expectedVersion: 1,
      }),
    ).resolves.toEqual({ ok: true });
    expect(ctx.db.rows("productClientPayloads")).toEqual([]);
    expect(ctx.db.rows("productClientPayloadSummaries")[0]).toMatchObject({
      version: 2,
      deleted: true,
      updatedAt: 200,
    });

    now.mockReturnValueOnce(300);
    await expect(
      runUpsert(ctx, {
        body: '{"tier":"recreated"}',
        expectedVersion: 2,
      }),
    ).resolves.toMatchObject({ created: true, version: 3, updatedAt: 300 });
    expect(ctx.db.rows("productClientPayloadSummaries")[0]).toMatchObject({
      version: 3,
      deleted: false,
    });

    await expect(
      runUpsert(ctx, {
        body: '{"tier":"stale"}',
        expectedVersion: 1,
      }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        convexErrorData(error).code === "CLIENT_PAYLOAD_VERSION_CONFLICT" &&
        convexErrorData(error).actualVersion === 3,
    );
    expect(ctx.db.rows("productClientPayloads")[0]).toMatchObject({
      body: '{"tier":"recreated"}',
      version: 3,
    });
    now.mockRestore();
  });

  it("retains client payload when the catalog product is removed", async () => {
    const ctx = makeCtx();
    ctx.db.seed("products", {
      _id: "product_ios",
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium.monthly",
    });
    ctx.db.seed("productClientPayloads", {
      _id: "payload_ios",
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium.monthly",
      format: "text",
      body: "survives purge",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    ctx.db.seed("productClientPayloadSummaries", {
      _id: "summary_ios",
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium.monthly",
      format: "text",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
    });

    await expect(
      removeProduct._handler(ctx, {
        apiKey: "key",
        platform: "IOS",
        productId: "premium.monthly",
      }),
    ).resolves.toEqual({ ok: true });
    expect(ctx.db.rows("products")).toHaveLength(1);
    expect(ctx.db.rows("products")[0]).toMatchObject({ state: "Removed" });
    expect(ctx.db.rows("productClientPayloads")).toHaveLength(1);
    expect(ctx.db.rows("productClientPayloadSummaries")).toHaveLength(1);
  });
});

// The dashboard's delete-all depends entirely on this distinction, and
// nothing asserted it: `undefined` means "not specified, keep what is
// stored", an explicit `[]` means "the operator removed them all".
// Convex treats `undefined` in a patch as a no-op, which is why the
// clear has to become `null`.
describe("upsertProduct localization clearing contract", () => {
  const PROJECT = "projects_a" as Id<"projects">;

  const storedLocalizations = (ctx: ReturnType<typeof makeCtx>) =>
    (
      ctx.db.rows("products").find((r) => r._id === "product_android") as
        | { localizations?: unknown }
        | undefined
    )?.localizations;

  function seededCtx() {
    const ctx = makeCtx();
    ctx.db.seed("products", {
      _id: "product_android",
      projectId: PROJECT,
      platform: "Android",
      productId: "premium.monthly",
      type: "Consumable",
      title: "Premium",
      localizations: [{ locale: "ko-KR", title: "프리미엄" }],
    });
    return ctx;
  }

  const base = {
    projectId: PROJECT,
    productId: "premium.monthly",
    platform: "Android" as const,
    type: "Consumable" as const,
    title: "Premium",
  };

  beforeEach(() => {
    projectMocks.byProjectId.mockResolvedValue({
      project: { _id: PROJECT },
      role: "admin",
      userId: "user_a",
    });
  });

  it("preserves stored localizations when the field is omitted", async () => {
    const ctx = seededCtx();
    await upsertProduct._handler(ctx, base);
    expect(storedLocalizations(ctx)).toEqual([
      { locale: "ko-KR", title: "프리미엄" },
    ]);
  });

  it("clears them with null when an explicit empty array is sent", async () => {
    const ctx = seededCtx();
    await upsertProduct._handler(ctx, { ...base, localizations: [] });
    // Not `undefined` — Convex would read that as "leave unchanged" and
    // the next push would republish the locale the operator deleted.
    expect(storedLocalizations(ctx)).toBeNull();
  });

  it("replaces them when a new set is sent", async () => {
    const ctx = seededCtx();
    await upsertProduct._handler(ctx, {
      ...base,
      localizations: [{ locale: "ja-JP", title: "プレミアム" }],
    });
    expect(storedLocalizations(ctx)).toEqual([
      { locale: "ja-JP", title: "プレミアム" },
    ]);
  });
});

describe("upsertProduct sales-region contract", () => {
  const PROJECT = "projects_a" as Id<"projects">;
  const base = {
    projectId: PROJECT,
    productId: "coins",
    platform: "Android" as const,
    type: "Consumable" as const,
    title: "Coins",
  };

  beforeEach(() => {
    projectMocks.byProjectId.mockResolvedValue({
      project: { _id: PROJECT },
      role: "admin",
      userId: "user_a",
    });
  });

  function seededCtx(regions: "all" | string[] = ["US"]) {
    const ctx = makeCtx();
    ctx.db.seed("products", {
      _id: "product_android",
      projectId: PROJECT,
      productId: "coins",
      platform: "Android",
      type: "Consumable",
      title: "Coins",
      regions,
    });
    return ctx;
  }

  const storedRegions = (ctx: ReturnType<typeof makeCtx>) =>
    (
      ctx.db.rows("products").find((row) => row._id === "product_android") as
        | { regions?: unknown }
        | undefined
    )?.regions;

  it("preserves an existing footprint when omitted", async () => {
    const ctx = seededCtx(["US"]);
    await upsertProduct._handler(ctx, base);
    expect(storedRegions(ctx)).toEqual(["US"]);
  });

  it('stores explicit "all" and clears back to inherit with []', async () => {
    const ctx = seededCtx(["US"]);
    await upsertProduct._handler(ctx, { ...base, regions: "all" });
    expect(storedRegions(ctx)).toBe("all");

    await upsertProduct._handler(ctx, { ...base, regions: [] });
    expect(storedRegions(ctx)).toBeNull();
  });

  it("rejects explicit footprints on unsupported products", async () => {
    const ctx = makeCtx();
    await expect(
      upsertProduct._handler(ctx, {
        ...base,
        platform: "IOS",
        regions: "all",
      }),
    ).rejects.toThrow("Sales regions are currently Android-only");

    await expect(
      upsertProduct._handler(ctx, {
        ...base,
        type: "Subscription",
        regions: ["US"],
      }),
    ).rejects.toThrow("Sales regions cannot be set on a subscription");
  });

  it("clears a stale footprint when a product becomes unsupported", async () => {
    const ctx = seededCtx(["US"]);
    await upsertProduct._handler(ctx, {
      ...base,
      type: "Subscription",
    });
    expect(storedRegions(ctx)).toBeNull();
  });

  it("revalidates preserved localizations when the product type changes", async () => {
    const ctx = makeCtx();
    ctx.db.seed("products", {
      _id: "product_android",
      projectId: PROJECT,
      productId: "coins",
      platform: "Android",
      type: "Subscription",
      title: "Coins",
      localizations: [{ locale: "ko-KR", title: "x".repeat(56) }],
    });

    await expect(upsertProduct._handler(ctx, base)).rejects.toThrow(
      /accepts at most 55/,
    );
  });
});
