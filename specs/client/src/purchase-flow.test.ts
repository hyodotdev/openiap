import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPurchaseFlow,
  describePurchaseFlowStatus,
  toPurchaseConfirmationRequest,
  type PurchaseFlowOutcome,
  type PurchaseConfirmation,
  type PurchaseFlowOptions,
  type PurchaseFlowPurchase,
  type PurchaseFlowStatus,
} from "./purchase-flow";
import {
  createDeviceConfirmationIOS,
  createIapkitConfirmation,
  type IapkitVerificationProps,
  type IapkitVerificationResult,
} from "./purchase-flow-confirmers";

interface StepVector {
  listener?: string[];
  process?: string[];
  recover?: { includeFinished?: boolean };
  outcomes?: { id: string; status: unknown }[];
  dispose?: boolean;
}

// The cases every port runs; see the file's $comment.
const vectors: {
  process: {
    name: string;
    purchase: PurchaseFlowPurchase;
    isConsumable: boolean;
    confirmation?: unknown;
    confirmThrows?: true;
    finishThrows?: true;
    confirms?: boolean;
    finishes: boolean;
    status: unknown;
    guidance: unknown;
  }[];
  iapkit: {
    name: string;
    purchase: PurchaseFlowPurchase;
    isConsumable: boolean;
    apiKey?: string | null;
    baseUrl?: string;
    amazon?: { sandbox: boolean; verifiedProductIds: Record<string, string> };
    verifyAs?: Record<string, "apple" | "google" | "amazon" | "horizon">;
    noGrant?: true;
    props: IapkitVerificationProps | null;
    result?: IapkitVerificationResult;
    verifies?: boolean;
    confirmation?: PurchaseConfirmation;
    error?: true;
    granted: boolean;
  }[];
  device: {
    name: string;
    clock?: { beforeRead: number; afterRead: number };
    purchase: PurchaseFlowPurchase;
    pending: PurchaseFlowPurchase[];
    isConsumable: boolean;
    noGrant?: true;
    reads?: boolean;
    confirmation?: PurchaseConfirmation;
    error?: true;
    granted: boolean;
  }[];
  sequences: {
    name: string;
    consumables?: string[];
    purchases: Record<string, PurchaseFlowPurchase>;
    answers: Record<string, (PurchaseConfirmation | "throw")[]>;
    requested?: string[];
    requestedOnce?: true;
    pendingIOS?: string[] | "throw";
    available?: string[];
    steps: StepVector[];
    confirms: Record<string, number>;
    finishes: Record<string, number>;
    published?: { id: string; status: unknown }[];
  }[];
} = JSON.parse(
  readFileSync(
    new URL("./purchase-flow.vectors.json", import.meta.url),
    "utf8",
  ),
);

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
    "confirms and finishes an entitled %s purchase",
    async (store) => {
      const { flow, options } = flowWith(async () => ({
        status: "entitled",
        alreadyGranted: false,
      }));
      const item = purchase({ store });
      await expect(flow.processPurchase(item)).resolves.toEqual({
        status: "entitled",
        alreadyGranted: false,
      });
      expect(options.confirmWithBackend).toHaveBeenCalledWith(item, {
        isConsumable: false,
      });
      expect(options.finishTransaction).toHaveBeenCalledOnce();
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
    expect(options.confirmWithBackend).toHaveBeenCalledWith(current, {
      isConsumable: false,
    });
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

  it("finishes with the product type confirmation was given", async () => {
    const isConsumable = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    const { flow, options } = flowWith(
      async () => ({ status: "entitled", alreadyGranted: false }),
      { isConsumable },
    );

    await flow.processPurchase(purchase({ store: "google" }));

    expect(isConsumable).toHaveBeenCalledOnce();
    expect(options.finishTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ isConsumable: false }),
    );
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
    // A later delivery of the finished purchase is answered without a call.
    await expect(flow.processPurchase(purchase())).resolves.toBe(await first);
    expect(options.confirmWithBackend).toHaveBeenCalledTimes(1);
    expect(options.finishTransaction).toHaveBeenCalledTimes(1);
  });
});

describe("listening", () => {
  function listeningFlow(
    confirm: () => Promise<PurchaseConfirmation>,
    overrides: Partial<PurchaseFlowOptions<PurchaseFlowPurchase>> = {},
  ) {
    const store: { deliver?: (p: PurchaseFlowPurchase) => void } = {};
    const published: PurchaseFlowOutcome<PurchaseFlowPurchase>[] = [];
    const { flow, options } = flowWith(confirm, {
      listenForPurchases: (onPurchase) => {
        store.deliver = onPurchase;
        return { remove: () => (store.deliver = undefined) };
      },
      wasRequested: () => false,
      ...overrides,
    });
    flow.subscribe((outcome) => published.push(outcome));
    return { flow, options, store, published };
  }

  function gate() {
    let open!: () => void;
    const opened = new Promise<void>((resolve) => {
      open = resolve;
    });
    return { open, opened };
  }

  it("publishes a shared run as requested when the user's request joined it", async () => {
    const { opened, open } = gate();
    const { flow, store, published } = listeningFlow(async () => {
      await opened;
      return { status: "invalid" };
    });

    store.deliver?.(purchase());
    const requested = flow.processPurchase(purchase());
    open();

    await expect(requested).resolves.toEqual({ status: "invalid" });
    expect(published.map(({ status }) => status)).toEqual([
      { status: "invalid" },
    ]);
  });

  it("publishes a shared run with its latest delivery", async () => {
    const { opened, open } = gate();
    const { store, published } = listeningFlow(async () => {
      await opened;
      return { status: "entitled", alreadyGranted: false };
    });
    const changed = purchase({
      store: "google",
      pendingPurchaseUpdateAndroid: { products: ["premium_yearly"] },
    });

    store.deliver?.(purchase({ store: "google" }));
    store.deliver?.(changed);
    open();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(published).toEqual([
      {
        purchase: changed,
        status: {
          status: "entitled",
          alreadyGranted: false,
          changePending: true,
        },
      },
    ]);
  });

  it("shares a recovery pass that is still running", async () => {
    const { flow, options } = listeningFlow(
      async () => ({ status: "entitled", alreadyGranted: false }),
      {
        getAvailablePurchases: vi.fn(async () => [
          purchase({ store: "google", isAcknowledgedAndroid: false }),
        ]),
      },
    );

    const [first, second] = await Promise.all([
      flow.recoverPurchases(),
      flow.recoverPurchases(),
    ]);

    expect(first).toBe(second);
    expect(options.getAvailablePurchases).toHaveBeenCalledTimes(1);
  });

  it("confirms nothing more for a recovery pass once disposed", async () => {
    const { opened, open } = gate();
    const { flow, options } = listeningFlow(
      async () => {
        await opened;
        return { status: "entitled", alreadyGranted: false };
      },
      {
        getAvailablePurchases: vi.fn(async () => [
          purchase({ id: "a", store: "google", isAcknowledgedAndroid: false }),
          purchase({ id: "b", store: "google", isAcknowledgedAndroid: false }),
        ]),
      },
    );

    const recovery = flow.recoverPurchases();
    await vi.waitFor(() =>
      expect(options.confirmWithBackend).toHaveBeenCalledTimes(1),
    );
    flow.dispose();
    open();

    await expect(recovery).resolves.toHaveLength(1);
    expect(options.confirmWithBackend).toHaveBeenCalledTimes(1);
  });

  it("publishes nothing after dispose, even to a later subscriber", async () => {
    const { opened, open } = gate();
    const { flow, store } = listeningFlow(async () => {
      await opened;
      return { status: "entitled", alreadyGranted: false };
    });
    const late = vi.fn();

    store.deliver?.(purchase());
    flow.dispose();
    flow.subscribe(late);
    open();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(late).not.toHaveBeenCalled();
    expect(store.deliver).toBeUndefined();
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
      { key: "change_pending", offerPurchase: false },
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

// The same cases run in every port, so all SDKs make the same decisions.
describe("shared vectors", () => {
  it.each(vectors.process.map((v) => [v.name, v] as const))(
    "process: %s",
    async (_, vector) => {
      const confirmWithBackend = vi.fn(async () => {
        if (vector.confirmThrows) throw new Error("backend down");
        // Raw JSON on purpose: the flow must reject malformed answers itself.
        return vector.confirmation as PurchaseConfirmation;
      });
      const finishTransaction = vi.fn(
        async (_args: {
          purchase: PurchaseFlowPurchase;
          isConsumable: boolean;
        }) => {
          if (vector.finishThrows) throw new Error("store down");
        },
      );
      const flow = createPurchaseFlow({
        confirmWithBackend,
        finishTransaction,
        isConsumable: () => vector.isConsumable,
        getAvailablePurchases: async () => [],
        getPendingTransactionsIOS: undefined,
      });
      const item = vector.purchase;

      const status = await flow.processPurchase(item);

      expect(confirmWithBackend).toHaveBeenCalledTimes(
        vector.confirms === false ? 0 : 1,
      );
      if (vector.finishes) {
        expect(finishTransaction).toHaveBeenCalledExactlyOnceWith({
          purchase: item,
          isConsumable: vector.isConsumable,
        });
      } else {
        expect(finishTransaction).not.toHaveBeenCalled();
      }
      const { error, finishError, ...rest } = status as Record<string, unknown>;
      expect({
        ...rest,
        ...(error === undefined ? {} : { error: true }),
        ...(finishError === undefined ? {} : { finishError: true }),
      }).toEqual(vector.status);
      expect(describePurchaseFlowStatus(status)).toEqual(vector.guidance);
    },
  );

  it.each(vectors.iapkit.map((v) => [v.name, v] as const))(
    "iapkit: %s",
    async (_, vector) => {
      const item = vector.purchase;
      const { amazon } = vector;
      const productIds = amazon?.verifiedProductIds ?? {};
      const stores = vector.verifyAs ?? {};
      const grant = vi.fn(async () => {});
      const apiKey = vector.apiKey === undefined ? "pk" : vector.apiKey;
      const options = {
        ...(apiKey === null ? {} : { apiKey }),
        baseUrl: vector.baseUrl,
        ...(amazon
          ? {
              amazon: {
                sandbox: amazon.sandbox,
                verifiedProductId: (id: string) => productIds[id] ?? id,
              },
            }
          : {}),
        verifyAs: (p: PurchaseFlowPurchase) => stores[p.storeId ?? ""],
        ...(vector.noGrant ? {} : { grant }),
      };
      const verify = vi.fn(
        async (_props: IapkitVerificationProps) => vector.result ?? {},
      );
      const confirm = createIapkitConfirmation(verify, options);

      const answer = confirm(item, { isConsumable: vector.isConsumable });

      if (vector.error) {
        await expect(answer).rejects.toThrow();
      } else {
        await expect(answer).resolves.toEqual(vector.confirmation);
      }
      if (vector.props === null || vector.verifies === false) {
        expect(verify).not.toHaveBeenCalled();
      } else {
        expect(verify).toHaveBeenCalledExactlyOnceWith(vector.props);
      }
      expect(grant).toHaveBeenCalledTimes(vector.granted ? 1 : 0);
    },
  );

  it.each(vectors.device.map((v) => [v.name, v] as const))(
    "device: %s",
    async (_, vector) => {
      const { clock } = vector;
      if (clock) vi.useFakeTimers({ now: clock.beforeRead });
      try {
        const grant = vi.fn(async () => {});
        const read = vi.fn(async () => {
          if (clock) vi.setSystemTime(clock.afterRead);
          return vector.pending;
        });
        const confirm = createDeviceConfirmationIOS(
          read,
          vector.noGrant ? {} : { grant },
        );

        const answer = confirm(vector.purchase, {
          isConsumable: vector.isConsumable,
        });

        if (vector.error) {
          await expect(answer).rejects.toThrow();
        } else {
          await expect(answer).resolves.toEqual(vector.confirmation);
        }
        expect(read).toHaveBeenCalledTimes(vector.reads === false ? 0 : 1);
        expect(grant).toHaveBeenCalledTimes(vector.granted ? 1 : 0);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each(vectors.sequences.map((v) => [v.name, v] as const))(
    "sequence: %s",
    async (_, vector) => {
      const { purchases, answers, pendingIOS } = vector;
      const confirms: Record<string, number> = {};
      const finishes: Record<string, number> = {};
      const published: PurchaseFlowOutcome<PurchaseFlowPurchase>[] = [];
      const consumables = new Set(vector.consumables);
      const requested = new Set(vector.requested);
      const store: { deliver?: (purchase: PurchaseFlowPurchase) => void } = {};
      const flow = createPurchaseFlow<PurchaseFlowPurchase>({
        confirmWithBackend: async (p) => {
          const count = (confirms[p.id] = (confirms[p.id] ?? 0) + 1);
          const list = answers[p.id] ?? answers["*"];
          const answer = list[Math.min(count, list.length) - 1];
          if (answer === "throw") throw new Error("backend down");
          return answer;
        },
        finishTransaction: async ({ purchase: p }) => {
          finishes[p.id] = (finishes[p.id] ?? 0) + 1;
        },
        isConsumable: (productId) => consumables.has(productId),
        getAvailablePurchases: async () =>
          (vector.available ?? []).map((key) => purchases[key]),
        getPendingTransactionsIOS:
          pendingIOS === undefined
            ? undefined
            : async () => {
                if (pendingIOS === "throw") throw new Error("unverified");
                return pendingIOS.map((key) => purchases[key]);
              },
        listenForPurchases: (onPurchase) => {
          store.deliver = onPurchase;
          return {
            remove: () => {
              store.deliver = undefined;
            },
          };
        },
        wasRequested: (p) =>
          vector.requestedOnce ? requested.delete(p.id) : requested.has(p.id),
      });
      flow.subscribe((outcome) => published.push(outcome));
      const comparable = (status: PurchaseFlowStatus) => {
        const { error, finishError, ...rest } = status as Record<
          string,
          unknown
        >;
        return {
          ...rest,
          ...(error === undefined ? {} : { error: true }),
          ...(finishError === undefined ? {} : { finishError: true }),
        };
      };
      const byId = (outcomes: PurchaseFlowOutcome<PurchaseFlowPurchase>[]) =>
        outcomes.map(({ purchase: p, status }) => ({
          id: p.id,
          status: comparable(status),
        }));

      for (const step of vector.steps) {
        if (step.dispose) flow.dispose();
        for (const key of step.listener ?? []) store.deliver?.(purchases[key]);
        const processed = (step.process ?? []).map((key) =>
          flow.processPurchase(purchases[key]),
        );
        const recovered = step.recover
          ? flow.recoverPurchases(step.recover)
          : undefined;
        await Promise.all(processed);
        if (recovered) expect(byId(await recovered)).toEqual(step.outcomes);
        // Listener deliveries settle without a promise to wait on.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      expect(confirms).toEqual(vector.confirms);
      expect(finishes).toEqual(vector.finishes);
      if (vector.published) {
        expect(byId(published)).toEqual(vector.published);
      }
    },
  );
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
