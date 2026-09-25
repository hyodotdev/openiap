import {
  ConfigPlugin,
  createRunOncePlugin,
  WarningAggregator,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withGradleProperties,
  withInfoPlist,
  withPodfile,
  withProjectBuildGradle,
} from 'expo/config-plugins';
import type {ExpoConfig} from '@expo/config-types';
import * as fs from 'fs';
import * as path from 'path';
import withLocalOpenIAP, {withoutLocalOpenIAPAndroid} from './withLocalOpenIAP';
import withVega, {type VegaProjectOptions} from './withVega';
import {
  withIosAlternativeBilling,
  type IOSAlternativeBillingConfig,
} from './withIosAlternativeBilling';
import type {ExpoIapPluginCommonOptions} from './expoConfig.augmentation';
import {ensureOnsidePodIOS} from './onsidePodfile';

export {ensureOnsidePodIOS} from './onsidePodfile';

const pkg = require('../../package.json');
const AUTOLINKING_CONFIG_PATH = path.resolve(
  __dirname,
  '../../expo-module.config.json',
);

// Log a message only once per Node process
const logOnce = (() => {
  const printed = new Set<string>();
  return (msg: string) => {
    if (!printed.has(msg)) {
      // stderr, so tools that read the config as JSON from stdout stay intact
      console.error(msg);
      printed.add(msg);
    }
  };
})();

const HORIZON_APP_ID_META_DATA_NAME =
  'com.meta.horizon.platform.HORIZON_APP_ID';

const isHorizonAppIdMetaData = (metaData: any): boolean => {
  return metaData?.$?.['android:name'] === HORIZON_APP_ID_META_DATA_NAME;
};

type AndroidManifestLike = {
  manifest: {
    application?: Record<string, any>[];
  };
};

type HorizonAppIdSyncResult = 'added' | 'updated' | 'removed' | 'unchanged';

export const normalizeGeneratedGroovyProjectBuildGradle = (
  gradle: string,
): string =>
  gradle.replace(
    /maven\s*\{\s*url\s+(['"])https:\/\/www\.jitpack\.io\1\s*\}/g,
    "maven { url = uri('https://www.jitpack.io') }",
  );

export const normalizeGeneratedGroovyAppBuildGradle = (
  gradle: string,
): string => {
  let modified = gradle;
  const replacements: [RegExp, string][] = [
    [
      /^(\s*)ndkVersion\s+rootProject\.ext\.ndkVersion\s*$/gm,
      '$1ndkVersion = rootProject.ext.ndkVersion',
    ],
    [
      /^(\s*)buildToolsVersion\s+rootProject\.ext\.buildToolsVersion\s*$/gm,
      '$1buildToolsVersion = rootProject.ext.buildToolsVersion',
    ],
    [
      /^(\s*)compileSdk\s+rootProject\.ext\.compileSdkVersion\s*$/gm,
      '$1compileSdk = rootProject.ext.compileSdkVersion',
    ],
    // Expo SDK 54 generates assignment syntax for these string properties.
    // AGP accepts both forms, but @expo/config-plugins parses only the
    // method-call form in getApplicationIdAsync and setPackageInBuildGradle.
    // Normalize both so `expo run:android` can still resolve the app id.
    // See hyodotdev/openiap#228.
    [/^(\s*)namespace\s*=\s*(['"][^'"]+['"])\s*$/gm, '$1namespace $2'],
    [/^(\s*)applicationId\s*=\s*(['"][^'"]+['"])\s*$/gm, '$1applicationId $2'],
    [
      /^(\s*)minSdkVersion\s+rootProject\.ext\.minSdkVersion\s*$/gm,
      '$1minSdk = rootProject.ext.minSdkVersion',
    ],
    [
      /^(\s*)targetSdkVersion\s+rootProject\.ext\.targetSdkVersion\s*$/gm,
      '$1targetSdk = rootProject.ext.targetSdkVersion',
    ],
    [
      /^(\s*)signingConfig\s+signingConfigs\.debug\s*$/gm,
      '$1signingConfig = signingConfigs.debug',
    ],
    [
      /^(\s*)shrinkResources\s+enableShrinkResources\.toBoolean\(\)\s*$/gm,
      '$1shrinkResources = enableShrinkResources.toBoolean()',
    ],
    [
      /^(\s*)crunchPngs\s+enablePngCrunchInRelease\.toBoolean\(\)\s*$/gm,
      '$1crunchPngs = enablePngCrunchInRelease.toBoolean()',
    ],
    [
      /^(\s*)useLegacyPackaging\s+enableLegacyPackaging\.toBoolean\(\)\s*$/gm,
      '$1useLegacyPackaging = enableLegacyPackaging.toBoolean()',
    ],
    [
      /^(\s*)ignoreAssetsPattern\s+(['"][^'"]+['"])\s*$/gm,
      '$1ignoreAssetsPattern = $2',
    ],
  ];

  for (const [pattern, replacement] of replacements) {
    modified = modified.replace(pattern, replacement);
  }

  return modified;
};

// The app id is inert outside Quest, so every build carries it.
export function syncHorizonAppIdMetaData(
  manifest: AndroidManifestLike,
  horizonAppId?: string,
): HorizonAppIdSyncResult {
  const application = manifest.manifest.application?.[0];
  if (application?.['meta-data'] && !Array.isArray(application['meta-data'])) {
    application['meta-data'] = [application['meta-data']];
  }
  const existingMetaData = application?.['meta-data'];

  if (!horizonAppId) {
    if (!Array.isArray(existingMetaData)) return 'unchanged';

    const nextMetaData = existingMetaData.filter(
      (metaData) => !isHorizonAppIdMetaData(metaData),
    );
    if (nextMetaData.length === existingMetaData.length || !application) {
      return 'unchanged';
    }

    application['meta-data'] = nextMetaData;
    return 'removed';
  }

  if (
    !manifest.manifest.application ||
    manifest.manifest.application.length === 0
  ) {
    manifest.manifest.application = [{$: {}}];
  }

  const horizonApplication = manifest.manifest.application[0]!;
  if (!horizonApplication['meta-data']) {
    horizonApplication['meta-data'] = [];
  }

  const metaData = horizonApplication['meta-data'];
  const horizonAppIdMeta = {
    $: {
      'android:name': HORIZON_APP_ID_META_DATA_NAME,
      'android:value': horizonAppId,
    },
  };

  const hadExistingAppId = metaData.some(isHorizonAppIdMetaData);
  horizonApplication['meta-data'] = metaData.filter(
    (item: any) => !isHorizonAppIdMetaData(item),
  );
  horizonApplication['meta-data'].push(horizonAppIdMeta);
  return hadExistingAppId ? 'updated' : 'added';
}

const OPENIAP_DEPENDENCY_LINE =
  /^\s*(?:implementation|api)\s*\(?\s*["']io\.github\.hyochan\.openiap:openiap-google(?:-(?:horizon|amazon))?:[^"']+["']\s*\)?\s*$/gm;
const PLATFORM_STRATEGY_LINE =
  /^\s*missingDimensionStrategy\s*\(?\s*["']platform["']\s*,\s*["'](play|horizon|amazon)["']\s*\)?\s*$/gm;

// The expo-iap module owns the OpenIAP dependency and the store choice, so the
// app build file carries neither; a copy an older plugin wrote is removed.
export const modifyAppBuildGradle = (
  gradle: string,
  language: 'groovy' | 'kt',
): string => {
  let modified =
    language === 'groovy'
      ? normalizeGeneratedGroovyAppBuildGradle(gradle)
      : gradle;

  const withoutDependency = modified.replace(OPENIAP_DEPENDENCY_LINE, '');
  if (withoutDependency !== modified) {
    modified = withoutDependency.replace(/\n{3,}/g, '\n\n');
    logOnce(
      '🧹 expo-iap: Removed the OpenIAP dependency from app build.gradle; the module provides it',
    );
  }

  const removedStrategies: string[] = [];
  const withoutStrategy = modified.replace(PLATFORM_STRATEGY_LINE, (line) => {
    removedStrategies.push(line.trim());
    return '';
  });
  if (withoutStrategy !== modified) {
    modified = withoutStrategy;
    logOnce(
      `🧹 expo-iap: Removed fixed platform strategies (${removedStrategies.join('; ')}) — the store is resolved at build time; pin it with openiapStore instead`,
    );
  }

  return modified;
};

export type AndroidStorePin = 'horizon' | 'amazon' | null;

const STORE_PROPERTY_KEYS = [
  'openiapStore',
  'openiapPlatform',
  'horizonEnabled',
  'fireOsEnabled',
];

type GradleProperty = {type: string; key?: string; value?: string};

// A pin outranks everything else, so a key an earlier prebuild left is removed.
export function storeGradleProperties<T extends GradleProperty>(
  properties: T[],
  pinnedStore: AndroidStorePin,
): T[] {
  const kept = properties.filter(
    (item) =>
      item.type !== 'property' || !STORE_PROPERTY_KEYS.includes(item.key ?? ''),
  );
  const removed = properties
    .filter(
      (item) =>
        item.type === 'property' &&
        STORE_PROPERTY_KEYS.includes(item.key ?? ''),
    )
    .map((item) => `${item.key}=${item.value ?? ''}`);
  const netRemoved = pinnedStore
    ? removed.filter((entry) => entry !== `openiapStore=${pinnedStore}`)
    : removed;
  if (netRemoved.length > 0) {
    const suffix = pinnedStore
      ? `re-pinned openiapStore=${pinnedStore}`
      : 'store now resolves automatically';
    logOnce(
      `🧹 expo-iap: Removed stale store properties (${netRemoved.join(', ')}) — ${suffix}`,
    );
  }
  return pinnedStore
    ? [
        ...kept,
        {type: 'property', key: 'openiapStore', value: pinnedStore} as T,
      ]
    : kept;
}
export const AMAZON_APPSTORE_KEY_FILE = 'AppstoreAuthenticationKey.pem';

// Copies the key into the app, or removes the old copy when the source is gone.
export function syncAmazonAppstoreKey(source: string, target: string): boolean {
  if (!fs.existsSync(source)) {
    fs.rmSync(target, {force: true});
    return false;
  }
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(source, target);
  return true;
}

// Amazon reads the key from assets to verify receipts; it is inert elsewhere.
const withAmazonAppstoreKey: ConfigPlugin<string> = (config, keyPath) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const {projectRoot, platformProjectRoot} = config.modRequest;
      const source = path.resolve(projectRoot, keyPath);
      const target = path.join(
        platformProjectRoot,
        'app',
        'src',
        'main',
        'assets',
        AMAZON_APPSTORE_KEY_FILE,
      );
      if (!syncAmazonAppstoreKey(source, target)) {
        WarningAggregator.addWarningAndroid(
          'expo-iap',
          `Amazon Appstore key not found at ${source}; Fire OS builds cannot verify receipts without it.`,
        );
        return config;
      }
      logOnce(
        `✅ expo-iap: Copied ${AMAZON_APPSTORE_KEY_FILE} into android/app/src/main/assets`,
      );
      return config;
    },
  ]);

const withIapAndroid: ConfigPlugin<
  {
    horizonAppId?: string;
    pinnedStore?: AndroidStorePin;
    amazonAppstoreKey?: string;
  } | void
> = (config, props) => {
  const pinnedStore = props?.pinnedStore ?? null;

  config = withProjectBuildGradle(config, (config) => {
    const {language} = config.modResults;
    if (language === 'groovy') {
      config.modResults.contents = normalizeGeneratedGroovyProjectBuildGradle(
        config.modResults.contents,
      );
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    const {language} = config.modResults;
    config.modResults.contents = modifyAppBuildGradle(
      config.modResults.contents,
      language,
    );
    return config;
  });

  config = withGradleProperties(config, (config) => {
    config.modResults = storeGradleProperties(config.modResults, pinnedStore);
    logOnce(
      pinnedStore
        ? `✅ expo-iap: Set openiapStore=${pinnedStore} in gradle.properties`
        : 'ℹ️ expo-iap: No store pin; Gradle picks the store from the task flavor or the connected debug device',
    );
    return config;
  });

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const existingPermissions = manifest.manifest['uses-permission'];
    const permissions = Array.isArray(existingPermissions)
      ? existingPermissions
      : [];
    if (!Array.isArray(existingPermissions) && existingPermissions) {
      permissions.push(existingPermissions);
    }
    manifest.manifest['uses-permission'] = permissions;
    const billingPerm = {$: {'android:name': 'com.android.vending.BILLING'}};

    if (pinnedStore === 'amazon') {
      const nextPermissions = permissions.filter(
        (p) => p.$['android:name'] !== 'com.android.vending.BILLING',
      );
      if (nextPermissions.length !== permissions.length) {
        manifest.manifest['uses-permission'] = nextPermissions;
        logOnce(
          '🧹 Removed com.android.vending.BILLING from AndroidManifest.xml',
        );
      }
    } else {
      const alreadyExists = permissions.some(
        (p) => p.$['android:name'] === 'com.android.vending.BILLING',
      );
      if (!alreadyExists) {
        permissions.push(billingPerm);
        logOnce('✅ Added com.android.vending.BILLING to AndroidManifest.xml');
      } else {
        logOnce(
          'ℹ️ com.android.vending.BILLING already exists in AndroidManifest.xml',
        );
      }
    }

    const horizonAppIdSync = syncHorizonAppIdMetaData(
      manifest,
      props?.horizonAppId,
    );
    if (horizonAppIdSync === 'removed') {
      logOnce(
        `🧹 Removed ${HORIZON_APP_ID_META_DATA_NAME} from AndroidManifest.xml`,
      );
    } else if (horizonAppIdSync === 'updated') {
      logOnce(
        `✅ Updated ${HORIZON_APP_ID_META_DATA_NAME} to ${props?.horizonAppId} in AndroidManifest.xml`,
      );
    } else if (horizonAppIdSync === 'added') {
      logOnce(
        `✅ Added ${HORIZON_APP_ID_META_DATA_NAME}: ${props?.horizonAppId} to AndroidManifest.xml`,
      );
    }

    return config;
  });

  if (props?.amazonAppstoreKey) {
    config = withAmazonAppstoreKey(config, props.amazonAppstoreKey);
  }

  return config;
};

export type AutolinkState = {expoIap: boolean; onside: boolean};

type AutolinkEntry = {name: string; enable: boolean};

export function computeAutolinkModules(
  existing: string[],
  desired: AutolinkEntry[],
): {modules: string[]; added: string[]; removed: string[]} {
  let modules = [...existing];
  const added: string[] = [];
  const removed: string[] = [];

  for (const entry of desired) {
    const hasModule = modules.includes(entry.name);
    if (entry.enable && !hasModule) {
      modules = [...modules, entry.name];
      added.push(entry.name);
    } else if (!entry.enable && hasModule) {
      modules = modules.filter((module) => module !== entry.name);
      removed.push(entry.name);
    }
  }

  return {modules, added, removed};
}

const syncAutolinking = (state: AutolinkState) => {
  const readAutolinkingConfig = (): string | null => {
    try {
      return fs.readFileSync(AUTOLINKING_CONFIG_PATH, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
      throw error;
    }
  };

  try {
    const raw = readAutolinkingConfig();
    if (raw === null) return;
    const config = JSON.parse(raw);
    const iosConfig = config.ios ?? (config.ios = {});
    const existingModules: string[] = Array.isArray(iosConfig.modules)
      ? iosConfig.modules.filter((module: string) => module !== 'OneSideModule')
      : [];

    const desiredEntries: {
      name: string;
      enable: boolean;
      addLog: string;
      removeLog: string;
    }[] = [
      {
        name: 'ExpoIapModule',
        enable: state.expoIap,
        addLog: '🔗 expo-iap: Enabled ExpoIapModule autolinking',
        removeLog: '🧹 expo-iap: Disabled ExpoIapModule autolinking',
      },
      {
        name: 'ExpoOnsideModule',
        enable: state.onside,
        addLog: '🔗 expo-iap: Enabled ExpoOnsideModule autolinking',
        removeLog: '🧹 expo-iap: Disabled ExpoOnsideModule autolinking',
      },
      {
        name: 'ExpoIapOnsideModule',
        enable: state.onside,
        addLog: '🔗 expo-iap: Enabled ExpoIapOnsideModule autolinking',
        removeLog: '🧹 expo-iap: Disabled ExpoIapOnsideModule autolinking',
      },
    ];

    const {
      modules: nextModules,
      added,
      removed,
    } = computeAutolinkModules(
      existingModules,
      desiredEntries.map(({name, enable}) => ({name, enable})),
    );

    for (const name of added) {
      const entry = desiredEntries.find((candidate) => candidate.name === name);
      if (entry) {
        logOnce(entry.addLog);
      }
    }

    for (const name of removed) {
      const entry = desiredEntries.find((candidate) => candidate.name === name);
      if (entry) {
        logOnce(entry.removeLog);
      }
    }

    const existingSubscribers: string[] = Array.isArray(
      iosConfig.appDelegateSubscribers,
    )
      ? iosConfig.appDelegateSubscribers
      : [];
    const desiredSubscribers: {
      name: string;
      enable: boolean;
      addLog: string;
      removeLog: string;
    }[] = [
      {
        name: 'ExpoIapAppDelegateSubscriber',
        enable: state.expoIap,
        addLog: '🔗 expo-iap: Enabled ExpoIapAppDelegateSubscriber',
        removeLog: '🧹 expo-iap: Disabled ExpoIapAppDelegateSubscriber',
      },
      {
        name: 'OnsideAppDelegateSubscriber',
        enable: state.onside,
        addLog: '🔗 expo-iap: Enabled OnsideAppDelegateSubscriber',
        removeLog: '🧹 expo-iap: Disabled OnsideAppDelegateSubscriber',
      },
    ];

    const {
      modules: nextSubscribers,
      added: addedSubscribers,
      removed: removedSubscribers,
    } = computeAutolinkModules(
      existingSubscribers,
      desiredSubscribers.map(({name, enable}) => ({name, enable})),
    );

    for (const name of addedSubscribers) {
      const entry = desiredSubscribers.find(
        (candidate) => candidate.name === name,
      );
      if (entry) {
        logOnce(entry.addLog);
      }
    }

    for (const name of removedSubscribers) {
      const entry = desiredSubscribers.find(
        (candidate) => candidate.name === name,
      );
      if (entry) {
        logOnce(entry.removeLog);
      }
    }

    const modulesChanged = added.length > 0 || removed.length > 0;
    const subscribersChanged =
      addedSubscribers.length > 0 || removedSubscribers.length > 0;

    if (modulesChanged || subscribersChanged) {
      iosConfig.modules = nextModules;
      iosConfig.appDelegateSubscribers = nextSubscribers;
      fs.writeFileSync(
        AUTOLINKING_CONFIG_PATH,
        `${JSON.stringify(config, null, 2)}\n`,
        'utf8',
      );
    }
  } catch (error) {
    WarningAggregator.addWarningIOS(
      'expo-iap',
      `Failed to sync Expo IAP autolinking modules: ${String(error)}`,
    );
  }
};

type WithIapIosOptions = {
  enableOnside?: boolean;
  iosAlternativeBilling?: IOSAlternativeBillingConfig;
};

export type OnsideInfoPlist = {
  CFBundleIdentifier?: string;
  CFBundleURLTypes?: {CFBundleURLSchemes?: string[]}[];
  LSApplicationQueriesSchemes?: string[];
};

export const applyOnsideInfoPlist = (
  plist: OnsideInfoPlist,
  bundleIdentifier?: string,
): OnsideInfoPlist => {
  const queries = (plist.LSApplicationQueriesSchemes ??= []);
  if (!queries.includes('onside')) {
    queries.push('onside');
  }

  const plistBundleIdentifier = plist.CFBundleIdentifier;
  const concretePlistBundleIdentifier =
    plistBundleIdentifier && !plistBundleIdentifier.includes('$(')
      ? plistBundleIdentifier
      : undefined;
  const bundleId = bundleIdentifier || concretePlistBundleIdentifier;
  const callbackScheme = bundleId ? `${bundleId}.onside-auth` : '';
  const urlTypes = (plist.CFBundleURLTypes ??= []);

  if (callbackScheme) {
    const hasCallbackScheme = urlTypes.some(
      (entry) =>
        Array.isArray(entry.CFBundleURLSchemes) &&
        entry.CFBundleURLSchemes.includes(callbackScheme),
    );

    if (!hasCallbackScheme) {
      urlTypes.push({
        CFBundleURLSchemes: [callbackScheme],
      });
    }
  }

  return plist;
};

const withOnsideInfoPlist: ConfigPlugin = (config) =>
  withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults as OnsideInfoPlist;
    const bundleIdentifier = cfg.ios?.bundleIdentifier;
    applyOnsideInfoPlist(plist, bundleIdentifier);

    if (
      !bundleIdentifier &&
      (!plist.CFBundleIdentifier || plist.CFBundleIdentifier.includes('$('))
    ) {
      WarningAggregator.addWarningIOS(
        'expo-iap',
        'Onside callback scheme could not be derived because bundle identifier is empty. Skipping CFBundleURLTypes injection.',
      );
    }

    return cfg;
  });

const withIapIOS: ConfigPlugin<WithIapIosOptions | undefined> = (
  config,
  options,
) => {
  // Add iOS alternative billing configuration if provided
  if (options?.iosAlternativeBilling) {
    config = withIosAlternativeBilling(config, options.iosAlternativeBilling);
  }

  if (options?.enableOnside) {
    config = withOnsideInfoPlist(config);
  }

  return withPodfile(config, (config) => {
    let content = config.modResults.contents;

    // 1) Ensure CocoaPods CDN source is present at the very top
    const cdnLine = `source 'https://cdn.cocoapods.org/'`;
    if (!content.includes(cdnLine)) {
      content = `${cdnLine}\n\n${content}`;
      logOnce('📦 expo-iap: Added CocoaPods CDN source to Podfile');
    }

    // 2) Remove any lingering local OpenIAP pod injection
    const localPodRegex =
      /^\s*pod\s+'openiap'\s*,\s*:path\s*=>\s*['"][^'"]+['"][^\n]*$/gm;
    if (localPodRegex.test(content)) {
      content = content.replace(localPodRegex, '').replace(/\n{3,}/g, '\n\n');
      logOnce('🧹 expo-iap: Removed local OpenIAP pod from Podfile');
    }

    // 3) Optionally install OnsideKit when enabled in config
    if (options?.enableOnside) {
      const updatedContent = ensureOnsidePodIOS(content);
      if (updatedContent !== content) {
        logOnce('📦 expo-iap: Enabled OnsideKit (EXPO_IAP_ONSIDE=1)');
      }
      content = updatedContent;
    }

    config.modResults.contents = content;
    return config;
  });
};

export type ExpoIapPluginOptions = ExpoIapPluginCommonOptions;

export interface ModuleSelectionResult {
  selection: 'auto' | 'expo-iap' | 'onside';
  includeExpoIap: boolean;
  includeOnside: boolean;
}

export type AmazonPlatformFlags = {
  isFireOsEnabled: boolean;
  isVegaEnabled: boolean;
  isHorizonEnabled: boolean;
  isOnsideEnabled: boolean;
};

type AmazonPlatformFlagOptions = ExpoIapPluginOptions;

function isEnvFlagEnabled(name: string): boolean {
  return process.env[name] === '1';
}

function hasOwnKey(
  value: object | null | undefined,
  key: PropertyKey,
): boolean {
  return value != null && Object.prototype.hasOwnProperty.call(value, key);
}

export function resolveAmazonPlatformFlags(
  options?: AmazonPlatformFlagOptions | void,
): AmazonPlatformFlags {
  const moduleAmazon = options?.modules?.amazon;
  const isFireOsEnabled = hasOwnKey(moduleAmazon, 'fireOS')
    ? moduleAmazon?.fireOS === true
    : isEnvFlagEnabled('EXPO_IAP_FIREOS');
  const isVegaEnabled = hasOwnKey(moduleAmazon, 'vegaOS')
    ? moduleAmazon?.vegaOS === true
    : isEnvFlagEnabled('EXPO_IAP_VEGA');
  const modules = options?.modules;
  // Both flags are reported so resolvePinnedAndroidStore can refuse the pair.
  const isHorizonEnabled = hasOwnKey(modules, 'horizon')
    ? modules?.horizon === true
    : isEnvFlagEnabled('EXPO_IAP_HORIZON');
  const isOnsideEnabled = hasOwnKey(modules, 'onside')
    ? modules?.onside === true
    : isEnvFlagEnabled('EXPO_IAP_ONSIDE');

  return {
    isFireOsEnabled,
    isVegaEnabled,
    isHorizonEnabled,
    isOnsideEnabled,
  };
}

export function resolveHorizonAppId(
  options?: ExpoIapPluginOptions | void,
): string | undefined {
  return options?.android?.horizon?.appId ?? undefined;
}

export function resolveAmazonAppstoreKey(
  options?: ExpoIapPluginOptions | void,
): string | undefined {
  return options?.android?.amazon?.appstoreKey ?? undefined;
}

// A module flag pins the store for every build; without one, Gradle picks it.
// The flags are deprecated but still pin, so a Quest or Fire release keeps its store.
export function resolvePinnedAndroidStore(
  flags: Pick<AmazonPlatformFlags, 'isFireOsEnabled' | 'isHorizonEnabled'>,
): AndroidStorePin {
  // An APK links one billing SDK.
  if (flags.isFireOsEnabled && flags.isHorizonEnabled) {
    throw new Error(
      'expo-iap: modules.amazon.fireOS and modules.horizon are both enabled; ' +
        'an Android build links one store, so enable one of them.',
    );
  }
  return flags.isFireOsEnabled
    ? 'amazon'
    : flags.isHorizonEnabled
    ? 'horizon'
    : null;
}

export function deprecatedStorePinWarning(store: 'horizon' | 'amazon'): string {
  const key =
    store === 'horizon'
      ? 'modules.horizon (or EXPO_IAP_HORIZON)'
      : 'modules.amazon.fireOS (or EXPO_IAP_FIREOS)';
  const device = store === 'horizon' ? 'Quest' : 'Fire device';
  return (
    `${key} is deprecated: a local debug build already follows the connected ${device}. ` +
    `Pin every EAS or release build that must target it with ORG_GRADLE_PROJECT_openiapStore=${store} ` +
    `in the build profile env; until then ${key} still pins every build of this prebuild.`
  );
}

export function resolveAlternativeBillingIOS(
  options?: ExpoIapPluginOptions | void,
): IOSAlternativeBillingConfig | undefined {
  return options?.ios?.alternativeBilling ?? undefined;
}

export function resolveVegaProjectOptions(
  options?: ExpoIapPluginOptions | void,
): VegaProjectOptions | undefined {
  const androidAmazon = options?.android?.amazon;

  return androidAmazon?.vegaOS;
}

/**
 * Determines which native modules to include: ExpoIap (StoreKit 2) and/or
 * Onside (iOS alternative billing).
 */
export function resolveModuleSelection(
  config: ExpoConfig,
  options?: ExpoIapPluginCommonOptions | void,
): ModuleSelectionResult {
  const normalizedOptions = (options ?? undefined) as
    | ExpoIapPluginCommonOptions
    | undefined;

  const selection = normalizedOptions?.module ?? 'auto';

  // Determine includeExpoIap based on explicit module selection
  let includeExpoIap = true;
  let includeOnside = false;

  if (selection === 'expo-iap') {
    // Explicit expo-iap: only ExpoIap, no Onside
    includeExpoIap = true;
    includeOnside = false;
  } else if (selection === 'onside') {
    // Explicit onside: only Onside, no ExpoIap
    includeExpoIap = false;
    includeOnside = true;
  } else {
    // Auto mode: ExpoIap always included, Onside based on config
    includeExpoIap = true;
    includeOnside =
      normalizedOptions?.modules?.onside ??
      config.ios?.onside?.enabled ??
      isEnvFlagEnabled('EXPO_IAP_ONSIDE') ??
      false;
  }

  return {selection, includeExpoIap, includeOnside};
}

const withIap: ConfigPlugin<ExpoIapPluginOptions | void> = (
  config,
  options,
) => {
  const {isFireOsEnabled, isVegaEnabled, isHorizonEnabled, isOnsideEnabled} =
    resolveAmazonPlatformFlags(options);
  // Outside the try, whose catch would turn this error into a warning.
  const pinnedStore = resolvePinnedAndroidStore({
    isFireOsEnabled,
    isHorizonEnabled,
  });

  try {
    // Add iapkitApiKey to extra if provided
    if (options?.iapkitApiKey) {
      config.extra = {
        ...config.extra,
        iapkitApiKey: options.iapkitApiKey,
      };
      logOnce('🔑 [expo-iap] Added iapkitApiKey to config.extra');
    }

    const horizonAppId = resolveHorizonAppId(options);
    const amazonAppstoreKey = resolveAmazonAppstoreKey(options);
    if (pinnedStore) {
      WarningAggregator.addWarningAndroid(
        'expo-iap',
        deprecatedStorePinWarning(pinnedStore),
      );
    }
    const iosAlternativeBilling = resolveAlternativeBillingIOS(options);

    logOnce(
      `🔍 [expo-iap] Config values: horizonAppId=${horizonAppId}, pinnedStore=${
        pinnedStore ?? 'auto'
      }, amazonAppstoreKey=${
        amazonAppstoreKey ?? 'none'
      }, isVegaEnabled=${isVegaEnabled}, isOnsideEnabled=${isOnsideEnabled}`,
    );

    const {includeExpoIap, includeOnside} = resolveModuleSelection(
      config as ExpoConfig,
      options,
    );

    const autolinkState: AutolinkState = {
      expoIap: includeExpoIap,
      onside: includeOnside,
    };

    if (includeOnside) {
      config.ios = {
        ...config.ios,
        onside: {
          ...(config.ios?.onside ?? {}),
          enabled: true,
        },
      } as typeof config.ios;
    } else if (config.ios?.onside?.enabled) {
      config.ios.onside.enabled = false;
    }

    // Respect explicit flag; fall back to presence of localPath only when flag is unset
    const isLocalDev = options?.enableLocalDev ?? !!options?.localPath;
    let result = withIapAndroid(config, {
      horizonAppId,
      pinnedStore,
      amazonAppstoreKey,
    });

    // One path per prebuild: the local checkout, or the published packages.
    const localPath = isLocalDev ? options?.localPath : undefined;
    if (isLocalDev && !localPath) {
      WarningAggregator.addWarningIOS(
        'expo-iap',
        'enableLocalDev is true but no localPath provided. Using the published OpenIAP instead.',
      );
    }
    if (localPath) {
      const resolved =
        typeof localPath === 'string'
          ? path.resolve(localPath)
          : {
              ios: localPath.ios ? path.resolve(localPath.ios) : undefined,
              android: localPath.android
                ? path.resolve(localPath.android)
                : undefined,
            };

      const preview =
        typeof resolved === 'string'
          ? resolved
          : `ios=${resolved.ios ?? 'auto'}, android=${
              resolved.android ?? 'auto'
            }`;
      logOnce(`🔧 [expo-iap] Enabling local OpenIAP: ${preview}`);
      if (includeOnside) {
        result = withOnsideInfoPlist(result);
      }
      result = withLocalOpenIAP(result, {
        localPath: resolved,
        iosAlternativeBilling,
        enableOnside: includeOnside,
      });
    } else {
      // Ensure iOS Podfile is set up to resolve public CocoaPods specs
      result = withIapIOS(result, {
        enableOnside: includeOnside,
        iosAlternativeBilling,
      });
      result = withoutLocalOpenIAPAndroid(result);
      if (includeExpoIap) {
        logOnce('📦 [expo-iap] Using OpenIAP from CocoaPods');
      }
    }

    syncAutolinking(autolinkState);

    // Vega generation is auto-detected from the project's manifest.toml; the
    // module flag and EXPO_IAP_VEGA only override it. withVega no-ops for
    // non-Vega projects.
    const moduleAmazon = options?.modules?.amazon;
    const vegaExplicit = hasOwnKey(moduleAmazon, 'vegaOS')
      ? moduleAmazon?.vegaOS === true
      : isEnvFlagEnabled('EXPO_IAP_VEGA')
      ? true
      : undefined;
    const vegaProjectOptions = resolveVegaProjectOptions(options);
    result = withVega(result, {
      ...vegaProjectOptions,
      enabled: vegaExplicit ?? vegaProjectOptions?.enabled,
    });

    return result;
  } catch (error) {
    WarningAggregator.addWarningAndroid(
      'expo-iap',
      `expo-iap plugin encountered an error: ${error}`,
    );
    console.error('expo-iap plugin error:', error);
    return config;
  }
};

export {withIosAlternativeBilling, withIap};
export default createRunOncePlugin(withIap, pkg.name, pkg.version);
