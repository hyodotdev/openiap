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
  MAX_CLIENT_PAYLOAD_HISTORY,
  getClientPayloadVersion,
  listClientPayloadVersions,
  publishClientPayload,
  publishClientPayloadDraft,
  removeClientPayload,
  rollbackClientPayload,
  saveClientPayloadDraft,
  type ClientPayloadKey,
} from "./clientPayloads";
import {
  clientPayloadEtag,
  clientPayloadEtagScope,
  clientPayloadKnownVersion,
} from "./clientPayloadHttp";
import {
  discardProductClientPayloadDraft as registeredDiscardDraft,
  publishProductClientPayloadDraft as registeredPublishDraft,
  removeProductClientPayload as registeredRemove,
  rollbackProductClientPayload as registeredRollback,
  saveProductClientPayloadDraft as registeredSaveDraft,
  upsertProductClientPayloadWithApiKey as registeredUpsertWithApiKey,
} from "./mutation";
import {
  getProductClientPayloadIfChanged as registeredIfChanged,
  getProductClientPayloadSdkPreview as registeredSdkPreview,
  getProductClientPayloadWorkspace as registeredWorkspace,
  listProductClientPayloadHistory as registeredHistory,
} from "./query";
import { testableFunction } from "../test.setup";

const saveDraft = testableFunction(registeredSaveDraft);
const discardDraft = testableFunction(registeredDiscardDraft);
const publishDraft = testableFunction(registeredPublishDraft);
const rollback = testableFunction(registeredRollback);
const remove = testableFunction(registeredRemove);
const upsertWithApiKey = testableFunction(registeredUpsertWithApiKey);
const ifChanged = testableFunction(registeredIfChanged);
const sdkPreview = testableFunction(registeredSdkPreview);
const workspace = testableFunction(registeredWorkspace);
const history = testableFunction(registeredHistory);

type Row = Record<string, unknown> & { _id: string };

class IndexBuilder {
  predicates: Array<(row: Row) => boolean> = [];

  eq(field: string, value: unknown) {
    this.predicates.push((row) => row[field] === value);
    return this;
  }

  lte(field: string, value: number) {
    this.predicates.push((row) => Number(row[field]) <= value);
    return this;
  }
}

class MemQuery {
  constructor(private readonly rows: Row[]) {}

  withIndex(_name: string, build?: (q: IndexBuilder) => IndexBuilder) {
    if (!build) return this;
    const builder = build(new IndexBuilder());
    return new MemQuery(
      this.rows.filter((row) => builder.predicates.every((test) => test(row))),
    );
  }

  // Only the versions index is read in order; it sorts by `version`.
  order(direction: "asc" | "desc") {
    const sorted = [...this.rows].sort(
      (a, b) => Number(a.version) - Number(b.version),
    );
    return new MemQuery(direction === "desc" ? sorted.reverse() : sorted);
  }

  async take(limit: number) {
    return this.rows.slice(0, limit);
  }

  async collect() {
    return [...this.rows];
  }

  async unique() {
    if (this.rows.length > 1) throw new Error("Expected unique row");
    return this.rows[0] ?? null;
  }
}

class MemDb {
  tables = new Map<string, Row[]>();
  private nextId = 0;

  rows(table: string): Row[] {
    let rows = this.tables.get(table);
    if (!rows) {
      rows = [];
      this.tables.set(table, rows);
    }
    return rows;
  }

  query(table: string) {
    return new MemQuery(this.rows(table));
  }

  async get(id: string) {
    for (const rows of this.tables.values()) {
      const row = rows.find((candidate) => candidate._id === id);
      if (row) return row;
    }
    return null;
  }

  async insert(table: string, value: Record<string, unknown>) {
    this.nextId += 1;
    const id = `${table}_${this.nextId}`;
    this.rows(table).push({ ...value, _id: id });
    return id;
  }

  async patch(id: string, value: Record<string, unknown>) {
    const row = await this.get(id);
    if (!row) throw new Error(`Unknown row: ${id}`);
    for (const [field, fieldValue] of Object.entries(value)) {
      if (fieldValue === undefined) delete row[field];
      else row[field] = fieldValue;
    }
  }

  async delete(id: string) {
    for (const rows of this.tables.values()) {
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
const USER_ID = "users_admin" as Id<"users">;
const KEY: ClientPayloadKey = {
  projectId: PROJECT_ID,
  platform: "IOS",
  productId: "premium_monthly",
};
const DASHBOARD_ARGS = { ...KEY };
const AUTHOR = { userId: USER_ID };

function makeCtx() {
  const db = new MemDb();
  db.rows("products").push({
    _id: "products_premium",
    projectId: PROJECT_ID,
    platform: "IOS",
    productId: "premium_monthly",
    state: "Active",
  });
  db.rows("users").push({ _id: USER_ID, name: "Hyo" });
  return { db };
}

function errorCode(error: unknown): unknown {
  return (error as { data?: { code?: unknown } }).data?.code;
}

async function publicRead(
  ctx: ReturnType<typeof makeCtx>,
  knownVersion?: number,
) {
  return await ifChanged._handler(ctx, {
    apiKey: "openiap-kit_pk_app",
    platform: "IOS",
    productId: "premium_monthly",
    ...(knownVersion !== undefined ? { knownVersion } : {}),
  });
}

beforeEach(() => {
  projectMocks.byApiKey.mockReset();
  projectMocks.byProjectId.mockReset();
  projectMocks.byApiKey.mockImplementation(
    async (_ctx: unknown, apiKey: string) =>
      apiKey.startsWith("openiap-kit_pk_")
        ? { project: { _id: PROJECT_ID }, keyType: "publishable" }
        : apiKey === "openiap-kit_sk_ci"
          ? {
              project: { _id: PROJECT_ID },
              keyType: "secret",
              keyId: "apiKeys_ci",
            }
          : null,
  );
  projectMocks.byProjectId.mockResolvedValue({
    project: { _id: PROJECT_ID },
    role: "admin",
    userId: USER_ID,
  });
});

describe("client payload drafts", () => {
  it("never reach the app-facing read until published", async () => {
    const ctx = makeCtx();
    await publishClientPayload(ctx as never, KEY, {
      format: "json",
      body: '{"copy":"v1"}',
      author: AUTHOR,
    });
    await saveDraft._handler(ctx, {
      ...DASHBOARD_ARGS,
      format: "json",
      body: '{"copy":"draft"}',
      expectedDraftRevision: 0,
    });

    const beforePublish = await publicRead(ctx);
    expect(beforePublish).toMatchObject({
      status: "found",
      clientPayload: { body: '{"copy":"v1"}', version: 1 },
    });
    // The draft does not move the ETag revision either.
    await expect(publicRead(ctx, 1)).resolves.toEqual({
      status: "not_modified",
      version: 1,
    });

    await publishDraft._handler(ctx, {
      ...DASHBOARD_ARGS,
      expectedVersion: 1,
      expectedDraftRevision: 1,
      note: "Spring copy",
    });
    await expect(publicRead(ctx, 1)).resolves.toMatchObject({
      status: "found",
      clientPayload: { body: '{"copy":"draft"}', version: 2 },
    });
    await expect(
      workspace._handler(ctx, DASHBOARD_ARGS),
    ).resolves.toMatchObject({
      expectedVersion: 2,
      expectedDraftRevision: 2,
      clientPayload: { version: 2 },
    });
    expect(
      (await workspace._handler(ctx, DASHBOARD_ARGS))?.draft,
    ).toBeUndefined();
  });

  it("rejects a draft that was never saved and an unpublished product key", async () => {
    const ctx = makeCtx();
    await expect(
      publishClientPayloadDraft(ctx as never, KEY, { author: AUTHOR }),
    ).rejects.toSatisfy(
      (error) => errorCode(error) === "CLIENT_PAYLOAD_DRAFT_NOT_FOUND",
    );
    await expect(
      saveClientPayloadDraft(
        ctx as never,
        { ...KEY, productId: "missing" },
        { format: "text", body: "x" },
      ),
    ).rejects.toSatisfy((error) => errorCode(error) === "PRODUCT_NOT_FOUND");
  });

  it("validates draft bodies like published ones", async () => {
    const ctx = makeCtx();
    await expect(
      saveClientPayloadDraft(ctx as never, KEY, {
        format: "json",
        body: "[]",
      }),
    ).rejects.toSatisfy(
      (error) => errorCode(error) === "CLIENT_PAYLOAD_INVALID",
    );
  });

  it("refuses to publish a draft over a version published after it was saved", async () => {
    const ctx = makeCtx();
    await saveClientPayloadDraft(ctx as never, KEY, {
      format: "text",
      body: "draft",
    });
    await publishClientPayload(ctx as never, KEY, {
      format: "text",
      body: "newer",
      author: AUTHOR,
    });

    await expect(
      publishClientPayloadDraft(ctx as never, KEY, { author: AUTHOR }),
    ).rejects.toSatisfy(
      (error) => errorCode(error) === "CLIENT_PAYLOAD_VERSION_CONFLICT",
    );
    await expect(
      publishClientPayloadDraft(ctx as never, KEY, {
        expectedVersion: 1,
        author: AUTHOR,
      }),
    ).resolves.toMatchObject({ version: 2 });
  });

  it("guards publish with the draft revision, which never resets", async () => {
    const ctx = makeCtx();
    const first = await saveClientPayloadDraft(ctx as never, KEY, {
      format: "text",
      body: "a",
      expectedDraftRevision: 0,
    });
    expect(first).toMatchObject({ changed: true, revision: 1, baseVersion: 0 });
    await expect(
      saveClientPayloadDraft(ctx as never, KEY, {
        format: "text",
        body: "a",
        expectedDraftRevision: 1,
      }),
    ).resolves.toMatchObject({ changed: false, revision: 1 });

    await publishClientPayloadDraft(ctx as never, KEY, {
      expectedDraftRevision: 1,
      author: AUTHOR,
    });
    // A new draft after publish gets revision 3, so a tab still holding
    // revision 1 cannot publish it.
    await saveClientPayloadDraft(ctx as never, KEY, {
      format: "text",
      body: "b",
    });
    await expect(
      publishClientPayloadDraft(ctx as never, KEY, {
        expectedDraftRevision: 1,
        author: AUTHOR,
      }),
    ).rejects.toSatisfy(
      (error) => errorCode(error) === "CLIENT_PAYLOAD_DRAFT_CONFLICT",
    );
    await expect(
      discardDraft._handler(ctx, {
        ...DASHBOARD_ARGS,
        expectedDraftRevision: 3,
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      discardDraft._handler(ctx, {
        ...DASHBOARD_ARGS,
        expectedDraftRevision: 4,
      }),
    ).resolves.toEqual({ ok: false });
  });
});

describe("client payload history", () => {
  it("keeps versions monotonic across publish, remove, and rollback", async () => {
    const ctx = makeCtx();
    const v1 = await publishClientPayload(ctx as never, KEY, {
      format: "toml",
      body: 'tier = "one"',
      author: AUTHOR,
    });
    const v2 = await publishClientPayload(ctx as never, KEY, {
      format: "toml",
      body: 'tier = "two"',
      expectedVersion: 1,
      author: AUTHOR,
    });
    await removeClientPayload(ctx as never, KEY, {
      expectedVersion: 2,
      author: AUTHOR,
    });
    await expect(publicRead(ctx)).resolves.toEqual({ status: "not_found" });

    const restored = await rollbackClientPayload(ctx as never, KEY, {
      toVersion: 1,
      expectedVersion: 3,
      note: "Restore launch copy",
      author: AUTHOR,
    });
    expect([v1.version, v2.version, restored.version]).toEqual([1, 2, 4]);
    await expect(publicRead(ctx)).resolves.toMatchObject({
      status: "found",
      clientPayload: { body: 'tier = "one"', version: 4 },
    });

    const versions = await listClientPayloadVersions(ctx as never, KEY);
    expect(versions.map((entry) => [entry.version, entry.action])).toEqual([
      [4, "rollback"],
      [3, "remove"],
      [2, "publish"],
      [1, "publish"],
    ]);
    expect(versions[0]).toMatchObject({
      rolledBackFrom: 1,
      note: "Restore launch copy",
      author: { type: "user", name: "Hyo" },
      byteLength: 12,
    });
    expect(versions[1]).not.toHaveProperty("byteLength");

    await expect(
      rollbackClientPayload(ctx as never, KEY, {
        toVersion: 3,
        author: AUTHOR,
      }),
    ).rejects.toSatisfy(
      (error) => errorCode(error) === "CLIENT_PAYLOAD_VERSION_NOT_FOUND",
    );
    await expect(
      rollbackClientPayload(ctx as never, KEY, {
        toVersion: 2,
        expectedVersion: 3,
        author: AUTHOR,
      }),
    ).rejects.toSatisfy(
      (error) => errorCode(error) === "CLIENT_PAYLOAD_VERSION_CONFLICT",
    );
  });

  it("does not add a version when a rollback matches the published body", async () => {
    const ctx = makeCtx();
    await publishClientPayload(ctx as never, KEY, {
      format: "text",
      body: "same",
      author: AUTHOR,
    });
    await expect(
      rollbackClientPayload(ctx as never, KEY, {
        toVersion: 1,
        author: AUTHOR,
      }),
    ).resolves.toMatchObject({ changed: false, version: 1 });
    expect(await listClientPayloadVersions(ctx as never, KEY)).toHaveLength(1);
  });

  it(`retains the newest ${MAX_CLIENT_PAYLOAD_HISTORY} versions`, async () => {
    const ctx = makeCtx();
    for (let index = 1; index <= MAX_CLIENT_PAYLOAD_HISTORY + 5; index += 1) {
      await publishClientPayload(ctx as never, KEY, {
        format: "text",
        body: `v${index}`,
        author: AUTHOR,
      });
    }

    const versions = await listClientPayloadVersions(ctx as never, KEY);
    expect(versions).toHaveLength(MAX_CLIENT_PAYLOAD_HISTORY);
    expect(versions[0]?.version).toBe(MAX_CLIENT_PAYLOAD_HISTORY + 5);
    expect(versions.at(-1)?.version).toBe(6);
    expect(ctx.db.rows("productClientPayloadVersions")).toHaveLength(
      MAX_CLIENT_PAYLOAD_HISTORY,
    );
    await expect(
      getClientPayloadVersion(ctx as never, KEY, 5),
    ).resolves.toBeNull();
    await expect(
      rollbackClientPayload(ctx as never, KEY, {
        toVersion: 5,
        author: AUTHOR,
      }),
    ).rejects.toSatisfy(
      (error) => errorCode(error) === "CLIENT_PAYLOAD_VERSION_NOT_FOUND",
    );
    await expect(
      getClientPayloadVersion(ctx as never, KEY, 6),
    ).resolves.toMatchObject({ version: 6, body: "v6" });
  });

  it("records the direct secret-key PUT with its API key as author", async () => {
    const ctx = makeCtx();
    ctx.db.rows("apiKeys").push({ _id: "apiKeys_ci", name: "CI deploy" });

    await expect(
      upsertWithApiKey._handler(ctx, {
        apiKey: "openiap-kit_sk_ci",
        platform: "IOS",
        productId: "premium_monthly",
        format: "json",
        body: '{"copy":"ci"}',
      }),
    ).resolves.toMatchObject({ created: true, version: 1 });

    await expect(history._handler(ctx, DASHBOARD_ARGS)).resolves.toMatchObject([
      {
        version: 1,
        action: "publish",
        format: "json",
        author: { type: "apiKey", name: "CI deploy" },
      },
    ]);
  });

  it("keeps a payload published before history existed restorable", async () => {
    const ctx = makeCtx();
    ctx.db.rows("productClientPayloads").push({
      _id: "payload_legacy",
      ...KEY,
      format: "text",
      body: "legacy",
      version: 7,
      createdAt: 1,
      updatedAt: 2,
    });
    ctx.db.rows("productClientPayloadSummaries").push({
      _id: "summary_legacy",
      ...KEY,
      format: "text",
      version: 7,
      createdAt: 1,
      updatedAt: 2,
    });

    await publishClientPayload(ctx as never, KEY, {
      format: "text",
      body: "new",
      expectedVersion: 7,
      author: AUTHOR,
    });
    const versions = await listClientPayloadVersions(ctx as never, KEY);
    expect(versions).toEqual([
      expect.objectContaining({ version: 8, action: "publish" }),
      {
        version: 7,
        action: "publish",
        format: "text",
        byteLength: 6,
        createdAt: 2,
      },
    ]);
    await expect(
      rollbackClientPayload(ctx as never, KEY, {
        toVersion: 7,
        author: AUTHOR,
      }),
    ).resolves.toMatchObject({ version: 9 });
  });
});

describe("client payload permissions", () => {
  it("lets members change payloads and records them as authors", async () => {
    const ctx = makeCtx();
    ctx.db.rows("users").push({ _id: "users_member", name: "Member" });
    await publishClientPayload(ctx as never, KEY, {
      format: "text",
      body: "v1",
      author: AUTHOR,
    });
    projectMocks.byProjectId.mockResolvedValue({
      project: { _id: PROJECT_ID },
      role: "member",
      userId: "users_member",
    });

    const discarded = await saveDraft._handler(ctx, {
      ...DASHBOARD_ARGS,
      format: "text",
      body: "scratch",
    });
    await expect(
      discardDraft._handler(ctx, {
        ...DASHBOARD_ARGS,
        expectedDraftRevision: discarded.revision,
      }),
    ).resolves.toEqual({ ok: true });
    const draft = await saveDraft._handler(ctx, {
      ...DASHBOARD_ARGS,
      format: "text",
      body: "member",
    });
    await publishDraft._handler(ctx, {
      ...DASHBOARD_ARGS,
      expectedDraftRevision: draft.revision,
    });
    await rollback._handler(ctx, { ...DASHBOARD_ARGS, toVersion: 1 });
    await expect(
      remove._handler(ctx, { ...DASHBOARD_ARGS, expectedVersion: 3 }),
    ).resolves.toEqual({ ok: true });

    const versions = await listClientPayloadVersions(ctx as never, KEY);
    expect(
      versions.map(({ version, action, author }) => [
        version,
        action,
        author?.name,
      ]),
    ).toEqual([
      [4, "remove", "Member"],
      [3, "rollback", "Member"],
      [2, "publish", "Member"],
      [1, "publish", "Hyo"],
    ]);
  });

  it("rejects publishable keys before any secret-key write", async () => {
    const ctx = makeCtx();
    projectMocks.byApiKey.mockRejectedValueOnce(
      new Error("INSUFFICIENT_SCOPE"),
    );
    await expect(
      upsertWithApiKey._handler(ctx, {
        apiKey: "openiap-kit_pk_app",
        platform: "IOS",
        productId: "premium_monthly",
        format: "text",
        body: "x",
      }),
    ).rejects.toThrow("INSUFFICIENT_SCOPE");
    expect(projectMocks.byApiKey).toHaveBeenCalledWith(
      ctx,
      "openiap-kit_pk_app",
      "admin",
    );
    expect(ctx.db.rows("productClientPayloads")).toEqual([]);
  });
});

describe("client payload SDK preview", () => {
  it("matches the public GET's ETag for the project's publishable key", async () => {
    const ctx = makeCtx();
    ctx.db.rows("apiKeys").push({
      _id: "apiKeys_pk",
      projectId: PROJECT_ID,
      key: "openiap-kit_pk_golden",
      keyType: "publishable",
      isActive: true,
      createdAt: 1,
    });
    await publishClientPayload(ctx as never, KEY, {
      format: "json",
      body: '{"a":1}',
      author: AUTHOR,
    });
    vi.spyOn(Date, "now").mockReturnValue(1784160000000);
    await publishClientPayload(ctx as never, KEY, {
      format: "json",
      body: '{"a":2}',
      author: AUTHOR,
    });
    vi.restoreAllMocks();

    const preview = await sdkPreview._handler(ctx, DASHBOARD_ARGS);
    expect(preview).toMatchObject({
      etagScope: "SqWgLnewTVKwyBe5",
      response: {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache",
          Vary: "Authorization",
          "Content-Type": "application/json",
          ETag: '"iapkit-client-payload-SqWgLnewTVKwyBe5-v2"',
        },
        body: '{"clientPayload":{"format":"json","body":"{\\"a\\":2}","version":2,"updatedAt":1784160000000}}',
      },
    });
    expect(preview?.keyPreview).not.toContain("golden");
  });

  it("shows the 404 an app gets while the product is a Draft", async () => {
    const ctx = makeCtx();
    ctx.db.rows("apiKeys").push({
      _id: "apiKeys_pk",
      projectId: PROJECT_ID,
      key: "openiap-kit_pk_golden",
      keyType: "publishable",
      isActive: true,
      createdAt: 1,
    });
    await publishClientPayload(ctx as never, KEY, {
      format: "text",
      body: "x",
      author: AUTHOR,
    });
    ctx.db.rows("products")[0].state = "Draft";

    await expect(
      sdkPreview._handler(ctx, DASHBOARD_ARGS),
    ).resolves.toMatchObject({ response: { status: 404 } });
  });

  it("keeps the ETag format and If-None-Match parsing stable", async () => {
    const scope = await clientPayloadEtagScope(
      "openiap-kit_pk_golden",
      "IOS",
      "premium_monthly",
    );
    expect(scope).toBe("SqWgLnewTVKwyBe5");
    expect(clientPayloadEtag(scope, 7)).toBe(
      '"iapkit-client-payload-SqWgLnewTVKwyBe5-v7"',
    );
    expect(
      clientPayloadKnownVersion(
        `"other", W/"iapkit-client-payload-${scope}-v7"`,
        scope,
      ),
    ).toBe(7);
    expect(
      clientPayloadKnownVersion(`"iapkit-client-payload-${scope}-v0"`, scope),
    ).toBeUndefined();
  });
});
