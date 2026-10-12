const {readFileSync} = require('fs');
const {resolve} = require('path');

const read = (path) => readFileSync(resolve(__dirname, '../..', path), 'utf8');

describe('native subscription status bridge', () => {
  it('passes the StoreKit renewal-state name through instead of a number', () => {
    const spec = read('src/specs/RnIap.nitro.ts');
    const swift = read('ios/HybridRnIap.swift');
    const statusSpec = spec.slice(
      spec.indexOf('export interface NitroSubscriptionStatus {'),
      spec.indexOf(
        '}',
        spec.indexOf('export interface NitroSubscriptionStatus {'),
      ),
    );
    const mapping = swift.slice(
      swift.indexOf('func subscriptionStatusIOS('),
      swift.indexOf('func currentEntitlementIOS('),
    );

    expect(statusSpec).toContain('state: string;');
    expect(mapping).toContain(
      'let state = payload["state"] as? String ?? "unknown"',
    );
    expect(mapping).toContain('NitroSubscriptionStatus(state: state,');
  });
});
