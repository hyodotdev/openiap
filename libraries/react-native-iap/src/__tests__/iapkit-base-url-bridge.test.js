/* eslint-env jest, node */

const {readFileSync} = require('fs');
const {resolve} = require('path');

const rootDir = resolve(__dirname, '../..');

function readSource(path) {
  return readFileSync(resolve(rootDir, path), 'utf8');
}

describe('IAPKit baseUrl native bridge parity', () => {
  it('declares baseUrl in the Nitro contract', () => {
    const spec = readSource('src/specs/RnIap.nitro.ts');

    expect(spec).toMatch(
      /interface NitroVerifyPurchaseWithIapkitProps[\s\S]*?baseUrl\?: string \| null;/,
    );
  });

  it('forwards baseUrl through the iOS and Android native maps', () => {
    const ios = readSource('ios/HybridRnIap.swift');
    const android = readSource(
      'android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt',
    );

    expect(ios).toContain('if case .second(let baseUrl) = iapkit.baseUrl');
    expect(ios).toContain('iapkitDict["baseUrl"] = baseUrl');
    expect(android).toContain(
      'iapkit.baseUrl.unwrapString()?.let { iapkitMap["baseUrl"] = it }',
    );
  });
});
