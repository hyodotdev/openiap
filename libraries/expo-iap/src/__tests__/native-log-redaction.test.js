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
    expect(androidLog).not.toContain('emittedDeprecations');
    expect(iosLog).not.toContain('emittedDeprecations');
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

  it('redacts Billing Programs reporting details before logging', () => {
    const androidModule = readRepoFile(
      'android/src/main/java/expo/modules/iap/ExpoIapModule.kt',
    );

    expect(androidModule).not.toContain(
      'ExpoIapLog.result("createBillingProgramReportingDetailsAndroid", result.externalTransactionToken)',
    );
    expect(androidModule).toContain(
      '"externalTransactionToken" to result.externalTransactionToken',
    );
    expect(androidModule).toContain(
      'ExpoIapLog.result(\n                            "createBillingProgramReportingDetailsAndroid",\n                            response,',
    );
  });

  it('fails closed when Onside has no storefront country code', () => {
    const onsideModule = readRepoFile('ios/onside/OnsideIapModule.swift');

    expect(onsideModule).not.toContain('storefront?.countryCode ?? ""');
    expect(onsideModule).toContain('PurchaseError.make(');
    expect(onsideModule).toContain('code: .serviceError');
  });

  it('rejects query-only and malformed purchase types on both iOS paths', () => {
    const iosHelper = readRepoFile('ios/ExpoIapHelper.swift');
    const onsideModule = readRepoFile('ios/onside/OnsideIapModule.swift');
    const purchaseBlock = onsideModule.slice(
      onsideModule.indexOf('AsyncFunction("requestPurchase")'),
      onsideModule.indexOf('AsyncFunction("finishTransaction")'),
    );
    const fetchBlock = onsideModule.slice(
      onsideModule.indexOf('AsyncFunction("fetchProducts")'),
      onsideModule.indexOf('AsyncFunction("requestPurchase")'),
    );

    expect(iosHelper).toContain(
      'static func parsePurchaseProductQueryType(_ rawValue: Any?)',
    );
    expect(iosHelper).toContain('!(rawValue is String)');
    expect(iosHelper).toContain('!(rawValue is NSNull)');
    expect(iosHelper).toContain('guard type != .all');
    expect(iosHelper).toContain(
      'parsePurchaseProductQueryType(payload["type"])',
    );
    expect(purchaseBlock).toContain(
      'decodeRequestPurchaseProps(from: payload)',
    );
    expect(purchaseBlock).not.toContain('resolveSku(from: payload)');
    expect(
      purchaseBlock.indexOf('decodeRequestPurchaseProps(from: payload)'),
    ).toBeLessThan(
      purchaseBlock.indexOf('try await ensureObserverRegistered()'),
    );
    expect(onsideModule).toContain('switch (request.type, request.request)');
    expect(
      fetchBlock.indexOf('decodeProductRequest(from: params)'),
    ).toBeLessThan(fetchBlock.indexOf('try await ensureObserverRegistered()'));
  });

  it('keeps Onside purchases aligned with the canonical iOS payload', () => {
    const onsideModule = readRepoFile('ios/onside/OnsideIapModule.swift');
    const iosHelper = readRepoFile('ios/ExpoIapHelper.swift');

    expect(onsideModule).toContain('dictionary["store"] = "unknown"');
    expect(onsideModule).toMatch(
      /if product\.subscriptionPeriod == nil \{\s+dictionary\["currentPlanId"\] = NSNull\(\)\s+\} else \{\s+dictionary\["currentPlanId"\] = product\.productIdentifier/,
    );
    expect(onsideModule).toContain('dictionary["quantity"] = 1');
    expect(onsideModule).toContain('dictionary["quantityIOS"] = 1');
    expect(onsideModule).toContain(
      'dictionary["type"] = isSubscription ? "subs" : "in-app"',
    );
    expect(onsideModule).toContain(
      'dictionary["typeIOS"] = isSubscription ? "auto-renewable-subscription" : "non-consumable"',
    );
    expect(onsideModule).toContain(
      'dictionary["subscriptionPeriodUnitIOS"] = subscriptionPeriod.unit',
    );
    expect(onsideModule).toContain(
      'introductoryPricePaymentModeIOS(for: introductoryPrice).rawValue',
    );
    expect(onsideModule).toMatch(
      /private func introductoryPricePaymentModeIOS\([\s\S]*?if offer\.price\.value == 0 \{\s+return \.freeTrial\s+\}[\s\S]*?return \.empty/,
    );
    expect(onsideModule).toContain('PaymentModeIOS.empty.rawValue');
    expect(onsideModule).toContain('private func formatPriceIOS(');
    expect(onsideModule).toContain(
      'private func subscriptionPeriodComponentsIOS(',
    );
    expect(onsideModule).not.toContain('private func formatPrice(');
    expect(onsideModule).not.toContain(
      'private func subscriptionPeriodComponents(',
    );
    expect(onsideModule).toMatch(
      /switch request\.type \?\? \.inApp \{\s+case \.subs:\s+return product\.subscriptionPeriod != nil\s+case \.inApp:\s+return product\.subscriptionPeriod == nil\s+case \.all:\s+return true/,
    );
    expect(onsideModule).toContain('dictionary["environmentIOS"] = NSNull()');
    expect(onsideModule).toContain(
      'dictionary["countryCodeIOS"] = transaction.storefront.countryCode',
    );
    expect(onsideModule).toContain(
      'dictionary["subscriptionGroupIdIOS"] = product.subscriptionGroupIdentifier',
    );
    expect(onsideModule).toMatch(
      /dictionary\["originalTransactionIdentifierIOS"\] =\s+transaction\.originalTransactionIdentifier/,
    );
    expect(onsideModule).not.toContain(
      'dictionary["environmentIOS"] = transaction.storefront.id',
    );
    expect(onsideModule).toMatch(/case \.restored:\s+return "purchased"/);
    expect(onsideModule).toMatch(/case \.failed:\s+return "unknown"/);
    expect(onsideModule).not.toContain('return "restored"');
    expect(onsideModule).not.toContain('return "failed"');
    expect(iosHelper).toContain('guard let stringValue = rawValue as? String');
    expect(iosHelper).toContain('if raw.isEmpty {\n            return .inApp');
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
