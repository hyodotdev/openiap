import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getAuthUserId: vi.fn() }));

vi.mock("@convex-dev/auth/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@convex-dev/auth/server")>()),
  getAuthUserId: authMocks.getAuthUserId,
}));

import {
  count as countFiles,
  get as getFile,
  getAppStoreFileByProject,
  getAscApiKeyFileByProject,
  getGooglePlayFileByProject,
  list as listFiles,
} from "../files/query";
import {
  getActiveCount,
  getById as getApiKeyById,
  listProjectApiKeys,
} from "../apiKeys/query";
import {
  getOrganizationReceiptStats,
  getPurchaseById,
  getReceiptsByProject,
} from "../purchases/query";

type Row = Record<string, unknown> & { _id: string };

class IndexBuilder {
  predicates: Array<(row: Row) => boolean> = [];

  eq(field: string, value: unknown): this {
    this.predicates.push((row) => row[field] === value);
    return this;
  }
}

class TestQuery {
  constructor(private readonly rows: Row[]) {}

  withIndex(
    _name: string,
    build: (q: IndexBuilder) => IndexBuilder,
  ): TestQuery {
    const builder = build(new IndexBuilder());
    return new TestQuery(
      this.rows.filter((row) =>
        builder.predicates.every((predicate) => predicate(row)),
      ),
    );
  }

  order(direction: "asc" | "desc"): TestQuery {
    return direction === "desc"
      ? new TestQuery([...this.rows].reverse())
      : new TestQuery([...this.rows]);
  }

  async first(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }

  async collect(): Promise<Row[]> {
    return [...this.rows];
  }

  async paginate(options: {
    numItems: number;
    cursor: string | null;
  }): Promise<{
    page: Row[];
    isDone: boolean;
    continueCursor: string;
  }> {
    const start = options.cursor ? Number(options.cursor) : 0;
    const end = Math.min(start + options.numItems, this.rows.length);
    return {
      page: this.rows.slice(start, end),
      isDone: end >= this.rows.length,
      continueCursor: String(end),
    };
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Row> {
    yield* this.rows;
  }
}

class TestDb {
  constructor(readonly tables: Record<string, Row[]>) {}

  async get(id: string): Promise<Row | null> {
    return (
      Object.values(this.tables)
        .flat()
        .find((row) => row._id === id) ?? null
    );
  }

  query(table: string): TestQuery {
    return new TestQuery(this.tables[table] ?? []);
  }
}

const ORGANIZATION_ID = "organizations_a";
const PROJECT_ID = "projects_a";
const USER_ID = "users_a";

function makeCtx(options: {
  projectPending?: boolean;
  organizationPending?: boolean;
}): { db: TestDb } {
  return {
    db: new TestDb({
      organizations: [
        {
          _id: ORGANIZATION_ID,
          pendingDeletion: options.organizationPending,
        },
      ],
      projects: [
        {
          _id: PROJECT_ID,
          organizationId: ORGANIZATION_ID,
          pendingDeletion: options.projectPending,
        },
      ],
      organizationMembers: [
        {
          _id: "members_a",
          organizationId: ORGANIZATION_ID,
          userId: USER_ID,
          role: "admin",
        },
      ],
      users: [{ _id: USER_ID, name: "Admin", email: "admin@example.com" }],
      userProfiles: [
        { _id: "profiles_a", userId: USER_ID, displayName: "Admin" },
      ],
      apiKeys: [
        {
          _id: "apiKeys_a",
          projectId: PROJECT_ID,
          organizationId: ORGANIZATION_ID,
          key: "openiap-kit_secret1234",
          name: "Production",
          isActive: true,
          createdBy: USER_ID,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      files: [
        {
          _id: "files_a",
          organizationId: ORGANIZATION_ID,
          projectId: PROJECT_ID,
          fileName: "server-key.p8",
          fileType: "application/x-pem-file",
          fileSize: 128,
          purpose: "apple_p8_key",
          isInternal: true,
          uploadedBy: USER_ID,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          _id: "files_b",
          organizationId: ORGANIZATION_ID,
          projectId: PROJECT_ID,
          fileName: "asc-key.p8",
          fileType: "application/x-pem-file",
          fileSize: 128,
          purpose: "apple_p8_asc_api_key",
          isInternal: true,
          uploadedBy: USER_ID,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          _id: "files_c",
          organizationId: ORGANIZATION_ID,
          projectId: PROJECT_ID,
          fileName: "service-account.json",
          fileType: "application/json",
          fileSize: 256,
          purpose: "android_service_account",
          isInternal: true,
          uploadedBy: USER_ID,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      purchases: [
        {
          _id: "purchases_a",
          projectId: PROJECT_ID,
          store: "google",
          applicationId: "dev.openiap.app",
          requestData: { google: { purchaseToken: "token" } },
          state: "Purchased",
          isValid: true,
        },
      ],
      purchaseStats: [
        {
          _id: "purchaseStats_a",
          projectId: PROJECT_ID,
          organizationId: ORGANIZATION_ID,
          total: 7,
          apple: 2,
          google: 5,
          googleOrders: 4,
          valid: 6,
          invalid: 1,
        },
      ],
    }),
  };
}

async function expectProjectReadsHidden(ctx: { db: TestDb }): Promise<void> {
  await expect(
    listFiles._handler(ctx as never, {
      organizationId: ORGANIZATION_ID as never,
      projectId: PROJECT_ID as never,
    }),
  ).resolves.toEqual([]);
  await expect(
    getFile._handler(ctx as never, { fileId: "files_a" as never }),
  ).resolves.toBeNull();
  await expect(
    countFiles._handler(ctx as never, {
      organizationId: ORGANIZATION_ID as never,
    }),
  ).resolves.toBe(0);

  for (const query of [
    getAppStoreFileByProject,
    getAscApiKeyFileByProject,
    getGooglePlayFileByProject,
  ]) {
    await expect(
      query._handler(ctx as never, { projectId: PROJECT_ID as never }),
    ).resolves.toBeNull();
  }

  await expect(
    listProjectApiKeys._handler(ctx as never, {
      projectId: PROJECT_ID as never,
    }),
  ).rejects.toThrow("Project not found");
  await expect(
    getActiveCount._handler(ctx as never, {
      projectId: PROJECT_ID as never,
    }),
  ).rejects.toThrow("Project not found");
  await expect(
    getApiKeyById._handler(ctx as never, { keyId: "apiKeys_a" as never }),
  ).rejects.toThrow("Project not found");

  await expect(
    getReceiptsByProject._handler(ctx as never, {
      projectId: PROJECT_ID as never,
      paginationOpts: { numItems: 10, cursor: null },
    }),
  ).rejects.toThrow("Project not found");
  await expect(
    getPurchaseById._handler(ctx as never, {
      purchaseId: "purchases_a" as never,
    }),
  ).resolves.toBeNull();
  await expect(
    getOrganizationReceiptStats._handler(ctx as never, {
      organizationId: ORGANIZATION_ID as never,
    }),
  ).resolves.toEqual({
    total: 0,
    googleOrders: 0,
    valid: 0,
    invalid: 0,
  });
}

describe("pending-deletion project child query guards", () => {
  beforeEach(() => {
    authMocks.getAuthUserId.mockReset();
    authMocks.getAuthUserId.mockResolvedValue(USER_ID);
  });

  it("hides every file, API-key, and purchase read while the project drains", async () => {
    await expectProjectReadsHidden(makeCtx({ projectPending: true }));
  });

  it("hides every file, API-key, and purchase read while the organization drains", async () => {
    await expectProjectReadsHidden(makeCtx({ organizationPending: true }));
  });

  it("fails closed after the owning organization row has been removed", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.organizations = [];

    await expect(
      getOrganizationReceiptStats._handler(ctx as never, {
        organizationId: ORGANIZATION_ID as never,
      }),
    ).resolves.toEqual({
      total: 0,
      googleOrders: 0,
      valid: 0,
      invalid: 0,
    });
  });

  it("keeps active-project organization aggregates while excluding a draining sibling", async () => {
    const ctx = makeCtx({ projectPending: true });
    ctx.db.tables.projects.push({
      _id: "projects_b",
      organizationId: ORGANIZATION_ID,
    });
    ctx.db.tables.files.push({
      _id: "files_active",
      organizationId: ORGANIZATION_ID,
      projectId: "projects_b",
      fileName: "active.json",
      fileType: "application/json",
      fileSize: 64,
      purpose: "android_service_account",
      isInternal: true,
      uploadedBy: USER_ID,
      createdAt: 2,
      updatedAt: 2,
    });
    ctx.db.tables.purchaseStats.push({
      _id: "purchaseStats_b",
      projectId: "projects_b",
      organizationId: ORGANIZATION_ID,
      total: 3,
      apple: 0,
      google: 3,
      googleOrders: 2,
      valid: 2,
      invalid: 1,
    });

    await expect(
      listFiles._handler(ctx as never, {
        organizationId: ORGANIZATION_ID as never,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ _id: "files_active", projectId: "projects_b" }),
    ]);
    await expect(
      countFiles._handler(ctx as never, {
        organizationId: ORGANIZATION_ID as never,
      }),
    ).resolves.toBe(1);
    await expect(
      getOrganizationReceiptStats._handler(ctx as never, {
        organizationId: ORGANIZATION_ID as never,
      }),
    ).resolves.toEqual({
      total: 3,
      googleOrders: 2,
      valid: 2,
      invalid: 1,
    });
  });

  it("preserves authorized reads for an active project and organization", async () => {
    const ctx = makeCtx({});

    await expect(
      listFiles._handler(ctx as never, {
        organizationId: ORGANIZATION_ID as never,
        projectId: PROJECT_ID as never,
      }),
    ).resolves.toHaveLength(3);
    await expect(
      countFiles._handler(ctx as never, {
        organizationId: ORGANIZATION_ID as never,
      }),
    ).resolves.toBe(3);
    await expect(
      getFile._handler(ctx as never, { fileId: "files_a" as never }),
    ).resolves.toMatchObject({ _id: "files_a", projectId: PROJECT_ID });
    await expect(
      getAppStoreFileByProject._handler(ctx as never, {
        projectId: PROJECT_ID as never,
      }),
    ).resolves.toMatchObject({ _id: "files_a" });
    await expect(
      getAscApiKeyFileByProject._handler(ctx as never, {
        projectId: PROJECT_ID as never,
      }),
    ).resolves.toMatchObject({ _id: "files_b" });
    await expect(
      getGooglePlayFileByProject._handler(ctx as never, {
        projectId: PROJECT_ID as never,
      }),
    ).resolves.toMatchObject({ _id: "files_c" });
    await expect(
      listProjectApiKeys._handler(ctx as never, {
        projectId: PROJECT_ID as never,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        _id: "apiKeys_a",
        keyPreview: "openiap-kit_...1234",
      }),
    ]);
    await expect(
      getActiveCount._handler(ctx as never, {
        projectId: PROJECT_ID as never,
      }),
    ).resolves.toEqual({ total: 1, valid: 1, expired: 0 });
    await expect(
      getApiKeyById._handler(ctx as never, { keyId: "apiKeys_a" as never }),
    ).resolves.toMatchObject({
      _id: "apiKeys_a",
      keyPreview: "openiap-kit_...1234",
      creatorName: "Admin",
    });
    await expect(
      getReceiptsByProject._handler(ctx as never, {
        projectId: PROJECT_ID as never,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).resolves.toMatchObject({
      page: [expect.objectContaining({ _id: "purchases_a" })],
      stats: { total: 7, googleOrders: 4, valid: 6, invalid: 1 },
    });
    await expect(
      getPurchaseById._handler(ctx as never, {
        purchaseId: "purchases_a" as never,
      }),
    ).resolves.toMatchObject({ _id: "purchases_a", projectId: PROJECT_ID });
    await expect(
      getOrganizationReceiptStats._handler(ctx as never, {
        organizationId: ORGANIZATION_ID as never,
      }),
    ).resolves.toEqual({
      total: 7,
      googleOrders: 4,
      valid: 6,
      invalid: 1,
    });
  });
});
