import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getAuthUserId: vi.fn() }));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMocks.getAuthUserId,
}));

vi.mock("../purchases/stats", () => ({
  applyPurchaseStatsDelta: vi.fn().mockResolvedValue({
    wasFirstValidTransition: false,
  }),
  deletePurchaseStatsForProject: vi.fn().mockResolvedValue(undefined),
  deltaForMissingPurchaseStats: vi.fn().mockReturnValue({}),
  deltaForUpdate: vi.fn().mockReturnValue({}),
  mergePurchaseStatsDeltas: vi.fn().mockReturnValue({}),
}));

import {
  create as registeredCreateApiKey,
  remove as registeredRemoveApiKey,
} from "../apiKeys/mutation";
import {
  pruneUploadReservations as registeredPruneUploadReservations,
  UPLOAD_RESERVATION_PRUNE_BATCH_SIZE,
} from "../files/internal";
import {
  generateUploadUrl as registeredGenerateUploadUrl,
  MAX_ACTIVE_FILE_UPLOAD_RESERVATIONS_PER_TARGET,
  saveFile as registeredSaveFile,
} from "../files/mutation";
import { markReceiptInvalid as registeredMarkReceiptInvalid } from "../purchases/mutation";
import { testableFunction } from "../test.setup";

const createApiKey = testableFunction(registeredCreateApiKey);
const removeApiKey = testableFunction(registeredRemoveApiKey);
const generateUploadUrl = testableFunction(registeredGenerateUploadUrl);
const markReceiptInvalid = testableFunction(registeredMarkReceiptInvalid);
const pruneUploadReservations = testableFunction(
  registeredPruneUploadReservations,
);
const saveFile = testableFunction(registeredSaveFile);

const UPLOAD_RESERVATION_ID = "fileUploadReservations_a";

type Row = Record<string, unknown> & { _id: string };

class IndexBuilder {
  predicates: Array<(row: Row) => boolean> = [];

  eq(field: string, value: unknown): this {
    this.predicates.push((row) => row[field] === value);
    return this;
  }

  lte(field: string, value: number): this {
    this.predicates.push(
      (row) => typeof row[field] === "number" && row[field] <= value,
    );
    return this;
  }

  gt(field: string, value: number): this {
    this.predicates.push(
      (row) => typeof row[field] === "number" && row[field] > value,
    );
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

  filter(
    build: (q: {
      field: (name: string) => string;
      eq: (field: string, value: unknown) => (row: Row) => boolean;
    }) => (row: Row) => boolean,
  ): TestQuery {
    const predicate = build({
      field: (name) => name,
      eq: (field, value) => (row) => row[field] === value,
    });
    return new TestQuery(this.rows.filter(predicate));
  }

  async first(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }

  async collect(): Promise<Row[]> {
    return [...this.rows];
  }

  async take(count: number): Promise<Row[]> {
    return this.rows.slice(0, count);
  }
}

class TestDb {
  insertCount = 0;
  patchCount = 0;
  system = {
    get: vi.fn(
      async (
        _table: string,
        id: string,
      ): Promise<{ _id: string; size: number } | null> => ({
        _id: id,
        size: 1,
      }),
    ),
  };

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

  async insert(table: string, value: Record<string, unknown>): Promise<string> {
    this.insertCount += 1;
    const id = `${table}_${this.insertCount}`;
    (this.tables[table] ??= []).push({ _id: id, ...value });
    return id;
  }

  async patch(id: string, value: Record<string, unknown>): Promise<void> {
    const row = await this.get(id);
    if (!row) throw new Error(`Unknown row: ${id}`);
    this.patchCount += 1;
    Object.assign(row, value);
  }

  async delete(id: string): Promise<void> {
    for (const rows of Object.values(this.tables)) {
      const index = rows.findIndex((row) => row._id === id);
      if (index >= 0) {
        rows.splice(index, 1);
        return;
      }
    }
  }
}

function makeCtx(options: {
  projectPending?: boolean;
  organizationPending?: boolean;
}): {
  db: TestDb;
  storage: {
    delete: ReturnType<typeof vi.fn>;
    generateUploadUrl: ReturnType<typeof vi.fn>;
  };
  scheduler: { runAfter: ReturnType<typeof vi.fn> };
} {
  return {
    db: new TestDb({
      organizations: [
        {
          _id: "organizations_a",
          pendingDeletion: options.organizationPending,
        },
      ],
      projects: [
        {
          _id: "projects_a",
          organizationId: "organizations_a",
          pendingDeletion: options.projectPending,
        },
      ],
      organizationMembers: [
        {
          _id: "members_a",
          organizationId: "organizations_a",
          userId: "users_a",
          role: "admin",
        },
      ],
      fileUploadReservations: [
        {
          _id: UPLOAD_RESERVATION_ID,
          organizationId: "organizations_a",
          projectId: "projects_a",
          createdBy: "users_a",
          expiresAt: Date.now() + 60_000,
          cleanupExpiresAt: Date.now() + 120_000,
          validatedGoogleServiceAccount: {
            storageId: "storage_a",
            fileName: "credential.json",
            fileType: "application/json",
            fileSize: 1,
            clientEmail: "service@project.iam.gserviceaccount.com",
          },
          createdAt: Date.now(),
        },
      ],
      purchases: [
        {
          _id: "purchases_a",
          projectId: "projects_a",
          store: "google",
          isValid: true,
        },
      ],
    }),
    storage: {
      delete: vi.fn().mockResolvedValue(undefined),
      generateUploadUrl: vi
        .fn()
        .mockResolvedValue("https://upload.example.test"),
    },
    scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
  };
}

function credentialSaveArgs(storageId: string) {
  return {
    organizationId: "organizations_a" as never,
    projectId: "projects_a" as never,
    uploadReservationId: UPLOAD_RESERVATION_ID as never,
    storageId: storageId as never,
    fileName: "credential.json",
    fileType: "application/json",
    fileSize: 1,
    purpose: "android_service_account" as const,
  };
}

describe("pending-deletion project child write guards", () => {
  beforeEach(() => {
    authMocks.getAuthUserId.mockReset();
    authMocks.getAuthUserId.mockResolvedValue("users_a");
  });

  it("permanently disables legacy fallback before deleting the final scoped key", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.projects[0].apiKey = "legacy-key";
    ctx.db.tables.apiKeys = [
      {
        _id: "apiKeys_a",
        projectId: "projects_a",
        organizationId: "organizations_a",
        key: "legacy-key",
        isActive: true,
      },
    ];

    await expect(
      removeApiKey._handler(ctx as never, {
        keyId: "apiKeys_a" as never,
      }),
    ).resolves.toEqual({ success: true });

    expect(ctx.db.tables.apiKeys).toEqual([]);
    expect(ctx.db.tables.projects[0]).toMatchObject({
      legacyApiKeyFallbackDisabledAt: expect.any(Number),
    });
  });

  for (const options of [
    { projectPending: true },
    { organizationPending: true },
  ]) {
    const owner = options.projectPending ? "project" : "organization";

    it(`rejects stale API-key, file, and purchase writes while the ${owner} drains`, async () => {
      const ctx = makeCtx(options);

      await expect(
        createApiKey._handler(ctx as never, {
          projectId: "projects_a" as never,
          name: "stale key",
          keyType: "publishable",
        }),
      ).rejects.toThrow("Project not found");

      await expect(
        saveFile._handler(ctx as never, {
          organizationId: "organizations_a" as never,
          projectId: "projects_a" as never,
          uploadReservationId: UPLOAD_RESERVATION_ID as never,
          storageId: "storage_a" as never,
          fileName: "stale.json",
          fileType: "application/json",
          fileSize: 1,
          purpose: "android_service_account",
        }),
      ).resolves.toEqual({
        success: false,
        code: "TARGET_PENDING_DELETION",
      });

      await expect(
        markReceiptInvalid._handler(ctx as never, {
          purchaseId: "purchases_a" as never,
        }),
      ).rejects.toThrow("RECEIPT_NOT_FOUND");

      expect(ctx.db.insertCount).toBe(0);
      expect(ctx.db.patchCount).toBe(0);
      expect(ctx.storage.delete).toHaveBeenCalledWith("storage_a");
    });
  }

  it("does not delete storage with another user's reservation", async () => {
    const ctx = makeCtx({ projectPending: true });
    ctx.db.tables.organizationMembers = [];
    ctx.db.tables.fileUploadReservations[0].createdBy = "users_other";

    await expect(
      saveFile._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
        uploadReservationId: UPLOAD_RESERVATION_ID as never,
        storageId: "storage_a" as never,
        fileName: "untrusted.json",
        fileType: "application/json",
        fileSize: 1,
        purpose: "android_service_account",
      }),
    ).rejects.toThrow("Invalid upload reservation");
    expect(ctx.storage.delete).not.toHaveBeenCalled();
    expect(ctx.db.tables.fileUploadReservations).toHaveLength(1);
  });

  it("reclaims a late upload after account deletion removes auth and membership", async () => {
    const ctx = makeCtx({ organizationPending: true });
    ctx.db.tables.organizationMembers = [];
    authMocks.getAuthUserId.mockResolvedValueOnce(null);

    await expect(
      saveFile._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
        uploadReservationId: UPLOAD_RESERVATION_ID as never,
        storageId: "storage_late" as never,
        fileName: "late.json",
        fileType: "application/json",
        fileSize: 1,
        purpose: "android_service_account",
      }),
    ).resolves.toEqual({
      success: false,
      code: "TARGET_PENDING_DELETION",
    });
    expect(ctx.storage.delete).toHaveBeenCalledWith("storage_late");
    expect(ctx.db.tables.fileUploadReservations).toEqual([]);
    expect(ctx.db.tables.files ?? []).toEqual([]);
  });

  it("reclaims an upload when membership disappears but the target stays active", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.organizationMembers = [];

    await expect(
      saveFile._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
        uploadReservationId: UPLOAD_RESERVATION_ID as never,
        storageId: "storage_late" as never,
        fileName: "late.json",
        fileType: "application/json",
        fileSize: 1,
        purpose: "android_service_account",
      }),
    ).resolves.toEqual({
      success: false,
      code: "AUTHORIZATION_LOST",
    });
    expect(ctx.storage.delete).toHaveBeenCalledWith("storage_late");
    expect(ctx.db.tables.fileUploadReservations).toEqual([]);
  });

  it("does not delete a storage blob already claimed by a file row", async () => {
    const ctx = makeCtx({ projectPending: true });
    ctx.db.tables.files = [
      {
        _id: "files_existing",
        organizationId: "organizations_a",
        projectId: "projects_a",
        storageId: "storage_a",
      },
    ];

    await expect(
      saveFile._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
        uploadReservationId: UPLOAD_RESERVATION_ID as never,
        storageId: "storage_a" as never,
        fileName: "already-claimed.json",
        fileType: "application/json",
        fileSize: 1,
        purpose: "android_service_account",
      }),
    ).resolves.toMatchObject({ success: false });
    expect(ctx.storage.delete).not.toHaveBeenCalled();
  });

  it("does not claim an organization avatar as an active file upload", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.organizations[0].avatarFileId = "storage_avatar";

    await expect(
      saveFile._handler(ctx as never, credentialSaveArgs("storage_avatar")),
    ).resolves.toEqual({
      success: false,
      code: "UPLOAD_ALREADY_REGISTERED",
    });
    expect(ctx.storage.delete).not.toHaveBeenCalled();
    expect(ctx.db.tables.files ?? []).toEqual([]);
  });

  it("does not delete an organization avatar during expired-grace cleanup", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.organizations[0].avatarFileId = "storage_avatar";
    ctx.db.tables.fileUploadReservations[0].expiresAt = Date.now() - 1;
    ctx.db.tables.fileUploadReservations[0].cleanupExpiresAt =
      Date.now() + 60_000;

    await expect(
      saveFile._handler(ctx as never, credentialSaveArgs("storage_avatar")),
    ).resolves.toEqual({
      success: false,
      code: "UPLOAD_RESERVATION_EXPIRED",
    });
    expect(ctx.storage.delete).not.toHaveBeenCalled();
    expect(ctx.db.tables.files ?? []).toEqual([]);
  });

  it("does not delete an organization avatar after upload authorization is lost", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.organizations[0].avatarFileId = "storage_avatar";
    ctx.db.tables.organizationMembers = [];

    await expect(
      saveFile._handler(ctx as never, credentialSaveArgs("storage_avatar")),
    ).resolves.toEqual({
      success: false,
      code: "AUTHORIZATION_LOST",
    });
    expect(ctx.storage.delete).not.toHaveBeenCalled();
    expect(ctx.db.tables.files ?? []).toEqual([]);
  });

  it("does not delete an organization avatar while the upload target drains", async () => {
    const ctx = makeCtx({ projectPending: true });
    ctx.db.tables.organizations[0].avatarFileId = "storage_avatar";

    await expect(
      saveFile._handler(ctx as never, credentialSaveArgs("storage_avatar")),
    ).resolves.toEqual({
      success: false,
      code: "TARGET_PENDING_DELETION",
    });
    expect(ctx.storage.delete).not.toHaveBeenCalled();
    expect(ctx.db.tables.files ?? []).toEqual([]);
  });

  it("commits cleanup when the project finished deleting before saveFile", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.projects = [];

    await expect(
      saveFile._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
        uploadReservationId: UPLOAD_RESERVATION_ID as never,
        storageId: "storage_a" as never,
        fileName: "late.json",
        fileType: "application/json",
        fileSize: 1,
        purpose: "android_service_account",
      }),
    ).resolves.toEqual({
      success: false,
      code: "TARGET_PENDING_DELETION",
    });
    expect(ctx.storage.delete).toHaveBeenCalledWith("storage_a");
  });

  it("does not reclaim an unclaimed blob through a project in another organization", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.projects = [
      {
        _id: "projects_other",
        organizationId: "organizations_other",
      },
    ];

    await expect(
      saveFile._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_other" as never,
        uploadReservationId: UPLOAD_RESERVATION_ID as never,
        storageId: "storage_other" as never,
        fileName: "cross-org.json",
        fileType: "application/json",
        fileSize: 1,
        purpose: "android_service_account",
      }),
    ).rejects.toThrow("Invalid upload reservation");
    expect(ctx.storage.delete).not.toHaveBeenCalled();
  });

  it("rejects an active save when the uploaded storage row is already gone", async () => {
    const ctx = makeCtx({});
    ctx.db.system.get.mockResolvedValueOnce(null);

    await expect(
      saveFile._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
        uploadReservationId: UPLOAD_RESERVATION_ID as never,
        storageId: "storage_missing" as never,
        fileName: "missing.json",
        fileType: "application/json",
        fileSize: 1,
        purpose: "android_service_account",
      }),
    ).resolves.toEqual({
      success: false,
      code: "UPLOAD_NOT_FOUND",
    });
    expect(ctx.db.insertCount).toBe(0);
    expect(ctx.db.tables.fileUploadReservations).toEqual([]);
  });

  it("reclaims a slow upload during the bounded cleanup-only grace period", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.fileUploadReservations[0].expiresAt = Date.now() - 1;
    ctx.db.tables.fileUploadReservations[0].cleanupExpiresAt =
      Date.now() + 60_000;

    await expect(
      saveFile._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
        uploadReservationId: UPLOAD_RESERVATION_ID as never,
        storageId: "storage_slow" as never,
        fileName: "slow.json",
        fileType: "application/json",
        fileSize: 1,
        purpose: "android_service_account",
      }),
    ).resolves.toEqual({
      success: false,
      code: "UPLOAD_RESERVATION_EXPIRED",
    });
    expect(ctx.storage.delete).toHaveBeenCalledWith("storage_slow");
    expect(ctx.db.tables.fileUploadReservations).toEqual([]);
    expect(ctx.db.system.get).toHaveBeenCalledWith("_storage", "storage_slow");
  });

  it("does not delete storage after the cleanup capability expires", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.fileUploadReservations[0].expiresAt = Date.now() - 60_000;
    ctx.db.tables.fileUploadReservations[0].cleanupExpiresAt = Date.now() - 1;

    await expect(
      saveFile._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
        uploadReservationId: UPLOAD_RESERVATION_ID as never,
        storageId: "storage_too_late" as never,
        fileName: "too-late.json",
        fileType: "application/json",
        fileSize: 1,
        purpose: "android_service_account",
      }),
    ).resolves.toEqual({
      success: false,
      code: "UPLOAD_RESERVATION_EXPIRED",
    });
    expect(ctx.storage.delete).not.toHaveBeenCalled();
    expect(ctx.db.tables.fileUploadReservations).toEqual([]);
  });

  it("allows only one file row to claim an uploaded storage id", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.files = [
      {
        _id: "files_existing",
        organizationId: "organizations_a",
        projectId: "projects_a",
        storageId: "storage_a",
      },
    ];

    await expect(
      saveFile._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
        uploadReservationId: UPLOAD_RESERVATION_ID as never,
        storageId: "storage_a" as never,
        fileName: "duplicate.json",
        fileType: "application/json",
        fileSize: 1,
        purpose: "android_service_account",
      }),
    ).resolves.toEqual({
      success: false,
      code: "UPLOAD_ALREADY_REGISTERED",
    });
    expect(ctx.db.insertCount).toBe(0);
    expect(ctx.db.system.get).not.toHaveBeenCalled();
    expect(ctx.db.tables.fileUploadReservations).toEqual([]);
  });

  it("reads the storage row immediately before an active file insert", async () => {
    const ctx = makeCtx({});
    const calls: string[] = [];
    ctx.db.system.get.mockImplementationOnce(async (_table, id) => {
      calls.push("storage-read");
      return { _id: id, size: 1 };
    });
    const insert = ctx.db.insert.bind(ctx.db);
    ctx.db.insert = vi.fn(async (table, value) => {
      calls.push("file-insert");
      return await insert(table, value);
    });

    await expect(
      saveFile._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
        uploadReservationId: UPLOAD_RESERVATION_ID as never,
        storageId: "storage_a" as never,
        fileName: "credential.json",
        fileType: "application/json",
        fileSize: 1,
        purpose: "android_service_account",
      }),
    ).resolves.toMatchObject({ success: true });
    expect(calls).toEqual(["storage-read", "file-insert"]);
    expect(ctx.db.tables.fileUploadReservations).toEqual([]);
  });

  it("rejects replay after a reservation is consumed", async () => {
    const ctx = makeCtx({});
    const args = {
      organizationId: "organizations_a" as never,
      projectId: "projects_a" as never,
      uploadReservationId: UPLOAD_RESERVATION_ID as never,
      storageId: "storage_a" as never,
      fileName: "credential.json",
      fileType: "application/json",
      fileSize: 1,
      purpose: "android_service_account" as const,
    };

    await expect(saveFile._handler(ctx as never, args)).resolves.toMatchObject({
      success: true,
    });
    await expect(
      saveFile._handler(ctx as never, {
        ...args,
        storageId: "storage_replay" as never,
      }),
    ).rejects.toThrow("Invalid upload reservation");
    expect(ctx.storage.delete).not.toHaveBeenCalled();
    expect(ctx.db.tables.files).toHaveLength(1);
  });

  it("issues a target-bound reservation before returning an upload URL", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.fileUploadReservations = [];
    const before = Date.now();

    const result = await generateUploadUrl._handler(ctx, {
      organizationId: "organizations_a" as never,
      projectId: "projects_a" as never,
    });

    expect(result).toMatchObject({
      uploadUrl: "https://upload.example.test",
      uploadReservationId: "fileUploadReservations_1",
    });
    expect(result.expiresAt).toBeGreaterThan(before);
    expect(ctx.db.tables.fileUploadReservations).toEqual([
      expect.objectContaining({
        _id: "fileUploadReservations_1",
        organizationId: "organizations_a",
        projectId: "projects_a",
        createdBy: "users_a",
        expiresAt: result.expiresAt,
      }),
    ]);
    expect(ctx.storage.generateUploadUrl).toHaveBeenCalledOnce();
  });

  it("allows the three normal credential uploads but bounds reservation abuse per user and target", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.fileUploadReservations = [];

    for (let index = 0; index < 3; index += 1) {
      await expect(
        generateUploadUrl._handler(ctx as never, {
          organizationId: "organizations_a" as never,
          projectId: "projects_a" as never,
        }),
      ).resolves.toMatchObject({
        uploadUrl: "https://upload.example.test",
      });
    }
    expect(ctx.db.tables.fileUploadReservations).toHaveLength(3);

    for (
      let index = 3;
      index < MAX_ACTIVE_FILE_UPLOAD_RESERVATIONS_PER_TARGET;
      index += 1
    ) {
      await generateUploadUrl._handler(ctx, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
      });
    }

    await expect(
      generateUploadUrl._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
      }),
    ).rejects.toThrow("Too many active upload reservations");
    expect(ctx.db.tables.fileUploadReservations).toHaveLength(
      MAX_ACTIVE_FILE_UPLOAD_RESERVATIONS_PER_TARGET,
    );
    expect(ctx.storage.generateUploadUrl).toHaveBeenCalledTimes(
      MAX_ACTIVE_FILE_UPLOAD_RESERVATIONS_PER_TARGET,
    );
  });

  it("does not count cleanup-expired reservations against the issuance cap", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.fileUploadReservations = Array.from(
      { length: MAX_ACTIVE_FILE_UPLOAD_RESERVATIONS_PER_TARGET },
      (_, index) => ({
        _id: `fileUploadReservations_expired_${index}`,
        organizationId: "organizations_a",
        projectId: "projects_a",
        createdBy: "users_a",
        expiresAt: Date.now() - 60_000,
        cleanupExpiresAt: Date.now() - 1,
        createdAt: Date.now() - 120_000,
      }),
    );

    await expect(
      generateUploadUrl._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
      }),
    ).resolves.toMatchObject({ uploadUrl: "https://upload.example.test" });
    expect(ctx.db.tables.fileUploadReservations).toHaveLength(
      MAX_ACTIVE_FILE_UPLOAD_RESERVATIONS_PER_TARGET + 1,
    );
  });

  it("fails closed before issuing an upload URL for a pending target", async () => {
    const ctx = makeCtx({ projectPending: true });
    ctx.db.tables.fileUploadReservations = [];

    await expect(
      generateUploadUrl._handler(ctx as never, {
        organizationId: "organizations_a" as never,
        projectId: "projects_a" as never,
      }),
    ).rejects.toThrow("Project not found");
    expect(ctx.db.tables.fileUploadReservations).toEqual([]);
    expect(ctx.storage.generateUploadUrl).not.toHaveBeenCalled();
  });

  it("prunes only expired abandoned upload reservations", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.fileUploadReservations = [
      {
        _id: "fileUploadReservations_expired",
        organizationId: "organizations_a",
        projectId: "projects_a",
        createdBy: "users_a",
        expiresAt: Date.now() - 1,
        cleanupExpiresAt: Date.now() - 1,
        createdAt: Date.now() - 60_000,
      },
      {
        _id: "fileUploadReservations_active",
        organizationId: "organizations_a",
        projectId: "projects_a",
        createdBy: "users_a",
        expiresAt: Date.now() + 60_000,
        cleanupExpiresAt: Date.now() + 120_000,
        createdAt: Date.now(),
      },
    ];

    await expect(
      pruneUploadReservations._handler(ctx as never, { batchSize: 10 }),
    ).resolves.toEqual({ deletedCount: 1 });
    expect(ctx.db.tables.fileUploadReservations).toEqual([
      expect.objectContaining({ _id: "fileUploadReservations_active" }),
    ]);
  });

  it("reclaims a validated screenshot blob when its save is abandoned", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.fileUploadReservations = [
      {
        _id: "fileUploadReservations_validated_expired",
        organizationId: "organizations_a",
        projectId: "projects_a",
        createdBy: "users_a",
        expiresAt: Date.now() - 1,
        cleanupExpiresAt: Date.now() - 1,
        validatedAppleReviewScreenshot: {
          storageId: "storage_abandoned",
          fileName: "review.png",
          fileType: "image/png",
          fileSize: 128,
        },
        createdAt: Date.now() - 60_000,
      },
    ];

    await expect(
      pruneUploadReservations._handler(ctx as never, { batchSize: 10 }),
    ).resolves.toEqual({ deletedCount: 1 });
    expect(ctx.storage.delete).toHaveBeenCalledWith("storage_abandoned");
    expect(ctx.db.tables.fileUploadReservations).toEqual([]);
  });

  it("preserves a claimed screenshot blob that gained a live file reference", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.files = [
      {
        _id: "files_review",
        storageId: "storage_claimed",
      },
    ];
    ctx.db.tables.fileUploadReservations = [
      {
        _id: "fileUploadReservations_pending_expired",
        organizationId: "organizations_a",
        projectId: "projects_a",
        createdBy: "users_a",
        expiresAt: Date.now() - 1,
        cleanupExpiresAt: Date.now() - 1,
        pendingAppleReviewScreenshotStorageId: "storage_claimed",
        createdAt: Date.now() - 60_000,
      },
    ];

    await expect(
      pruneUploadReservations._handler(ctx as never, { batchSize: 10 }),
    ).resolves.toEqual({ deletedCount: 1 });
    expect(ctx.storage.delete).not.toHaveBeenCalled();
    expect(ctx.db.tables.fileUploadReservations).toEqual([]);
  });

  it("immediately chains another bounded prune when expired backlog exceeds one batch", async () => {
    const ctx = makeCtx({});
    ctx.db.tables.fileUploadReservations = Array.from(
      { length: UPLOAD_RESERVATION_PRUNE_BATCH_SIZE + 1 },
      (_, index) => ({
        _id: `fileUploadReservations_expired_${index}`,
        organizationId: "organizations_a",
        projectId: "projects_a",
        createdBy: "users_a",
        expiresAt: Date.now() - 60_000,
        cleanupExpiresAt: Date.now() - 1,
        createdAt: Date.now() - 120_000,
      }),
    );

    await expect(
      pruneUploadReservations._handler(ctx as never, {}),
    ).resolves.toEqual({ deletedCount: UPLOAD_RESERVATION_PRUNE_BATCH_SIZE });
    expect(ctx.db.tables.fileUploadReservations).toHaveLength(1);
    expect(ctx.scheduler.runAfter).toHaveBeenCalledWith(0, expect.anything(), {
      batchSize: UPLOAD_RESERVATION_PRUNE_BATCH_SIZE,
    });

    await expect(
      pruneUploadReservations._handler(ctx as never, {
        batchSize: UPLOAD_RESERVATION_PRUNE_BATCH_SIZE,
      }),
    ).resolves.toEqual({ deletedCount: 1 });
    expect(ctx.db.tables.fileUploadReservations).toEqual([]);
    expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
  });
});
