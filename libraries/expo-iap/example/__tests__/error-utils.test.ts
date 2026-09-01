import {extractErrorCode, formatErrorForDisplay} from '../src/utils/errorUtils';

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
});
