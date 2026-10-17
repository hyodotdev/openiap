import React from 'react';
import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import * as ExpoIap from 'expo-iap';
import type {ExpoPurchaseError, PurchaseIOS, UseIAPOptions} from 'expo-iap';
import BackendEntitlementFlow from '../src/components/BackendEntitlementFlow';

const mockIap: {
  options?: UseIAPOptions;
  subscriptions: object[];
  fetchProducts: jest.Mock;
  requestPurchase: jest.Mock;
} = {
  subscriptions: [],
  fetchProducts: jest.fn(() => Promise.resolve()),
  requestPurchase: jest.fn(() => Promise.resolve()),
};

jest.mock('expo-iap', () => ({
  ...jest.requireActual('../../src/purchase-flow'),
  ErrorCode: jest.requireActual('../../src/types').ErrorCode,
  finishTransaction: jest.fn(() => Promise.resolve()),
  getAvailablePurchases: jest.fn(() => Promise.resolve([])),
  getPendingTransactionsIOS: jest.fn(() => Promise.resolve([])),
  useIAP: (options: UseIAPOptions) => {
    mockIap.options = options;
    return {
      connected: true,
      products: [
        {id: 'dev.hyo.martie.10bulbs', title: '10 Bulbs', displayPrice: '$1'},
      ],
      subscriptions: mockIap.subscriptions,
      fetchProducts: mockIap.fetchProducts,
      requestPurchase: mockIap.requestPurchase,
    };
  },
}));

const bulbs: PurchaseIOS = {
  id: 'tx-1',
  transactionId: 'tx-1',
  productId: 'dev.hyo.martie.10bulbs',
  purchaseState: 'purchased',
  purchaseToken: 'jws',
  store: 'apple',
  storeId: 'apple',
  isAutoRenewing: false,
  quantity: 1,
  transactionDate: 0,
};

function replyWith(body: object): jest.SpyInstance {
  return jest
    .spyOn(global, 'fetch')
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(body), {status: 200})),
    );
}

// Waits for the launch recovery so no update lands after the test.
async function renderReady(productType: 'in-app' | 'subs' = 'in-app') {
  const screen = await render(
    <BackendEntitlementFlow productType={productType} />,
  );
  await screen.findByText('Restore purchases');
  return screen;
}

describe('BackendEntitlementFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIap.subscriptions = [];
    jest.mocked(ExpoIap.getPendingTransactionsIOS).mockResolvedValue([]);
    jest.mocked(ExpoIap.getAvailablePurchases).mockResolvedValue([]);
    process.env.EXPO_PUBLIC_APP_BACKEND_URL = 'https://backend.example/';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.EXPO_PUBLIC_APP_BACKEND_URL;
  });

  it('shows setup instructions without a backend URL', async () => {
    delete process.env.EXPO_PUBLIC_APP_BACKEND_URL;
    const fetchSpy = replyWith({});

    const {getByText} = await render(<BackendEntitlementFlow />);

    expect(getByText('Set up your app backend')).toBeDefined();
    expect(getByText(/Never put that key in this app/)).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ExpoIap.getPendingTransactionsIOS).not.toHaveBeenCalled();
  });

  it('shows only observed purchase, backend and finish milestones', async () => {
    let confirm!: (response: Response) => void;
    let finish!: () => void;
    jest.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          confirm = resolve;
        }),
    );
    jest.mocked(ExpoIap.finishTransaction).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const screen = await renderReady();
    await fireEvent.press(
      screen.getByRole('button', {name: /Show purchase steps/}),
    );
    await fireEvent.press(screen.getByRole('button', {name: 'Buy 10 Bulbs'}));
    expect(
      within(screen.getByTestId('purchase-step-store')).getByText('Running'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('purchase-step-confirmation')).getByText(
        'Not observed',
      ),
    ).toBeTruthy();

    await act(async () => {
      mockIap.options?.onPurchaseSuccess?.(bulbs);
    });
    expect(
      within(screen.getByTestId('purchase-step-store')).getByText('Completed'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('purchase-step-confirmation')).getByText(
        'Running',
      ),
    ).toBeTruthy();
    expect(ExpoIap.finishTransaction).not.toHaveBeenCalled();
    await act(async () => {
      confirm(
        new Response(
          JSON.stringify({status: 'entitled', alreadyGranted: false}),
          {status: 200},
        ),
      );
    });
    expect(
      within(screen.getByTestId('purchase-step-finish')).getByText('Running'),
    ).toBeTruthy();
    await act(async () => {
      mockIap.options?.onPurchaseSuccess?.(bulbs);
    });
    expect(
      within(screen.getByTestId('purchase-step-finish')).getByText('Running'),
    ).toBeTruthy();
    expect(ExpoIap.finishTransaction).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
    });
    expect(
      within(screen.getByTestId('purchase-step-finish')).getByText('Completed'),
    ).toBeTruthy();
    expect(ExpoIap.finishTransaction).toHaveBeenCalledTimes(1);
    await fireEvent.press(
      screen.getByRole('button', {name: /Hide purchase steps/}),
    );
    expect(screen.queryByTestId('purchase-step-store')).toBeNull();
  });

  it('keeps a real finish failure separate from granted account access', async () => {
    replyWith({status: 'entitled', alreadyGranted: false});
    jest
      .mocked(ExpoIap.finishTransaction)
      .mockRejectedValueOnce(new Error('Store unavailable'));
    const screen = await renderReady();
    await fireEvent.press(
      screen.getByRole('button', {name: /Show purchase steps/}),
    );
    await act(async () => {
      mockIap.options?.onPurchaseSuccess?.(bulbs);
    });
    expect(
      await screen.findByText('Access granted. Finishing needs retry.'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('purchase-step-confirmation')).getByText(
        'Completed',
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('purchase-step-finish')).getByText(
        'Needs retry',
      ),
    ).toBeTruthy();
    expect(screen.getByText('entitled')).toBeTruthy();
  });

  it.each([false, true])(
    'starts fresh diagram steps on reconfirm after finish failure=%s',
    async (finishFails) => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({status: 'entitled', alreadyGranted: false}),
            {status: 200},
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              status: 'verification_delayed',
              retryAfterMs: 5000,
            }),
            {status: 200},
          ),
        );
      if (finishFails)
        jest
          .mocked(ExpoIap.finishTransaction)
          .mockRejectedValueOnce(new Error('Store unavailable'));
      const screen = await renderReady();
      await fireEvent.press(
        screen.getByRole('button', {name: /Show purchase steps/}),
      );
      await act(async () => {
        mockIap.options?.onPurchaseSuccess?.(bulbs);
      });
      await screen.findByText('entitled');
      await act(async () => {
        mockIap.options?.onPurchaseSuccess?.(bulbs);
      });
      await screen.findByText('verification_delayed');
      expect(
        within(screen.getByTestId('purchase-step-confirmation')).getByText(
          'Waiting',
        ),
      ).toBeTruthy();
      expect(
        within(screen.getByTestId('purchase-step-finish')).getByText(
          'Not observed',
        ),
      ).toBeTruthy();
      expect(ExpoIap.finishTransaction).toHaveBeenCalledTimes(1);
    },
  );

  it('shows a recovered pending payment without backend or finish calls', async () => {
    const fetchSpy = replyWith({});
    jest
      .mocked(ExpoIap.getPendingTransactionsIOS)
      .mockResolvedValue([{...bulbs, purchaseState: 'pending'}]);
    const screen = await renderReady();
    await screen.findByText('store_pending');
    await fireEvent.press(
      screen.getByRole('button', {name: /Show purchase steps/}),
    );
    expect(
      within(screen.getByTestId('purchase-step-store')).getByText('Waiting'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('purchase-step-confirmation')).getByText(
        'Not observed',
      ),
    ).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ExpoIap.finishTransaction).not.toHaveBeenCalled();
  });

  it('does not let an older recovery read replace a newer running confirmation', async () => {
    let returnPending!: (purchases: PurchaseIOS[]) => void;
    let confirm!: (response: Response) => void;
    jest.mocked(ExpoIap.getPendingTransactionsIOS).mockImplementationOnce(
      () =>
        new Promise<PurchaseIOS[]>((resolve) => {
          returnPending = resolve;
        }),
    );
    jest.spyOn(global, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          confirm = resolve;
        }),
    );
    const screen = await render(<BackendEntitlementFlow />);
    await fireEvent.press(
      screen.getByRole('button', {name: /Show purchase steps/}),
    );
    await act(async () => {
      mockIap.options?.onPurchaseSuccess?.(bulbs);
    });
    await act(async () => {
      returnPending([
        {
          ...bulbs,
          id: 'older-pending',
          productId: 'dev.hyo.martie.30bulbs',
          purchaseState: 'pending',
        },
      ]);
    });
    await screen.findByText('store_pending');
    expect(
      screen.getByText('Latest purchase activity · dev.hyo.martie.10bulbs'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('purchase-step-confirmation')).getByText(
        'Running',
      ),
    ).toBeTruthy();
    await act(async () => {
      confirm(
        new Response(
          JSON.stringify({status: 'entitled', alreadyGranted: false}),
          {status: 200},
        ),
      );
    });
  });

  it('keeps an older purchase completion out of the latest purchase diagram', async () => {
    let confirmFirst!: (response: Response) => void;
    jest
      .spyOn(global, 'fetch')
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            confirmFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({status: 'verification_delayed', retryAfterMs: 5000}),
          {status: 200},
        ),
      );
    const screen = await renderReady();
    await fireEvent.press(
      screen.getByRole('button', {name: /Show purchase steps/}),
    );
    await act(async () => {
      mockIap.options?.onPurchaseSuccess?.(bulbs);
    });
    await act(async () => {
      mockIap.options?.onPurchaseSuccess?.({
        ...bulbs,
        id: 'tx-2',
        productId: 'dev.hyo.martie.30bulbs',
      });
    });
    await screen.findByText('verification_delayed');
    await act(async () => {
      confirmFirst(
        new Response(
          JSON.stringify({status: 'entitled', alreadyGranted: false}),
          {status: 200},
        ),
      );
    });
    expect(ExpoIap.finishTransaction).toHaveBeenCalledWith({
      purchase: bulbs,
      isConsumable: true,
    });
    expect(
      screen.getByText('Latest purchase activity · dev.hyo.martie.30bulbs'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('purchase-step-confirmation')).getByText(
        'Waiting',
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('purchase-step-finish')).getByText(
        'Not observed',
      ),
    ).toBeTruthy();
  });

  it('recovers an unfinished transaction and finishes it once granted', async () => {
    jest.mocked(ExpoIap.getPendingTransactionsIOS).mockResolvedValue([bulbs]);
    const fetchSpy = replyWith({status: 'entitled', alreadyGranted: false});

    const {findByText} = await renderReady();

    expect(await findByText('Access granted.')).toBeDefined();
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://backend.example/purchases/confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          store: 'apple',
          purchaseToken: 'jws',
          productId: 'dev.hyo.martie.10bulbs',
        }),
      }),
    );
    expect(ExpoIap.finishTransaction).toHaveBeenCalledWith({
      purchase: bulbs,
      isConsumable: true,
    });
    expect(mockIap.fetchProducts.mock.calls.map(([args]) => args.type)).toEqual(
      ['in-app'],
    );
  });

  it('shows an ownership conflict without finishing', async () => {
    replyWith({status: 'ownership_conflict', alreadyGranted: false});
    const {findByText, getByText} = await renderReady();

    await act(async () => {
      mockIap.options?.onPurchaseSuccess?.(bulbs);
    });

    expect(
      await findByText(/This purchase belongs to another account/),
    ).toBeDefined();
    expect(getByText('ownership_conflict')).toBeDefined();
    expect(ExpoIap.finishTransaction).not.toHaveBeenCalled();
  });

  it('finishes a purchase another account was already granted', async () => {
    replyWith({status: 'ownership_conflict', alreadyGranted: true});
    const {findByText} = await renderReady();

    await act(async () => {
      mockIap.options?.onPurchaseSuccess?.(bulbs);
    });

    expect(
      await findByText(/This purchase belongs to another account/),
    ).toBeDefined();
    expect(ExpoIap.finishTransaction).toHaveBeenCalledWith({
      purchase: bulbs,
      isConsumable: true,
    });
  });

  it('shows the retry hint for a delayed verification', async () => {
    replyWith({status: 'verification_delayed', retryAfterMs: 5_000});
    const {findByText} = await renderReady();

    await act(async () => {
      mockIap.options?.onPurchaseSuccess?.(bulbs);
    });

    expect(await findByText('Retry after 5s')).toBeDefined();
    expect(ExpoIap.finishTransaction).not.toHaveBeenCalled();
  });

  it('restores an owned purchase for the same account on demand', async () => {
    jest.mocked(ExpoIap.getAvailablePurchases).mockResolvedValue([bulbs]);
    replyWith({status: 'entitled', alreadyGranted: true});
    const {findByText, getByText} = await renderReady();

    await act(async () => {
      fireEvent.press(getByText('Restore purchases'));
    });

    expect(await findByText('Access granted.')).toBeDefined();
    expect(ExpoIap.getAvailablePurchases).toHaveBeenCalledTimes(1);
  });

  it('confirms a restored purchase for the new account and ignores the old response', async () => {
    let resolveFirst!: (response: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockReturnValueOnce(firstResponse)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'ownership_conflict',
            alreadyGranted: false,
          }),
          {status: 200},
        ),
      );
    const {getByLabelText, getByText, findByText, queryByText} =
      await renderReady();

    await act(async () => {
      mockIap.options?.onPurchaseSuccess?.(bulbs);
    });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    await act(async () => {
      fireEvent.changeText(getByLabelText('App account'), 'demo-user-2');
    });
    jest.mocked(ExpoIap.getAvailablePurchases).mockResolvedValue([bulbs]);
    await act(async () => {
      fireEvent.press(getByText('Restore purchases'));
    });

    expect(await findByText('ownership_conflict')).toBeDefined();
    expect(fetchSpy.mock.calls.map(([, options]) => options?.headers)).toEqual([
      expect.objectContaining({authorization: 'Bearer demo-user-1'}),
      expect.objectContaining({authorization: 'Bearer demo-user-2'}),
    ]);
    await act(async () => {
      resolveFirst(
        new Response(
          JSON.stringify({status: 'entitled', alreadyGranted: false}),
          {status: 200},
        ),
      );
    });
    expect(getByText('ownership_conflict')).toBeDefined();
    expect(queryByText('Access granted.')).toBeNull();
  });

  it('clears the previous account outcomes when switching accounts', async () => {
    jest.mocked(ExpoIap.getPendingTransactionsIOS).mockResolvedValue([bulbs]);
    replyWith({status: 'entitled', alreadyGranted: false});
    const {findByText, getByLabelText, queryByText} = await renderReady();
    await findByText('Access granted.');

    await act(async () => {
      fireEvent.changeText(getByLabelText('App account'), 'demo-user-2');
    });

    expect(queryByText('Access granted.')).toBeNull();
  });

  it.each([
    [ExpoIap.ErrorCode.NotPrepared, 'Needs retry'],
    [ExpoIap.ErrorCode.UserCancelled, 'Skipped'],
    [ExpoIap.ErrorCode.DeferredPayment, 'Waiting'],
  ])('reports a promise-only purchase error %s as %s', async (code, state) => {
    const fetchSpy = replyWith({});
    mockIap.requestPurchase.mockRejectedValueOnce(
      Object.assign(new Error('Request rejected'), {code}),
    );
    const screen = await renderReady();
    await fireEvent.press(
      screen.getByRole('button', {name: /Show purchase steps/}),
    );
    await fireEvent.press(screen.getByRole('button', {name: 'Buy 10 Bulbs'}));

    expect(
      within(screen.getByTestId('purchase-step-store')).getByText(state),
    ).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ExpoIap.finishTransaction).not.toHaveBeenCalled();
  });

  it.each(['request', 'account'])(
    'ignores a late rejection after a new %s',
    async (change) => {
      let reject!: (reason: Error) => void;
      mockIap.requestPurchase.mockImplementationOnce(
        () =>
          new Promise<void>((_, fail) => {
            reject = fail;
          }),
      );
      const screen = await renderReady();
      await fireEvent.press(
        screen.getByRole('button', {name: /Show purchase steps/}),
      );
      await fireEvent.press(screen.getByRole('button', {name: 'Buy 10 Bulbs'}));
      if (change === 'account')
        await fireEvent.changeText(
          screen.getByLabelText('App account'),
          'new-account',
        );
      await fireEvent.press(screen.getByRole('button', {name: 'Buy 10 Bulbs'}));
      await act(async () => {
        reject(
          Object.assign(new Error('Old request failed'), {
            code: ExpoIap.ErrorCode.NotPrepared,
          }),
        );
      });

      expect(
        within(screen.getByTestId('purchase-step-store')).getByText('Running'),
      ).toBeTruthy();
      expect(
        screen.queryByText('Purchase failed: Old request failed'),
      ).toBeNull();
    },
  );

  it('quotes the prepaid Play offer it purchases instead of another plan price', async () => {
    mockIap.subscriptions = [
      {
        id: 'dev.hyo.martie.premium',
        title: 'Premium',
        displayPrice: '$50',
        platform: 'android',
        subscriptionOffers: [
          {
            offerTokenAndroid: 'offer-1',
            displayPrice: '$5',
            paymentMode: 'pay-up-front',
            pricingPhasesAndroid: {
              pricingPhaseList: [{billingPeriod: 'P1M', recurrenceMode: 3}],
            },
          },
          {
            offerTokenAndroid: 'offer-2',
            displayPrice: '$50',
            paymentMode: 'pay-as-you-go',
          },
        ],
      },
    ];
    const {getByText} = await renderReady('subs');

    await act(async () => {
      expect(getByText('$5')).toBeDefined();
      expect(getByText('for 1 month · Does not renew')).toBeDefined();
      fireEvent.press(getByText('Subscribe'));
    });

    expect(mockIap.fetchProducts).toHaveBeenCalledWith(
      expect.objectContaining({type: 'subs'}),
    );
    expect(mockIap.requestPurchase).toHaveBeenCalledWith({
      request: {
        apple: {sku: 'dev.hyo.martie.premium'},
        google: {
          skus: ['dev.hyo.martie.premium'],
          subscriptionOffers: [
            {sku: 'dev.hyo.martie.premium', offerToken: 'offer-1'},
          ],
        },
      },
      type: 'subs',
    });
  });

  it('quotes the token-bearing offer when an earlier offer cannot be purchased', async () => {
    mockIap.subscriptions = [
      {
        id: 'dev.hyo.martie.premium',
        title: 'Premium',
        displayPrice: '$50',
        platform: 'android',
        subscriptionOffers: [
          {displayPrice: '$1'},
          {offerTokenAndroid: 'offer-2', displayPrice: '$5'},
        ],
      },
    ];
    const {getByText, queryByText} = await renderReady('subs');

    await act(async () => {
      expect(getByText('$5')).toBeDefined();
      fireEvent.press(getByText('Subscribe'));
    });

    expect(queryByText('$50')).toBeNull();
    expect(mockIap.requestPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          google: {
            skus: ['dev.hyo.martie.premium'],
            subscriptionOffers: [
              {sku: 'dev.hyo.martie.premium', offerToken: 'offer-2'},
            ],
          },
        }),
      }),
    );
  });

  it('keeps the default App Store price and purchase without a Play offer', async () => {
    mockIap.subscriptions = [
      {
        id: 'dev.hyo.martie.premium',
        title: 'Premium',
        displayPrice: '$50',
        platform: 'ios',
        typeIOS: 'auto-renewable-subscription',
        subscriptionPeriodNumberIOS: '1',
        subscriptionPeriodUnitIOS: 'year',
        subscriptionOffers: [{displayPrice: '$5'}],
      },
    ];
    const {getByText} = await renderReady('subs');

    await act(async () => {
      expect(getByText('$50')).toBeDefined();
      expect(getByText('1 year · Auto-renews')).toBeDefined();
      fireEvent.press(getByText('Subscribe'));
    });

    expect(mockIap.requestPurchase).toHaveBeenCalledWith({
      request: {
        apple: {sku: 'dev.hyo.martie.premium'},
        google: {
          skus: ['dev.hyo.martie.premium'],
          subscriptionOffers: undefined,
        },
      },
      type: 'subs',
    });
  });

  it('shows every selected Play pricing phase instead of hiding the renewal price', async () => {
    mockIap.subscriptions = [
      {
        id: 'dev.hyo.martie.premium',
        title: 'Premium Year',
        displayPrice: '$50',
        platform: 'android',
        subscriptionOffers: [
          {
            offerTokenAndroid: 'trial-monthly',
            displayPrice: '$0',
            pricingPhasesAndroid: {
              pricingPhaseList: [
                {
                  formattedPrice: '$0',
                  billingPeriod: 'P1W',
                  recurrenceMode: 3,
                },
                {formattedPrice: '$5', billingPeriod: 'P1M', recurrenceMode: 1},
              ],
            },
          },
        ],
      },
    ];
    const {getByText, queryByText} = await renderReady('subs');
    expect(
      getByText('$0 for 1 week, then $5 every 1 month · Auto-renews'),
    ).toBeDefined();
    expect(queryByText('$50')).toBeNull();
    await act(async () => fireEvent.press(getByText('Subscribe')));
    expect(mockIap.requestPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          google: {
            skus: ['dev.hyo.martie.premium'],
            subscriptionOffers: [
              {sku: 'dev.hyo.martie.premium', offerToken: 'trial-monthly'},
            ],
          },
        }),
      }),
    );
  });

  it('reports when there is nothing to restore', async () => {
    const {findByText, getByText} = await renderReady();

    await act(async () => {
      fireEvent.press(getByText('Restore purchases'));
    });

    expect(await findByText('No purchases to restore.')).toBeDefined();
  });

  it.each([false, true])(
    'recovers once under the current StrictMode owner with a purchase=%s',
    async (hasPurchase) => {
      const resolvers: ((purchases: PurchaseIOS[]) => void)[] = [];
      jest.mocked(ExpoIap.getPendingTransactionsIOS).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          }),
      );
      const fetchSpy = replyWith({status: 'entitled', alreadyGranted: false});
      const screen = await render(
        <React.StrictMode>
          <BackendEntitlementFlow />
        </React.StrictMode>,
      );
      expect(resolvers).toHaveLength(2);
      await act(async () => {
        resolvers[0]?.(hasPurchase ? [bulbs] : []);
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      await act(async () => {
        resolvers[1]?.(hasPurchase ? [bulbs] : []);
      });
      expect(
        await screen.findByRole('button', {name: 'Restore purchases'}),
      ).toBeEnabled();
      expect(fetchSpy).toHaveBeenCalledTimes(hasPurchase ? 1 : 0);
      expect(ExpoIap.finishTransaction).toHaveBeenCalledTimes(
        hasPurchase ? 1 : 0,
      );
      expect(mockIap.fetchProducts).toHaveBeenCalledTimes(1);
    },
  );

  it('shows Ask to Buy as a pending payment', async () => {
    const {findByText} = await renderReady();

    await act(async () => {
      const error: ExpoPurchaseError = Object.assign(new Error('deferred'), {
        code: ExpoIap.ErrorCode.DeferredPayment,
      });
      mockIap.options?.onPurchaseError?.(error);
    });

    expect(await findByText(/Payment is pending at the store/)).toBeDefined();
  });
});
