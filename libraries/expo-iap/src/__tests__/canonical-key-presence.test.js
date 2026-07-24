/* eslint-env jest, node */

const {readFileSync} = require('fs');
const {resolve} = require('path');

const rootDir = resolve(__dirname, '../..');

function readExpoFile(path) {
  return readFileSync(resolve(rootDir, path), 'utf8');
}

describe('native canonical-key presence contract', () => {
  it('removes the legacy iOS alias before the standard Swift decoder sees it', () => {
    const helper = readExpoFile('ios/ExpoIapHelper.swift');

    expect(helper).toContain('if request.keys.contains("apple")');
    expect(helper).toContain('request.removeValue(forKey: "ios")');
  });

  it('fails closed to in-app for unrecognized iOS product query types', () => {
    const helper = readExpoFile('ios/ExpoIapHelper.swift');
    const parser = helper.match(
      /static func parseProductQueryType[\s\S]*?\n    }\n\n    static func decodeProductRequest/,
    )?.[0];

    expect(parser).toBeDefined();
    expect(parser).toContain('default:\n            return .inApp');
    expect(parser).not.toContain('default:\n            return .all');
  });

  it('does not let Onside fall through from an explicit apple key to ios', () => {
    const onside = readExpoFile('ios/onside/OnsideIapModule.swift');

    expect(onside).toContain('if request.keys.contains("apple")');
    expect(onside).toContain('return request["apple"] as? [String: Any]');
    expect(onside).not.toContain(
      'if let apple = request["apple"] as? [String: Any]',
    );
  });

  it('uses Kotlin map key presence for canonical Android aliases', () => {
    const helper = readExpoFile(
      'android/src/main/java/expo/modules/iap/ExpoIapHelper.kt',
    );

    expect(helper).toContain(
      'val hasCanonicalGoogle = request.containsKey("google")',
    );
    expect(helper).toContain(
      'val hasCanonicalSkus = effective.containsKey("skus")',
    );
    expect(helper).toContain('effective.containsKey("subscriptionOffers")');
  });
});
