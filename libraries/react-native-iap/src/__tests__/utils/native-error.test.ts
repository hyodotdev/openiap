import {ErrorCode, type PurchaseError} from '../../types';
import {parseErrorStringToJsonObj} from '../../utils/error';
import {parseNativePurchaseError} from '../../utils/native-error';

describe('native PurchaseError contract decoding', () => {
  const payload = {
    code: ErrorCode.QueryProduct,
    message: 'A store message with "quotes", \\paths and\nnewlines',
    debugMessage: 'Nested {"code":"user-cancelled"} is diagnostic data',
    productId: 'premium',
    productIds: ['premium', 'monthly'],
    productType: 'subs',
    isEmptyProductList: false,
    responseCode: -1,
    subResponseCodeAndroid: 'user-ineligible',
  } satisfies PurchaseError;

  it.each([
    (json: string) => json,
    (json: string) => json + '\n',
    (json: string) =>
      json + '\r\nCaused by: {"code":"user-cancelled","message":"unrelated"}',
    (json: string) =>
      'java.lang.Exception: ' + json + '\n\tat Native.call(Native.kt:1)',
    (json: string) =>
      `Error Domain=com.margelo.nitro.rniap Code=-1 "${json}" UserInfo={NSLocalizedDescription=${json}}`,
  ])('preserves every spec field through a supported transport %#', (frame) => {
    expect(
      parseNativePurchaseError(new Error(frame(JSON.stringify(payload)))),
    ).toEqual(payload);
  });

  it.each(Object.values(ErrorCode))('accepts the canonical code %s', (code) => {
    expect(parseNativePurchaseError({code, message: ''})).toMatchObject({
      code,
      message: '',
    });
  });

  it('keeps spec-valid empty strings, empty lists, false and zero', () => {
    expect(
      parseNativePurchaseError(
        JSON.stringify({
          code: ErrorCode.Unknown,
          message: '',
          productId: '',
          debugMessage: '',
          productIds: [],
          productType: '',
          isEmptyProductList: false,
          responseCode: 0,
        }),
      ),
    ).toEqual({
      code: ErrorCode.Unknown,
      message: '',
      productId: '',
      debugMessage: '',
      productIds: [],
      productType: '',
      isEmptyProductList: false,
      responseCode: 0,
    });
  });

  it.each([null, {}, [], {code: 'future-code'}, {code: 6, message: false}])(
    'uses Unknown for an absent or unrecognized code %#',
    (input) => {
      expect(parseNativePurchaseError(input).code).toBe(ErrorCode.Unknown);
    },
  );

  it('drops invalid optional fields without losing the authoritative code', () => {
    const input = {
      code: ErrorCode.Unknown,
      message: 'Original failure',
      productId: 1,
      productIds: ['valid', null],
      debugMessage: {},
      responseCode: 1.5,
      productType: true,
      isEmptyProductList: 'false',
      subResponseCodeAndroid: 'future-sub-code',
      platform: 'web',
    };
    expect(parseNativePurchaseError(input)).toEqual({
      code: ErrorCode.Unknown,
      message: 'Original failure',
    });
    expect(parseErrorStringToJsonObj(input)).toEqual(input);
  });

  it.each([NaN, Infinity, -Infinity, 2147483648, -2147483649, '1', null])(
    'rejects a responseCode outside GraphQL Int: %s',
    (responseCode) => {
      expect(
        parseNativePurchaseError({...payload, responseCode}).responseCode,
      ).toBeUndefined();
    },
  );

  it.each([-2147483648, 2147483647])(
    'accepts the GraphQL Int boundary %s',
    (responseCode) => {
      expect(
        parseNativePurchaseError({...payload, responseCode}).responseCode,
      ).toBe(responseCode);
    },
  );

  it('rejects sparse product ID lists instead of leaking missing entries', () => {
    expect(
      parseNativePurchaseError({...payload, productIds: new Array(1)})
        .productIds,
    ).toBeUndefined();
  });

  it('keeps canonical decoding independent of the public parser defaults', () => {
    const json = '{"code":"E_NETWORK_ERROR","message":"","extra":"retained"}';
    expect(parseErrorStringToJsonObj(json)).toEqual({
      code: 'E_NETWORK_ERROR',
      message: json,
      extra: 'retained',
    });
    expect(parseNativePurchaseError(json)).toEqual({
      code: ErrorCode.NetworkError,
      message: '',
    });
  });

  it('never borrows a cancellation code from a truncated leading payload', () => {
    const json = JSON.stringify({
      ...payload,
      message: 'UserInfo={NSLocalizedDescription={"code":"user-cancelled"}}',
    });
    const frame =
      json +
      '\nCaused by: Error Domain=Test Code=-1 "{\"code\":\"user-cancelled\"}"';
    for (let end = 0; end <= frame.length; end += 1) {
      const parsed = parseNativePurchaseError(frame.slice(0, end));
      expect(Object.values(ErrorCode)).toContain(parsed.code);
      expect(parsed.code).not.toBe(ErrorCode.UserCancelled);
    }
  });
});
