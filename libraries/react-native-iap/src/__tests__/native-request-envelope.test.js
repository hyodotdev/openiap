const {readFileSync} = require('fs');
const {resolve} = require('path');

const helper = readFileSync(
  resolve(__dirname, '../../ios/RnIapHelper.swift'),
  'utf8',
);

describe('native purchase request envelope', () => {
  it('uses the canonical apple key for both iOS request branches', () => {
    const start = helper.indexOf('static func decodeRequestPurchaseProps(');
    const end = helper.indexOf('// MARK: - Shared helpers', start);
    const decoder = helper.slice(start, end);

    expect(decoder).toContain(
      'normalized["requestPurchase"] = ["apple": iosPayload]',
    );
    expect(decoder).toContain(
      'normalized["requestSubscription"] = ["apple": iosPayload]',
    );
    expect(decoder).not.toContain('["ios": iosPayload]');
  });
});
