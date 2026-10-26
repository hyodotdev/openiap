import {getNativeIapInstance} from '../utils/native-instance';
import {ErrorCode} from '../types';

const mockCore = {
  addPurchaseErrorListener: jest.fn(),
  claimFirstPurchaseNotice: jest.fn(() => true),
};
const mockProtocol = {
  core: mockCore,
  initConnection: jest.fn(),
  fetchProducts: jest.fn(),
  requestPurchase: jest.fn(),
  clearTransactionIOS: jest.fn(),
  getAppTransactionIOS: jest.fn(),
  hasActiveSubscriptions: jest.fn(),
  enableBillingProgramAndroid: jest.fn(),
};
const mockCreateHybridObject = jest.fn((_name: unknown) => mockProtocol);

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    hasHybridObject: (name: string) => name === 'RnIapProtocol',
    createHybridObject: (name: string) => mockCreateHybridObject(name),
  },
}));
jest.mock('../utils/legacy-native-error', () => ({
  parseNativePurchaseError: () => {
    throw new Error('Modern transport must not parse strings');
  },
}));

const payload = {
  code: ErrorCode.QueryProduct,
  message: 'Query failed: {"code":"user-cancelled"} is only text',
  debugMessage: 'Caused by: diagnostic text',
  productId: 'premium',
  productIds: ['premium', 'other'],
  productType: 'subs',
  responseCode: -1,
  isEmptyProductList: false,
  subResponseCodeAndroid: 'no-applicable-sub-response-code',
};

describe('structured native error protocol', () => {
  beforeEach(() => jest.clearAllMocks());

  it('selects one protocol instance and keeps listener registration on its core', () => {
    const iap = getNativeIapInstance();
    expect(getNativeIapInstance()).toBe(iap);
    const listener = jest.fn();
    iap.addPurchaseErrorListener(listener);
    expect(mockCore.addPurchaseErrorListener).toHaveBeenCalledWith(listener);
    expect(mockCore.addPurchaseErrorListener.mock.contexts[0]).toBe(mockCore);
    expect(iap.claimFirstPurchaseNotice()).toBe(true);
    // Other tests reuse this cached facade.
    expect(mockCreateHybridObject.mock.calls[0]?.[0]).toBe('RnIapProtocol');
  });

  it('preserves every schema diagnostic without reading exception descriptions', async () => {
    mockProtocol.fetchProducts.mockResolvedValueOnce({error: payload});
    const operation = getNativeIapInstance().fetchProducts(['premium'], 'subs');
    await expect(operation).rejects.toBeInstanceOf(Error);
    await expect(operation).rejects.toMatchObject(payload);
  });

  it('preserves false, empty lists, null and void successes', async () => {
    const iap = getNativeIapInstance();
    mockProtocol.hasActiveSubscriptions.mockResolvedValueOnce({value: false});
    mockProtocol.fetchProducts.mockResolvedValueOnce({value: []});
    mockProtocol.getAppTransactionIOS.mockResolvedValueOnce({value: null});
    mockProtocol.clearTransactionIOS.mockResolvedValueOnce({});
    await expect(iap.hasActiveSubscriptions()).resolves.toBe(false);
    await expect(iap.fetchProducts([], 'in-app')).resolves.toEqual([]);
    await expect(iap.getAppTransactionIOS()).resolves.toBeNull();
    await expect(iap.clearTransactionIOS()).resolves.toBeUndefined();
  });

  it('normalizes unexpected bridge rejections without interpreting message JSON', async () => {
    const message = JSON.stringify({code: 'user-cancelled', message: 'nested'});
    mockProtocol.initConnection.mockRejectedValueOnce(new Error(message));
    await expect(getNativeIapInstance().initConnection()).rejects.toMatchObject(
      {
        code: ErrorCode.Unknown,
        message,
      },
    );
  });

  it('normalizes synchronous invocation failures into rejected promises', async () => {
    mockProtocol.fetchProducts.mockImplementationOnce(() => {
      throw new Error('JSI failure');
    });
    await expect(
      getNativeIapInstance().fetchProducts([], 'in-app'),
    ).rejects.toMatchObject({
      code: ErrorCode.Unknown,
      message: 'JSI failure',
    });
  });

  it('normalizes synchronous store failures from typed outcomes', () => {
    mockProtocol.enableBillingProgramAndroid.mockReturnValueOnce({
      error: payload,
    });
    expect(() =>
      getNativeIapInstance().enableBillingProgramAndroid('external-offer'),
    ).toThrow(payload.message);
  });

  it('rejects malformed successful outcomes', async () => {
    mockProtocol.initConnection.mockResolvedValueOnce({});
    await expect(getNativeIapInstance().initConnection()).rejects.toMatchObject(
      {code: ErrorCode.Unknown},
    );
  });
});
