import type {ExpoConfig} from '@expo/config-types';
import plugin, {
  computeAutolinkModules,
  ensureOnsidePodIOS,
  modifyAppBuildGradle,
  resolveModuleSelection,
  syncHorizonAppIdMetaData,
} from '../src/withIAP';
import {getAndroidLocalPathInput} from '../src/withLocalOpenIAP';
import type {AutolinkState} from '../src/withIAP';
import type {ExpoIapPluginCommonOptions} from '../src/expoConfig.augmentation';
import {
  createVegaAppJson,
  createVegaEntryPoint,
  createVegaManifest,
  mergeVegaPackageJson,
  normalizeVegaPackageId,
  resolveVegaProjectSettings,
} from '../src/withVega';

// Type-level expectations
const autoModeOptions: ExpoIapPluginCommonOptions = {
  modules: {onside: true, fireOS: false, vega: false},
};

const explicitModeOptions: ExpoIapPluginCommonOptions = {
  module: 'onside',
};

const invalidExplicitOptions: ExpoIapPluginCommonOptions = {
  modules: {onside: false},
};
void autoModeOptions;
void explicitModeOptions;
void invalidExplicitOptions;

jest.mock('expo/config-plugins', () => {
  const plugins = jest.requireActual('expo/config-plugins');

  return {
    ...plugins,
    WarningAggregator: {addWarningAndroid: jest.fn(), addWarningIOS: jest.fn()},
  };
});

describe('android configuration', () => {
  const dependencyVersion = require('../../openiap-versions.json').google;
  const dependencyRegex = new RegExp(
    `io\\.github\\.hyochan\\.openiap:openiap-google:${dependencyVersion}`,
    'g',
  );

  it('adds OpenIAP dependency when missing', () => {
    const baseGradle = 'dependencies {\n}\n';
    const result = modifyAppBuildGradle(baseGradle, 'groovy');
    expect(result).toContain(
      `    implementation "io.github.hyochan.openiap:openiap-google:${dependencyVersion}"`,
    );
    const matches = result.match(dependencyRegex) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('keeps existing dependency untouched', () => {
    const baseGradle = `dependencies {\n    implementation "io.github.hyochan.openiap:openiap-google:0.0.1"\n}\n`;
    const result = modifyAppBuildGradle(baseGradle, 'groovy');
    const matches = result.match(dependencyRegex) ?? [];
    expect(matches).toHaveLength(1);
    expect(result).not.toContain('openiap-google:0.0.1');
  });

  it('uses Fire OS artifact and flavor when Fire OS is enabled', () => {
    const baseGradle = [
      'android {',
      '    defaultConfig {',
      '    }',
      '}',
      'dependencies {',
      '    implementation "io.github.hyochan.openiap:openiap-google-horizon:0.0.1"',
      '}',
      '',
    ].join('\n');
    const result = modifyAppBuildGradle(baseGradle, 'groovy', false, true);

    expect(result).toContain(
      `    implementation "io.github.hyochan.openiap:openiap-google-amazon:${dependencyVersion}"`,
    );
    expect(result).toContain(
      '        missingDimensionStrategy "platform", "amazon"',
    );
    expect(result).not.toContain('openiap-google-horizon:0.0.1');
  });

  it('prefers Fire OS over Horizon when both store flags are enabled', () => {
    const baseGradle = [
      'android {',
      '    defaultConfig {',
      '    }',
      '}',
      'dependencies {',
      '}',
      '',
    ].join('\n');
    const result = modifyAppBuildGradle(baseGradle, 'kotlin', true, true);

    expect(result).toContain(
      `    implementation("io.github.hyochan.openiap:openiap-google-amazon:${dependencyVersion}")`,
    );
    expect(result).toContain(
      '        missingDimensionStrategy("platform", "amazon")',
    );
  });

  it('replaces stale platform strategy when returning to Play', () => {
    const baseGradle = [
      'android {',
      '    defaultConfig {',
      '        missingDimensionStrategy "platform", "amazon"',
      '    }',
      '}',
      'dependencies {',
      '    implementation "io.github.hyochan.openiap:openiap-google-amazon:0.0.1"',
      '}',
      '',
    ].join('\n');
    const result = modifyAppBuildGradle(baseGradle, 'groovy');

    expect(result).toContain(
      `    implementation "io.github.hyochan.openiap:openiap-google:${dependencyVersion}"`,
    );
    expect(result).not.toContain('openiap-google-amazon:0.0.1');
    expect(result).toContain('missingDimensionStrategy "platform", "play"');
  });

  it('rejects Vega OS combined with Fire OS during prebuild', () => {
    expect(() =>
      plugin({name: 'test-app', slug: 'test-app'} as ExpoConfig, {
        modules: {fireOS: true, vega: true},
      }),
    ).toThrow(/modules\.vega cannot be combined/);
  });

  it('removes Horizon App ID metadata outside Horizon builds', () => {
    const manifest = {
      manifest: {
        application: [
          {
            'meta-data': [
              {
                $: {
                  'android:name': 'com.meta.horizon.platform.ovr.OCULUS_APP_ID',
                  'android:value': '123',
                },
              },
              {
                $: {
                  'android:name': 'dev.iapkit.API_KEY',
                  'android:value': 'key',
                },
              },
            ],
          },
        ],
      },
    };

    expect(syncHorizonAppIdMetaData(manifest, false, '123')).toBe('removed');
    expect(manifest.manifest.application[0]!['meta-data']).toEqual([
      {
        $: {
          'android:name': 'dev.iapkit.API_KEY',
          'android:value': 'key',
        },
      },
    ]);
  });

  it('adds Horizon App ID metadata only for Horizon builds', () => {
    const manifest = {manifest: {}};

    expect(syncHorizonAppIdMetaData(manifest, false, '123')).toBe('unchanged');
    expect(manifest.manifest).not.toHaveProperty('application');

    expect(syncHorizonAppIdMetaData(manifest, true, '123')).toBe('added');
    expect(manifest.manifest.application?.[0]?.['meta-data']).toEqual([
      {
        $: {
          'android:name': 'com.meta.horizon.platform.ovr.OCULUS_APP_ID',
          'android:value': '123',
        },
      },
    ]);
  });

  it('normalizes a single meta-data object before adding Horizon metadata', () => {
    const manifest = {
      manifest: {
        application: [
          {
            'meta-data': {
              $: {
                'android:name': 'dev.iapkit.API_KEY',
                'android:value': 'key',
              },
            },
          },
        ],
      },
    };

    expect(syncHorizonAppIdMetaData(manifest, true, '123')).toBe('added');
    expect(manifest.manifest.application[0]!['meta-data']).toEqual([
      {
        $: {
          'android:name': 'dev.iapkit.API_KEY',
          'android:value': 'key',
        },
      },
      {
        $: {
          'android:name': 'com.meta.horizon.platform.ovr.OCULUS_APP_ID',
          'android:value': '123',
        },
      },
    ]);
  });
});

describe('local OpenIAP configuration', () => {
  it('uses string localPath for Android local module resolution', () => {
    expect(getAndroidLocalPathInput('/repo/packages/google')).toBe(
      '/repo/packages/google',
    );
  });

  it('uses android localPath when platform paths are split', () => {
    expect(
      getAndroidLocalPathInput({
        ios: '/repo/packages/apple',
        android: '/repo/packages/google',
      }),
    ).toBe('/repo/packages/google');
  });
});

describe('ios module selection', () => {
  const createConfig = (ios?: ExpoConfig['ios']): ExpoConfig =>
    ({name: 'test-app', slug: 'test-app', ios}) as ExpoConfig;

  it('defaults to Expo IAP only when no options provided', () => {
    const result = resolveModuleSelection(createConfig(), undefined);
    expect(result).toEqual({
      selection: 'auto',
      includeExpoIap: true,
      includeOnside: false,
    });
  });

  it('inherits existing ios.onside.enabled flag in auto mode', () => {
    const result = resolveModuleSelection(
      createConfig({onside: {enabled: true}}),
      undefined,
    );
    expect(result).toEqual({
      selection: 'auto',
      includeExpoIap: true,
      includeOnside: true,
    });
  });

  it('forces Expo IAP when module option is expo-iap', () => {
    const options: ExpoIapPluginCommonOptions = {module: 'expo-iap'};
    const result = resolveModuleSelection(createConfig(), options);
    expect(result).toEqual({
      selection: 'expo-iap',
      includeExpoIap: true,
      includeOnside: false,
    });
  });

  it('forces Onside when module option is onside', () => {
    const options: ExpoIapPluginCommonOptions = {module: 'onside'};
    const result = resolveModuleSelection(createConfig(), options);
    expect(result).toEqual({
      selection: 'onside',
      includeExpoIap: false,
      includeOnside: true,
    });
  });

  it('enables Onside when modules.onside is true in auto mode', () => {
    const options: ExpoIapPluginCommonOptions = {
      modules: {onside: true},
    };
    const result = resolveModuleSelection(createConfig(), options);
    expect(result).toEqual({
      selection: 'auto',
      includeExpoIap: true,
      includeOnside: true,
    });
  });

  it('disables Onside when modules.onside is false', () => {
    const options: ExpoIapPluginCommonOptions = {
      modules: {onside: false},
    };
    const result = resolveModuleSelection(createConfig(), options);
    expect(result).toEqual({
      selection: 'auto',
      includeExpoIap: true,
      includeOnside: false,
    });
  });

  describe('autolinking computation', () => {
    const entries = (state: AutolinkState) => [
      {name: 'ExpoIapModule', enable: state.expoIap},
      {name: 'ExpoOnsideModule', enable: state.onside},
      {name: 'ExpoIapOnsideModule', enable: state.onside},
    ];

    it('adds missing modules when enabled', () => {
      const result = computeAutolinkModules(
        [],
        entries({
          expoIap: true,
          onside: true,
        }),
      );
      expect(result.modules).toEqual([
        'ExpoIapModule',
        'ExpoOnsideModule',
        'ExpoIapOnsideModule',
      ]);
      expect(result.added).toEqual([
        'ExpoIapModule',
        'ExpoOnsideModule',
        'ExpoIapOnsideModule',
      ]);
      expect(result.removed).toEqual([]);
    });

    it('removes disabled modules while retaining enabled ones', () => {
      const result = computeAutolinkModules(
        ['ExpoIapModule', 'ExpoOnsideModule', 'ExpoIapOnsideModule'],
        entries({expoIap: true, onside: false}),
      );
      expect(result.modules).toEqual(['ExpoIapModule']);
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([
        'ExpoOnsideModule',
        'ExpoIapOnsideModule',
      ]);
    });

    it('preserves unrelated modules when toggling state', () => {
      const result = computeAutolinkModules(
        ['CustomModule'],
        entries({expoIap: false, onside: true}),
      );
      expect(result.modules).toEqual([
        'CustomModule',
        'ExpoOnsideModule',
        'ExpoIapOnsideModule',
      ]);
      expect(result.added).toEqual(['ExpoOnsideModule', 'ExpoIapOnsideModule']);
      expect(result.removed).toEqual([]);
    });
  });
});

describe('ensureOnsidePodIOS', () => {
  const basePodfile = [
    "source 'https://cdn.cocoapods.org/'",
    '',
    "target 'MyApp' do",
    "  pod 'ExpoModulesCore'",
    'end',
    '',
  ].join('\n');

  it('prepends EXPO_IAP_ONSIDE env var', () => {
    const result = ensureOnsidePodIOS(basePodfile);
    expect(result).toContain("ENV['EXPO_IAP_ONSIDE'] = '1'");
    expect(result.indexOf("ENV['EXPO_IAP_ONSIDE']")).toBe(0);
  });

  it('skips if env var already exists', () => {
    const podfileWithEnv = `ENV['EXPO_IAP_ONSIDE'] = '1'\n${basePodfile}`;
    const result = ensureOnsidePodIOS(podfileWithEnv);
    expect(result).toBe(podfileWithEnv);
  });

  it('overwrites env var when value is not 1', () => {
    const podfileWithZero = `ENV['EXPO_IAP_ONSIDE'] = '0'\n${basePodfile}`;
    const result = ensureOnsidePodIOS(podfileWithZero);
    expect(result).toContain("ENV['EXPO_IAP_ONSIDE'] = '1'");
  });

  it('does not modify Podfile when onside is disabled (not called)', () => {
    const enableOnside = false;
    let content = basePodfile;

    if (enableOnside) {
      content = ensureOnsidePodIOS(content);
    }

    expect(content).toBe(basePodfile);
    expect(content).not.toContain('EXPO_IAP_ONSIDE');
  });

  it('modifies Podfile when onside is enabled', () => {
    const enableOnside = true;
    let content = basePodfile;

    if (enableOnside) {
      content = ensureOnsidePodIOS(content);
    }

    expect(content).not.toBe(basePodfile);
    expect(content).toContain("ENV['EXPO_IAP_ONSIDE'] = '1'");
  });
});

describe('vega project generation', () => {
  it('normalizes derived Vega package ids', () => {
    expect(normalizeVegaPackageId('dev.hyo.martie')).toBe('dev.hyo.martie');
    expect(normalizeVegaPackageId('123 bad id')).toBe('app_123.bad.id');
  });

  it('creates a manifest from Expo config defaults', () => {
    const settings = resolveVegaProjectSettings({
      name: 'Expo IAP Example',
      slug: 'expo-iap-example',
      version: '1.0.0',
      icon: './assets/images/icon.png',
      android: {package: 'dev.hyo.martie'},
    } as ExpoConfig);
    const manifest = createVegaManifest(settings);

    expect(settings.packageId).toBe('dev.hyo.martie');
    expect(settings.componentId).toBe('dev.hyo.martie.main');
    expect(settings.appName).toBe('ExpoIAPExample');
    expect(manifest).toContain('id = "dev.hyo.martie"');
    expect(manifest).toContain('icon = "@image/icon.png"');
    expect(manifest).toContain('id = "com.amazon.iap.core.service"');
    expect(manifest).toContain(
      'id = "/com.amazon.kepler.appstore.iap.purchase.core@IAppstoreIAPPurchaseCoreService"',
    );
    expect(createVegaEntryPoint()).toContain(
      'AppRegistry.registerComponent(appName, () => App);',
    );
    expect(createVegaAppJson(settings)).toEqual({
      name: 'ExpoIAPExample',
      displayName: 'Expo IAP Example',
      expoIapGenerated: true,
    });
  });

  it('merges Vega scripts, dependencies, and kepler metadata', () => {
    const settings = resolveVegaProjectSettings({
      name: 'Expo IAP Example',
      slug: 'expo-iap-example',
      android: {package: 'dev.hyo.martie'},
    } as ExpoConfig);
    const result = mergeVegaPackageJson(
      {
        scripts: {start: 'expo start'},
        dependencies: {expo: '^54.0.0'},
        devDependencies: {typescript: '~5.9.2'},
      },
      settings,
    );

    expect(result.scripts?.start).toBe('expo start');
    expect(result.scripts?.['vega:prebuild']).toContain('expo prebuild');
    expect(result.scripts?.['build:vega:release']).toContain('expo prebuild');
    expect(result.scripts?.['build:vega:release']).toContain('build-vega');
    expect(result.scripts?.['run:vega:firetv']).toContain('armv7-debug');
    expect(result.dependencies?.expo).toBe('^54.0.0');
    expect(
      result.dependencies?.['@amazon-devices/keplerscript-appstore-iap-lib'],
    ).toBe('~2.12.13');
    expect(
      result.devDependencies?.['@amazon-devices/kepler-cli-platform'],
    ).toBe('~0.22.0');
    expect(result.kepler?.appName).toBe('ExpoIAPExample');
  });
});
