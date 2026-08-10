import {parseAppTransactionPayload} from '../../utils';
import {RnIapConsole} from '../../utils/debug';
import {getSuccessFromPurchaseVariant} from '../../utils/purchase';

describe('utility fallback coverage', () => {
  afterEach(() => {
    delete process.env.RN_IAP_DEV_MODE;
    delete (global as any).RN_IAP_DEV_MODE;
    jest.restoreAllMocks();
  });

  it('rejects non-object, incomplete, and malformed app transactions', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseAppTransactionPayload('null')).toBeNull();
    expect(parseAppTransactionPayload('{"appId":"invalid"}')).toBeNull();
    expect(parseAppTransactionPayload('{')).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('returns native success variants and throws normalized failures', () => {
    expect(getSuccessFromPurchaseVariant(true, 'finishTransaction')).toBe(true);
    expect(
      getSuccessFromPurchaseVariant(
        {responseCode: 0, code: 'ok'} as never,
        'finishTransaction',
      ),
    ).toBe(true);

    expect(() =>
      getSuccessFromPurchaseVariant(
        {
          responseCode: 5,
          code: 'E_NETWORK_ERROR',
          message: '',
          debugMessage: 'offline',
          purchaseToken: null,
        } as never,
        'consumePurchaseAndroid',
      ),
    ).toThrow(
      /"code":"network-error".*"message":"Failed to consumePurchaseAndroid"/,
    );
  });

  it('emits opt-in development logs through both supported switches', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});

    process.env.RN_IAP_DEV_MODE = 'true';
    RnIapConsole.log('environment');
    delete process.env.RN_IAP_DEV_MODE;
    (global as any).RN_IAP_DEV_MODE = true;
    RnIapConsole.info('global');

    expect(log).toHaveBeenCalledWith('[RN-IAP]', 'environment');
    expect(info).toHaveBeenCalledWith('[RN-IAP]', 'global');
  });
});
