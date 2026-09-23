import type {ExpoConfig} from '@expo/config-types';
import {compileModsAsync, WarningAggregator} from 'expo/config-plugins';
import plugin, {
  applyOnsideInfoPlist,
  computeAutolinkModules,
  ensureOnsidePodIOS,
  modifyAppBuildGradle,
  normalizeGeneratedGroovyAppBuildGradle,
  normalizeGeneratedGroovyProjectBuildGradle,
  resolveAlternativeBillingIOS,
  resolveAmazonAppstoreKey,
  resolveAmazonPlatformFlags,
  resolveHorizonAppId,
  resolveModuleSelection,
  resolvePinnedAndroidStore,
  storeGradleProperties,
  syncAmazonAppstoreKey,
  resolveVegaProjectOptions,
  syncHorizonAppIdMetaData,
} from '../src/withIAP';
import {getAndroidLocalPathInput} from '../src/withLocalOpenIAP';
import type {
  AutolinkState,
  ExpoIapPluginOptions,
  OnsideInfoPlist,
} from '../src/withIAP';
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
  modules: {onside: true, amazon: {fireOS: false, vegaOS: false}},
};

const groupedAmazonOptions: ExpoIapPluginCommonOptions = {
  modules: {amazon: {fireOS: true, vegaOS: true}},
};

const typedPluginOptions: ExpoIapPluginOptions = {
  iapkitApiKey: 'openiap-kit_test',
  module: 'auto',
  modules: {amazon: {fireOS: false, vegaOS: true}},
  android: {
    amazon: {
      vegaOS: {packageId: 'dev.example.vega'},
    },
  },
};

const typedLegacyAmazonOptions: ExpoIapPluginOptions = {
  module: 'auto',
  android: {
    amazon: {
      fireOS: true,
      vegaOS: false,
    },
  },
};

const explicitModeOptions: ExpoIapPluginCommonOptions = {
  module: 'onside',
};

const invalidExplicitOptions: ExpoIapPluginCommonOptions = {
  modules: {onside: false},
};
void autoModeOptions;
void groupedAmazonOptions;
void typedPluginOptions;
void typedLegacyAmazonOptions;
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
  it('leaves an app build file without OpenIAP lines untouched', () => {
    const baseGradle =
      'android {\n    defaultConfig {\n    }\n}\ndependencies {\n}\n';
    expect(modifyAppBuildGradle(baseGradle, 'groovy')).toBe(baseGradle);
  });

  it('strips the dependency and fixed strategy that older plugin versions wrote', () => {
    const baseGradle = [
      'android {',
      '    defaultConfig {',
      '        missingDimensionStrategy "platform", "amazon"',
      '    }',
      '}',
      'dependencies {',
      '    implementation "io.github.hyochan.openiap:openiap-google-amazon:0.0.1"',
      '    implementation "io.github.hyochan.openiap:openiap-google:0.0.1"',
      '}',
      '',
    ].join('\n');
    const result = modifyAppBuildGradle(baseGradle, 'groovy');

    expect(result).not.toContain('openiap-google');
    expect(result).not.toContain('missingDimensionStrategy');
    expect(result).toContain('dependencies {');
  });

  it('strips Kotlin DSL dependency and strategy lines too', () => {
    const baseGradle = [
      'android {',
      '    defaultConfig {',
      '        missingDimensionStrategy("platform", "horizon")',
      '    }',
      '}',
      'dependencies {',
      '    implementation("io.github.hyochan.openiap:openiap-google-horizon:0.0.1")',
      '}',
      '',
    ].join('\n');
    const result = modifyAppBuildGradle(baseGradle, 'kotlin');

    expect(result).not.toContain('openiap-google');
    expect(result).not.toContain('missingDimensionStrategy');
  });

  it('pins the store only when a module flag asks for it', () => {
    expect(
      resolvePinnedAndroidStore({
        isFireOsEnabled: false,
        isHorizonEnabled: false,
      }),
    ).toBeNull();
    expect(
      resolvePinnedAndroidStore({
        isFireOsEnabled: false,
        isHorizonEnabled: true,
      }),
    ).toBe('horizon');
  });

  it('warns that a module pin is deprecated but still applies it', () => {
    // Dropping the pin silently would move an existing Quest release to Play.
    const warn = WarningAggregator.addWarningAndroid as jest.Mock;
    warn.mockClear();
    plugin({name: 'app', slug: 'app'} as ExpoConfig, {
      modules: {horizon: true},
    });

    expect(warn).toHaveBeenCalledWith(
      'expo-iap',
      expect.stringMatching(
        /modules\.horizon \(or EXPO_IAP_HORIZON\) is deprecated.*ORG_GRADLE_PROJECT_openiapStore=horizon/u,
      ),
    );
  });

  it('does not warn when nothing pins the store', () => {
    const warn = WarningAggregator.addWarningAndroid as jest.Mock;
    warn.mockClear();
    plugin({name: 'app', slug: 'app'} as ExpoConfig, {});

    expect(
      warn.mock.calls.some(([, message]) =>
        /deprecated/u.test(String(message)),
      ),
    ).toBe(false);
  });

  it('refuses two modules naming different stores', () => {
    // An APK links one billing SDK, so picking one silently would ship the
    // other store's users a build that cannot talk to their store.
    expect(() =>
      resolvePinnedAndroidStore({
        isFireOsEnabled: true,
        isHorizonEnabled: true,
      }),
    ).toThrow(/both enabled/u);
  });

  it('fails the prebuild on two store modules instead of skipping every mod', () => {
    // The plugin's catch-all once turned this into a warning and returned the
    // config with no expo-iap changes.
    expect(() =>
      plugin({name: 'app', slug: 'app'} as ExpoConfig, {
        modules: {horizon: true, amazon: {fireOS: true}},
      }),
    ).toThrow(/both enabled/u);
  });

  it('keeps the published iOS setup when enableLocalDev has no localPath', () => {
    const result = plugin({name: 'app', slug: 'app'} as ExpoConfig, {
      enableLocalDev: true,
    }) as ExpoConfig & {mods?: {ios?: Record<string, unknown>}};
    expect(result.mods?.ios?.podfile).toBeDefined();
  });

  it('moves the local pod when localPath moves', async () => {
    const fs = jest.requireActual('fs') as typeof import('fs');
    const os = jest.requireActual('os') as typeof import('os');
    const path = jest.requireActual('path') as typeof import('path');
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-iap-pod-'));
    const podfile = path.join(projectRoot, 'ios', 'Podfile');
    try {
      fs.mkdirSync(path.dirname(podfile), {recursive: true});
      fs.writeFileSync(
        podfile,
        "target 'app' do\n  use_expo_modules!\n\n  pod 'openiap', :path => '../gone/apple'\nend\n",
      );
      const apple = path.resolve(__dirname, '../../../../packages/apple');
      await compileModsAsync(
        plugin({name: 'app', slug: 'app'} as ExpoConfig, {
          enableLocalDev: true,
          localPath: {ios: apple},
        }) as ExpoConfig,
        {projectRoot, platforms: ['ios']},
      );
      expect(fs.readFileSync(podfile, 'utf8')).toContain(
        `pod 'openiap', :path => '${path.relative(
          path.dirname(podfile),
          apple,
        )}'`,
      );
    } finally {
      fs.rmSync(projectRoot, {recursive: true, force: true});
    }
  });

  it("drops an earlier local build's Android wiring on a published prebuild", async () => {
    const fs = jest.requireActual('fs') as typeof import('fs');
    const os = jest.requireActual('os') as typeof import('os');
    const path = jest.requireActual('path') as typeof import('path');
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'expo-iap-local-'),
    );
    const android = path.join(projectRoot, 'android');
    const files: Record<string, string> = {
      'settings.gradle': "rootProject.name = 'app'\ninclude ':app'\n",
      'build.gradle': 'buildscript {\n  repositories {\n    google()\n  }\n}\n',
      'app/build.gradle':
        'android {\n    defaultConfig {\n    }\n}\n\ndependencies {\n}\n',
      'gradle.properties': 'org.gradle.jvmargs=-Xmx2g\n',
      'app/src/main/AndroidManifest.xml':
        '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n  <application android:name=".MainApplication"/>\n</manifest>\n',
    };
    const buildFiles = ['settings.gradle', 'build.gradle', 'app/build.gradle'];
    const read = () =>
      Object.fromEntries(
        buildFiles.map((file) => [
          file,
          fs.readFileSync(path.join(android, file), 'utf8'),
        ]),
      );
    const prebuild = (options: ExpoIapPluginOptions) =>
      compileModsAsync(
        plugin({name: 'app', slug: 'app'} as ExpoConfig, options) as ExpoConfig,
        {projectRoot, platforms: ['android']},
      );
    const local: ExpoIapPluginOptions = {
      enableLocalDev: true,
      localPath: {
        android: path.resolve(__dirname, '../../../../packages/google'),
      },
    };
    try {
      for (const [file, contents] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(android, file)), {recursive: true});
        fs.writeFileSync(path.join(android, file), contents);
      }

      await prebuild(local);
      const linked = read();
      expect(linked['settings.gradle']).toContain("include ':openiap-google'");
      expect(linked['app/build.gradle']).toContain(
        "implementation project(':openiap-google')",
      );
      expect(linked['build.gradle']).toContain('openIapResolveStore');

      // expo-iap links an included :openiap-google in place of Maven.
      await prebuild({});
      const published = read();
      expect(published['settings.gradle']).not.toMatch(
        /include ':openiap-google'|projectDir/,
      );
      expect(published['app/build.gradle']).not.toMatch(
        /openiap-google|openiap-store|openIapResolveStore/,
      );
      expect(published['build.gradle']).toBe(files['build.gradle']);
      expect(published['app/build.gradle']).toBe(files['app/build.gradle']);

      await prebuild(local);
      await prebuild({});
      expect(read()).toEqual(published);

      // A local build that links only the iOS package uses the published Android one.
      await prebuild(local);
      await prebuild({
        enableLocalDev: true,
        localPath: {ios: path.resolve(__dirname, '../../../../packages/apple')},
      });
      expect(read()).toEqual(published);
    } finally {
      fs.rmSync(projectRoot, {recursive: true, force: true});
    }
  });

  it('writes the pin gradle.properties carries, and clears a stale one', () => {
    // The pin is the only file the prebuild leaves behind that selects a store,
    // so a stale key from an earlier prebuild would outrank the device.
    const properties = [
      {type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2g'},
      {type: 'property', key: 'openiapStore', value: 'horizon'},
      // A leftover opt-out would make Gradle refuse the pin outright.
      {type: 'property', key: 'openiapPlatform', value: 'none'},
      {type: 'property', key: 'horizonEnabled', value: 'true'},
      {type: 'property', key: 'fireOsEnabled', value: 'false'},
    ];
    expect(storeGradleProperties(properties, 'amazon')).toEqual([
      {type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2g'},
      {type: 'property', key: 'openiapStore', value: 'amazon'},
    ]);
    expect(storeGradleProperties(properties, null)).toEqual([
      {type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx2g'},
    ]);
  });

  it('reads the Amazon Appstore key path from android.amazon', () => {
    expect(
      resolveAmazonAppstoreKey({
        android: {
          amazon: {appstoreKey: './keys/AppstoreAuthenticationKey.pem'},
        },
      }),
    ).toBe('./keys/AppstoreAuthenticationKey.pem');
    expect(resolveAmazonAppstoreKey({})).toBeUndefined();
  });

  it('removes a copied Amazon key once its source is gone', () => {
    const fs = jest.requireActual('fs') as typeof import('fs');
    const os = jest.requireActual('os') as typeof import('os');
    const path = jest.requireActual('path') as typeof import('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-iap-key-'));
    const source = path.join(dir, 'AppstoreAuthenticationKey.pem');
    const target = path.join(
      dir,
      'android',
      'assets',
      'AppstoreAuthenticationKey.pem',
    );
    try {
      fs.writeFileSync(source, 'key');
      expect(syncAmazonAppstoreKey(source, target)).toBe(true);
      expect(fs.readFileSync(target, 'utf8')).toBe('key');

      // A stale copy would keep verifying with a key the config no longer finds.
      fs.rmSync(source);
      expect(syncAmazonAppstoreKey(source, target)).toBe(false);
      expect(fs.existsSync(target)).toBe(false);
    } finally {
      fs.rmSync(dir, {recursive: true, force: true});
    }
  });

  it('normalizes Expo generated Groovy root Gradle syntax', () => {
    const result = normalizeGeneratedGroovyProjectBuildGradle(
      "allprojects {\n  repositories {\n    maven { url 'https://www.jitpack.io' }\n  }\n}\n",
    );

    expect(result).toContain("maven { url = uri('https://www.jitpack.io') }");
    expect(result).not.toContain("url 'https://www.jitpack.io'");
  });

  it('normalizes Expo generated Groovy app Gradle assignment syntax', () => {
    const result = normalizeGeneratedGroovyAppBuildGradle(
      [
        'android {',
        '    ndkVersion rootProject.ext.ndkVersion',
        '    buildToolsVersion rootProject.ext.buildToolsVersion',
        '    compileSdk rootProject.ext.compileSdkVersion',
        "    namespace = 'dev.hyo.openiap.expo.example'",
        '    defaultConfig {',
        "        applicationId = 'dev.hyo.openiap.expo.example'",
        '        minSdkVersion rootProject.ext.minSdkVersion',
        '        targetSdkVersion rootProject.ext.targetSdkVersion',
        '    }',
        '    buildTypes {',
        '        debug {',
        '            signingConfig signingConfigs.debug',
        '        }',
        '        release {',
        '            shrinkResources enableShrinkResources.toBoolean()',
        '            crunchPngs enablePngCrunchInRelease.toBoolean()',
        '        }',
        '    }',
        '    packagingOptions {',
        '        jniLibs {',
        '            useLegacyPackaging enableLegacyPackaging.toBoolean()',
        '        }',
        '    }',
        '    androidResources {',
        "        ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~'",
        '    }',
        '}',
      ].join('\n'),
    );

    expect(result).toContain('ndkVersion = rootProject.ext.ndkVersion');
    expect(result).toContain('compileSdk = rootProject.ext.compileSdkVersion');
    // namespace/applicationId normalize to method-call form (see withIAP.ts):
    // AGP accepts both, but @expo/config-plugins only parses the no-`=` form.
    expect(result).toContain("namespace 'dev.hyo.openiap.expo.example'");
    expect(result).not.toContain("namespace = 'dev.hyo.openiap.expo.example'");
    expect(result).toContain("applicationId 'dev.hyo.openiap.expo.example'");
    expect(result).not.toContain(
      "applicationId = 'dev.hyo.openiap.expo.example'",
    );
    expect(result).toContain('minSdk = rootProject.ext.minSdkVersion');
    expect(result).toContain('targetSdk = rootProject.ext.targetSdkVersion');
    expect(result).toContain('signingConfig = signingConfigs.debug');
    expect(result).toContain(
      'shrinkResources = enableShrinkResources.toBoolean()',
    );
    expect(result).toContain(
      'crunchPngs = enablePngCrunchInRelease.toBoolean()',
    );
    expect(result).toContain(
      'useLegacyPackaging = enableLegacyPackaging.toBoolean()',
    );
    expect(result).toContain("ignoreAssetsPattern = '!.svn");
    expect(result).not.toContain(
      'compileSdk rootProject.ext.compileSdkVersion',
    );
    expect(result).not.toContain('minSdkVersion rootProject.ext.minSdkVersion');
  });

  it('allows Fire OS and Vega OS to be enabled as Amazon targets', () => {
    expect(
      resolveAmazonPlatformFlags({
        modules: {amazon: {fireOS: true, vegaOS: true}},
      }),
    ).toEqual({
      isFireOsEnabled: true,
      isVegaEnabled: true,
      isHorizonEnabled: false,
      isOnsideEnabled: false,
    });
  });

  it('keeps Onside and Horizon under modules', () => {
    expect(
      resolveAmazonPlatformFlags({
        modules: {horizon: true, onside: true},
      }),
    ).toEqual({
      isFireOsEnabled: false,
      isVegaEnabled: false,
      isHorizonEnabled: true,
      isOnsideEnabled: true,
    });
  });

  it('reports Fire OS and Horizon as both set so the pin can refuse them', () => {
    const flags = resolveAmazonPlatformFlags({
      modules: {
        horizon: true,
        amazon: {fireOS: true, vegaOS: false},
      },
    });

    expect(flags).toEqual({
      isFireOsEnabled: true,
      isVegaEnabled: false,
      isHorizonEnabled: true,
      isOnsideEnabled: false,
    });
    // Gradle and the doctor both fail this combination; silently preferring
    // Fire OS here would ship a store the config never asked for.
    expect(() => resolvePinnedAndroidStore(flags)).toThrow(/both enabled/);
  });

  it('uses Expo IAP platform env flags when module options are absent', () => {
    const previous = {
      fireOS: process.env.EXPO_IAP_FIREOS,
      vega: process.env.EXPO_IAP_VEGA,
      horizon: process.env.EXPO_IAP_HORIZON,
      onside: process.env.EXPO_IAP_ONSIDE,
    };

    process.env.EXPO_IAP_FIREOS = '1';
    process.env.EXPO_IAP_VEGA = '1';
    process.env.EXPO_IAP_HORIZON = '1';
    process.env.EXPO_IAP_ONSIDE = '1';

    try {
      expect(resolveAmazonPlatformFlags(undefined)).toEqual({
        isFireOsEnabled: true,
        isVegaEnabled: true,
        isHorizonEnabled: true,
        isOnsideEnabled: true,
      });
    } finally {
      if (previous.fireOS === undefined) {
        delete process.env.EXPO_IAP_FIREOS;
      } else {
        process.env.EXPO_IAP_FIREOS = previous.fireOS;
      }
      if (previous.vega === undefined) {
        delete process.env.EXPO_IAP_VEGA;
      } else {
        process.env.EXPO_IAP_VEGA = previous.vega;
      }
      if (previous.horizon === undefined) {
        delete process.env.EXPO_IAP_HORIZON;
      } else {
        process.env.EXPO_IAP_HORIZON = previous.horizon;
      }
      if (previous.onside === undefined) {
        delete process.env.EXPO_IAP_ONSIDE;
      } else {
        process.env.EXPO_IAP_ONSIDE = previous.onside;
      }
    }
  });

  it('keeps explicit module flags ahead of Expo IAP platform env flags', () => {
    const previous = process.env.EXPO_IAP_FIREOS;
    process.env.EXPO_IAP_FIREOS = '1';

    try {
      expect(
        resolveAmazonPlatformFlags({
          modules: {amazon: {fireOS: false}},
        }),
      ).toEqual({
        isFireOsEnabled: false,
        isVegaEnabled: false,
        isHorizonEnabled: false,
        isOnsideEnabled: false,
      });
    } finally {
      if (previous === undefined) {
        delete process.env.EXPO_IAP_FIREOS;
      } else {
        process.env.EXPO_IAP_FIREOS = previous;
      }
    }
  });

  it('keeps explicit null module flags ahead of Expo IAP platform env flags', () => {
    const previous = {
      horizon: process.env.EXPO_IAP_HORIZON,
      onside: process.env.EXPO_IAP_ONSIDE,
    };
    process.env.EXPO_IAP_HORIZON = '1';
    process.env.EXPO_IAP_ONSIDE = '1';

    try {
      const options = {
        modules: {horizon: null, onside: null},
      } as unknown as ExpoIapPluginOptions;

      expect(resolveAmazonPlatformFlags(options)).toEqual({
        isFireOsEnabled: false,
        isVegaEnabled: false,
        isHorizonEnabled: false,
        isOnsideEnabled: false,
      });
    } finally {
      if (previous.horizon === undefined) {
        delete process.env.EXPO_IAP_HORIZON;
      } else {
        process.env.EXPO_IAP_HORIZON = previous.horizon;
      }
      if (previous.onside === undefined) {
        delete process.env.EXPO_IAP_ONSIDE;
      } else {
        process.env.EXPO_IAP_ONSIDE = previous.onside;
      }
    }
  });

  it('does not use project overrides as Amazon module-selection flags', () => {
    const options = {
      android: {amazon: {fireOS: true, vegaOS: true}},
    } as unknown as ExpoIapPluginOptions;

    expect(resolveAmazonPlatformFlags(options)).toEqual({
      isFireOsEnabled: false,
      isVegaEnabled: false,
      isHorizonEnabled: false,
      isOnsideEnabled: false,
    });
  });

  it('does not enable Vega OS from metadata overrides alone', () => {
    expect(
      resolveAmazonPlatformFlags({
        android: {
          amazon: {
            vegaOS: {
              packageId: 'dev.example.vega',
            },
          },
        },
      }),
    ).toEqual({
      isFireOsEnabled: false,
      isVegaEnabled: false,
      isHorizonEnabled: false,
      isOnsideEnabled: false,
    });
  });

  it('resolves the canonical Horizon app id', () => {
    expect(
      resolveHorizonAppId({
        android: {
          horizon: {appId: 'canonical'},
        },
      }),
    ).toBe('canonical');
  });

  it('ignores removed Horizon app id aliases', () => {
    const options = {
      android: {horizonAppId: 'removed-android'},
      horizonAppId: 'deprecated-top-level',
    } as unknown as ExpoIapPluginOptions;

    expect(resolveHorizonAppId(options)).toBeUndefined();
  });

  it('does not revive removed Horizon aliases after an explicit canonical null', () => {
    const options = {
      android: {
        horizon: {appId: null},
        horizonAppId: 'removed-android',
      },
      horizonAppId: 'removed-top-level',
    } as unknown as ExpoIapPluginOptions;

    expect(resolveHorizonAppId(options)).toBeUndefined();
  });

  it('ignores the removed iOS alternative-billing alias', () => {
    const options = {
      iosAlternativeBilling: {enabled: true},
    } as unknown as ExpoIapPluginOptions;

    expect(resolveAlternativeBillingIOS(options)).toBeUndefined();
  });

  it('resolves Vega OS project options from android.amazon.vegaOS', () => {
    expect(
      resolveVegaProjectOptions({
        android: {
          amazon: {
            vegaOS: {
              packageId: 'dev.example.vega',
            },
          },
        },
        modules: {amazon: {vegaOS: true}},
      }),
    ).toEqual({packageId: 'dev.example.vega'});
  });

  it('uses Expo config defaults when Vega OS has no project overrides', () => {
    expect(
      resolveVegaProjectOptions({
        modules: {amazon: {vegaOS: true}},
      }),
    ).toBeUndefined();
  });

  it('removes Horizon App ID metadata when no app id is configured', () => {
    const manifest = {
      manifest: {
        application: [
          {
            'meta-data': [
              {
                $: {
                  'android:name': 'com.meta.horizon.platform.HORIZON_APP_ID',
                  'android:value': '123',
                },
              },
              {
                $: {
                  'android:name': 'dev.example.UNRELATED',
                  'android:value': 'preserved',
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

    expect(syncHorizonAppIdMetaData(manifest, undefined)).toBe('removed');
    expect(manifest.manifest.application[0]!['meta-data']).toEqual([
      {
        $: {
          'android:name': 'dev.example.UNRELATED',
          'android:value': 'preserved',
        },
      },
      {
        $: {
          'android:name': 'dev.iapkit.API_KEY',
          'android:value': 'key',
        },
      },
    ]);
  });

  it('adds Horizon App ID metadata whenever an app id is configured', () => {
    const manifest = {manifest: {}};

    expect(syncHorizonAppIdMetaData(manifest, undefined)).toBe('unchanged');
    expect(manifest.manifest).not.toHaveProperty('application');

    expect(syncHorizonAppIdMetaData(manifest, '123')).toBe('added');
    expect(manifest.manifest.application?.[0]?.['meta-data']).toEqual([
      {
        $: {
          'android:name': 'com.meta.horizon.platform.HORIZON_APP_ID',
          'android:value': '123',
        },
      },
    ]);
  });

  it('does not interpret removed Horizon metadata aliases', () => {
    const manifest = {
      manifest: {
        application: [
          {
            'meta-data': [
              {
                $: {
                  'android:name': 'com.meta.horizon.platform.ovr.OCULUS_APP_ID',
                  'android:value': 'old',
                },
              },
              {
                $: {
                  'android:name': 'com.oculus.vr.APP_ID',
                  'android:value': 'old',
                },
              },
            ],
          },
        ],
      },
    };

    expect(syncHorizonAppIdMetaData(manifest, '123')).toBe('added');
    expect(manifest.manifest.application[0]!['meta-data']).toEqual([
      {
        $: {
          'android:name': 'com.meta.horizon.platform.ovr.OCULUS_APP_ID',
          'android:value': 'old',
        },
      },
      {
        $: {
          'android:name': 'com.oculus.vr.APP_ID',
          'android:value': 'old',
        },
      },
      {
        $: {
          'android:name': 'com.meta.horizon.platform.HORIZON_APP_ID',
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

    expect(syncHorizonAppIdMetaData(manifest, '123')).toBe('added');
    expect(manifest.manifest.application[0]!['meta-data']).toEqual([
      {
        $: {
          'android:name': 'dev.iapkit.API_KEY',
          'android:value': 'key',
        },
      },
      {
        $: {
          'android:name': 'com.meta.horizon.platform.HORIZON_APP_ID',
          'android:value': '123',
        },
      },
    ]);
  });
});

describe('Onside iOS configuration', () => {
  it('adds the Onside query and callback schemes idempotently', () => {
    const plist: OnsideInfoPlist = {
      CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
      CFBundleURLTypes: [{CFBundleURLSchemes: ['expo-iap-example']}],
    };

    applyOnsideInfoPlist(plist, 'dev.hyo.martie');
    applyOnsideInfoPlist(plist, 'dev.hyo.martie');

    expect(plist.LSApplicationQueriesSchemes).toEqual(['onside']);
    expect(plist.CFBundleURLTypes).toEqual([
      {CFBundleURLSchemes: ['expo-iap-example']},
      {CFBundleURLSchemes: ['dev.hyo.martie.onside-auth']},
    ]);
  });

  it('does not emit a build-setting placeholder as a callback scheme', () => {
    const plist: OnsideInfoPlist = {
      CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
    };

    applyOnsideInfoPlist(plist);

    expect(plist.LSApplicationQueriesSchemes).toEqual(['onside']);
    expect(plist.CFBundleURLTypes).toEqual([]);
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
    ({name: 'test-app', slug: 'test-app', ios} as ExpoConfig);

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

  it('enables Onside from env fallback in auto mode', () => {
    const previous = process.env.EXPO_IAP_ONSIDE;
    process.env.EXPO_IAP_ONSIDE = '1';

    try {
      const result = resolveModuleSelection(createConfig(), undefined);
      expect(result).toEqual({
        selection: 'auto',
        includeExpoIap: true,
        includeOnside: true,
      });
    } finally {
      if (previous === undefined) {
        delete process.env.EXPO_IAP_ONSIDE;
      } else {
        process.env.EXPO_IAP_ONSIDE = previous;
      }
    }
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
    expect(result.startsWith("ENV['EXPO_IAP_ONSIDE'] = '1'\n")).toBe(true);
    expect(result.match(/EXPO_IAP_ONSIDE/g)).toHaveLength(1);
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
    expect(manifest).toContain('id = "/com.amazon.vega.os@IVega_1_2"');
    expect(manifest).toContain('[os.version]\ntarget = "1.2"\nmin = "1.2"');
    expect(createVegaEntryPoint()).toContain(
      'AppRegistry.registerComponent(appName, () => App);',
    );
    expect(createVegaAppJson(settings)).toEqual({
      name: 'ExpoIAPExample',
      displayName: 'Expo IAP Example',
      expoIapGenerated: true,
    });
  });

  it('merges Vega scripts, dependency buckets, and kepler metadata', () => {
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
    expect(result.scripts?.['run:vega:firetv']).toContain(
      'vega device install-app',
    );
    expect(result.scripts?.['run:vega:firetv']).toContain(
      'vega device launch-app',
    );
    expect(result.dependencies?.expo).toBe('^54.0.0');
    expect(
      result.dependencies?.['@amazon-devices/keplerscript-appstore-iap-lib'],
    ).toBe('~2.13.0');
    expect(
      result.devDependencies?.['@amazon-devices/kepler-cli-platform'],
    ).toBe('~0.22.0');
    expect(
      result.devDependencies?.['@amazon-devices/react-native-kepler'],
    ).toBeUndefined();
    expect(
      result.optionalDependencies?.['@amazon-devices/react-native-kepler'],
    ).toBe('^2.0.0');
    expect(result.kepler?.appName).toBe('ExpoIAPExample');
  });

  it('moves existing react-native-kepler direct dependency into optionalDependencies', () => {
    const settings = resolveVegaProjectSettings({
      name: 'Expo IAP Example',
      slug: 'expo-iap-example',
      android: {package: 'dev.hyo.martie'},
    } as ExpoConfig);
    const result = mergeVegaPackageJson(
      {
        dependencies: {
          '@amazon-devices/keplerscript-appstore-iap-lib': '~2.13.0',
        },
        devDependencies: {
          '@amazon-devices/kepler-cli-platform': '~0.22.0',
          '@amazon-devices/react-native-kepler': '^2.0.0',
        },
      },
      settings,
    );

    expect(
      result.dependencies?.['@amazon-devices/keplerscript-appstore-iap-lib'],
    ).toBe('~2.13.0');
    expect(
      result.devDependencies?.['@amazon-devices/kepler-cli-platform'],
    ).toBe('~0.22.0');
    expect(
      result.devDependencies?.['@amazon-devices/react-native-kepler'],
    ).toBeUndefined();
    expect(
      result.optionalDependencies?.['@amazon-devices/react-native-kepler'],
    ).toBe('^2.0.0');
  });

  it('moves Vega CLI tooling out of optionalDependencies for command discovery', () => {
    const settings = resolveVegaProjectSettings({
      name: 'Expo IAP Example',
      slug: 'expo-iap-example',
      android: {package: 'dev.hyo.martie'},
    } as ExpoConfig);
    const result = mergeVegaPackageJson(
      {
        optionalDependencies: {
          '@amazon-devices/kepler-cli-platform': '~0.22.0',
          '@amazon-devices/kepler-compatibility-metro-config': '^0.0.7',
          '@amazon-devices/kepler-module-resolver-preset': '^0.1.15',
          '@amazon-devices/react-native-kepler': '^2.0.0',
        },
      },
      settings,
    );

    expect(
      result.devDependencies?.['@amazon-devices/kepler-cli-platform'],
    ).toBe('~0.22.0');
    expect(
      result.devDependencies?.[
        '@amazon-devices/kepler-compatibility-metro-config'
      ],
    ).toBe('^0.0.7');
    expect(
      result.devDependencies?.['@amazon-devices/kepler-module-resolver-preset'],
    ).toBe('^0.1.15');
    expect(
      result.optionalDependencies?.['@amazon-devices/kepler-cli-platform'],
    ).toBeUndefined();
    expect(
      result.optionalDependencies?.['@amazon-devices/react-native-kepler'],
    ).toBe('^2.0.0');
  });
});
