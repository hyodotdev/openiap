import { describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";

const apiKeyMocks = vi.hoisted(() => ({ getApiKeyByKey: vi.fn() }));

vi.mock("../apiKeys/helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../apiKeys/helpers")>()),
  getApiKeyByKey: apiKeyMocks.getApiKeyByKey,
}));

import {
  deleteProjectWithData,
  getProjectById,
  resolveProjectByApiKeyFromDb,
} from "./helpers";
import {
  continueProjectDeletion as registeredContinueProjectDeletion,
  drainPendingProjectDeletion as registeredDrainPendingProjectDeletion,
} from "./internal";
import { testableFunction } from "../test.setup";

const continueProjectDeletion = testableFunction(
  registeredContinueProjectDeletion,
);
const drainPendingProjectDeletion = testableFunction(
  registeredDrainPendingProjectDeletion,
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
  constructor(
    private readonly rows: Row[],
    private readonly recordTake: (count: number) => void,
  ) {}

  withIndex(_name: string, build: (q: IndexBuilder) => IndexBuilder) {
    const builder = build(new IndexBuilder());
    return new TestQuery(
      this.rows.filter((row) => builder.predicates.every((test) => test(row))),
      this.recordTake,
    );
  }

  async take(count: number) {
    this.recordTake(count);
    return this.rows.slice(0, count);
  }

  async collect() {
    return [...this.rows];
  }

  async first() {
    return this.rows[0] ?? null;
  }
}

class TestDb {
  takeSizes: number[] = [];
  missingStorageIds = new Set<string>();
  system = {
    get: vi.fn(async (_table: string, id: string) =>
      this.missingStorageIds.has(id) ? null : { _id: id },
    ),
  };

  constructor(readonly tables: Record<string, Row[]>) {}

  async get(id: string) {
    return (
      Object.values(this.tables)
        .flat()
        .find((row) => row._id === id) ?? null
    );
  }

  query(table: string) {
    return new TestQuery(this.tables[table] ?? [], (count) => {
      this.takeSizes.push(count);
    });
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

describe("deleteProjectWithData", () => {
  it("drains every project-owned table in bounded scheduled pages", async () => {
    const rows = (prefix: string, extra: Record<string, unknown> = {}) =>
      Array.from({ length: 11 }, (_, index) => ({
        _id: `${prefix}_${index}`,
        projectId: PROJECT_ID,
        ...extra,
      }));
    const webhookEvents = Array.from({ length: 3 }, (_, index) => ({
      _id: `webhook_event_${index}`,
      projectId: PROJECT_ID,
    }));
    const db = new TestDb({
      projects: [{ _id: PROJECT_ID }],
      productClientPayloads: rows("payload", {
        body: "x".repeat(16 * 1024),
      }),
      productClientPayloadSummaries: rows("summary"),
      apiKeys: rows("api_key"),
      purchases: rows("purchase", { rawSignedPayload: "signed" }),
      files: rows("file").map((row, index) => ({
        ...row,
        storageId: `storage_${index}`,
        purpose:
          index === 0
            ? "apple_iap_review_screenshot"
            : "android_service_account",
      })),
      outboundDeliveryQueues: rows("outbound_queue"),
      outboundDeliveries: rows("outbound_delivery"),
      outboundDestinations: rows("outbound_destination"),
      commerceEvents: rows("commerce_event"),
      webhookIdempotencyKeys: [
        ...rows("webhook_key"),
        ...webhookEvents.map((event, index) => ({
          _id: `legacy_webhook_key_${index}`,
          eventId: event._id,
        })),
      ],
      webhookEvents,
      subscriptionUserErasureJobs: rows("subscription_erasure_job"),
      subscriptionTokenAliases: rows("subscription_alias"),
      subscriptions: rows("subscription"),
      subscriptionStats: rows("subscription_stats"),
      revenueMetricsDaily: rows("revenue_daily"),
      revenueMetricsRunStatus: rows("revenue_run"),
      products: rows("product"),
      productSyncJobs: rows("product_job", { result: "large" }),
      purchaseStats: rows("purchase_stats"),
    });
    const scheduler = { runAfter: vi.fn().mockResolvedValue(undefined) };
    const storage = { delete: vi.fn().mockResolvedValue(undefined) };
    const ctx = { db, scheduler, storage };

    let complete = false;
    let calls = 0;
    while (!complete && calls < 100) {
      complete = await deleteProjectWithData(ctx as never, PROJECT_ID);
      calls += 1;
    }

    expect(complete).toBe(true);
    expect(calls).toBe(42);
    expect(scheduler.runAfter).toHaveBeenCalledTimes(calls - 1);
    expect(db.takeSizes.every((size) => size === 10)).toBe(true);
    for (const [table, tableRows] of Object.entries(db.tables)) {
      expect(tableRows, table).toEqual([]);
    }
    expect(db.tables.projects).toEqual([]);
    expect(storage.delete).toHaveBeenCalledTimes(11);
    expect(storage.delete).toHaveBeenCalledWith("storage_0");
  });

  it("recovers a pending deletion and tolerates a duplicate continuation", async () => {
    const db = new TestDb({
      projects: [{ _id: PROJECT_ID, pendingDeletion: true }],
      productClientPayloads: Array.from({ length: 11 }, (_, index) => ({
        _id: `payload_${index}`,
        projectId: PROJECT_ID,
        body: "x".repeat(16 * 1024),
      })),
      productClientPayloadSummaries: [],
      apiKeys: [],
      purchases: [],
      files: [],
    });
    const ctx = {
      db,
      scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
      storage: { delete: vi.fn().mockResolvedValue(undefined) },
    };

    await expect(
      drainPendingProjectDeletion._handler(ctx as never, {}),
    ).resolves.toEqual({ progressed: true, projectId: PROJECT_ID });
    expect(db.tables.productClientPayloads).toHaveLength(1);
    expect(db.tables.projects).toHaveLength(1);

    await expect(
      drainPendingProjectDeletion._handler(ctx as never, {}),
    ).resolves.toEqual({ progressed: true, projectId: PROJECT_ID });
    expect(db.tables.productClientPayloads).toEqual([]);
    expect(db.tables.projects).toHaveLength(1);

    await expect(
      drainPendingProjectDeletion._handler(ctx as never, {}),
    ).resolves.toEqual({ progressed: true, projectId: PROJECT_ID });
    expect(db.tables.projects).toEqual([]);

    await expect(
      continueProjectDeletion._handler(ctx as never, { projectId: PROJECT_ID }),
    ).resolves.toBeNull();
    await expect(
      drainPendingProjectDeletion._handler(ctx as never, {}),
    ).resolves.toEqual({ progressed: false, projectId: null });
  });

  it("deletes a file row and completes when its storage blob is already absent", async () => {
    const db = new TestDb({
      projects: [{ _id: PROJECT_ID, pendingDeletion: true }],
      files: [
        {
          _id: "file_missing_blob",
          projectId: PROJECT_ID,
          storageId: "storage_missing",
        },
      ],
    });
    db.missingStorageIds.add("storage_missing");
    const storage = { delete: vi.fn().mockResolvedValue(undefined) };
    const ctx = {
      db,
      scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
      storage,
    };

    await expect(
      deleteProjectWithData(ctx as never, PROJECT_ID as never),
    ).resolves.toBe(false);
    await expect(
      deleteProjectWithData(ctx as never, PROJECT_ID as never),
    ).resolves.toBe(true);
    expect(db.tables.files).toEqual([]);
    expect(db.tables.projects).toEqual([]);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("preserves storage when a legacy organization avatar shares the project file blob", async () => {
    const db = new TestDb({
      projects: [{ _id: PROJECT_ID, pendingDeletion: true }],
      organizations: [
        {
          _id: "organizations_a",
          avatarFileId: "storage_shared",
        },
      ],
      files: [
        {
          _id: "file_shared_with_avatar",
          projectId: PROJECT_ID,
          storageId: "storage_shared",
        },
      ],
    });
    const storage = { delete: vi.fn().mockResolvedValue(undefined) };
    const ctx = {
      db,
      scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
      storage,
    };

    await expect(
      deleteProjectWithData(ctx as never, PROJECT_ID as never),
    ).resolves.toBe(false);
    expect(db.tables.files).toEqual([]);
    expect(db.tables.organizations).toEqual([
      expect.objectContaining({ avatarFileId: "storage_shared" }),
    ]);
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

describe("resolveProjectByApiKeyFromDb", () => {
  it("allows publishable keys for client reads and secret keys for admin operations", async () => {
    const db = new TestDb({
      projects: [
        {
          _id: PROJECT_ID,
          organizationId: "organizations_a",
        },
      ],
      organizations: [{ _id: "organizations_a" }],
    });

    apiKeyMocks.getApiKeyByKey.mockResolvedValueOnce({
      _id: "api_key_publishable",
      projectId: PROJECT_ID,
      organizationId: "organizations_a",
      isActive: true,
      keyType: "publishable",
    });
    await expect(
      resolveProjectByApiKeyFromDb({ db } as never, "publishable-key"),
    ).resolves.toMatchObject({
      project: { _id: PROJECT_ID },
      keyType: "publishable",
    });

    apiKeyMocks.getApiKeyByKey.mockResolvedValueOnce({
      _id: "api_key_secret",
      projectId: PROJECT_ID,
      organizationId: "organizations_a",
      isActive: true,
      keyType: "secret",
    });
    await expect(
      resolveProjectByApiKeyFromDb({ db } as never, "secret-key", "admin"),
    ).resolves.toMatchObject({
      project: { _id: PROJECT_ID },
      keyType: "secret",
    });
  });

  it("treats current unclassified and legacy project keys as publishable", async () => {
    const db = new TestDb({
      projects: [
        {
          _id: PROJECT_ID,
          organizationId: "organizations_a",
          apiKey: "legacy-key",
        },
      ],
      organizations: [{ _id: "organizations_a" }],
    });

    apiKeyMocks.getApiKeyByKey.mockResolvedValueOnce({
      _id: "api_key_unclassified",
      projectId: PROJECT_ID,
      organizationId: "organizations_a",
      isActive: true,
    });
    await expect(
      resolveProjectByApiKeyFromDb(
        { db } as never,
        "unclassified-key",
        "admin",
      ),
    ).rejects.toThrow("INSUFFICIENT_SCOPE");

    apiKeyMocks.getApiKeyByKey.mockResolvedValueOnce(null);
    await expect(
      resolveProjectByApiKeyFromDb({ db } as never, "legacy-key", "admin"),
    ).rejects.toThrow("INSUFFICIENT_SCOPE");
  });

  it("never revives the legacy project key after scoped keys are issued or removed", async () => {
    apiKeyMocks.getApiKeyByKey.mockResolvedValue(null);
    const dbWithScopedKey = new TestDb({
      projects: [
        {
          _id: PROJECT_ID,
          organizationId: "organizations_a",
          apiKey: "legacy-key",
        },
      ],
      organizations: [{ _id: "organizations_a" }],
      apiKeys: [
        {
          _id: "api_key_new",
          projectId: PROJECT_ID,
          organizationId: "organizations_a",
          key: "new-key",
          isActive: true,
        },
      ],
    });
    await expect(
      resolveProjectByApiKeyFromDb(
        { db: dbWithScopedKey } as never,
        "legacy-key",
      ),
    ).resolves.toBeNull();

    const dbAfterRemoval = new TestDb({
      projects: [
        {
          _id: PROJECT_ID,
          organizationId: "organizations_a",
          apiKey: "legacy-key",
          legacyApiKeyFallbackDisabledAt: 123,
        },
      ],
      organizations: [{ _id: "organizations_a" }],
      apiKeys: [],
    });
    await expect(
      resolveProjectByApiKeyFromDb(
        { db: dbAfterRemoval } as never,
        "legacy-key",
      ),
    ).resolves.toBeNull();
  });

  it("rejects current and legacy keys when the owning organization is pending deletion", async () => {
    const currentDb = new TestDb({
      projects: [
        {
          _id: PROJECT_ID,
          organizationId: "organizations_a",
          apiKey: "legacy-key",
        },
      ],
      organizations: [{ _id: "organizations_a", pendingDeletion: true }],
    });
    apiKeyMocks.getApiKeyByKey.mockResolvedValueOnce({
      _id: "api_key_a",
      projectId: PROJECT_ID,
      organizationId: "organizations_a",
      isActive: true,
    });
    await expect(
      resolveProjectByApiKeyFromDb({ db: currentDb } as never, "current-key"),
    ).resolves.toBeNull();

    apiKeyMocks.getApiKeyByKey.mockResolvedValueOnce(null);
    await expect(
      resolveProjectByApiKeyFromDb({ db: currentDb } as never, "legacy-key"),
    ).resolves.toBeNull();
  });
});

describe("getProjectById pending-deletion guard", () => {
  it("returns only projects whose project and organization are active", async () => {
    const db = new TestDb({
      projects: [
        {
          _id: "projects_active",
          organizationId: "organizations_active",
        },
        {
          _id: "projects_pending",
          organizationId: "organizations_active",
          pendingDeletion: true,
        },
        {
          _id: "projects_org_pending",
          organizationId: "organizations_pending",
        },
      ],
      organizations: [
        { _id: "organizations_active" },
        { _id: "organizations_pending", pendingDeletion: true },
      ],
    });

    await expect(
      getProjectById({ db } as never, "projects_active" as never),
    ).resolves.toMatchObject({ _id: "projects_active" });
    await expect(
      getProjectById({ db } as never, "projects_pending" as never),
    ).resolves.toBeNull();
    await expect(
      getProjectById({ db } as never, "projects_org_pending" as never),
    ).resolves.toBeNull();
  });
});
