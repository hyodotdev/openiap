/* eslint-env jest, node */

const {readFileSync} = require('fs');
const {resolve} = require('path');

const rootDir = resolve(__dirname, '../..');

function readSource(path) {
  return readFileSync(resolve(rootDir, path), 'utf8');
}

describe('native legacy compatibility contract', () => {
  it('keeps explicit canonical purchase variants authoritative', () => {
    const android = readSource(
      'android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt',
    );
    const ios = readSource('ios/HybridRnIap.swift');

    expect(android).toContain('if (request.google != null)');
    expect(android).not.toMatch(
      /request\.google[\s\S]{0,160}\?:[\s\S]{0,160}request\.android/,
    );
    expect(ios).toContain('if let canonicalApple = request.apple');
    expect(ios).toContain('guard case .second(let unwrapped) = canonicalApple');
  });

  it('deduplicates native legacy warnings by stable key', () => {
    const androidLog = readSource(
      'android/src/main/java/com/margelo/nitro/iap/RnIapLog.kt',
    );
    const android = readSource(
      'android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt',
    );
    const iosLog = readSource('ios/RnIapLog.swift');
    const ios = readSource('ios/HybridRnIap.swift');

    expect(androidLog).toContain('fun deprecation(');
    expect(androidLog).toContain('emittedDeprecations.add(key)');
    expect(iosLog).toContain('static func deprecation(');
    expect(iosLog).toContain('emittedDeprecations.insert(key).inserted');
    expect(iosLog).toContain('emit(.warn, message)');
    expect(iosLog).toContain(
      'private static func emit(_ level: Level, _ message: String)',
    );
    expect(android).toContain(
      'RnIapLog.deprecation(\n                        "product-type.inapp"',
    );
    expect(ios).toContain(
      'RnIapLog.deprecation(\n                        "product-type.inapp"',
    );
  });
});
