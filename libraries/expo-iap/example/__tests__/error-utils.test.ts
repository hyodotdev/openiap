import type {ExpoPurchaseError} from 'expo-iap';
import {
  extractErrorCode,
  formatErrorForDisplay,
  formatPurchaseErrorDetails,
} from '../src/utils/errorUtils';

describe('errorUtils', () => {
  const wrappedNetworkError = new Error(
    'FunctionCallException: OPENIAP_ERROR_JSON: ' +
      '{"platform":"ios","code":"network-error","message":"Could not connect to the server."}' +
      ' (at ExpoIapHelper.swift:21)',
  );

  it('extracts a standard code from a wrapped native error', () => {
    expect(
      extractErrorCode(wrappedNetworkError, 'purchase-verification-failed'),
    ).toBe('network-error');
  });

  it('hides native diagnostics in production messages', () => {
    expect(
      formatErrorForDisplay(
        wrappedNetworkError,
        'purchase-verification-failed',
        false,
      ),
    ).toBe(
      'Network connection error. Please check your internet connection and try again. ' +
        '(Error code: network-error)',
    );
  });

  it('keeps native diagnostics in development messages', () => {
    expect(
      formatErrorForDisplay(
        wrappedNetworkError,
        'purchase-verification-failed',
        true,
      ),
    ).toContain('FunctionCallException');
  });

  it('lists a purchase error code, message, and debug message', () => {
    const error = {
      code: 'user-cancelled',
      message: 'Cancelled',
    } as ExpoPurchaseError;
    expect(formatPurchaseErrorDetails(error)).toBe(
      'Code: user-cancelled\nMessage: Cancelled',
    );
    expect(
      formatPurchaseErrorDetails({...error, debugMessage: 'Response code 1'}),
    ).toBe('Code: user-cancelled\nMessage: Cancelled\nDebug: Response code 1');
  });
});
