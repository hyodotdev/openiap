import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getAuthUserId: vi.fn() }));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMocks.getAuthUserId,
}));

import {
  getAppleReviewScreenshotByProjectInternal as registeredGetScreenshot,
  getGooglePlayFileByProjectInternal as registeredGetGooglePlayFile,
  readFileAsBase64 as registeredReadFileAsBase64,
} from "./internal";
import {
  drainGoogleServiceAccountFiles as registeredDrainGoogleServiceAccountFiles,
  GOOGLE_SERVICE_ACCOUNT_CLEANUP_BATCH_SIZE,
  GOOGLE_SERVICE_ACCOUNT_RECOVERY_PROJECT_BATCH_SIZE,
  resumeGoogleServiceAccountCleanup as registeredResumeGoogleServiceAccountCleanup,
  rejectAppleReviewScreenshotValidation as registeredRejectValidation,
  remove as registeredRemove,
  saveFile as registeredSaveFile,
} from "./mutation";
import {
  decodeAppleReviewScreenshot,
  validateGoogleServiceAccountPrivateKey,
  validateAppleReviewScreenshotUpload as registeredValidateUpload,
} from "./action";
import { validateGoogleServiceAccountContent } from "./validation";
import { testableFunction } from "../test.setup";

const getScreenshot = testableFunction(registeredGetScreenshot);
const getGooglePlayFile = testableFunction(registeredGetGooglePlayFile);
const readFileAsBase64 = testableFunction(
  registeredReadFileAsBase64,
) as unknown as {
  _handler: (ctx: unknown, args: unknown) => Promise<Record<string, unknown>>;
};
const saveFile = testableFunction(registeredSaveFile);
const drainGoogleServiceAccountFiles = testableFunction(
  registeredDrainGoogleServiceAccountFiles,
);
const resumeGoogleServiceAccountCleanup = testableFunction(
  registeredResumeGoogleServiceAccountCleanup,
);
const removeFile = testableFunction(registeredRemove);
const rejectValidation = testableFunction(registeredRejectValidation);
const validateUpload = testableFunction(
  registeredValidateUpload,
) as unknown as {
  _handler: (ctx: unknown, args: unknown) => Promise<{ valid: true }>;
};

const FLAT_PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAEElEQVR4nGP8wwACLGCSAQANBAECv1AVswAAAABJRU5ErkJggg==",
    "base64",
  ),
);
const JPEG_BYTES = Uint8Array.from(
  Buffer.from(
    "/9j/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAKAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABwn/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdAAYqm//Z",
    "base64",
  ),
);

type Row = Record<string, unknown> & { _id: string };
type RowPredicate = (row: Row) => boolean;

class IndexBuilder {
  readonly predicates: RowPredicate[] = [];

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
}

class FilterBuilder {
  field(name: string): string {
    return name;
  }

  eq(field: string, value: unknown): RowPredicate {
    return (row) => row[field] === value;
  }
}

class TestQuery {
  constructor(
    private readonly rows: Row[],
    private readonly usedIndexes: string[],
  ) {}

  withIndex(
    name: string,
    build: (builder: IndexBuilder) => IndexBuilder,
  ): TestQuery {
    this.usedIndexes.push(name);
    const builder = build(new IndexBuilder());
    return new TestQuery(
      this.rows.filter((row) =>
        builder.predicates.every((predicate) => predicate(row)),
      ),
      this.usedIndexes,
    );
  }

  filter(build: (builder: FilterBuilder) => RowPredicate): TestQuery {
    const predicate = build(new FilterBuilder());
    return new TestQuery(this.rows.filter(predicate), this.usedIndexes);
  }

  order(direction: "asc" | "desc"): TestQuery {
    return new TestQuery(
      direction === "desc" ? [...this.rows].reverse() : [...this.rows],
      this.usedIndexes,
    );
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
  readonly usedIndexes: string[] = [];
  readonly system: {
    get: ReturnType<typeof vi.fn>;
  };
  private insertCounter = 0;

  constructor(
    readonly tables: Record<string, Row[]>,
    storageSizes: Record<string, number>,
  ) {
    this.system = {
      get: vi.fn(async (_table: string, id: string) => {
        const size = storageSizes[id];
        return size === undefined ? null : { _id: id, size };
      }),
    };
  }

  async get(id: string): Promise<Row | null> {
    return (
      Object.values(this.tables)
        .flat()
        .find((row) => row._id === id) ?? null
    );
  }

  query(table: string): TestQuery {
    return new TestQuery(this.tables[table] ?? [], this.usedIndexes);
  }

  async insert(table: string, value: Record<string, unknown>): Promise<string> {
    this.insertCounter += 1;
    const id = `${table}_new_${this.insertCounter}`;
    (this.tables[table] ??= []).push({ _id: id, ...value });
    return id;
  }

  async patch(id: string, value: Record<string, unknown>): Promise<void> {
    const row = await this.get(id);
    if (!row) throw new Error(`Unknown row: ${id}`);
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

function makeSaveCtx(args: {
  fileType?: string;
  newSize?: number;
  declaredSize?: number;
}) {
  const now = Date.now();
  const tables: Record<string, Row[]> = {
    organizations: [{ _id: "organizations_a" }],
    projects: [{ _id: "projects_a", organizationId: "organizations_a" }],
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
        _id: "reservation_a",
        organizationId: "organizations_a",
        projectId: "projects_a",
        createdBy: "users_a",
        expiresAt: now + 60_000,
        cleanupExpiresAt: now + 120_000,
        validatedAppleReviewScreenshot: {
          storageId: "storage_new",
          fileName: "new.png",
          fileType: args.fileType ?? "image/png",
          fileSize: args.declaredSize ?? 256,
        },
      },
    ],
    files: [
      {
        _id: "files_old",
        organizationId: "organizations_a",
        projectId: "projects_a",
        uploadedBy: "users_a",
        storageId: "storage_old",
        fileName: "old.png",
        fileType: "image/png",
        fileSize: 128,
        purpose: "apple_iap_review_screenshot",
        isInternal: true,
        createdAt: now - 1_000,
        updatedAt: now - 1_000,
      },
    ],
  };
  const declaredSize = args.declaredSize ?? 256;
  const db = new TestDb(tables, {
    storage_old: 128,
    storage_new: args.newSize ?? declaredSize,
  });
  const storage = { delete: vi.fn(async () => undefined) };
  const scheduler = { runAfter: vi.fn(async () => undefined) };
  return {
    ctx: { db, scheduler, storage },
    db,
    scheduler,
    storage,
    tables,
    saveArgs: {
      organizationId: "organizations_a",
      projectId: "projects_a",
      uploadReservationId: "reservation_a",
      storageId: "storage_new",
      fileName: "new.png",
      fileType: args.fileType ?? "image/png",
      fileSize: declaredSize,
      purpose: "apple_iap_review_screenshot" as const,
      isInternal: true,
    },
  };
}

describe("App Review screenshot private storage", () => {
  beforeEach(() => {
    authMocks.getAuthUserId.mockReset();
    authMocks.getAuthUserId.mockResolvedValue("users_a");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("requires a complete image decode instead of accepting a spoofed header", async () => {
    await expect(
      decodeAppleReviewScreenshot(FLAT_PNG_BYTES, "image/png"),
    ).resolves.toBeUndefined();

    const headerOnly = new Uint8Array(26);
    headerOnly.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    headerOnly.set([0x49, 0x48, 0x44, 0x52], 12);
    headerOnly[25] = 2;
    await expect(
      decodeAppleReviewScreenshot(headerOnly, "image/png"),
    ).rejects.toThrow(/truncated|corrupt|decode/);

    await expect(
      decodeAppleReviewScreenshot(JPEG_BYTES, "image/jpeg"),
    ).resolves.toBeUndefined();
    await expect(
      decodeAppleReviewScreenshot(
        Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
        "image/jpeg",
      ),
    ).rejects.toThrow(/truncated|corrupt|decode/);
  });

  it("rejects incomplete Google service-account JSON and invalid PKCS#8 keys", () => {
    expect(() =>
      validateGoogleServiceAccountContent(
        JSON.stringify({
          type: "service_account",
          client_email: "service@project.iam.gserviceaccount.com",
          private_key:
            "-----BEGIN PRIVATE KEY-----\ngarbage\n-----END PRIVATE KEY-----",
          token_uri: "https://oauth2.googleapis.com/token",
        }),
      ),
    ).not.toThrow();
    expect(() =>
      validateGoogleServiceAccountPrivateKey(
        "-----BEGIN PRIVATE KEY-----\ngarbage\n-----END PRIVATE KEY-----",
      ),
    ).toThrow("invalid private key");
    expect(() =>
      validateGoogleServiceAccountContent(
        JSON.stringify({
          type: "service_account",
          client_email: "project.iam.gserviceaccount.com",
          private_key:
            "-----BEGIN PRIVATE KEY-----\ngarbage\n-----END PRIVATE KEY-----",
          token_uri: "https://oauth2.googleapis.com/token",
        }),
      ),
    ).toThrow("complete service-account JSON");
  });

  it("marks a server-decoded upload pending and then validated", async () => {
    const mutations: Array<Record<string, unknown>> = [];
    const ctx = {
      runQuery: vi
        .fn()
        .mockResolvedValueOnce({
          reservation: {
            _id: "reservation_a",
            organizationId: "organizations_a",
            projectId: "projects_a",
            createdBy: "users_a",
            expiresAt: Date.now() + 60_000,
          },
          storage: { size: FLAT_PNG_BYTES.byteLength },
        })
        .mockResolvedValueOnce({ role: "admin" }),
      runMutation: vi.fn(async (_reference, args) => {
        mutations.push(args as Record<string, unknown>);
      }),
      storage: {
        getUrl: vi.fn(async () => "https://storage.example.test/review.png"),
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response(FLAT_PNG_BYTES, {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
        ),
      ),
    );

    await expect(
      validateUpload._handler(ctx, {
        organizationId: "organizations_a",
        projectId: "projects_a",
        uploadReservationId: "reservation_a",
        storageId: "storage_new",
        fileName: "review.png",
        fileType: "image/png",
        fileSize: FLAT_PNG_BYTES.byteLength,
      }),
    ).resolves.toEqual({ valid: true });
    expect(mutations).toEqual([
      expect.objectContaining({
        uploadReservationId: "reservation_a",
        storageId: "storage_new",
        fileSize: FLAT_PNG_BYTES.byteLength,
      }),
      expect.objectContaining({
        uploadReservationId: "reservation_a",
        storageId: "storage_new",
        fileName: "review.png",
        fileType: "image/png",
      }),
    ]);
  });

  it.each([
    ["member access", "users_a", { role: "member" }, Date.now() + 60_000],
    ["expired reservation", "users_a", { role: "admin" }, Date.now() - 1],
    ["lost session", null, { role: "admin" }, Date.now() + 60_000],
  ])(
    "reclaims the blob after %s",
    async (_label, userId, membership, expiresAt) => {
      authMocks.getAuthUserId.mockResolvedValueOnce(userId);
      const runMutation = vi.fn(async () => undefined);
      const ctx = {
        runQuery: vi
          .fn()
          .mockResolvedValueOnce({
            reservation: {
              _id: "reservation_a",
              organizationId: "organizations_a",
              projectId: "projects_a",
              createdBy: "users_a",
              expiresAt,
            },
            storage: { size: FLAT_PNG_BYTES.byteLength },
          })
          .mockResolvedValueOnce(membership),
        runMutation,
        storage: { getUrl: vi.fn() },
      };

      await expect(
        validateUpload._handler(ctx, {
          organizationId: "organizations_a",
          projectId: "projects_a",
          uploadReservationId: "reservation_a",
          storageId: "storage_new",
          fileName: "review.png",
          fileType: "image/png",
          fileSize: FLAT_PNG_BYTES.byteLength,
        }),
      ).rejects.toThrow();
      expect(runMutation).toHaveBeenCalledOnce();
      expect(runMutation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          uploadReservationId: "reservation_a",
          organizationId: "organizations_a",
          projectId: "projects_a",
          storageId: "storage_new",
        }),
      );
    },
  );

  it("does not clean up another user's reservation", async () => {
    authMocks.getAuthUserId.mockResolvedValueOnce("users_b");
    const runMutation = vi.fn();
    const ctx = {
      runQuery: vi.fn(async () => ({
        reservation: {
          organizationId: "organizations_a",
          projectId: "projects_a",
          createdBy: "users_a",
          expiresAt: Date.now() + 60_000,
        },
        storage: { size: FLAT_PNG_BYTES.byteLength },
      })),
      runMutation,
      storage: { getUrl: vi.fn() },
    };

    await expect(
      validateUpload._handler(ctx, {
        organizationId: "organizations_a",
        projectId: "projects_a",
        uploadReservationId: "reservation_a",
        storageId: "storage_new",
        fileName: "review.png",
        fileType: "image/png",
        fileSize: FLAT_PNG_BYTES.byteLength,
      }),
    ).rejects.toThrow("Invalid upload reservation");
    expect(runMutation).not.toHaveBeenCalled();
  });

  it("preserves an exact blob that a concurrent validation already accepted", async () => {
    const now = Date.now();
    const tables: Record<string, Row[]> = {
      fileUploadReservations: [
        {
          _id: "reservation_a",
          organizationId: "organizations_a",
          projectId: "projects_a",
          createdBy: "users_a",
          expiresAt: now + 60_000,
          cleanupExpiresAt: now + 120_000,
          validatedAppleReviewScreenshot: {
            storageId: "storage_new",
            fileName: "review.png",
            fileType: "image/png",
            fileSize: FLAT_PNG_BYTES.byteLength,
          },
        },
      ],
    };
    const db = new TestDb(tables, {
      storage_new: FLAT_PNG_BYTES.byteLength,
    });
    const storage = { delete: vi.fn(async () => undefined) };

    await rejectValidation._handler({ db, storage }, {
      uploadReservationId: "reservation_a",
      organizationId: "organizations_a",
      projectId: "projects_a",
      storageId: "storage_new",
    } as never);
    expect(storage.delete).not.toHaveBeenCalled();
    expect(tables.fileUploadReservations).toHaveLength(1);
  });

  it("atomically replaces the project slot and reclaims the old blob", async () => {
    const { ctx, storage, tables, saveArgs } = makeSaveCtx({});

    await expect(
      saveFile._handler(ctx as never, saveArgs as never),
    ).resolves.toMatchObject({
      success: true,
      purpose: "apple_iap_review_screenshot",
    });

    expect(tables.files).toHaveLength(1);
    expect(tables.files?.[0]).toMatchObject({
      storageId: "storage_new",
      fileName: "new.png",
    });
    expect(storage.delete).toHaveBeenCalledWith("storage_old");
    expect(tables.fileUploadReservations).toHaveLength(0);
  });

  it("atomically replaces the private Google service-account slot", async () => {
    const { ctx, storage, tables, saveArgs } = makeSaveCtx({});
    Object.assign(tables.files?.[0] ?? {}, {
      storageId: "storage_old",
      fileName: "old.json",
      fileType: "application/json",
      purpose: "android_service_account",
    });
    Object.assign(tables.fileUploadReservations?.[0] ?? {}, {
      validatedGoogleServiceAccount: {
        storageId: "storage_new",
        fileName: "new.json",
        fileType: "application/json",
        fileSize: 256,
        clientEmail: "service@project.iam.gserviceaccount.com",
      },
    });

    const result = await saveFile._handler(ctx, {
      ...saveArgs,
      fileName: "new.json",
      fileType: "application/json",
      purpose: "android_service_account",
      isInternal: false,
    } as never);
    expect(result).toMatchObject({
      success: true,
      purpose: "android_service_account",
    });
    if (!result.success) throw new Error("replacement fixture failed");

    expect(tables.projects?.[0]).toMatchObject({
      googlePlayServiceAccountFileId: result._id,
    });
    expect(tables.files).toHaveLength(2);
    await drainGoogleServiceAccountFiles._handler(ctx, {
      projectId: "projects_a" as never,
      activeFileId: result._id,
    });
    expect(tables.files).toHaveLength(1);
    expect(tables.files?.[0]).toMatchObject({
      storageId: "storage_new",
      fileName: "new.json",
      isInternal: true,
    });
    expect(storage.delete).toHaveBeenCalledWith("storage_old");
  });

  it("does not let a member replace the Google service-account slot", async () => {
    const { ctx, storage, tables, saveArgs } = makeSaveCtx({});
    Object.assign(tables.files?.[0] ?? {}, {
      fileName: "old.json",
      fileType: "application/json",
      purpose: "android_service_account",
    });
    const membership = tables.organizationMembers?.[0];
    if (!membership) throw new Error("membership fixture missing");
    membership.role = "member";

    await expect(
      saveFile._handler(
        ctx as never,
        {
          ...saveArgs,
          fileName: "new.json",
          fileType: "application/json",
          purpose: "android_service_account",
        } as never,
      ),
    ).resolves.toMatchObject({
      success: false,
      code: "INSUFFICIENT_PERMISSIONS",
    });

    expect(tables.files).toHaveLength(1);
    expect(tables.files?.[0]).toMatchObject({
      _id: "files_old",
      purpose: "android_service_account",
    });
    expect(storage.delete).toHaveBeenCalledWith("storage_new");
  });

  it("preserves the current Google credential when replacement validation is absent", async () => {
    const { ctx, storage, tables, saveArgs } = makeSaveCtx({});
    Object.assign(tables.projects?.[0] ?? {}, {
      googlePlayServiceAccountFileId: "files_old",
    });
    Object.assign(tables.files?.[0] ?? {}, {
      fileName: "old.json",
      fileType: "application/json",
      purpose: "android_service_account",
    });

    await expect(
      saveFile._handler(
        ctx as never,
        {
          ...saveArgs,
          fileName: "invalid.json",
          fileType: "application/json",
          purpose: "android_service_account",
        } as never,
      ),
    ).resolves.toMatchObject({ success: false, code: "INVALID_FILE" });

    expect(tables.projects?.[0]).toMatchObject({
      googlePlayServiceAccountFileId: "files_old",
    });
    expect(tables.files).toHaveLength(1);
    expect(tables.files?.[0]?._id).toBe("files_old");
    expect(storage.delete).toHaveBeenCalledWith("storage_new");
  });

  it("uses the newest Google service-account row while legacy duplicates exist", async () => {
    const db = new TestDb(
      {
        projects: [{ _id: "projects_a" }],
        files: [
          {
            _id: "google_old",
            projectId: "projects_a",
            purpose: "android_service_account",
            createdAt: 1,
          },
          {
            _id: "google_other",
            projectId: "projects_b",
            purpose: "android_service_account",
            createdAt: 2,
          },
          {
            _id: "google_new",
            projectId: "projects_a",
            purpose: "android_service_account",
            createdAt: 3,
          },
        ],
      },
      {},
    );

    await expect(
      getGooglePlayFile._handler(
        { db },
        {
          projectId: "projects_a" as never,
        },
      ),
    ).resolves.toMatchObject({ _id: "google_new" });
  });

  it("deletes every legacy Google service-account row in the project slot", async () => {
    const tables: Record<string, Row[]> = {
      organizations: [{ _id: "organizations_a" }],
      projects: [{ _id: "projects_a", organizationId: "organizations_a" }],
      organizationMembers: [
        {
          _id: "members_a",
          organizationId: "organizations_a",
          userId: "users_a",
          role: "admin",
        },
      ],
      files: [
        {
          _id: "google_old",
          organizationId: "organizations_a",
          projectId: "projects_a",
          purpose: "android_service_account",
          storageId: "storage_old",
        },
        {
          _id: "google_new",
          organizationId: "organizations_a",
          projectId: "projects_a",
          purpose: "android_service_account",
          storageId: "storage_new",
        },
      ],
    };
    const db = new TestDb(tables, { storage_old: 10, storage_new: 20 });
    const storage = { delete: vi.fn(async () => undefined) };
    const scheduler = { runAfter: vi.fn(async () => undefined) };

    await expect(
      removeFile._handler(
        { db, scheduler, storage },
        { fileId: "google_new" as never },
      ),
    ).resolves.toEqual({ success: true });

    expect(tables.projects?.[0]).toMatchObject({
      googlePlayServiceAccountFileId: null,
    });
    expect(tables.files).toHaveLength(1);
    await expect(
      getGooglePlayFile._handler({ db }, { projectId: "projects_a" as never }),
    ).resolves.toBeNull();
    await drainGoogleServiceAccountFiles._handler(
      { db, scheduler, storage },
      { projectId: "projects_a" as never, activeFileId: null },
    );
    expect(tables.files).toEqual([]);
    expect(storage.delete).toHaveBeenCalledWith("storage_old");
    expect(storage.delete).toHaveBeenCalledWith("storage_new");
    await expect(
      getGooglePlayFile._handler({ db }, { projectId: "projects_a" as never }),
    ).resolves.toBeNull();
  });

  it("drains legacy Google credentials in bounded pages after revocation", async () => {
    const staleCount = GOOGLE_SERVICE_ACCOUNT_CLEANUP_BATCH_SIZE + 3;
    const googleFiles = Array.from({ length: staleCount }, (_, index) => ({
      _id: `google_${index}`,
      organizationId: "organizations_a",
      projectId: "projects_a",
      purpose: "android_service_account",
      storageId: `storage_${index}`,
    }));
    const unrelatedFiles = Array.from({ length: 5_000 }, (_, index) => ({
      _id: `apple_${index}`,
      organizationId: "organizations_a",
      projectId: "projects_a",
      purpose: "apple_p8_key",
      storageId: `apple_storage_${index}`,
    }));
    const files = [...unrelatedFiles, ...googleFiles];
    const tables: Record<string, Row[]> = {
      organizations: [{ _id: "organizations_a" }],
      projects: [{ _id: "projects_a", organizationId: "organizations_a" }],
      organizationMembers: [
        {
          _id: "members_a",
          organizationId: "organizations_a",
          userId: "users_a",
          role: "admin",
        },
      ],
      files,
    };
    const db = new TestDb(
      tables,
      Object.fromEntries(
        googleFiles.map((file, index) => [file.storageId, index + 1]),
      ),
    );
    const storage = { delete: vi.fn(async () => undefined) };
    const scheduler = { runAfter: vi.fn(async () => undefined) };

    await removeFile._handler(
      { db, scheduler, storage },
      { fileId: `google_${staleCount - 1}` as never },
    );
    await drainGoogleServiceAccountFiles._handler(
      { db, scheduler, storage },
      { projectId: "projects_a" as never, activeFileId: null },
    );

    expect(
      tables.files?.filter(
        (file) => file.purpose === "android_service_account",
      ),
    ).toHaveLength(2);
    expect(
      tables.files?.filter((file) => file.purpose === "apple_p8_key"),
    ).toHaveLength(unrelatedFiles.length);
    expect(db.usedIndexes).toContain("by_project_and_purpose");
    expect(storage.delete).toHaveBeenCalledTimes(
      GOOGLE_SERVICE_ACCOUNT_CLEANUP_BATCH_SIZE + 1,
    );
    expect(scheduler.runAfter).toHaveBeenCalledTimes(2);
    await expect(
      getGooglePlayFile._handler({ db }, { projectId: "projects_a" as never }),
    ).resolves.toBeNull();
  });

  it("recovers a missed Google credential cleanup schedule", async () => {
    const tables: Record<string, Row[]> = {
      projects: [
        {
          _id: "projects_a",
          googlePlayServiceAccountFileId: null,
          googlePlayServiceAccountCleanupPending: true,
          googlePlayServiceAccountCleanupRecoveryAt: 0,
        },
      ],
      files: [
        {
          _id: "google_stale",
          projectId: "projects_a",
          purpose: "android_service_account",
          storageId: "storage_stale",
        },
      ],
    };
    const db = new TestDb(tables, { storage_stale: 10 });
    const scheduler = { runAfter: vi.fn(async () => undefined) };
    const storage = { delete: vi.fn(async () => undefined) };

    await resumeGoogleServiceAccountCleanup._handler({ db, scheduler }, {});

    expect(scheduler.runAfter).toHaveBeenCalledWith(0, expect.anything(), {
      projectId: "projects_a",
      activeFileId: null,
    });
    expect(db.usedIndexes).toContain("by_google_service_account_cleanup");

    await drainGoogleServiceAccountFiles._handler(
      { db, scheduler, storage },
      { projectId: "projects_a" as never, activeFileId: null },
    );
    expect(tables.files).toEqual([]);
    expect(tables.projects?.[0]).toMatchObject({
      googlePlayServiceAccountCleanupPending: false,
    });
  });

  it("rotates cleanup recovery so a failing head batch cannot starve the tail", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000));
    const projectCount = GOOGLE_SERVICE_ACCOUNT_RECOVERY_PROJECT_BATCH_SIZE + 1;
    const projects = Array.from({ length: projectCount }, (_, index) => ({
      _id: `projects_${index}`,
      googlePlayServiceAccountFileId: `google_${index}`,
      googlePlayServiceAccountCleanupPending: true,
      googlePlayServiceAccountCleanupRecoveryAt: 0,
    }));
    const db = new TestDb({ projects }, {});
    const scheduler = { runAfter: vi.fn(async () => undefined) };

    await resumeGoogleServiceAccountCleanup._handler({ db, scheduler }, {});
    expect(scheduler.runAfter).toHaveBeenCalledTimes(
      GOOGLE_SERVICE_ACCOUNT_RECOVERY_PROJECT_BATCH_SIZE,
    );

    await resumeGoogleServiceAccountCleanup._handler({ db, scheduler }, {});
    expect(scheduler.runAfter).toHaveBeenCalledTimes(projectCount);
    expect(scheduler.runAfter).toHaveBeenLastCalledWith(0, expect.anything(), {
      projectId: `projects_${projectCount - 1}`,
      activeFileId: `google_${projectCount - 1}`,
    });
  });

  it("removes a stale Google credential without revoking the active pointer", async () => {
    const tables: Record<string, Row[]> = {
      organizations: [{ _id: "organizations_a" }],
      projects: [
        {
          _id: "projects_a",
          organizationId: "organizations_a",
          googlePlayServiceAccountFileId: "google_active",
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
      files: [
        {
          _id: "google_stale",
          organizationId: "organizations_a",
          projectId: "projects_a",
          purpose: "android_service_account",
          storageId: "storage_stale",
        },
        {
          _id: "google_active",
          organizationId: "organizations_a",
          projectId: "projects_a",
          purpose: "android_service_account",
          storageId: "storage_active",
        },
      ],
    };
    const db = new TestDb(tables, {
      storage_stale: 10,
      storage_active: 20,
    });
    const storage = { delete: vi.fn(async () => undefined) };
    const scheduler = { runAfter: vi.fn(async () => undefined) };

    await removeFile._handler(
      { db, scheduler, storage },
      { fileId: "google_stale" as never },
    );

    expect(tables.projects?.[0]).toMatchObject({
      googlePlayServiceAccountFileId: "google_active",
    });
    expect(tables.files).toHaveLength(1);
    expect(tables.files?.[0]?._id).toBe("google_active");
    expect(storage.delete).toHaveBeenCalledWith("storage_stale");
    expect(scheduler.runAfter).not.toHaveBeenCalled();
    await expect(
      getGooglePlayFile._handler({ db }, { projectId: "projects_a" as never }),
    ).resolves.toMatchObject({ _id: "google_active" });
  });

  it("forces the screenshot slot to internal even when a caller sends false", async () => {
    const { ctx, tables, saveArgs } = makeSaveCtx({});

    await expect(
      saveFile._handler(
        ctx as never,
        {
          ...saveArgs,
          isInternal: false,
        } as never,
      ),
    ).resolves.toMatchObject({ success: true });

    expect(tables.files).toHaveLength(1);
    expect(tables.files?.[0]?.isInternal).toBe(true);
  });

  it("rejects invalid metadata, deletes the unclaimed blob, and preserves the old slot", async () => {
    const { ctx, storage, tables, saveArgs } = makeSaveCtx({
      fileType: "application/octet-stream",
    });

    await expect(
      saveFile._handler(ctx as never, saveArgs as never),
    ).resolves.toMatchObject({
      success: false,
      code: "INVALID_FILE",
    });
    expect(tables.files).toHaveLength(1);
    expect(tables.files?.[0]?._id).toBe("files_old");
    expect(storage.delete).toHaveBeenCalledWith("storage_new");
  });

  it("rejects a declared size that differs from Convex storage metadata", async () => {
    const { ctx, storage, tables, saveArgs } = makeSaveCtx({
      declaredSize: 256,
      newSize: 300,
    });

    await expect(
      saveFile._handler(ctx as never, saveArgs as never),
    ).resolves.toMatchObject({
      success: false,
      code: "INVALID_FILE",
      message: expect.stringMatching(/size does not match/),
    });
    expect(tables.files).toHaveLength(1);
    expect(storage.delete).toHaveBeenCalledWith("storage_new");
  });

  it("rejects a screenshot that skipped server-side binary validation", async () => {
    const { ctx, storage, tables, saveArgs } = makeSaveCtx({});
    const reservation = tables.fileUploadReservations?.[0];
    if (!reservation) throw new Error("reservation fixture missing");
    delete reservation.validatedAppleReviewScreenshot;

    await expect(
      saveFile._handler(ctx as never, saveArgs as never),
    ).resolves.toMatchObject({
      success: false,
      code: "INVALID_FILE",
      message: expect.stringMatching(/not validated/),
    });
    expect(tables.files).toHaveLength(1);
    expect(tables.files?.[0]?._id).toBe("files_old");
    expect(storage.delete).toHaveBeenCalledWith("storage_new");
    expect(tables.fileUploadReservations).toHaveLength(0);
  });

  it("does not let a member replace the admin-managed screenshot slot", async () => {
    const { ctx, storage, tables, saveArgs } = makeSaveCtx({});
    const membership = tables.organizationMembers?.[0];
    if (!membership) throw new Error("membership fixture missing");
    membership.role = "member";

    await expect(
      saveFile._handler(ctx as never, saveArgs as never),
    ).resolves.toMatchObject({
      success: false,
      code: "INSUFFICIENT_PERMISSIONS",
    });
    expect(tables.files).toHaveLength(1);
    expect(tables.files?.[0]?._id).toBe("files_old");
    expect(storage.delete).toHaveBeenCalledWith("storage_new");
    expect(tables.fileUploadReservations).toHaveLength(0);
  });

  it("looks up only the newest screenshot for the exact project", async () => {
    const ctx = {
      db: new TestDb(
        {
          files: [
            {
              _id: "org_default",
              purpose: "apple_iap_review_screenshot",
              fileName: "org.png",
            },
            {
              _id: "project_a_old",
              storageId: "storage_old",
              projectId: "projects_a",
              purpose: "apple_iap_review_screenshot",
              fileName: "old.png",
              fileType: "image/png",
              fileSize: 10,
              createdAt: 1,
            },
            {
              _id: "project_b",
              projectId: "projects_b",
              purpose: "apple_iap_review_screenshot",
              fileName: "other.png",
            },
            {
              _id: "project_a_new",
              storageId: "storage_new",
              projectId: "projects_a",
              purpose: "apple_iap_review_screenshot",
              fileName: "new.png",
              fileType: "image/png",
              fileSize: 20,
              createdAt: 2,
            },
          ],
        },
        {},
      ),
      storage: {
        getUrl: vi.fn(async (storageId: string) =>
          storageId === "storage_new"
            ? "https://storage.example.test/private-new"
            : null,
        ),
      },
    };

    await expect(
      getScreenshot._handler(
        ctx as never,
        { projectId: "projects_a" } as never,
      ),
    ).resolves.toEqual({
      fileId: "project_a_new",
      fileName: "new.png",
      fileType: "image/png",
      fileSize: 20,
      createdAt: 2,
      storageUrl: "https://storage.example.test/private-new",
    });
  });

  it("returns binary content through an internal action without a storage id or URL", async () => {
    const ctx = {
      runQuery: vi.fn(async () => ({
        _id: "files_a",
        storageId: "storage_private",
        fileName: "review.jpg",
        fileType: "image/jpeg",
        fileSize: 4,
        purpose: "apple_iap_review_screenshot",
      })),
      storage: {
        get: vi.fn(
          async () => new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])]),
        ),
      },
    };

    const result = await readFileAsBase64._handler(ctx, {
      fileId: "files_a",
    });
    expect(result).toMatchObject({
      fileId: "files_a",
      fileName: "review.jpg",
      fileType: "image/jpeg",
      fileSize: 4,
      purpose: "apple_iap_review_screenshot",
      content: "/9j/2Q==",
    });
    expect(result).not.toHaveProperty("storageId");
    expect(result).not.toHaveProperty("url");
  });
});
