import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getAuthUserId: vi.fn() }));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMocks.getAuthUserId,
}));

import {
  getAppleReviewScreenshotByProjectInternal as registeredGetScreenshot,
  readFileAsBase64 as registeredReadFileAsBase64,
} from "./internal";
import {
  rejectAppleReviewScreenshotValidation as registeredRejectValidation,
  saveFile as registeredSaveFile,
} from "./mutation";
import {
  decodeAppleReviewScreenshot,
  validateAppleReviewScreenshotUpload as registeredValidateUpload,
} from "./action";
import { testableFunction } from "../test.setup";

const getScreenshot = testableFunction(registeredGetScreenshot);
const readFileAsBase64 = testableFunction(
  registeredReadFileAsBase64,
) as unknown as {
  _handler: (ctx: unknown, args: unknown) => Promise<Record<string, unknown>>;
};
const saveFile = testableFunction(registeredSaveFile);
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
  constructor(private readonly rows: Row[]) {}

  withIndex(
    _name: string,
    build: (builder: IndexBuilder) => IndexBuilder,
  ): TestQuery {
    const builder = build(new IndexBuilder());
    return new TestQuery(
      this.rows.filter((row) =>
        builder.predicates.every((predicate) => predicate(row)),
      ),
    );
  }

  filter(build: (builder: FilterBuilder) => RowPredicate): TestQuery {
    const predicate = build(new FilterBuilder());
    return new TestQuery(this.rows.filter(predicate));
  }

  order(direction: "asc" | "desc"): TestQuery {
    return new TestQuery(
      direction === "desc" ? [...this.rows].reverse() : [...this.rows],
    );
  }

  async first(): Promise<Row | null> {
    return this.rows[0] ?? null;
  }

  async collect(): Promise<Row[]> {
    return [...this.rows];
  }
}

class TestDb {
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
    return new TestQuery(this.tables[table] ?? []);
  }

  async insert(table: string, value: Record<string, unknown>): Promise<string> {
    this.insertCounter += 1;
    const id = `${table}_new_${this.insertCounter}`;
    (this.tables[table] ??= []).push({ _id: id, ...value });
    return id;
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
  return {
    ctx: { db, storage },
    db,
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
