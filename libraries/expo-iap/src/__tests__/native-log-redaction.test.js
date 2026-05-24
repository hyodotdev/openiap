/* eslint-env jest, node */

const {readFileSync} = require('fs');
const {resolve} = require('path');

const rootDir = resolve(__dirname, '../..');

function readRepoFile(path) {
  return readFileSync(resolve(rootDir, path), 'utf8');
}

describe('native log redaction', () => {
  it('keeps Expo native log sanitizers covering verification secrets', () => {
    const androidLog = readRepoFile(
      'android/src/main/java/expo/modules/iap/ExpoIapLog.kt',
    );
    const iosLog = readRepoFile('ios/ExpoIapLog.swift');
    const sensitiveFragments = [
      'token',
      'apikey',
      'secret',
      'jws',
      'receiptid',
      'userid',
    ];

    for (const fragment of sensitiveFragments) {
      expect(androidLog).toContain(`"${fragment}"`);
      expect(iosLog).toContain(`"${fragment}"`);
    }
    expect(androidLog).toContain('isSensitiveKey');
    expect(iosLog).toContain('isSensitiveKey');
    expect(androidLog).toContain('filter { it.isLetterOrDigit() }');
    expect(iosLog).toContain('.filter { $0.isLetter || $0.isNumber }');
  });

  it('does not log raw verifyPurchaseWithProvider params on Expo native bridges', () => {
    const androidModule = readRepoFile(
      'android/src/main/java/expo/modules/iap/ExpoIapModule.kt',
    );
    const iosModule = readRepoFile('ios/ExpoIapModule.swift');

    expect(androidModule).not.toContain(
      'ExpoIapLog.payload("verifyPurchaseWithProvider", params)',
    );
    expect(iosModule).not.toContain(
      'ExpoIapLog.payload("verifyPurchaseWithProvider", payload: params)',
    );
    expect(androidModule).toContain('"hasIapkit" to (params["iapkit"] != null)');
    expect(iosModule).toContain('"hasIapkit": params["iapkit"] != nil');
  });

  it('does not log raw IAPKit request bodies in the Apple core package', () => {
    const appleModule = readFileSync(
      resolve(rootDir, '../../packages/apple/Sources/OpenIapModule.swift'),
      'utf8',
    );

    expect(appleModule).not.toContain('IAPKit request body:');
    expect(appleModule).toContain('IAPKit request body bytes=');
  });
});
