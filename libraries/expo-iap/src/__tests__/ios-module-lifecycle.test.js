const {readFileSync} = require('fs');
const {resolve} = require('path');

const rootDir = resolve(__dirname, '../..');

function readExpoFile(path) {
  return readFileSync(resolve(rootDir, path), 'utf8');
}

describe('iOS module lifecycle', () => {
  it('scopes StoreKit teardown to the active module generation', () => {
    const module = readExpoFile('ios/ExpoIapModule.swift');
    const helper = readExpoFile('ios/ExpoIapHelper.swift');

    expect(module).toMatch(/OnCreate \{ \[weak self\] in/);
    expect(module).toMatch(/Task \{ @MainActor \[weak self\] in/);
    expect(module).toMatch(/OnDestroy \{ \[weak self\] in/);
    expect(module).toMatch(/Task \{ @MainActor \[self\] in/);
    expect(module).toContain(
      'ExpoIapHelper.cleanupStore(listenerGeneration: listenerGeneration)',
    );
    expect(module).toContain('await ExpoIapHelper.waitForStoreCleanup()');
    expect(helper).toContain('private static var activeListenerGeneration');
    expect(helper).toContain(
      'guard activeListenerGeneration == listenerGeneration else { return nil }',
    );
    expect(helper).toContain('private static var pendingConnectionCleanup');
    expect(helper).toContain('await pendingConnectionCleanupTask()?.value');
  });

  it('does not retain Onside modules through lifecycle definitions', () => {
    const module = readExpoFile('ios/onside/OnsideIapModule.swift');

    expect(module).toMatch(/OnCreate \{ \[weak self\] in/);
    expect(module).toMatch(/Task \{ @MainActor \[weak self\] in/);
    expect(module).toMatch(/OnDestroy \{ \[weak self\] in/);
    expect(module).toMatch(/Task \{ @MainActor \[self\] in/);
  });
});
