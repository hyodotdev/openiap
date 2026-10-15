import {
  createPurchaseFlow,
  describePurchaseFlowStatus,
  toPurchaseConfirmationRequest,
  type PurchaseConfirmation,
  type PurchaseFlowOptions,
  type PurchaseFlowPurchase,
  type PurchaseFlowStatus,
} from '../purchase-flow';

// Mirrored into expo-iap with purchase-flow.ts by specs/client `bun run sync`;
// specs/client/src/purchase-flow.test.ts holds the full behavior suite.

const purchase = (
  overrides: Partial<PurchaseFlowPurchase> = {},
): PurchaseFlowPurchase => ({
  id: 'tx-1',
  productId: 'premium',
  purchaseState: 'purchased',
  purchaseToken: 'token-1',
  store: 'apple',
  ...overrides,
});

const entitled: PurchaseConfirmation = {
  status: 'entitled',
  alreadyGranted: false,
};

function flowWith(
  confirm: (p: PurchaseFlowPurchase) => Promise<PurchaseConfirmation>,
  overrides: Partial<PurchaseFlowOptions<PurchaseFlowPurchase>> = {},
) {
  const finishTransaction = jest.fn(async () => {});
  const confirmWithBackend = jest.fn(confirm);
  const flow = createPurchaseFlow({
    confirmWithBackend,
    finishTransaction,
    isConsumable: (productId) => productId === 'coins_100',
    getAvailablePurchases: async () => [],
    ...overrides,
  });
  return {flow, confirmWithBackend, finishTransaction};
}

describe('shared purchase-flow', () => {
  it('never contacts the backend for a pending payment', async () => {
    const {flow, confirmWithBackend} = flowWith(async () => entitled);

    await expect(
      flow.processPurchase(purchase({purchaseState: 'pending'})),
    ).resolves.toEqual({status: 'store_pending'});
    expect(confirmWithBackend).not.toHaveBeenCalled();
  });

  it.each<PurchaseConfirmation>([
    {status: 'store_pending'},
    {status: 'verification_delayed', retryAfterMs: 5_000},
    {status: 'ownership_conflict'},
    {status: 'test_account_restricted'},
    {status: 'invalid', reason: 'EXPIRED'},
    {status: 'invalid'},
    {status: 'verified'},
    {status: 'linked', retryAfterMs: 30_000},
  ])('does not finish on $status', async (confirmation) => {
    const {flow, finishTransaction} = flowWith(async () => confirmation);

    await expect(flow.processPurchase(purchase())).resolves.toEqual(
      confirmation,
    );
    expect(finishTransaction).not.toHaveBeenCalled();
  });

  it('finishes a consumable as consumable once access is granted', async () => {
    const {flow, finishTransaction} = flowWith(async () => entitled);
    const coins = purchase({productId: 'coins_100'});

    await expect(flow.processPurchase(coins)).resolves.toEqual(entitled);
    expect(finishTransaction).toHaveBeenCalledWith({
      purchase: coins,
      isConsumable: true,
    });
  });

  it('keeps access granted when finishing fails', async () => {
    const finishError = new Error('store unavailable');
    const {flow} = flowWith(async () => entitled, {
      finishTransaction: async () => {
        throw finishError;
      },
    });

    await expect(flow.processPurchase(purchase())).resolves.toEqual({
      ...entitled,
      finishError,
    });
  });

  it.each<unknown>([
    null,
    {status: 'granted'},
    {status: 'entitled'},
    {status: 'verification_delayed', retryAfterMs: -1},
  ])('fails without finishing on an off-contract body: %j', async (body) => {
    const {flow, finishTransaction} = flowWith(
      // @ts-expect-error The backend's JSON reaches the flow untyped.
      async () => body,
    );

    expect((await flow.processPurchase(purchase())).status).toBe('failed');
    expect(finishTransaction).not.toHaveBeenCalled();
  });

  it('fails without finishing when the backend call throws', async () => {
    const error = new Error('offline');
    const {flow, finishTransaction} = flowWith(async () => {
      throw error;
    });

    await expect(flow.processPurchase(purchase())).resolves.toEqual({
      status: 'failed',
      error,
    });
    expect(finishTransaction).not.toHaveBeenCalled();
  });

  it('shares one backend call between concurrent deliveries', async () => {
    const {flow, confirmWithBackend} = flowWith(async () => entitled);

    await Promise.all([
      flow.processPurchase(purchase()),
      flow.processPurchase(purchase()),
    ]);

    expect(confirmWithBackend).toHaveBeenCalledTimes(1);
  });

  it('recovers unfinished iOS transactions without listing finished ones', async () => {
    const getAvailablePurchases = jest.fn(async () => [purchase({id: 'old'})]);
    const {flow} = flowWith(async () => entitled, {
      getAvailablePurchases,
      getPendingTransactionsIOS: async () => [purchase()],
    });

    const outcomes = await flow.recoverPurchases();

    expect(outcomes.map(({purchase: p}) => p.id)).toEqual(['tx-1']);
    expect(getAvailablePurchases).not.toHaveBeenCalled();
  });

  it('recovers only unacknowledged Android purchases by default', async () => {
    const {flow} = flowWith(async () => entitled, {
      getAvailablePurchases: async () => [
        purchase({id: 'acked', isAcknowledgedAndroid: true}),
        purchase({id: 'open', isAcknowledgedAndroid: false}),
      ],
    });

    const outcomes = await flow.recoverPurchases();

    expect(outcomes.map(({purchase: p}) => p.id)).toEqual(['open']);
  });

  it('restores every owned purchase once, deduplicated by transaction', async () => {
    const {flow, confirmWithBackend} = flowWith(
      async () => ({status: 'entitled', alreadyGranted: true}),
      {
        getPendingTransactionsIOS: async () => [purchase()],
        getAvailablePurchases: async () => [purchase(), purchase({id: 'tx-2'})],
      },
    );

    const outcomes = await flow.recoverPurchases({includeFinished: true});

    expect(outcomes.map(({purchase: p}) => p.id)).toEqual(['tx-1', 'tx-2']);
    expect(confirmWithBackend).toHaveBeenCalledTimes(2);
  });

  it.each<[PurchaseFlowStatus, string, boolean, number | undefined]>([
    [{status: 'store_pending'}, 'payment_pending', false, undefined],
    [
      {status: 'verification_delayed', retryAfterMs: 5_000},
      'verification_delayed',
      false,
      5_000,
    ],
    [
      {status: 'ownership_conflict'},
      'owned_by_another_account',
      false,
      undefined,
    ],
    [
      {status: 'test_account_restricted'},
      'test_purchase_not_accepted',
      false,
      undefined,
    ],
    [{status: 'invalid'}, 'purchase_not_valid', true, undefined],
    [{status: 'verified'}, 'access_pending', false, undefined],
    [{status: 'linked', retryAfterMs: 1_000}, 'access_pending', false, 1_000],
    [entitled, 'access_granted', false, undefined],
    [{status: 'failed', error: null}, 'try_again_later', false, undefined],
  ])('describes %j', (status, key, offerPurchase, retryAfterMs) => {
    expect(describePurchaseFlowStatus(status)).toEqual({
      key,
      offerPurchase,
      ...(retryAfterMs === undefined ? {} : {retryAfterMs}),
    });
  });

  it('builds the backend request only from Apple or Google evidence', () => {
    expect(toPurchaseConfirmationRequest(purchase())).toEqual({
      store: 'apple',
      purchaseToken: 'token-1',
      productId: 'premium',
    });
    expect(() =>
      toPurchaseConfirmationRequest(purchase({store: 'amazon'})),
    ).toThrow('has no Apple or Google purchase token');
  });
});
