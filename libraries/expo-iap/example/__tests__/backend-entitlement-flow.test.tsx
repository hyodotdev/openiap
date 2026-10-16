import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import * as ExpoIap from 'expo-iap';
import type {ExpoPurchaseError, PurchaseIOS, UseIAPOptions} from 'expo-iap';
import BackendEntitlementFlow from '../src/components/BackendEntitlementFlow';

const mockExit = jest.fn();
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
async function renderReady() {
  const screen = await render(<BackendEntitlementFlow onExit={mockExit} />);
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

    const {getByText} = await render(
      <BackendEntitlementFlow onExit={mockExit} />,
    );

    expect(getByText('Set up your app backend')).toBeDefined();
    expect(getByText(/Never put that key in this app/)).toBeDefined();
    fireEvent.press(getByText('Choose another verification method'));
    expect(mockExit).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(ExpoIap.getPendingTransactionsIOS).not.toHaveBeenCalled();
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
      ['in-app', 'subs'],
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

  it('leaves a cancelled purchase to onPurchaseError', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    mockIap.requestPurchase.mockRejectedValueOnce(new Error('cancelled'));
    const {getByText} = await renderReady();

    await act(async () => {
      fireEvent.press(getByText('Buy 10 Bulbs · $1'));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
  });

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
          },
          {
            offerTokenAndroid: 'offer-2',
            displayPrice: '$50',
            paymentMode: 'pay-as-you-go',
          },
        ],
      },
    ];
    const {getByText} = await renderReady();

    await act(async () => {
      fireEvent.press(getByText('Subscribe Premium · $5'));
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
    const {getByText, queryByText} = await renderReady();

    await act(async () => {
      fireEvent.press(getByText('Subscribe Premium · $5'));
    });

    expect(queryByText('Subscribe Premium · $50')).toBeNull();
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
        subscriptionOffers: [{displayPrice: '$5'}],
      },
    ];
    const {getByText} = await renderReady();

    await act(async () => {
      fireEvent.press(getByText('Subscribe Premium · $50'));
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

  it('reports when there is nothing to restore', async () => {
    const {findByText, getByText} = await renderReady();

    await act(async () => {
      fireEvent.press(getByText('Restore purchases'));
    });

    expect(await findByText('No purchases to restore.')).toBeDefined();
  });

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
