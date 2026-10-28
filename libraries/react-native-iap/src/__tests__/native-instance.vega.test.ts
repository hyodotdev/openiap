import {getNativeIapInstance} from '../utils/native-instance';
import {ErrorCode} from '../types';
import {parseNativePurchaseError} from '../utils/legacy-native-error';

jest.mock('../utils/legacy-native-error', () => {
  const actual = jest.requireActual<
    typeof import('../utils/legacy-native-error')
  >('../utils/legacy-native-error');
  return {
    ...actual,
    parseNativePurchaseError: jest.fn(actual.parseNativePurchaseError),
  };
});

const mockVega = {getAvailablePurchases: jest.fn()};
jest.mock('../vega', () => ({
  isVegaOS: (): boolean => true,
  getVegaIapModule: (): typeof mockVega => mockVega,
}));
jest.mock('react-native-nitro-modules', () => {
  throw new Error('Vega must not load Nitro');
});

it('retains Vega error normalization when the old-native fallback is retired', async (): Promise<void> => {
  const payload = {
    code: ErrorCode.ServiceDisconnected,
    message: 'Amazon service disconnected',
    debugMessage: 'Store diagnostic',
    responseCode: -1,
    productId: 'premium',
    platform: 'android',
  };
  mockVega.getAvailablePurchases.mockRejectedValueOnce(
    Object.assign(new Error(payload.message), payload),
  );
  const operation = getNativeIapInstance().getAvailablePurchases();
  await expect(operation).rejects.toBeInstanceOf(Error);
  await expect(operation).rejects.toMatchObject({
    ...payload,
    name: '[react-native-iap]: PurchaseError',
  });
  expect(parseNativePurchaseError).not.toHaveBeenCalled();
});
