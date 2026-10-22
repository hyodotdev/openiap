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
    getPendingTransactionsIOS: undefined,
    ...overrides,
  };
  return { flow: createPurchaseFlow(options), options };
}

// Stands in for the app backend: one grant per purchase, one owner.
function fakeBackend(userId: () => string) {
  const owners = new Map<string, string>();
  return async (p: PurchaseFlowPurchase): Promise<PurchaseConfirmation> => {
    const owner = owners.get(p.id);
    if (owner && owner !== userId()) {
      return { status: "ownership_conflict", alreadyGranted: true };
    }
    owners.set(p.id, userId());
    return { status: "entitled", alreadyGranted: owner !== undefined };
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("processPurchase", () => {
  it.each(["apple", "google"])(
    "leaves unsupported %s quantities unfinished",
    async (store) => {
      const { flow, options } = flowWith(async () => ({
        status: "entitled",
        alreadyGranted: false,
      }));
      for (const quantity of [0, 2, -1, NaN]) {
        const bulk = purchase({ store, quantity });
        await expect(flow.processPurchase(bulk)).resolves.toMatchObject({
          status: "failed",
          error: expect.any(Error),
        });
        expect(() => toPurchaseConfirmationRequest(bulk)).toThrow(
          "single-unit",
        );
      }
      expect(options.confirmWithBackend).not.toHaveBeenCalled();
      expect(options.finishTransaction).not.toHaveBeenCalled();
    },
  );
  it("leaves a multi-product Play token unfinished without confirming only its first item", async () => {
    const { flow, options } = flowWith(async () => ({
      status: "entitled",
      alreadyGranted: false,
    }));
    const cart = purchase({
      store: "google",
      ids: ["coins_100", "premium"],
      productId: "coins_100",
    });
    await expect(flow.processPurchase(cart)).resolves.toMatchObject({
      status: "failed",
      error: expect.any(Error),
    });
    expect(() => toPurchaseConfirmationRequest(cart)).toThrow("multi-product");
    expect(options.confirmWithBackend).not.toHaveBeenCalled();
    expect(options.finishTransaction).not.toHaveBeenCalled();
  });
  it.each(["amazon", "horizon", "unknown"])(
    "rejects unsupported %s purchases before calling the backend",
    async (store) => {
      const { flow, options } = flowWith(async () => ({
        status: "entitled",
        alreadyGranted: false,
      }));
      await expect(
        flow.processPurchase(purchase({ store })),
      ).resolves.toMatchObject({ status: "failed", error: expect.any(Error) });
      expect(options.confirmWithBackend).not.toHaveBeenCalled();
      expect(options.finishTransaction).not.toHaveBeenCalled();
    },
  );
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
    { status: "ownership_conflict", alreadyGranted: false },
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

  it.each<PurchaseConfirmation>([
    { status: "invalid", reason: "EXPIRED" },
    { status: "invalid" },
    { status: "test_account_restricted" },
  ])(
    "finishes a settled rejection on iOS but never acknowledges it on Google Play: %j",
    async (confirmation) => {
      const { flow, options } = flowWith(async () => confirmation);
      const apple = purchase({ productId: "coins_100" });

      await expect(flow.processPurchase(apple)).resolves.toEqual(confirmation);
      expect(options.finishTransaction).toHaveBeenCalledWith({
        purchase: apple,
        isConsumable: true,
      });

      vi.mocked(options.finishTransaction).mockClear();
      await expect(
        flow.processPurchase(purchase({ id: "GPA.1", store: "google" })),
      ).resolves.toEqual(confirmation);
      expect(options.finishTransaction).not.toHaveBeenCalled();
    },
  );

  it.each(["apple", "google"])(
    "finishes a %s purchase another account was already granted, granting nothing",
    async (store) => {
      const { flow, options } = flowWith(async () => ({
        status: "ownership_conflict",
        alreadyGranted: true,
      }));
      const item = purchase({ store, productId: "coins_100" });

      await expect(flow.processPurchase(item)).resolves.toEqual({
        status: "ownership_conflict",
        alreadyGranted: true,
      });
      expect(options.finishTransaction).toHaveBeenCalledWith({
        purchase: item,
        isConsumable: true,
      });
    },
  );

  it("reports an invalid iOS purchase whose finish failed", async () => {
    const finishError = new Error("store unavailable");
    const { flow } = flowWith(
      async () => ({ status: "invalid", reason: "CANCELED" }),
      {
        finishTransaction: vi.fn(async () => {
          throw finishError;
        }),
      },
    );

    await expect(flow.processPurchase(purchase())).resolves.toEqual({
      status: "invalid",
      reason: "CANCELED",
      finishError,
    });
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

  it("finishes the current Play purchase and marks a change that waits for payment", async () => {
    const { flow, options } = flowWith(async () => ({
      status: "entitled",
      alreadyGranted: true,
    }));
    const current = purchase({
      store: "google",
      pendingPurchaseUpdateAndroid: { products: ["premium_yearly"] },
    });

    await expect(flow.processPurchase(current)).resolves.toEqual({
      status: "entitled",
      alreadyGranted: true,
      changePending: true,
    });
    expect(options.confirmWithBackend).toHaveBeenCalledWith(current);
    expect(options.finishTransaction).toHaveBeenCalledTimes(1);
  });

  it.each<PurchaseConfirmation>([
    { status: "verified" },
    { status: "ownership_conflict", alreadyGranted: true },
  ])(
    "marks a pending change only on an entitled purchase: %j",
    async (confirmation) => {
      const { flow } = flowWith(async () => confirmation);
      const status = await flow.processPurchase(
        purchase({
          store: "google",
          pendingPurchaseUpdateAndroid: { products: ["premium_yearly"] },
        }),
      );
      expect(status).not.toHaveProperty("changePending");
    },
  );

  it("keeps the pending change when finishing fails", async () => {
    const finishError = new Error("store unavailable");
    const { flow } = flowWith(
      async () => ({ status: "entitled", alreadyGranted: true }),
      {
        finishTransaction: vi.fn(async () => {
          throw finishError;
        }),
      },
    );

    await expect(
      flow.processPurchase(
        purchase({
          store: "google",
          pendingPurchaseUpdateAndroid: { products: ["premium_yearly"] },
        }),
      ),
    ).resolves.toEqual({
      status: "entitled",
      alreadyGranted: true,
      finishError,
      changePending: true,
    });
  });

  it("marks the pending change on a delivery that shares an earlier run", async () => {
    let answer: (confirmation: PurchaseConfirmation) => void = () => {};
    const { flow, options } = flowWith(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const before = flow.processPurchase(purchase({ store: "google" }));
    const after = flow.processPurchase(
      purchase({
        store: "google",
        pendingPurchaseUpdateAndroid: { products: ["premium_yearly"] },
      }),
    );
    answer({ status: "entitled", alreadyGranted: true });

    await expect(before).resolves.toEqual({
      status: "entitled",
      alreadyGranted: true,
    });
    await expect(after).resolves.toEqual({
      status: "entitled",
      alreadyGranted: true,
      changePending: true,
    });
    expect(options.confirmWithBackend).toHaveBeenCalledTimes(1);
  });

  it("does not mark a change when the purchase has no pending update", async () => {
    const { flow } = flowWith(async () => ({
      status: "entitled",
      alreadyGranted: false,
    }));

    await expect(
      flow.processPurchase(
        purchase({ store: "google", pendingPurchaseUpdateAndroid: null }),
      ),
    ).resolves.toEqual({ status: "entitled", alreadyGranted: false });
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
    { status: "ownership_conflict" },
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

  it.each([
    [undefined, 30_000],
    [5_000, 5_000],
  ])(
    "fails a backend call still hanging after confirmTimeoutMs %s, then retries it",
    async (confirmTimeoutMs, timeoutMs) => {
      vi.useFakeTimers();
      try {
        const { flow, options } = flowWith(() => new Promise(() => {}), {
          ...(confirmTimeoutMs !== undefined ? { confirmTimeoutMs } : {}),
        });
        let settled: PurchaseFlowStatus | undefined;
        void flow.processPurchase(purchase()).then((status) => {
          settled = status;
        });

        await vi.advanceTimersByTimeAsync(timeoutMs - 1);
        expect(settled).toBeUndefined();
        await vi.advanceTimersByTimeAsync(1);
        expect(settled).toEqual({
          status: "failed",
          error: new Error(
            `confirmWithBackend did not answer within ${timeoutMs} ms`,
          ),
        });
        expect(options.finishTransaction).not.toHaveBeenCalled();

        // The hung call no longer holds the transaction.
        void flow.processPurchase(purchase());
        expect(options.confirmWithBackend).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("leaves no timer behind once the backend answers", async () => {
    vi.useFakeTimers();
    try {
      const { flow } = flowWith(async () => ({
        status: "entitled",
        alreadyGranted: false,
      }));

      await flow.processPurchase(purchase());

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
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

describe("confirmTimeoutMs", () => {
  it("treats a timeout too long for setTimeout as the longest one", async () => {
    const { flow } = flowWith(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { status: "entitled", alreadyGranted: false };
      },
      { confirmTimeoutMs: Infinity },
    );

    await expect(flow.processPurchase(purchase())).resolves.toEqual({
      status: "entitled",
      alreadyGranted: false,
    });
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

  it("skips a purchase this flow finished since the store list was read", async () => {
    const tx = purchase({ id: "tx-5", productId: "coins_100" });
    const { flow, options } = flowWith(
      async () => ({ status: "entitled", alreadyGranted: false }),
      { getPendingTransactionsIOS: vi.fn(async () => [tx]) },
    );

    await flow.processPurchase(tx);
    await expect(flow.recoverPurchases()).resolves.toEqual([]);
    expect(options.confirmWithBackend).toHaveBeenCalledTimes(1);
  });

  it("confirms every owned Apple purchase when the pending list fails", async () => {
    const owned = purchase({ id: "tx-7" });
    const { flow, options } = flowWith(
      async () => ({ status: "entitled", alreadyGranted: true }),
      {
        getPendingTransactionsIOS: vi.fn(async () => {
          throw new Error("Transaction 7 failed StoreKit verification");
        }),
        getAvailablePurchases: vi.fn(async () => [owned]),
      },
    );

    await expect(flow.recoverPurchases()).resolves.toEqual([
      { purchase: owned, status: { status: "entitled", alreadyGranted: true } },
    ]);
    expect(options.finishTransaction).toHaveBeenCalledOnce();
  });

  it("stops rechecking an expired iOS renewal once it is finished", async () => {
    const unfinished = [purchase({ id: "renewal-2" })];
    const { flow, options } = flowWith(
      async () => ({ status: "invalid", reason: "EXPIRED" }),
      {
        getPendingTransactionsIOS: vi.fn(async () => [...unfinished]),
        finishTransaction: vi.fn(async ({ purchase: p }) => {
          unfinished.splice(unfinished.indexOf(p), 1);
        }),
      },
    );

    await flow.recoverPurchases();
    await expect(flow.recoverPurchases()).resolves.toEqual([]);
    expect(options.confirmWithBackend).toHaveBeenCalledTimes(1);
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
    const otherAccount = await flow.recoverPurchases({ includeFinished: true });

    expect(otherAccount.map(({ status }) => status)).toEqual([
      { status: "ownership_conflict", alreadyGranted: true },
      { status: "ownership_conflict", alreadyGranted: true },
    ]);
  });

  it("finishes a purchase granted to the previous account once another signs in", async () => {
    // User A was granted, but the app quit before finishing; then B signed in.
    const unfinished = [purchase({ id: "GPA.1", store: "google" })];
    let user = "user-a";
    const backend = fakeBackend(() => user);
    await backend(unfinished[0]!);
    user = "user-b";
    const { flow, options } = flowWith(backend, {
      getAvailablePurchases: vi.fn(async () =>
        unfinished.map((p) => ({ ...p, isAcknowledgedAndroid: false })),
      ),
      finishTransaction: vi.fn(async () => {
        unfinished.length = 0;
      }),
    });

    await expect(flow.recoverPurchases()).resolves.toEqual([
      {
        purchase: expect.objectContaining({ id: "GPA.1" }),
        status: { status: "ownership_conflict", alreadyGranted: true },
      },
    ]);
    expect(options.finishTransaction).toHaveBeenCalledOnce();
    // Acknowledged, so Google Play keeps user A's payment, and B got nothing.
    await expect(flow.recoverPurchases()).resolves.toEqual([]);
  });

  it("never offers a purchase for an old renewal recovery finds", async () => {
    const expired = purchase({ id: "renewal-1" });
    const active = purchase({ id: "renewal-2" });
    const { flow } = flowWith(
      async (p) =>
        p.id === expired.id
          ? { status: "invalid", reason: "EXPIRED" }
          : { status: "entitled", alreadyGranted: true },
      { getPendingTransactionsIOS: vi.fn(async () => [expired, active]) },
    );

    const outcomes = await flow.recoverPurchases();

    expect(outcomes[0]?.status).toEqual({
      status: "invalid",
      reason: "EXPIRED",
      recovered: true,
    });
    expect(
      outcomes.map(({ status }) => describePurchaseFlowStatus(status)),
    ).toEqual([
      { key: "purchase_not_valid", offerPurchase: false },
      { key: "access_granted", offerPurchase: false },
    ]);
    // The purchase the user just made still offers a retry.
    expect(
      describePurchaseFlowStatus(await flow.processPurchase(expired)),
    ).toEqual({ key: "purchase_not_valid", offerPurchase: true });
  });

  it.each([false, true])(
    "refuses to recover Apple purchases without getPendingTransactionsIOS (includeFinished %s)",
    async (includeFinished) => {
      const { flow, options } = flowWith(
        async () => ({ status: "entitled", alreadyGranted: false }),
        { getAvailablePurchases: vi.fn(async () => [purchase()]) },
      );

      await expect(flow.recoverPurchases({ includeFinished })).rejects.toThrow(
        "needs getPendingTransactionsIOS on iOS",
      );
      expect(options.confirmWithBackend).not.toHaveBeenCalled();
    },
  );

  it("restores a Play purchase whose change still waits for payment", async () => {
    const current = purchase({
      store: "google",
      isAcknowledgedAndroid: true,
      pendingPurchaseUpdateAndroid: { products: ["premium_yearly"] },
    });
    const { flow } = flowWith(
      async () => ({ status: "entitled", alreadyGranted: true }),
      { getAvailablePurchases: vi.fn(async () => [current]) },
    );

    await expect(
      flow.recoverPurchases({ includeFinished: true }),
    ).resolves.toEqual([
      {
        purchase: current,
        status: {
          status: "entitled",
          alreadyGranted: true,
          changePending: true,
        },
      },
    ]);
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
          purchase({ id: "a", store: "google", isAcknowledgedAndroid: false }),
          purchase({ id: "b", store: "google", isAcknowledgedAndroid: false }),
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
      { status: "ownership_conflict", alreadyGranted: true },
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
    [
      { status: "invalid", reason: "EXPIRED", recovered: true },
      { key: "purchase_not_valid", offerPurchase: false },
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
      { status: "entitled", alreadyGranted: true, changePending: true },
      { key: "payment_pending", offerPurchase: false },
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
          purchase({ store: "google", isAcknowledgedAndroid: false }),
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
