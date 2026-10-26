import {
  parseErrorStringToJsonObj,
  isUserCancelledError,
  isDuplicatePurchaseError,
  DUPLICATE_PURCHASE_CODE,
} from '../../utils/error';
import {ErrorCode} from '../../types';

describe('Error utilities', () => {
  describe('parseErrorStringToJsonObj', () => {
    it('should parse valid JSON error string', () => {
      const errorString = JSON.stringify({
        code: ErrorCode.UserCancelled,
        message: 'User cancelled',
        responseCode: 1,
      });

      const result = parseErrorStringToJsonObj(errorString);

      expect(result).toEqual({
        code: ErrorCode.UserCancelled,
        message: 'User cancelled',
        responseCode: 1,
      });
    });

    it('should replace empty JSON error fields with fallbacks', () => {
      const errorString = JSON.stringify({
        code: '',
        message: '',
        responseCode: -1,
      });

      expect(parseErrorStringToJsonObj(errorString)).toEqual({
        code: ErrorCode.Unknown,
        message: errorString,
        responseCode: -1,
      });
    });

    it('should handle Error object with JSON message', () => {
      const errorObj = {
        code: ErrorCode.NetworkError,
        message: 'Network error',
      };
      const error = new Error(JSON.stringify(errorObj));

      const result = parseErrorStringToJsonObj(error);

      expect(result).toEqual(errorObj);
    });

    describe.each([
      ErrorCode.ServiceDisconnected,
      ErrorCode.UserCancelled,
      ErrorCode.NetworkError,
      ErrorCode.AlreadyOwned,
      ErrorCode.DeveloperError,
      ErrorCode.ItemNotOwned,
    ])('Android rejection with code %s', (code) => {
      it.each([false, true])(
        'keeps the payload before a Java cause chain (Error instance: %s)',
        (wrapped) => {
          const payload = {
            code,
            message: 'Store operation failed',
            responseCode: -1,
            debugMessage: 'Service connection is disconnected.',
            productId: 'premium',
            productIds: ['premium'],
            productType: 'subs',
            isEmptyProductList: false,
            subResponseCodeAndroid: 'no-applicable-sub-response-code',
          };
          const message =
            JSON.stringify(payload) +
            '\nCaused by: ServiceDisconnected(debugMessage=Service connection is disconnected.)' +
            '\n\tat dev.hyo.openiap.helpers.HelpersKt.queryPurchases(Helpers.kt:68)';

          expect(
            parseErrorStringToJsonObj(wrapped ? new Error(message) : message),
          ).toEqual(payload);
        },
      );
    });

    it('keeps multiline JSON with nested data, quotes and braces before trailing text', () => {
      const payload = {
        code: ErrorCode.ServiceError,
        message: 'Failed for {"sku":"premium"}; path C:\\billing',
        debugMessage: 'First line\nSecond line }',
        details: {reason: 'A "quoted" value', values: [{id: 'premium'}]},
      };
      const message =
        ' \n' +
        JSON.stringify(payload, null, 2) +
        '\r\nCaused by: java.lang.Exception: {"code":"unknown"}';

      expect(parseErrorStringToJsonObj(new Error(message))).toEqual(payload);
    });

    it.each(['android', 'ios', 'ios-escaped'])(
      'does not interpret quoted JSON inside the %s message as error fields',
      (platform) => {
        const payload = {
          code: ErrorCode.ServiceDisconnected,
          message: '\",\"code\":\"user-cancelled\"}',
        };
        const json = JSON.stringify(payload);
        const localizedDescription =
          platform === 'ios-escaped'
            ? '{\n  ' + json.slice(1).replace(/"/g, '\\"')
            : json;
        const message =
          platform === 'android'
            ? json + '\nCaused by: ServiceDisconnected'
            : 'Error Domain=Test Code=-1 "Failure" UserInfo={NSLocalizedDescription=' +
              localizedDescription +
              '}';

        const error = new Error(message);
        expect(parseErrorStringToJsonObj(error)).toEqual(payload);
        expect(isUserCancelledError(error)).toBe(false);
      },
    );

    it.each(['quoted-error', 'quoted-description'])(
      'decodes backslashes and embedded JSON in a string-encoded NSError %s',
      (format) => {
        const payload = {
          code: ErrorCode.ServiceDisconnected,
          message: '\",\"code\":\"user-cancelled\"}',
          debugMessage: 'Store path C:\\billing\nNext line',
          productId: 'premium',
        };
        const encoded = JSON.stringify(JSON.stringify(payload)).slice(1, -1);
        const message =
          format === 'quoted-error'
            ? `Error Domain=Test Code=-1 "${encoded}"`
            : `Error Domain=Test Code=-1 "Failure" UserInfo={NSLocalizedDescription="${encoded}"}`;

        const error = new Error(message);
        expect(parseErrorStringToJsonObj(error)).toEqual(payload);
        expect(isUserCancelledError(error)).toBe(false);
      },
    );

    it('keeps structured fields authoritative over a JSON message', () => {
      const message =
        '{"code":"user-cancelled","message":"Cancelled"}\nCaused by: other error';
      const error = Object.assign(new Error(message), {
        code: ErrorCode.NetworkError,
        responseCode: 2,
      });

      expect(parseErrorStringToJsonObj(error)).toEqual({
        code: ErrorCode.NetworkError,
        message,
        responseCode: 2,
      });
    });

    it.each([
      '{"code":"service-disconnected","message":\nCaused by: failure',
      'Native failure: {"code":"service-disconnected"}',
      '{broken JSON}\nCaused by: {"code":"user-cancelled"}',
    ])(
      'does not infer a code from malformed or unrelated text: %s',
      (message) => {
        expect(parseErrorStringToJsonObj(new Error(message))).toEqual({
          code: ErrorCode.Unknown,
          message,
        });
      },
    );

    it('should handle plain Error object', () => {
      const error = new Error('Something went wrong');

      const result = parseErrorStringToJsonObj(error);

      expect(result).toEqual({
        code: ErrorCode.Unknown,
        message: 'Something went wrong',
      });
    });

    it('should preserve structured fields on Error objects', () => {
      const error = new Error('Network error') as Error & {
        code?: ErrorCode;
        debugMessage?: string;
        productId?: string;
        responseCode?: number;
      };
      error.code = ErrorCode.NetworkError;
      error.debugMessage = 'Network error';
      error.productId = 'premium_monthly';
      error.responseCode = 503;

      const result = parseErrorStringToJsonObj(error);

      expect(result).toEqual({
        code: ErrorCode.NetworkError,
        message: 'Network error',
        debugMessage: 'Network error',
        productId: 'premium_monthly',
        responseCode: 503,
      });
    });

    it('should preserve structured code from Error objects', () => {
      const error = Object.assign(new Error('Request Canceled'), {
        code: ErrorCode.UserCancelled,
      });

      const result = parseErrorStringToJsonObj(error);

      expect(result).toEqual({
        code: ErrorCode.UserCancelled,
        message: 'Request Canceled',
      });
    });

    it('should preserve structured fields from Error objects', () => {
      const error = Object.assign(new Error('Request Canceled'), {
        code: ErrorCode.UserCancelled,
        productId: 'premium_monthly',
        responseCode: 1,
      });

      const result = parseErrorStringToJsonObj(error);

      expect(result).toEqual({
        code: ErrorCode.UserCancelled,
        message: 'Request Canceled',
        productId: 'premium_monthly',
        responseCode: 1,
      });
    });

    it('should parse Nitro NSError string with embedded JSON payload', () => {
      const error = new Error(
        'Error Domain=com.margelo.nitro.rniap Code=-1 ' +
          '"{\\"message\\":\\"Request Canceled\\",\\"code\\":\\"user-cancelled\\"}" ' +
          'UserInfo={NSLocalizedDescription={\\"message\\":\\"Request Canceled\\",\\"code\\":\\"user-cancelled\\"}}',
      );

      const result = parseErrorStringToJsonObj(error);

      expect(result).toEqual({
        code: ErrorCode.UserCancelled,
        message: 'Request Canceled',
      });
      expect(isUserCancelledError(error)).toBe(true);
    });

    it('should parse quoted NSError JSON without UserInfo', () => {
      const error = new Error(
        'Error Domain=com.margelo.nitro.rniap Code=-1 ' +
          '"{\\"message\\":\\"Request Canceled\\",\\"code\\":\\"user-cancelled\\"}"',
      );

      const result = parseErrorStringToJsonObj(error);

      expect(result).toEqual({
        code: ErrorCode.UserCancelled,
        message: 'Request Canceled',
      });
    });

    it('should parse escaped UserInfo JSON when NSError quoted payload is plain text', () => {
      const error = new Error(
        'Error Domain=SKErrorDomain Code=-1 "The operation failed." ' +
          'UserInfo={NSLocalizedDescription={\\"message\\":\\"Request Canceled\\",\\"code\\":\\"user-cancelled\\"}}',
      );

      const result = parseErrorStringToJsonObj(error);

      expect(result).toEqual({
        code: ErrorCode.UserCancelled,
        message: 'Request Canceled',
      });
    });

    it('should parse escaped UserInfo JSON with braces in message', () => {
      const error = new Error(
        'Error Domain=SKErrorDomain Code=-1 "The operation failed." ' +
          'UserInfo={NSLocalizedDescription={\\"message\\":\\"Request {Canceled}\\",\\"code\\":\\"user-cancelled\\"}}',
      );

      const result = parseErrorStringToJsonObj(error);

      expect(result).toEqual({
        code: ErrorCode.UserCancelled,
        message: 'Request {Canceled}',
      });
    });

    it('should parse quoted localized description JSON', () => {
      const error = new Error(
        'Error Domain=SKErrorDomain Code=-1 "The operation failed." ' +
          'UserInfo={NSLocalizedDescription="{\\"message\\":\\"Request Canceled\\",\\"code\\":\\"user-cancelled\\"}"}',
      );

      const result = parseErrorStringToJsonObj(error);

      expect(result).toEqual({
        code: ErrorCode.UserCancelled,
        message: 'Request Canceled',
      });
    });

    it('should handle non-JSON string', () => {
      const errorString = 'Not a JSON string';

      const result = parseErrorStringToJsonObj(errorString);

      expect(result).toEqual({
        code: ErrorCode.Unknown,
        message: 'Not a JSON string',
      });
    });

    it('should handle undefined input', () => {
      const result = parseErrorStringToJsonObj(undefined);

      expect(result).toEqual({
        code: ErrorCode.Unknown,
        message: 'Unknown error occurred',
      });
    });

    it('should handle null input', () => {
      const result = parseErrorStringToJsonObj(null);

      expect(result).toEqual({
        code: ErrorCode.Unknown,
        message: 'Unknown error occurred',
      });
    });

    it('should handle empty string', () => {
      const result = parseErrorStringToJsonObj('');

      expect(result).toEqual({
        code: ErrorCode.Unknown,
        message: '',
      });
    });

    it('should preserve plain structured object input', () => {
      const errorObj = {
        code: ErrorCode.ItemUnavailable,
        message: 'Item not available',
        responseCode: 4,
        debugMessage: 'StoreKit product lookup failed',
      };

      const result = parseErrorStringToJsonObj(errorObj);

      expect(result).toEqual(errorObj);
    });

    it('should replace empty structured error fields with fallbacks', () => {
      expect(parseErrorStringToJsonObj({code: '', message: ''})).toEqual({
        code: ErrorCode.Unknown,
        message: 'Unknown error occurred',
      });
    });

    it('should parse error code format "CODE: message"', () => {
      const errorString = 'E_NETWORK_ERROR: Network connection failed';

      const result = parseErrorStringToJsonObj(errorString);

      expect(result).toEqual({
        code: 'E_NETWORK_ERROR',
        message: 'Network connection failed',
      });
    });
  });

  describe('isUserCancelledError', () => {
    it('recognizes cancellation before a Java cause chain', () => {
      const error = new Error(
        '{"code":"user-cancelled","message":"Cancelled"}\nCaused by: UserCancelled',
      );

      expect(isUserCancelledError(error)).toBe(true);
    });

    it('should return true for user cancelled error', () => {
      const error = {
        code: ErrorCode.UserCancelled,
        message: 'User cancelled the purchase',
      };

      expect(isUserCancelledError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = {
        code: ErrorCode.NetworkError,
        message: 'Network error occurred',
      };

      expect(isUserCancelledError(error)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isUserCancelledError(undefined)).toBe(false);
    });

    it('should return false for error without code', () => {
      const error = {
        message: 'Some error',
      };

      expect(isUserCancelledError(error)).toBe(false);
    });
  });

  describe('isDuplicatePurchaseError', () => {
    it('should return true for duplicate purchase error', () => {
      const error = {
        code: DUPLICATE_PURCHASE_CODE,
        message: 'Duplicate purchase update skipped',
      };

      expect(isDuplicatePurchaseError(error)).toBe(true);
    });

    it('should return true for duplicate-purchase string code', () => {
      const error = {
        code: 'duplicate-purchase',
        message: 'Duplicate',
      };

      expect(isDuplicatePurchaseError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = {
        code: ErrorCode.UserCancelled,
        message: 'User cancelled',
      };

      expect(isDuplicatePurchaseError(error)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isDuplicatePurchaseError(undefined)).toBe(false);
    });
  });

  describe('DUPLICATE_PURCHASE_CODE', () => {
    it('should equal duplicate-purchase', () => {
      expect(DUPLICATE_PURCHASE_CODE).toBe('duplicate-purchase');
    });
  });
});
