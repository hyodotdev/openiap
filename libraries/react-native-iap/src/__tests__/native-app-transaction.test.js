/* eslint-env jest, node */

const {readFileSync} = require('fs');
const {resolve} = require('path');

const bridge = readFileSync(
  resolve(__dirname, '../../ios/HybridRnIap.swift'),
  'utf8',
);

describe('native app transaction bridge', () => {
  it('forwards Xcode 27 app acquisition metadata to JavaScript', () => {
    const start = bridge.indexOf('func getAppTransactionIOS()');
    const end = bridge.indexOf('// MARK:', start + 1);
    const method = bridge.slice(start, end);

    expect(method).toContain('result["revocationDate"] = appTx.revocationDate');
    expect(method).toContain('result["storeType"] = appTx.storeType');
  });
});
