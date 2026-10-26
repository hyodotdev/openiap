import {
  fetchProducts,
  finishTransaction,
  getActiveSubscriptions,
  getAvailablePurchases,
  hasActiveSubscriptions,
  isUserCancelledError,
  restorePurchases,
} from '../index';
import {ErrorCode} from '../types';
import {parseErrorStringToJsonObj} from '../utils/error';

const mockIap = {
  fetchProducts: jest.fn(),
  finishTransaction: jest.fn(),
  getActiveSubscriptions: jest.fn(),
  getAvailablePurchases: jest.fn(),
  hasActiveSubscriptions: jest.fn(),
  restorePurchases: jest.fn(),
};

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: <T>(values: Record<string, T>): T => values.android!,
  },
}));

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {createHybridObject: () => mockIap},
}));

describe('Android native rejection transport', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const calls = [
    {
      name: 'fetchProducts',
      reject: mockIap.fetchProducts,
      invoke: () => fetchProducts({skus: ['premium'], type: 'in-app'}),
    },
    {
      name: 'finishTransaction',
      reject: mockIap.finishTransaction,
      invoke: () =>
        finishTransaction({
          purchase: {
            id: 'transaction',
            purchaseToken: 'token',
            productId: 'premium',
            isAutoRenewing: false,
            purchaseState: 'purchased',
            quantity: 1,
            store: 'google',
            storeId: 'play',
            transactionDate: 1,
          },
        }),
    },
    {
      name: 'getActiveSubscriptions',
      reject: mockIap.getActiveSubscriptions,
      invoke: () => getActiveSubscriptions(),
    },
    {
      name: 'hasActiveSubscriptions',
      reject: mockIap.hasActiveSubscriptions,
      invoke: () => hasActiveSubscriptions(),
    },
    {
      name: 'restorePurchases',
      reject: mockIap.restorePurchases,
      invoke: () => restorePurchases(),
    },
  ];

  it.each(calls)(
    '$name preserves the store code and diagnostics',
    async ({reject, invoke}) => {
      const payload = {
        code: ErrorCode.ServiceDisconnected,
        message: 'Store service is not connected',
        responseCode: -1,
        debugMessage: 'Service connection is disconnected.',
        productId: 'premium',
        productIds: ['premium'],
        productType: 'subs',
        isEmptyProductList: false,
        subResponseCodeAndroid: 'no-applicable-sub-response-code',
      };
      reject.mockRejectedValueOnce(
        new Error(
          JSON.stringify(payload) +
            '\nCaused by: ServiceDisconnected(debugMessage=Service connection is disconnected.)' +
            '\n\tat dev.hyo.openiap.helpers.HelpersKt.queryPurchases(Helpers.kt:68)',
        ),
      );

      await expect(invoke()).rejects.toMatchObject(payload);
    },
  );

  it('keeps getAvailablePurchases rejections parseable without replacing the Error', async () => {
    const payload = {
      code: ErrorCode.ServiceDisconnected,
      message: 'Disconnected',
    };
    const error = new Error(
      JSON.stringify(payload) + '\nCaused by: ServiceDisconnected',
    );
    mockIap.getAvailablePurchases.mockRejectedValueOnce(error);

    const rejection = getAvailablePurchases();
    await expect(rejection).rejects.toBe(error);
    await rejection.catch((caught: unknown) => {
      expect(parseErrorStringToJsonObj(caught)).toEqual(payload);
    });
  });

  it('recognizes a cancelled restore without logging it as an error', async () => {
    mockIap.restorePurchases.mockRejectedValueOnce(
      new Error(
        '{"code":"user-cancelled","message":"Cancelled"}\nCaused by: UserCancelled',
      ),
    );

    const rejection = restorePurchases();
    await expect(rejection).rejects.toMatchObject({
      code: ErrorCode.UserCancelled,
    });
    await rejection.catch((error: unknown) => {
      expect(isUserCancelledError(error)).toBe(true);
    });
    expect(console.error).not.toHaveBeenCalled();
  });
});
