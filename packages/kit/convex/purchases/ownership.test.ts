import { beforeEach, describe, expect, it, vi } from "vitest";
import { testableFunction } from "../test.setup";
import { hmacSha256Hex } from "../utils/sha256";
import { HarmonizedPurchaseState } from "./purchaseState";

const stubs = vi.hoisted(() => ({
  resolve: vi.fn(),
  project: vi.fn(),
  amazon: vi.fn(),
  horizon: vi.fn(),
}));
vi.mock("../projects/helpers", () => ({
  resolveProjectByApiKeyFromDb: stubs.resolve,
  getProjectById: vi.fn(),
}));
vi.mock("./shared", async (original) => ({
  ...(await original<typeof import("./shared")>()),
  getProjectByApiKey: stubs.project,
}));
vi.mock("./amazon", () => ({
  verifyAmazonReceipt: stubs.amazon,
  verifyAmazonReceiptInternalV1: {},
}));
vi.mock("./horizon", () => ({ verifyHorizonReceipt: stubs.horizon }));
import { bindVerifiedPurchaseAsServer } from "./mutation";
import { boundPurchasesForUser } from "./internal";
import { readBoundPurchaseEntitlements } from "./action";
import { AmazonSandboxNotEnabledError } from "./errors";

const project = { _id: "p1", userErasureHashKey: "local-hash-key" };
type Row = Record<string, unknown>;
// Index names are not modeled: eq() filters fields, patch() keeps undefined keys.
function database(rows: Record<string, Row[]>) {
  return {
    query(table: string) {
      let current = rows[table] ?? [];
      const query = {
        withIndex(_name: string, build: (q: unknown) => unknown) {
          const index = {
            eq(field: string, value: unknown) {
              current = current.filter((row) => row[field] === value);
              return index;
            },
          };
          build(index);
          return query;
        },
        filter(build: (q: unknown) => unknown) {
          const predicate = build({
            field: (field: string) => field,
            eq: (field: string, value: unknown) => (row: Row) =>
              row[field] === value,
          }) as (row: Row) => boolean;
          current = current.filter(predicate);
          return query;
        },
        async unique() {
          if (current.length > 1) throw Error("Ambiguous rows");
          return current[0] ?? null;
        },
        async take(count: number) {
          return current.slice(0, count);
        },
      };
      return query;
    },
    async get(id: string) {
      return id === project._id ? project : null;
    },
    async patch(id: string, value: Row) {
      const row = Object.values(rows)
        .flat()
        .find((row) => row._id === id);
      if (!row) throw Error("Missing row");
      Object.assign(row, value);
    },
  };
}
const bind = testableFunction(bindVerifiedPurchaseAsServer)._handler;
const read = testableFunction(boundPurchasesForUser)._handler;
const refresh = testableFunction(readBoundPurchaseEntitlements)._handler;

beforeEach(() => {
  vi.clearAllMocks();
  stubs.resolve.mockResolvedValue({ project });
  stubs.project.mockResolvedValue(project);
  stubs.amazon.mockResolvedValue({ isValid: true });
  stubs.horizon.mockResolvedValue({ isValid: true });
});

describe.each(["amazon", "horizon"] as const)("%s ownership", (store) => {
  const args = {
    apiKey: "server-key",
    userId: "alice",
    store,
    remoteId: "store-proof",
  };
  function setup(overrides: Row = {}) {
    const purchase: Row = {
      _id: "receipt",
      projectId: "p1",
      store,
      remoteId: "store-proof",
      productId: "premium",
      state: HarmonizedPurchaseState.ENTITLED,
      isValid: true,
      ...overrides,
    };
    const rows: Record<string, Row[]> = {
      purchases: [purchase],
      subscriptionUserErasureJobs: [],
    };
    return { rows, purchase, ctx: { db: database(rows) } };
  }
  it("binds once, preserves ownership and refuses another account", async () => {
    const { ctx, purchase } = setup();
    expect(await bind(ctx, args)).toEqual({ bound: true });
    expect(await bind(ctx, args)).toEqual({ bound: true });
    expect(await bind(ctx, { ...args, userId: "bob" })).toEqual({
      bound: false,
    });
    expect(purchase.appUserId).toBe("alice");
    expect(stubs.resolve).toHaveBeenCalledWith(ctx, "server-key", "admin");
  });
  it.each([
    { state: HarmonizedPurchaseState.CANCELED },
    { isValid: false },
    { state: HarmonizedPurchaseState.READY_TO_CONSUME },
    { projectId: "other" },
    { store: "google" },
  ])(
    "rejects unavailable, consumable or cross-scope evidence %j",
    async (overrides) => {
      const { ctx, purchase } = setup(overrides);
      expect(await bind(ctx, args)).toEqual({ bound: false });
      expect(purchase.appUserId).toBeUndefined();
    },
  );
  it("lets another account bind erased evidence and drops the tombstone", async () => {
    const { ctx, purchase } = setup({ accountErased: true });
    expect(await bind(ctx, { ...args, userId: "bob" })).toEqual({
      bound: true,
    });
    expect(purchase.appUserId).toBe("bob");
    expect(purchase.accountErased).toBeUndefined();
  });
  function fillCap(
    rows: Record<string, Row[]>,
    overrides: (index: number) => Row = () => ({}),
  ) {
    rows.purchases.push(
      ...Array.from({ length: 20 }, (_, i) => ({
        _id: `bound-${i}`,
        projectId: "p1",
        appUserId: "alice",
        store,
        remoteId: `bound-${i}`,
        state: HarmonizedPurchaseState.ENTITLED,
        isValid: true,
        ...overrides(i),
      })),
    );
  }
  it("answers bound:false at the per-account cap without revealing evidence", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rows, ctx, purchase } = setup();
    fillCap(rows);
    expect(await bind(ctx, args)).toEqual({ bound: false });
    expect(await bind(ctx, { ...args, remoteId: "nobody-knows" })).toEqual({
      bound: false,
    });
    expect(purchase.appUserId).toBeUndefined();
    // Known and unknown evidence take the same path and log the same line.
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]).toEqual([
      expect.stringContaining("bound purchase limit"),
      { projectId: "p1", store },
    ]);
    expect(await bind(ctx, { ...args, remoteId: "bound-3" })).toEqual({
      bound: true,
    });
    warn.mockRestore();
  });
  it("reclaims the caller's own dead rows before refusing at the cap", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rows, ctx, purchase } = setup();
    // A refunded receipt is worthless to the account and must not hold a slot.
    fillCap(rows, (i: number) =>
      i % 2 === 0
        ? {}
        : { state: HarmonizedPurchaseState.CANCELED, isValid: false },
    );
    expect(await bind(ctx, args)).toEqual({ bound: true });
    expect(purchase.appUserId).toBe("alice");
    expect(
      rows.purchases.filter(
        (row) => row.appUserId === "alice" && row.isValid === false,
      ),
    ).toEqual([]);
    // Only the dead half is freed: ten live rows plus the one just bound.
    expect(
      rows.purchases.filter((row) => row.appUserId === "alice"),
    ).toHaveLength(11);
    // Reclaiming is not a refusal, so operators see no cap warning.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  it("binds erased evidence for the erased user when no erasure job is retained", async () => {
    const { ctx, purchase } = setup({ accountErased: true });
    expect(await bind(ctx, args)).toEqual({ bound: true });
    expect(purchase.appUserId).toBe("alice");
  });
  it("refuses binding and reads as soon as erasure is requested", async () => {
    const job = {
      projectId: "p1",
      userIdHash: await hmacSha256Hex(project.userErasureHashKey, "alice"),
      status: "queued",
    };
    const { rows, ctx } = setup({ appUserId: "alice" });
    rows.subscriptionUserErasureJobs.push(job);
    expect(await bind(ctx, args)).toEqual({ bound: false });
    expect(
      await read(ctx, { projectId: "p1" as never, userId: "alice" }),
    ).toEqual([]);
    const erased = setup({ accountErased: true });
    erased.rows.subscriptionUserErasureJobs.push(job);
    expect(await bind(erased.ctx, args)).toEqual({ bound: false });
  });
  it("checks credentials before revealing evidence", async () => {
    stubs.resolve.mockResolvedValue(null);
    const { ctx } = setup();
    await expect(bind(ctx, args)).rejects.toThrow();
  });
});

it("refuses partial ownership reads above the bounded limit", async () => {
  const ctx = {
    db: database({
      purchases: Array.from({ length: 21 }, (_, i) => ({
        _id: `r${i}`,
        projectId: "p1",
        appUserId: "alice",
      })),
    }),
  };
  await expect(
    read(ctx, { projectId: "p1" as never, userId: "alice" }),
  ).rejects.toThrow("limit");
});

it("refreshes both stores and returns only current, still-bound products", async () => {
  const rows = [
    {
      _id: "a",
      isValid: true,
      productId: "amazon-premium",
      requestData: {
        store: "amazon",
        userId: "store-alice",
        receiptId: "receipt",
        sandbox: true,
      },
    },
    {
      _id: "h",
      isValid: true,
      productId: "quest-premium",
      requestData: {
        store: "horizon",
        userId: "meta-alice",
        sku: "quest-premium",
      },
    },
  ];
  const runQuery = vi
    .fn()
    .mockResolvedValueOnce(rows)
    .mockResolvedValueOnce([{ ...rows[1], isValid: false }]);
  const runMutation = vi.fn();
  expect(
    await refresh(
      { runQuery, runMutation },
      { apiKey: "server", userId: "alice" },
    ),
  ).toEqual({ productIds: [] });
  // One recheck admission for the whole read, paid before any store call.
  expect(runMutation).toHaveBeenCalledTimes(1);
  expect(runMutation).toHaveBeenCalledWith(expect.anything(), {
    projectId: "p1",
    bucket: "entitlementRecheck",
    cost: 2,
  });
  expect(runMutation.mock.invocationCallOrder[0]).toBeLessThan(
    stubs.amazon.mock.invocationCallOrder[0],
  );
  expect(stubs.amazon).toHaveBeenCalledWith(
    expect.anything(),
    {
      apiKey: "server",
      userId: "store-alice",
      receiptId: "receipt",
      sandbox: true,
    },
    { recheck: true },
  );
  expect(stubs.horizon).toHaveBeenCalledWith(
    expect.anything(),
    {
      apiKey: "server",
      userId: "meta-alice",
      sku: "quest-premium",
    },
    { recheck: true },
  );
});

it("fails the entire read on upstream failure, preserving the saved verdict", async () => {
  stubs.horizon.mockRejectedValue(new Error("upstream unavailable"));
  const rows = [
    {
      _id: "h",
      isValid: true,
      productId: "premium",
      requestData: { store: "horizon", userId: "meta-alice", sku: "premium" },
    },
  ];
  const runQuery = vi.fn().mockResolvedValue(rows);
  const runMutation = vi.fn();
  await expect(
    refresh({ runQuery, runMutation }, { apiKey: "server", userId: "alice" }),
  ).rejects.toThrow("upstream");
  // The budget was charged before the failing store call.
  expect(runMutation).toHaveBeenCalledTimes(1);
  expect(rows[0].isValid).toBe(true);
  expect(runQuery).toHaveBeenCalledTimes(1);
});

it("fails the read when a store the project disabled cannot answer", async () => {
  // The rows that store granted are still bound and still valid, so omitting
  // them would be the partial answer SPEC "Fail-close" forbids.
  stubs.amazon.mockRejectedValue(new AmazonSandboxNotEnabledError());
  const rows = [
    {
      _id: "a",
      isValid: true,
      productId: "coins",
      requestData: {
        store: "amazon",
        userId: "store-alice",
        receiptId: "receipt",
        sandbox: true,
      },
    },
  ];
  const runQuery = vi.fn().mockResolvedValue(rows);
  const runMutation = vi.fn();
  await expect(
    refresh({ runQuery, runMutation }, { apiKey: "server", userId: "alice" }),
  ).rejects.toThrow(AmazonSandboxNotEnabledError);
  // It stopped at the store, so it never re-read ownership to answer partially.
  expect(runQuery).toHaveBeenCalledTimes(1);
});

it("does not return an unrefreshed purchase bound during the read", async () => {
  const runQuery = vi
    .fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ _id: "new", isValid: true, productId: "late" }]);
  const runMutation = vi.fn();
  // The row appeared after the recheck pass, so it is absent from the answer.
  expect(
    await refresh(
      { runQuery, runMutation },
      { apiKey: "server", userId: "alice" },
    ),
  ).toEqual({ productIds: [] });
  // An empty first read pays no recheck admission.
  expect(runMutation).not.toHaveBeenCalled();
});
