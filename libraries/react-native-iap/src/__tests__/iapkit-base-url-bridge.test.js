const {readFileSync} = require('fs');
const {resolve} = require('path');

const rootDir = resolve(__dirname, '../..');

function readSource(path) {
  return readFileSync(resolve(rootDir, path), 'utf8');
}

describe('IAPKit native bridge parity', () => {
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

  it('forwards Amazon expectedProductId and preserves environment', () => {
    const spec = readSource('src/specs/RnIap.nitro.ts');
    const ios = readSource('ios/HybridRnIap.swift');
    const android = readSource(
      'android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt',
    );

    expect(spec).toMatch(
      /interface NitroVerifyPurchaseWithIapkitAmazonProps[\s\S]*?expectedProductId\?: string \| null;/,
    );
    expect(spec).toMatch(
      /interface NitroVerifyPurchaseWithIapkitResult[\s\S]*?environment\?: string \| null;/,
    );
    expect(ios).toContain(
      'if case .second(let expectedProductId) = amazon.expectedProductId',
    );
    expect(ios).toContain(
      'amazonDict["expectedProductId"] = expectedProductId',
    );
    expect(ios).toContain(
      'environment: RnIapHelper.wrapString(item.environment)',
    );
    expect(android).toContain('amazon.expectedProductId.unwrapString()?.let {');
    expect(android).toContain('amazonMap["expectedProductId"] = it');
    expect(android).toContain(
      'environment = item.environment?.let { Variant_NullType_String.Second(it) }',
    );
  });

  it('forwards Horizon SKU and optional user ID through both native maps', () => {
    const spec = readSource('src/specs/RnIap.nitro.ts');
    const ios = readSource('ios/HybridRnIap.swift');
    const android = readSource(
      'android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt',
    );

    expect(spec).toMatch(
      /interface NitroVerifyPurchaseWithIapkitHorizonProps[\s\S]*?sku: string;[\s\S]*?userId\?: string \| null;/,
    );
    expect(ios).toContain('if case .second(let horizon) = iapkit.horizon');
    expect(ios).toContain('iapkitDict["horizon"] = horizonDict');
    expect(android).toContain(
      '(iapkit.horizon as? Variant_NullType_NitroVerifyPurchaseWithIapkitHorizonProps.Second)',
    );
    expect(android).toContain('iapkitMap["horizon"] = horizonMap');
  });
});
