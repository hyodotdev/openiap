import {readFileSync} from 'node:fs';
import {resolve as resolvePath} from 'node:path';
import plugin from '../src/withIAP';

const versionsPath = resolvePath(__dirname, '../../openiap-versions.json');
const openiapVersions = JSON.parse(readFileSync(versionsPath, 'utf8'));
const OPENIAP_VERSION: string = openiapVersions.google;
if (typeof OPENIAP_VERSION !== 'string' || OPENIAP_VERSION.length === 0) {
  throw new Error(
    'Test setup: Invalid "google" version in openiap-versions.json',
  );
}

// Mock config-plugins with simple pass-through helpers that immediately run mods
jest.mock('expo/config-plugins', () => ({
  createRunOncePlugin: (fn: any) => fn,
  withAndroidManifest: (config: any, action: any) => {
    // Simulate expo mod by passing manifest JSON as modResults
    const original = config.modResults;
    const cfg = {...config, modResults: original.manifest ?? {}};
    const result = action(cfg);
    // Write back the mutated manifest JSON
    const updated = {...original, manifest: result.modResults};
    return {...config, modResults: updated};
  },
  withAppBuildGradle: (config: any, action: any) => {
    const original = config.modResults;
    const cfg = {...config, modResults: {contents: original.contents}};
    const result = action(cfg);
    const updated = {...original, contents: result.modResults.contents};
    return {...config, modResults: updated};
  },
  withGradleProperties: (config: any, action: any) => {
    const original = config.modResults;
    const cfg = {...config, modResults: original.gradleProperties ?? []};
    const result = action(cfg);
    const updated = {
      ...original,
      gradleProperties: result.modResults,
    };
    return {...config, modResults: updated};
  },
  withInfoPlist: (config: any, action: any) => {
    const original = config.modResults;
    const cfg = {...config, modResults: original.plist ?? {}};
    const result = action(cfg);
    const updated = {...original, plist: result.modResults};
    return {...config, modResults: updated};
  },
  withEntitlementsPlist: (config: any, action: any) => {
    const original = config.modResults;
    const cfg = {...config, modResults: original.entitlements ?? {}};
    const result = action(cfg);
    const updated = {...original, entitlements: result.modResults};
    return {...config, modResults: updated};
  },
  withPodfile: (config: any, action: any) => {
    const original = config.modResults;
    const cfg = {...config, modResults: {contents: original.podfile ?? ''}};
    const result = action(cfg);
    const updated = {...original, podfile: result.modResults.contents};
    return {...config, modResults: updated};
  },
  WarningAggregator: {
    addWarningAndroid: jest.fn(),
    addWarningIOS: jest.fn(),
  },
}));

describe('withIAP config plugin (Android)', () => {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  beforeEach(() => {
    jest.resetModules();
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  });

  function makeConfig(gradle: string, manifest?: any) {
    return {
      modResults: {
        contents: gradle,
        manifest: manifest ?? {manifest: {}},
        gradleProperties: [],
        plist: {},
        entitlements: {},
        podfile: '',
      },
    } as any;
  }

  it('adds OpenIAP dep to app build.gradle and logs once', () => {
    const initial = `android {\n}\n\ndependencies {\n}`;
    const config = makeConfig(initial, {manifest: {}});
    const result: any = plugin(config as any);
    const out = result.modResults.contents as string;
    expect(out).toContain(
      `io.github.hyochan.openiap:openiap-google:${OPENIAP_VERSION}`,
    );
    expect((console.log as jest.Mock).mock.calls.join(' ')).toContain(
      `(${OPENIAP_VERSION})`,
    );
  });

  it('is idempotent and respects hasLoggedPluginExecution', () => {
    const initial = `dependencies {\n    implementation "io.github.hyochan.openiap:openiap-google:${OPENIAP_VERSION}"\n}`;
    const config1 = makeConfig(initial, {manifest: {}});
    const res1: any = plugin(config1 as any);
    expect(
      res1.modResults.contents.match(
        /io\.github\.hyochan\.openiap:openiap-google/g,
      )?.length,
    ).toBe(1);

    // Run plugin again on a second config; due to hasLoggedPluginExecution, it should not log again
    const config2 = makeConfig(initial, {manifest: {}});
    const before = (console.log as jest.Mock).mock.calls.length;
    plugin(config2);
    const after = (console.log as jest.Mock).mock.calls.length;
    expect(after).toBe(before);
  });

  it('adds BILLING permission to AndroidManifest if missing', () => {
    const config = makeConfig('dependencies {\n}', {manifest: {}});
    const res: any = plugin(config as any);
    const perms = res.modResults.manifest.manifest['uses-permission'];
    expect(Array.isArray(perms)).toBe(true);
    expect(
      perms.some(
        (p: any) => p.$['android:name'] === 'com.android.vending.BILLING',
      ),
    ).toBe(true);
  });

  it('keeps existing BILLING permission intact', () => {
    const manifest = {
      manifest: {
        'uses-permission': [
          {$: {'android:name': 'com.android.vending.BILLING'}},
        ],
      },
    };
    const config = makeConfig('dependencies {\n}', manifest);
    const res: any = plugin(config as any);
    const perms = res.modResults.manifest.manifest['uses-permission'];
    expect(perms.length).toBe(1);
  });

  it('adds IAPKit API key to AndroidManifest when provided', () => {
    const manifest = {
      manifest: {
        application: [{}],
      },
    };
    const config = makeConfig('dependencies {\n}', manifest);
    const res: any = plugin(config as any, {iapkitApiKey: 'test-api-key-123'});
    const app = res.modResults.manifest.manifest.application[0];
    expect(app['meta-data']).toBeDefined();
    expect(Array.isArray(app['meta-data'])).toBe(true);
    const iapkitMeta = app['meta-data'].find(
      (m: any) => m.$['android:name'] === 'dev.iapkit.API_KEY',
    );
    expect(iapkitMeta).toBeDefined();
    expect(iapkitMeta.$['android:value']).toBe('test-api-key-123');
  });

  it('does not add IAPKit API key when not provided', () => {
    const manifest = {
      manifest: {
        application: [{}],
      },
    };
    const config = makeConfig('dependencies {\n}', manifest);
    const res: any = plugin(config as any);
    const app = res.modResults.manifest.manifest.application[0];
    expect(app['meta-data']).toBeUndefined();
  });

  it('uses Fire OS artifact, flavor, and removes Play Billing permission when Fire OS is enabled', () => {
    const initial = [
      'android {',
      '    defaultConfig {',
      '    }',
      '}',
      'dependencies {',
      `    implementation "io.github.hyochan.openiap:openiap-google-horizon:0.0.1"`,
      '}',
      '',
    ].join('\n');
    const manifest = {
      manifest: {
        'uses-permission': [
          {$: {'android:name': 'com.android.vending.BILLING'}},
        ],
      },
    };
    const config = makeConfig(initial, manifest);
    const res: any = plugin(config as any, {modules: {fireOS: true}});

    expect(res.modResults.contents).toContain(
      `io.github.hyochan.openiap:openiap-google-amazon:${OPENIAP_VERSION}`,
    );
    expect(res.modResults.contents).toContain(
      'missingDimensionStrategy "platform", "amazon"',
    );
    expect(res.modResults.contents).not.toContain(
      'openiap-google-horizon:0.0.1',
    );
    expect(res.modResults.manifest.manifest['uses-permission']).toHaveLength(0);
    expect(res.modResults.gradleProperties).toEqual(
      expect.arrayContaining([
        {type: 'property', key: 'horizonEnabled', value: 'false'},
        {type: 'property', key: 'fireOsEnabled', value: 'true'},
      ]),
    );
  });

  it('prefers Fire OS over Horizon when both Android modules are enabled', () => {
    const initial = `android {\n    defaultConfig {\n    }\n}\n\ndependencies {\n}`;
    const config = makeConfig(initial, {manifest: {}});
    const res: any = plugin(config as any, {
      modules: {fireOS: true, horizon: true},
    });

    expect(res.modResults.contents).toContain(
      `io.github.hyochan.openiap:openiap-google-amazon:${OPENIAP_VERSION}`,
    );
    expect(res.modResults.contents).toContain(
      'missingDimensionStrategy "platform", "amazon"',
    );
    expect(res.modResults.gradleProperties).toEqual(
      expect.arrayContaining([
        {type: 'property', key: 'horizonEnabled', value: 'false'},
        {type: 'property', key: 'fireOsEnabled', value: 'true'},
      ]),
    );
  });

  it('rejects Vega OS combined with Fire OS during prebuild', () => {
    const initial = `android {\n    defaultConfig {\n    }\n}\n\ndependencies {\n}`;
    const config = makeConfig(initial, {manifest: {}});
    expect(() =>
      plugin(config as any, {
        modules: {fireOS: true, vega: true},
      }),
    ).toThrow(/modules\.vega cannot be combined/);
  });

  it('replaces stale Amazon artifact and platform strategy when returning to Play', () => {
    const initial = [
      'android {',
      '    defaultConfig {',
      '        missingDimensionStrategy "platform", "amazon"',
      '    }',
      '}',
      'dependencies {',
      `    implementation "io.github.hyochan.openiap:openiap-google-amazon:0.0.1"`,
      '}',
      '',
    ].join('\n');
    const config = makeConfig(initial, {manifest: {}});
    const res: any = plugin(config as any);

    expect(res.modResults.contents).toContain(
      `io.github.hyochan.openiap:openiap-google:${OPENIAP_VERSION}`,
    );
    expect(res.modResults.contents).not.toContain(
      'openiap-google-amazon:0.0.1',
    );
    expect(res.modResults.contents).toContain(
      'missingDimensionStrategy "platform", "play"',
    );
    expect(res.modResults.gradleProperties).toEqual(
      expect.arrayContaining([
        {type: 'property', key: 'horizonEnabled', value: 'false'},
        {type: 'property', key: 'fireOsEnabled', value: 'false'},
      ]),
    );
  });
});
