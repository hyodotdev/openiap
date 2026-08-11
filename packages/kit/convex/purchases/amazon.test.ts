import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { testableFunction } from "../test.setup";
import {
  buildAmazonRemoteId,
  buildAmazonRvsUrl,
  mapAmazonReceiptState,
  parseAmazonReceiptResponse,
  reconcileAmazonPurchases,
  verifyAmazonReceiptInternalV1,
  waitForAmazonRateSlot,
  type AmazonReceiptData,
} from "./amazon";
import {
  AmazonReceiptVerificationError,
  AmazonSandboxNotEnabledError,
  AmazonSharedSecretNotConfiguredError,
} from "./errors";
import { HarmonizedPurchaseState } from "./purchaseState";
import {
  AMAZON_RECONCILE_INTERVAL_MS,
  AMAZON_RECONCILE_RETRY_MS,
} from "./shared";

const USER_ID = "amzn1.account.test-user";
const RECEIPT_ID = "amzn1.receipt.test-receipt";
const PRODUCT_ID = "premium.monthly";

function validReceipt(
  overrides: Record<string, unknown> = {},
): AmazonReceiptData {
  return {
    productId: PRODUCT_ID,
    productType: "SUBSCRIPTION",
    receiptId: RECEIPT_ID,
    purchaseDate: 1_700_000_000_000,
    renewalDate: 1_700_100_000_000,
    cancelDate: null,
    ...overrides,
  };
}

function project(overrides: Record<string, unknown> = {}) {
  return {
    _id: "projects_amazon_test",
    organizationId: "organizations_amazon_test",
    androidPackageName: "com.example.amazon",
    amazonSandboxEnabled: false,
    amazonSharedSecret: "production-secret",
    ...overrides,
  };
}

function actionContext(projectRow = project()) {
  const runQuery = vi.fn().mockResolvedValue(projectRow);
  const runMutation = vi.fn().mockResolvedValue("purchases_amazon_test");
  return {
    ctx: { runQuery, runMutation } as never,
    runMutation,
  };
}

async function runVerify(ctx: never, overrides: Record<string, unknown> = {}) {
  return await testableFunction(verifyAmazonReceiptInternalV1)._handler(ctx, {
    apiKey: "iapkit_test_key",
    userId: USER_ID,
    receiptId: RECEIPT_ID,
    ...overrides,
  });
}

describe("buildAmazonRemoteId", () => {
  test("separates sandbox and production receipts", () => {
    expect(
      buildAmazonRemoteId({
        userId: "user/one",
        receiptId: "receipt:one",
        sandbox: true,
      }),
    ).toBe("sandbox:user%2Fone:receipt%3Aone");

    expect(
      buildAmazonRemoteId({
        userId: "user/one",
        receiptId: "receipt:one",
        sandbox: false,
      }),
    ).toBe("production:user%2Fone:receipt%3Aone");
  });
});

describe("buildAmazonRvsUrl", () => {
  test("encodes production credentials and adds sandbox only when selected", () => {
    expect(
      buildAmazonRvsUrl({
        sharedSecret: "secret/with space",
        userId: "user/one",
        receiptId: "receipt:one",
        sandbox: false,
      }),
    ).toBe(
      "https://appstore-sdk.amazon.com/version/1.0/verifyReceiptId/developer/secret%2Fwith%20space/user/user%2Fone/receiptId/receipt%3Aone",
    );
    expect(
      buildAmazonRvsUrl({
        sharedSecret: "placeholder",
        userId: USER_ID,
        receiptId: RECEIPT_ID,
        sandbox: true,
      }),
    ).toContain("appstore-sdk.amazon.com/sandbox/version/1.0");
  });
});

describe("mapAmazonReceiptState", () => {
  test("maps canceled receipts before product type handling", () => {
    expect(
      mapAmazonReceiptState({
        ...validReceipt({ productType: "CONSUMABLE" }),
        cancelDate: 1_700_000_000_000,
      }),
    ).toBe(HarmonizedPurchaseState.CANCELED);
  });

  test("maps Amazon product types to harmonized states", () => {
    expect(
      mapAmazonReceiptState(validReceipt({ productType: "CONSUMABLE" })),
    ).toBe(HarmonizedPurchaseState.READY_TO_CONSUME);
    expect(
      mapAmazonReceiptState(validReceipt({ productType: "ENTITLED" })),
    ).toBe(HarmonizedPurchaseState.ENTITLED);
    expect(mapAmazonReceiptState(validReceipt())).toBe(
      HarmonizedPurchaseState.ENTITLED,
    );
  });

  test("does not treat Amazon subscription renewalDate as expiry", () => {
    expect(
      mapAmazonReceiptState(
        validReceipt({ renewalDate: 1_000, cancelDate: null }),
      ),
    ).toBe(HarmonizedPurchaseState.ENTITLED);
  });
});

describe("parseAmazonReceiptResponse", () => {
  test("accepts a typed RVS object while retaining future extra fields", () => {
    const raw = validReceipt({ futureField: "retained" });
    expect(parseAmazonReceiptResponse(raw)).toBe(raw);
  });

  test.each([
    [null],
    [[]],
    ["not-json"],
    [{ productType: "SUBSCRIPTION" }],
    [{ productId: PRODUCT_ID, productType: "FUTURE_KIND" }],
    [
      {
        productId: PRODUCT_ID,
        productType: "SUBSCRIPTION",
        receiptId: RECEIPT_ID,
      },
    ],
    [
      {
        productId: PRODUCT_ID,
        productType: "SUBSCRIPTION",
        cancelDate: null,
      },
    ],
    [{ ...validReceipt(), renewalDate: "tomorrow" }],
    [{ ...validReceipt(), testTransaction: "yes" }],
  ])("rejects malformed or unsupported RVS data %#", (raw) => {
    expect(() => parseAmazonReceiptResponse(raw)).toThrow(
      AmazonReceiptVerificationError,
    );
  });
});

describe("verifyAmazonReceiptInternalV1", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("rejects sandbox before fetch or persistence unless the project opted in", async () => {
    const { ctx, runMutation } = actionContext(
      project({ amazonSandboxEnabled: false, amazonSharedSecret: null }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(runVerify(ctx, { sandbox: true })).rejects.toBeInstanceOf(
      AmazonSandboxNotEnabledError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(runMutation).not.toHaveBeenCalled();
  });

  test("rejects production before fetch when no shared secret is configured", async () => {
    const { ctx, runMutation } = actionContext(
      project({ amazonSharedSecret: null }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(runVerify(ctx)).rejects.toBeInstanceOf(
      AmazonSharedSecretNotConfiguredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(runMutation).not.toHaveBeenCalled();
  });

  test("uses only the placeholder in opted-in sandbox and returns/persists its environment", async () => {
    const { ctx, runMutation } = actionContext(
      project({
        amazonSandboxEnabled: true,
        amazonSharedSecret: "must-not-reach-sandbox",
      }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(validReceipt())));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      runVerify(ctx, {
        sandbox: true,
        expectedProductId: PRODUCT_ID,
      }),
    ).resolves.toEqual({
      isValid: true,
      state: HarmonizedPurchaseState.ENTITLED,
      productId: PRODUCT_ID,
      environment: "Sandbox",
    });

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("/sandbox/");
    expect(requestedUrl).toContain("/developer/iapkit-sandbox/");
    expect(requestedUrl).not.toContain("must-not-reach-sandbox");
    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        environment: "Sandbox",
        state: HarmonizedPurchaseState.ENTITLED,
        isValid: true,
        requestData: expect.objectContaining({
          sandbox: true,
          expectedProductId: PRODUCT_ID,
        }),
      }),
    );
  });

  test("uses the production secret without a sandbox path", async () => {
    const { ctx } = actionContext(
      project({ amazonSharedSecret: "production/secret" }),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(validReceipt())));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runVerify(ctx)).resolves.toMatchObject({
      environment: "Production",
    });
    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("/developer/production%2Fsecret/");
    expect(requestedUrl).not.toContain("/sandbox/");
  });

  test("returns an expectedProductId mismatch without corrupting the stored verdict", async () => {
    const { ctx, runMutation } = actionContext();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(validReceipt()))),
    );

    await expect(
      runVerify(ctx, { expectedProductId: "different.product" }),
    ).resolves.toEqual({
      isValid: false,
      state: HarmonizedPurchaseState.INAUTHENTIC,
      productId: PRODUCT_ID,
      environment: "Production",
    });
    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        isValid: true,
        state: HarmonizedPurchaseState.ENTITLED,
      }),
    );
  });

  test.each([
    [400, HarmonizedPurchaseState.INAUTHENTIC],
    [497, HarmonizedPurchaseState.INAUTHENTIC],
    [410, HarmonizedPurchaseState.CANCELED],
  ])("persists deterministic Amazon status %i", async (status, state) => {
    const { ctx, runMutation } = actionContext();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("rejected", { status }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runVerify(ctx)).resolves.toEqual({
      isValid: false,
      state,
      environment: "Production",
    });
    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        state,
        isValid: false,
        environment: "Production",
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([429, 500, 503])(
    "retries transient Amazon status %i and persists only the successful verdict",
    async (status) => {
      const { ctx, runMutation } = actionContext();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response("retry", { status }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify(validReceipt()), { status: 200 }),
        );
      vi.stubGlobal("fetch", fetchMock);

      await expect(runVerify(ctx)).resolves.toMatchObject({
        isValid: true,
        state: HarmonizedPurchaseState.ENTITLED,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(runMutation).toHaveBeenCalledTimes(1);
      expect(runMutation.mock.calls[0]?.[1]).toEqual(
        expect.objectContaining({ isValid: true }),
      );
    },
  );

  test.each([429, 500])(
    "does not persist after transient Amazon status %i exhausts retries",
    async (status) => {
      const { ctx, runMutation } = actionContext();
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response("still unavailable", { status }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(runVerify(ctx)).rejects.toBeInstanceOf(
        AmazonReceiptVerificationError,
      );
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(runMutation).not.toHaveBeenCalled();
    },
  );

  test("fails fast on Amazon 496 without persisting", async () => {
    const { ctx, runMutation } = actionContext();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("invalid secret", { status: 496 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runVerify(ctx)).rejects.toBeInstanceOf(
      AmazonReceiptVerificationError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runMutation).not.toHaveBeenCalled();
  });

  test("does not persist transient or protocol failures", async () => {
    for (const failure of [
      () => Promise.reject(new TypeError("network unavailable")),
      () => Promise.resolve(new Response("not-json")),
      () =>
        Promise.resolve(
          new Response(
            JSON.stringify(validReceipt({ receiptId: "different-receipt" })),
          ),
        ),
    ]) {
      const { ctx, runMutation } = actionContext();
      vi.stubGlobal("fetch", vi.fn().mockImplementation(failure));
      await expect(runVerify(ctx)).rejects.toBeInstanceOf(
        AmazonReceiptVerificationError,
      );
      expect(runMutation).not.toHaveBeenCalled();
    }
  });

  test.each([
    [
      "cancelDate",
      {
        productId: PRODUCT_ID,
        productType: "SUBSCRIPTION",
        receiptId: RECEIPT_ID,
      },
    ],
    [
      "receiptId",
      {
        productId: PRODUCT_ID,
        productType: "SUBSCRIPTION",
        cancelDate: null,
      },
    ],
  ])(
    "does not persist a 200 response missing required %s",
    async (_field, responseBody) => {
      const { ctx, runMutation } = actionContext();
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(responseBody)));
      vi.stubGlobal("fetch", fetchMock);

      await expect(runVerify(ctx)).rejects.toBeInstanceOf(
        AmazonReceiptVerificationError,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(runMutation).not.toHaveBeenCalled();
    },
  );

  test("keeps the timeout active while the response body stalls", async () => {
    vi.useFakeTimers();
    const { ctx, runMutation } = actionContext();
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init: { signal: AbortSignal }) =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: () =>
            new Promise<string>((_resolve, reject) => {
              init.signal.addEventListener("abort", () => {
                reject(new DOMException("aborted", "AbortError"));
              });
            }),
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const verification = runVerify(ctx);
    const rejection = expect(verification).rejects.toBeInstanceOf(
      AmazonReceiptVerificationError,
    );
    await vi.runAllTimersAsync();
    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(runMutation).not.toHaveBeenCalled();
  });
});

describe("Amazon purchase reconciler", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function probe(overrides: Record<string, unknown> = {}) {
    return {
      purchaseId: "purchases_due",
      projectId: "projects_amazon_test",
      applicationId: "com.example.amazon",
      remoteId: `production:${USER_ID}:${RECEIPT_ID}`,
      state: HarmonizedPurchaseState.ENTITLED,
      requestData: {
        store: "amazon",
        userId: USER_ID,
        receiptId: RECEIPT_ID,
        sandbox: false,
        expectedProductId: PRODUCT_ID,
      },
      leaseUntil: 10_000,
      amazonSandboxEnabled: false,
      amazonSharedSecret: "production-secret",
      ...overrides,
    };
  }

  function reconcileContext(probes: unknown[], mutationResult = true) {
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce(probes)
      .mockResolvedValue(mutationResult);
    return { ctx: { runMutation } as never, runMutation };
  }

  test("refreshes a valid purchase row and keeps Amazon out of subscriptions", async () => {
    const { ctx, runMutation } = reconcileContext([probe()]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(validReceipt()))),
    );

    await expect(
      testableFunction(reconcileAmazonPurchases)._handler(ctx, {}),
    ).resolves.toEqual({ claimed: 1, checked: 1, updated: 1, failures: 0 });

    expect(runMutation).toHaveBeenCalledTimes(2);
    expect(runMutation.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        state: HarmonizedPurchaseState.ENTITLED,
        purchaseId: "purchases_due",
        claimedLeaseUntil: 10_000,
      }),
    );
    expect(JSON.stringify(runMutation.mock.calls)).not.toContain(
      "subscriptions",
    );
  });

  test("authoritatively stops a 410 row but reschedules transient and protocol failures", async () => {
    const canceled = reconcileContext([probe()]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("gone", { status: 410 })),
    );
    await expect(
      testableFunction(reconcileAmazonPurchases)._handler(canceled.ctx, {}),
    ).resolves.toEqual({ claimed: 1, checked: 1, updated: 1, failures: 0 });
    expect(canceled.runMutation.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        state: HarmonizedPurchaseState.CANCELED,
        purchaseId: "purchases_due",
        claimedLeaseUntil: 10_000,
      }),
    );

    vi.useFakeTimers({ now: 20_000 });
    for (const response of [
      () => Promise.reject(new TypeError("network down")),
      () => Promise.resolve(new Response("invalid json")),
    ]) {
      const failed = reconcileContext([probe()]);
      vi.stubGlobal("fetch", vi.fn().mockImplementation(response));
      await expect(
        testableFunction(reconcileAmazonPurchases)._handler(failed.ctx, {}),
      ).resolves.toEqual({ claimed: 1, checked: 1, updated: 0, failures: 1 });
      expect(failed.runMutation.mock.calls[1]?.[1]).toEqual(
        expect.objectContaining({
          purchaseId: "purchases_due",
          claimedLeaseUntil: 10_000,
          retryAt: 20_000 + AMAZON_RECONCILE_RETRY_MS,
        }),
      );
      expect(failed.runMutation.mock.calls[1]?.[1]).not.toHaveProperty("state");
    }
  });

  test("defers an invalid configured secret on the normal cadence", async () => {
    vi.useFakeTimers({ now: 25_000 });
    const { ctx, runMutation } = reconcileContext([probe()]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("secret", { status: 496 })),
    );

    await expect(
      testableFunction(reconcileAmazonPurchases)._handler(ctx, {}),
    ).resolves.toEqual({ claimed: 1, checked: 1, updated: 0, failures: 1 });
    expect(runMutation.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        purchaseId: "purchases_due",
        claimedLeaseUntil: 10_000,
        retryAt: 25_000 + AMAZON_RECONCILE_INTERVAL_MS,
      }),
    );
    expect(runMutation.mock.calls[1]?.[1]).not.toHaveProperty("state");
  });

  test.each([
    [
      "cancelDate",
      {
        productId: PRODUCT_ID,
        productType: "SUBSCRIPTION",
        receiptId: RECEIPT_ID,
      },
    ],
    [
      "receiptId",
      {
        productId: PRODUCT_ID,
        productType: "SUBSCRIPTION",
        cancelDate: null,
      },
    ],
  ])(
    "reschedules without changing state when a 200 response omits %s",
    async (_field, responseBody) => {
      const { ctx, runMutation } = reconcileContext([probe()]);
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(responseBody)));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        testableFunction(reconcileAmazonPurchases)._handler(ctx, {}),
      ).resolves.toEqual({
        claimed: 1,
        checked: 1,
        updated: 0,
        failures: 1,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(runMutation.mock.calls[1]?.[1]).toEqual(
        expect.objectContaining({
          purchaseId: "purchases_due",
          claimedLeaseUntil: 10_000,
          retryAt: expect.any(Number),
        }),
      );
      expect(runMutation.mock.calls[1]?.[1]).not.toHaveProperty("state");
    },
  );

  test("does not count a verdict whose claim lost a foreground race", async () => {
    const { ctx } = reconcileContext([probe()], false);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(validReceipt()))),
    );

    await expect(
      testableFunction(reconcileAmazonPurchases)._handler(ctx, {}),
    ).resolves.toEqual({ claimed: 1, checked: 1, updated: 0, failures: 0 });
  });

  test("reschedules a disabled sandbox row without contacting Amazon", async () => {
    vi.useFakeTimers({ now: 30_000 });
    const { ctx, runMutation } = reconcileContext([
      probe({
        requestData: {
          store: "amazon",
          userId: USER_ID,
          receiptId: RECEIPT_ID,
          sandbox: true,
        },
        amazonSandboxEnabled: false,
        amazonSharedSecret: undefined,
      }),
    ]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      testableFunction(reconcileAmazonPurchases)._handler(ctx, {}),
    ).resolves.toEqual({ claimed: 1, checked: 0, updated: 0, failures: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(runMutation.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        purchaseId: "purchases_due",
        retryAt: 30_000 + AMAZON_RECONCILE_INTERVAL_MS,
      }),
    );
  });

  test("paces request starts at no more than 5 TPS", async () => {
    vi.useFakeTimers({ now: 1_000 });
    const { ctx } = reconcileContext([
      probe({ purchaseId: "purchases_1" }),
      probe({ purchaseId: "purchases_2" }),
      probe({ purchaseId: "purchases_3" }),
    ]);
    const starts: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        starts.push(Date.now());
        return Promise.resolve(new Response(JSON.stringify(validReceipt())));
      }),
    );

    const reconciliation = testableFunction(reconcileAmazonPurchases)._handler(
      ctx,
      {},
    );
    await vi.runAllTimersAsync();
    await expect(reconciliation).resolves.toEqual({
      claimed: 3,
      checked: 3,
      updated: 3,
      failures: 0,
    });
    expect(starts).toHaveLength(3);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(200);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(200);
  });
});

describe("waitForAmazonRateSlot", () => {
  test("waits only for the remainder of the 200ms slot", async () => {
    let now = 1_100;
    const sleep = vi.fn(async (ms: number) => {
      now += ms;
    });
    await expect(
      waitForAmazonRateSlot({
        lastStartedAt: 1_000,
        now: () => now,
        sleep,
      }),
    ).resolves.toBe(1_200);
    expect(sleep).toHaveBeenCalledWith(100);
  });
});
