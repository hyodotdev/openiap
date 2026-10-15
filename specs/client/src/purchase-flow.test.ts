import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPurchaseFlow,
  describePurchaseFlowStatus,
  toPurchaseConfirmationRequest,
  type PurchaseConfirmation,
  type PurchaseFlowOptions,
  type PurchaseFlowPurchase,
  type PurchaseFlowStatus,
} from "./purchase-flow";

const CONSUMABLES = new Set(["coins_100"]);

function purchase(
  overrides: Partial<PurchaseFlowPurchase> = {},
): PurchaseFlowPurchase {
  return {
    id: "tx-1",
    productId: "premium",
    purchaseState: "purchased",
    purchaseToken: "token-1",
    store: "apple",
    ...overrides,
  };
}

function flowWith(
  confirm: (p: PurchaseFlowPurchase) => Promise<PurchaseConfirmation>,
  overrides: Partial<PurchaseFlowOptions<PurchaseFlowPurchase>> = {},
) {
  const options = {
    confirmWithBackend: vi.fn(confirm),
    finishTransaction: vi.fn(async () => {}),
    isConsumable: (productId: string) => CONSUMABLES.has(productId),
    getAvailablePurchases: vi.fn(
      async (): Promise<PurchaseFlowPurchase[]> => [],
    ),
    ...overrides,
  };
  return { flow: createPurchaseFlow(options), options };
}

// Stands in for the app backend: one grant per purchase, one owner.
function fakeBackend(userId: () => string) {
  const owners = new Map<string, string>();
  return async (p: PurchaseFlowPurchase): Promise<PurchaseConfirmation> => {
    const owner = owners.get(p.id);
    if (owner && owner !== userId()) return { status: "ownership_conflict" };
    owners.set(p.id, userId());
    return { status: "entitled", alreadyGranted: owner !== undefined };
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("processPurchase", () => {
  it("returns store_pending for a pending payment without calling the backend", async () => {
    const { flow, options } = flowWith(async () => ({
      status: "entitled",
      alreadyGranted: false,
    }));

    await expect(
      flow.processPurchase(purchase({ purchaseState: "pending" })),
    ).resolves.toEqual({ status: "store_pending" });
    expect(options.confirmWithBackend).not.toHaveBeenCalled();
    expect(options.finishTransaction).not.toHaveBeenCalled();
  });

  it.each<PurchaseConfirmation>([
    { status: "store_pending" },
    { status: "verification_delayed", retryAfterMs: 5_000 },
    { status: "ownership_conflict" },
    { status: "test_account_restricted" },
    { status: "invalid", reason: "INAUTHENTIC" },
    { status: "invalid" },
    { status: "verified" },
    { status: "verified", retryAfterMs: 1_000 },
    { status: "linked", retryAfterMs: 30_000 },
  ])("reports $status without finishing", async (confirmation) => {
    const { flow, options } = flowWith(async () => confirmation);

    await expect(flow.processPurchase(purchase())).resolves.toEqual(
      confirmation,
    );
    expect(options.finishTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ["coins_100", true],
    ["premium", false],
  ])(
    "finishes %s with isConsumable %s only after the backend grants",
    async (productId, isConsumable) => {
      const order: string[] = [];
      const { flow, options } = flowWith(
        async () => {
          order.push("confirm");
          return { status: "entitled", alreadyGranted: false };
        },
        {
          finishTransaction: vi.fn(async () => {
            order.push("finish");
          }),
        },
      );
      const item = purchase({ productId });

      await expect(flow.processPurchase(item)).resolves.toEqual({
        status: "entitled",
        alreadyGranted: false,
      });
      expect(order).toEqual(["confirm", "finish"]);
      expect(options.finishTransaction).toHaveBeenCalledWith({
        purchase: item,
        isConsumable,
      });
    },
  );

  it("finishes an already granted purchase again", async () => {
    const { flow, options } = flowWith(async () => ({
      status: "entitled",
      alreadyGranted: true,
    }));

    await expect(flow.processPurchase(purchase())).resolves.toEqual({
      status: "entitled",
      alreadyGranted: true,
    });
    expect(options.finishTransaction).toHaveBeenCalledTimes(1);
  });

  it("keeps access granted when finishing fails", async () => {
    const finishError = new Error("store unavailable");
    const { flow } = flowWith(
      async () => ({ status: "entitled", alreadyGranted: false }),
      {
        finishTransaction: vi.fn(async () => {
          throw finishError;
        }),
      },
    );

    await expect(flow.processPurchase(purchase())).resolves.toEqual({
      status: "entitled",
      alreadyGranted: false,
      finishError,
    });
  });

  it("reports failed without finishing when the backend call throws", async () => {
    const error = new Error("offline");
    const { flow, options } = flowWith(async () => {
      throw error;
    });

    await expect(flow.processPurchase(purchase())).resolves.toEqual({
      status: "failed",
      error,
    });
    expect(options.finishTransaction).not.toHaveBeenCalled();
  });

  it.each<unknown>([
    null,
    "entitled",
    { status: "granted" },
    { status: "entitled" },
    { status: "entitled", alreadyGranted: "yes" },
    { status: "verification_delayed" },
    { status: "verification_delayed", retryAfterMs: -1 },
    { status: "verification_delayed", retryAfterMs: Number.NaN },
  ])("never finishes on an off-contract body: %j", async (body) => {
    const { flow, options } = flowWith(
      // @ts-expect-error The backend's JSON reaches the flow untyped.
      async () => body,
    );

    const status = await flow.processPurchase(purchase());

    expect(status.status).toBe("failed");
    expect(options.finishTransaction).not.toHaveBeenCalled();
  });

  it("drops unknown fields and invalid retry hints from the backend", async () => {
    const body = {
      status: "linked",
      retryAfterMs: Number.POSITIVE_INFINITY,
      extra: true,
    } as const;
    const { flow } = flowWith(async () => body);

    await expect(flow.processPurchase(purchase())).resolves.toEqual({
      status: "linked",
    });
  });

  it("walks verified, linked, then entitled, finishing once at the end", async () => {
    const verdicts: PurchaseConfirmation[] = [
      { status: "verified", retryAfterMs: 1_000 },
      { status: "linked", retryAfterMs: 1_000 },
      { status: "entitled", alreadyGranted: false },
    ];
    const { flow, options } = flowWith(async () => verdicts.shift()!);
    const statuses: PurchaseFlowStatus["status"][] = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      statuses.push((await flow.processPurchase(purchase())).status);
    }

    expect(statuses).toEqual(["verified", "linked", "entitled"]);
    expect(options.finishTransaction).toHaveBeenCalledTimes(1);
  });

  it("shares one backend call between concurrent deliveries of a transaction", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { flow, options } = flowWith(async () => {
      await gate;
      return { status: "entitled", alreadyGranted: false };
    });

    const first = flow.processPurchase(purchase());
    const second = flow.processPurchase(purchase());
    release();

    expect(await first).toBe(await second);
    expect(options.confirmWithBackend).toHaveBeenCalledTimes(1);
    await flow.processPurchase(purchase());
    expect(options.confirmWithBackend).toHaveBeenCalledTimes(2);
  });
});

describe("recoverPurchases", () => {
  it("reads only unfinished iOS transactions by default", async () => {
    const unfinished = purchase({ id: "tx-9", productId: "coins_100" });
    const { flow, options } = flowWith(
      async () => ({ status: "entitled", alreadyGranted: false }),
      { getPendingTransactionsIOS: vi.fn(async () => [unfinished]) },
    );

    await expect(flow.recoverPurchases()).resolves.toEqual([
      {
        purchase: unfinished,
        status: { status: "entitled", alreadyGranted: false },
      },
    ]);
    expect(options.getAvailablePurchases).not.toHaveBeenCalled();
    expect(options.finishTransaction).toHaveBeenCalledWith({
      purchase: unfinished,
      isConsumable: true,
    });
  });

  it("skips acknowledged Android purchases by default", async () => {
    const acknowledged = purchase({
      id: "GPA.1",
      store: "google",
      isAcknowledgedAndroid: true,
    });
    const unacknowledged = purchase({
      id: "GPA.2",
      store: "google",
      isAcknowledgedAndroid: false,
    });
    const pending = purchase({
      id: "GPA.3",
      store: "google",
      purchaseState: "pending",
      isAcknowledgedAndroid: false,
    });
    const { flow, options } = flowWith(
      async () => ({ status: "entitled", alreadyGranted: false }),
      {
        getAvailablePurchases: vi.fn(async () => [
          acknowledged,
          unacknowledged,
          pending,
        ]),
      },
    );

    const outcomes = await flow.recoverPurchases();

    expect(
      outcomes.map(({ purchase: p, status }) => [p.id, status.status]),
    ).toEqual([
      ["GPA.2", "entitled"],
      ["GPA.3", "store_pending"],
    ]);
    expect(options.confirmWithBackend).toHaveBeenCalledTimes(1);
  });

  it("restores every owned purchase once for the same account", async () => {
    const shared = purchase({ id: "tx-1" });
    const finishedOnly = purchase({ id: "tx-2", productId: "premium_year" });
    let user = "user-a";
    const { flow, options } = flowWith(
      fakeBackend(() => user),
      {
        getPendingTransactionsIOS: vi.fn(async () => [shared]),
        getAvailablePurchases: vi.fn(async () => [shared, finishedOnly]),
      },
    );

    const first = await flow.recoverPurchases({ includeFinished: true });
    const again = await flow.recoverPurchases({ includeFinished: true });

    expect(first.map(({ status }) => status)).toEqual([
      { status: "entitled", alreadyGranted: false },
      { status: "entitled", alreadyGranted: false },
    ]);
    expect(again.map(({ status }) => status)).toEqual([
      { status: "entitled", alreadyGranted: true },
      { status: "entitled", alreadyGranted: true },
    ]);
    expect(options.finishTransaction).toHaveBeenCalledTimes(4);

    user = "user-b";
    vi.mocked(options.finishTransaction).mockClear();
    const otherAccount = await flow.recoverPurchases({ includeFinished: true });

    expect(otherAccount.map(({ status }) => status.status)).toEqual([
      "ownership_conflict",
      "ownership_conflict",
    ]);
    expect(options.finishTransaction).not.toHaveBeenCalled();
  });

  it("confirms purchases one at a time", async () => {
    let active = 0;
    let maxActive = 0;
    const { flow } = flowWith(
      async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await Promise.resolve();
        active -= 1;
        return { status: "entitled", alreadyGranted: false };
      },
      {
        getAvailablePurchases: vi.fn(async () => [
          purchase({ id: "a", isAcknowledgedAndroid: false }),
          purchase({ id: "b", isAcknowledgedAndroid: false }),
        ]),
      },
    );

    await flow.recoverPurchases();

    expect(maxActive).toBe(1);
  });

  it("propagates a failed purchase read", async () => {
    const { flow } = flowWith(
      async () => ({ status: "entitled", alreadyGranted: false }),
      {
        getAvailablePurchases: vi.fn(async () => {
          throw new Error("not connected");
        }),
      },
    );

    await expect(flow.recoverPurchases()).rejects.toThrow("not connected");
  });
});

describe("describePurchaseFlowStatus", () => {
  it.each<[PurchaseFlowStatus, ReturnType<typeof describePurchaseFlowStatus>]>([
    [
      { status: "store_pending" },
      { key: "payment_pending", offerPurchase: false },
    ],
    [
      { status: "verification_delayed", retryAfterMs: 5_000 },
      {
        key: "verification_delayed",
        offerPurchase: false,
        retryAfterMs: 5_000,
      },
    ],
    [
      { status: "ownership_conflict" },
      { key: "owned_by_another_account", offerPurchase: false },
    ],
    [
      { status: "test_account_restricted" },
      { key: "test_purchase_not_accepted", offerPurchase: false },
    ],
    [
      { status: "invalid", reason: "EXPIRED" },
      { key: "purchase_not_valid", offerPurchase: true },
    ],
    [{ status: "verified" }, { key: "access_pending", offerPurchase: false }],
    [
      { status: "linked", retryAfterMs: 30_000 },
      { key: "access_pending", offerPurchase: false, retryAfterMs: 30_000 },
    ],
    [
      { status: "entitled", alreadyGranted: true, finishError: new Error("x") },
      { key: "access_granted", offerPurchase: false },
    ],
    [
      { status: "failed", error: new Error("offline") },
      { key: "try_again_later", offerPurchase: false },
    ],
  ])("maps %j", (status, guidance) => {
    expect(describePurchaseFlowStatus(status)).toEqual(guidance);
  });
});

describe("toPurchaseConfirmationRequest", () => {
  it("sends the store evidence and expected product", () => {
    expect(
      toPurchaseConfirmationRequest(
        purchase({ store: "google", purchaseToken: "play-token" }),
      ),
    ).toEqual({
      store: "google",
      purchaseToken: "play-token",
      productId: "premium",
    });
  });

  it.each([
    purchase({ store: "amazon" }),
    purchase({ purchaseToken: null }),
    purchase({ purchaseToken: "" }),
  ])("rejects a purchase it cannot confirm", (item) => {
    expect(() => toPurchaseConfirmationRequest(item)).toThrow(
      "has no Apple or Google purchase token",
    );
  });
});

describe("isolation", () => {
  it("touches only injected functions: no fetch, analytics, or imports", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const { flow } = flowWith(
      async () => ({ status: "entitled", alreadyGranted: false }),
      {
        getAvailablePurchases: vi.fn(async () => [
          purchase({ isAcknowledgedAndroid: false }),
        ]),
      },
    );

    await flow.processPurchase(purchase({ id: "tx-2" }));
    await flow.recoverPurchases({ includeFinished: true });

    expect(fetchSpy).not.toHaveBeenCalled();
    const source = readFileSync(
      new URL("./purchase-flow.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\bfetch\(|analytics|track\(/i);
  });
});
