const {readFileSync} = require('fs');
const {resolve} = require('path');

const rootDir = resolve(__dirname, '../..');

function readRepoFile(path) {
  return readFileSync(resolve(rootDir, path), 'utf8');
}

describe('native log redaction', () => {
  it('covers common purchase and verification secrets on both native bridges', () => {
    const androidLog = readRepoFile(
      'android/src/main/java/com/margelo/nitro/iap/RnIapLog.kt',
    );
    const iosLog = readRepoFile('ios/RnIapLog.swift');
    const sensitiveFragments = [
      'token',
      'apikey',
      'secret',
      'jws',
      'receiptid',
      'userid',
      'password',
      'bearer',
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

  it('summarizes Android results that can carry receipt identifiers', () => {
    const androidModule = readRepoFile(
      'android/src/main/java/com/margelo/nitro/iap/HybridRnIap.kt',
    );

    expect(androidModule).not.toContain(
      'mapOf("id" to p.id, "sku" to p.productId)',
    );
    expect(androidModule).not.toContain(
      'result.map { mapOf("id" to it.id, "sku" to it.productId) }',
    );
    expect(androidModule).not.toContain(
      'RnIapLog.result("verifyPurchase", verifyResult.toString())',
    );
    expect(androidModule).not.toContain(
      'RnIapLog.result("createAlternativeBillingTokenAndroid", token)',
    );
    expect(androidModule).toContain('"purchaseCount" to purchases.size');
    expect(androidModule).toContain(
      '"testTransaction" to androidResult.testTransaction',
    );
  });
});
