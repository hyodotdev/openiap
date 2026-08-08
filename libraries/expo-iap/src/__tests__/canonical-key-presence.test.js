const {readFileSync} = require('fs');
const {resolve} = require('path');

const rootDir = resolve(__dirname, '../..');

function readExpoFile(path) {
  return readFileSync(resolve(rootDir, path), 'utf8');
}

describe('native canonical-key presence contract', () => {
  it('passes only canonical Apple envelopes to the Swift decoder', () => {
    const helper = readExpoFile('ios/ExpoIapHelper.swift');

    expect(helper).toContain('payload.keys.contains("requestPurchase")');
    expect(helper).toContain('normalized["requestPurchase"] = request');
    expect(helper).not.toContain('normalizeApplePlatformKey');
    expect(helper).not.toContain('request.removeValue(forKey: "ios")');
  });

  it('rejects unrecognized iOS product query types', () => {
    const helper = readExpoFile('ios/ExpoIapHelper.swift');
    const parser = helper.match(
      /static func parseProductQueryType[\s\S]*?\n    }\n\n    static func decodeProductRequest/,
    )?.[0];

    expect(parser).toBeDefined();
    expect(parser).toContain('default:\n            throw PurchaseError.make(');
    expect(parser).toContain('code: .developerError');
  });

  it('uses only the canonical Apple key in Onside', () => {
    const onside = readExpoFile('ios/onside/OnsideIapModule.swift');

    expect(onside).toContain('request["apple"] as? [String: Any]');
    expect(onside).not.toContain('request["ios"]');
  });

  it('uses only canonical Google request fields in Kotlin', () => {
    const helper = readExpoFile(
      'android/src/main/java/expo/modules/iap/ExpoIapHelper.kt',
    );

    expect(helper).toContain('request["google"] as? Map<*, *>');
    expect(helper).toContain('effective["skus"] as? List<*>');
    expect(helper).toContain('effective["subscriptionOffers"] as? List<*>');
    expect(helper).not.toContain('effective["skuArr"]');
    expect(helper).not.toContain('effective["offerTokenArr"]');
  });
});
