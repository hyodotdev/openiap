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
      'receipt',
      'clientpayload',
      'dataandroid',
      'signatureandroid',
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
    expect(androidLog).toContain("'{' -> JSONObject(trimmed)");
    expect(iosLog).toContain('JSONSerialization.jsonObject(with: data)');
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
    expect(androidModule).toContain(
      '"hasIapkit" to (params["iapkit"] != null)',
    );
    expect(iosModule).toContain('"hasIapkit": params["iapkit"] != nil');
  });

  it('does not log the alternative-billing reporting token as a raw result', () => {
    const androidModule = readRepoFile(
      'android/src/main/java/expo/modules/iap/ExpoIapModule.kt',
    );

    expect(androidModule).not.toContain(
      'ExpoIapLog.result("createAlternativeBillingTokenAndroid", token)',
    );
    expect(androidModule).toContain(
      'if (token.isNullOrBlank()) "<empty>" else "<token>"',
    );
  });

  it('fails closed when Onside has no storefront country code', () => {
    const onsideModule = readRepoFile('ios/onside/OnsideIapModule.swift');

    expect(onsideModule).not.toContain('storefront?.countryCode ?? ""');
    expect(onsideModule).toContain('PurchaseError.make(');
    expect(onsideModule).toContain('code: .serviceError');
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

describe('native error and listener bridges', () => {
  it('keeps the canonical error envelope on both Expo native bridges', () => {
    const androidHelper = readRepoFile(
      'android/src/main/java/expo/modules/iap/ExpoIapHelper.kt',
    );
    const iosHelper = readRepoFile('ios/ExpoIapHelper.swift');
    const iosModule = readRepoFile('ios/ExpoIapModule.swift');

    expect(androidHelper).toContain('OPENIAP_ERROR_JSON:');
    expect(androidHelper).toContain('serializeErrorEnvelope(errorJson)');
    expect(iosHelper).toContain('OPENIAP_ERROR_JSON:');
    expect(iosHelper).toContain('OpenIapSerialization.encode(error)');
    expect(iosHelper).toContain(
      'if JSONSerialization.isValidJSONObject(payload),',
    );
    expect(iosModule).toContain('throw IapException.from(error)');
  });

  it('removes the exact Android listener instances on teardown', () => {
    const androidHelper = readRepoFile(
      'android/src/main/java/expo/modules/iap/ExpoIapHelper.kt',
    );
    const androidModule = readRepoFile(
      'android/src/main/java/expo/modules/iap/ExpoIapModule.kt',
    );

    expect(androidHelper).toContain('data class ListenerHandles');
    expect(androidHelper).toContain(
      'removePurchaseUpdateListener(handles.purchaseUpdate)',
    );
    expect(androidHelper).toContain(
      'removePurchaseErrorListener(handles.purchaseError)',
    );
    expect(androidHelper).toContain(
      'removeUserChoiceBillingListener(handles.userChoiceBilling)',
    );
    expect(androidHelper).toContain(
      'removeDeveloperProvidedBillingListener(handles.developerProvidedBilling)',
    );
    expect(androidHelper).toContain(
      'removeSubscriptionBillingIssueListener(handles.subscriptionBillingIssue)',
    );
    expect(androidModule).toContain(
      'ExpoIapHelper.cleanupListeners(openIap, listenerHandles)',
    );
  });
});
