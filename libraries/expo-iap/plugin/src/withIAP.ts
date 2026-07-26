import {
  ConfigPlugin,
  createRunOncePlugin,
  WarningAggregator,
  withAndroidManifest,
  withAppBuildGradle,
  withGradleProperties,
  withInfoPlist,
  withPodfile,
  withProjectBuildGradle,
} from 'expo/config-plugins';
import type {ExpoConfig} from '@expo/config-types';
import * as fs from 'fs';
import * as path from 'path';
import withLocalOpenIAP from './withLocalOpenIAP';
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
      console.log(msg);
      printed.add(msg);
    }
  };
})();

const emittedLegacyPluginWarnings = new Set<string>();

function addLegacyPluginWarningOnce(
  platform: 'android' | 'ios',
  key: string,
  message: string,
): void {
  const warningKey = `${platform}:${key}`;
  if (emittedLegacyPluginWarnings.has(warningKey)) {
    return;
  }
  emittedLegacyPluginWarnings.add(warningKey);
  if (platform === 'android') {
    WarningAggregator.addWarningAndroid('expo-iap', message);
  } else {
    WarningAggregator.addWarningIOS('expo-iap', message);
  }
}

const addLineToGradle = (
  content: string,
  anchor: RegExp | string,
  lineToAdd: string,
  offset: number = 1,
): string => {
  const lines = content.split('\n');
  const index = lines.findIndex((line) => line.match(anchor));
  if (index === -1) {
    WarningAggregator.addWarningAndroid(
      'expo-iap',
      `dependencies { ... } block not found; skipping injection: ${lineToAdd.trim()}`,
    );
    return content;
  } else {
    lines.splice(index + offset, 0, lineToAdd);
  }
  return lines.join('\n');
};

const HORIZON_APP_ID_META_DATA_NAME =
  'com.meta.horizon.platform.HORIZON_APP_ID';
const LEGACY_HORIZON_APP_ID_META_DATA_NAMES = new Set([
  'com.meta.horizon.platform.ovr.OCULUS_APP_ID',
  'com.meta.horizon.platform.ovr.HORIZON_APP_ID',
  'com.oculus.vr.APP_ID',
]);

const isHorizonAppIdMetaData = (metaData: any): boolean => {
  const name = metaData?.$?.['android:name'];
  return (
    name === HORIZON_APP_ID_META_DATA_NAME ||
    LEGACY_HORIZON_APP_ID_META_DATA_NAMES.has(name)
  );
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
  const replacements: Array<[RegExp, string]> = [
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
    // Note: `namespace` and `applicationId` are intentionally left in
    // method-call form. AGP accepts both, but @expo/config-plugins parses them
    // with regexes that only match the no-`=` form (getApplicationIdAsync and
    // setPackageInBuildGradle), so converting them breaks `expo run:android`
    // app-id resolution. See hyodotdev/openiap#228.
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

export function syncHorizonAppIdMetaData(
  manifest: AndroidManifestLike,
  isHorizonEnabled?: boolean,
  horizonAppId?: string,
): HorizonAppIdSyncResult {
  const application = manifest.manifest.application?.[0];
  if (application?.['meta-data'] && !Array.isArray(application['meta-data'])) {
    application['meta-data'] = [application['meta-data']];
  }
  const existingMetaData = application?.['meta-data'];

  if (!isHorizonEnabled) {
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

  if (!horizonAppId) return 'unchanged';

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

export const modifyAppBuildGradle = (
  gradle: string,
  language: 'groovy' | 'kotlin',
  isHorizonEnabled?: boolean,
  isFireOsEnabled?: boolean,
): string => {
  function loadOpenIapAndroidVersion(): string {
    try {
      const parsed = require('../../openiap-versions.json');
      const googleVersion =
        typeof parsed?.google === 'string' ? parsed.google.trim() : '';
      if (!googleVersion) {
        throw new Error(
          'expo-iap: "google" version missing or invalid in openiap-versions.json',
        );
      }
      return googleVersion;
    } catch (error) {
      throw new Error(
        `expo-iap: Unable to load openiap-versions.json (${
          error instanceof Error ? error.message : error
        })`,
      );
    }
  }

  let modified =
    language === 'groovy'
      ? normalizeGeneratedGroovyAppBuildGradle(gradle)
      : gradle;

  let openIapAndroidVersion: string;
  try {
    openIapAndroidVersion = loadOpenIapAndroidVersion();
  } catch (error) {
    WarningAggregator.addWarningAndroid(
      'expo-iap',
      `expo-iap: Failed to resolve OpenIAP version (${
        error instanceof Error ? error.message : error
      })`,
    );
    return gradle;
  }

  let flavor: 'amazon' | 'horizon' | 'play' = 'play';
  let artifactId:
    | 'openiap-google-amazon'
    | 'openiap-google-horizon'
    | 'openiap-google' = 'openiap-google';
  if (isFireOsEnabled) {
    flavor = 'amazon';
    artifactId = 'openiap-google-amazon';
  } else if (isHorizonEnabled) {
    flavor = 'horizon';
    artifactId = 'openiap-google-horizon';
  }

  // Ensure OpenIAP dependency exists at desired version in app-level build.gradle(.kts)
  const impl = (ga: string, v: string) =>
    language === 'kotlin'
      ? `    implementation("${ga}:${v}")`
      : `    implementation "${ga}:${v}"`;
  const openiapDep = impl(
    `io.github.hyochan.openiap:${artifactId}`,
    openIapAndroidVersion,
  );

  // Remove any existing openiap-google flavor lines (any version, groovy/kotlin, implementation/api)
  const openiapAnyLine =
    /^\s*(?:implementation|api)\s*\(?\s*["']io\.github\.hyochan\.openiap:openiap-google(?:-(?:horizon|amazon))?:[^"']+["']\s*\)?\s*$/gm;
  const withoutExistingOpeniap = modified.replace(openiapAnyLine, '');
  const hadExisting = withoutExistingOpeniap !== modified;
  if (hadExisting) {
    modified = withoutExistingOpeniap.replace(/\n{3,}/g, '\n\n');
  }

  // Ensure the desired dependency line is present
  if (
    !new RegExp(
      String.raw`io\.github\.hyochan\.openiap:${artifactId}:${openIapAndroidVersion}`,
    ).test(modified)
  ) {
    // Insert just after the opening `dependencies {` line
    modified = addLineToGradle(modified, /dependencies\s*{/, openiapDep, 1);
    logOnce(
      hadExisting
        ? `🛠️ expo-iap: Replaced OpenIAP dependency with ${openIapAndroidVersion}`
        : `🛠️ expo-iap: Added OpenIAP dependency (${openIapAndroidVersion}) to build.gradle`,
    );
  }

  // Remove stale OpenIAP platform strategies even when returning to the default
  // Play artifact. Otherwise a previous Fire OS/Horizon prebuild can keep
  // selecting the wrong local flavor.
  const strategyPattern =
    /^\s*missingDimensionStrategy\s*\(?\s*["']platform["']\s*,\s*["'](play|horizon|amazon)["']\s*\)?\s*$/gm;
  const withoutExistingStrategy = modified.replace(strategyPattern, '');
  if (withoutExistingStrategy !== modified) {
    modified = withoutExistingStrategy;
    logOnce('🧹 Removed existing missingDimensionStrategy for platform');
  }

  const defaultConfigRegex = /defaultConfig\s*{/;
  if (defaultConfigRegex.test(modified)) {
    const strategyLine =
      language === 'kotlin'
        ? `        missingDimensionStrategy("platform", "${flavor}")`
        : `        missingDimensionStrategy "platform", "${flavor}"`;

    // Add the new strategy
    if (!/missingDimensionStrategy.*platform/.test(modified)) {
      modified = addLineToGradle(modified, defaultConfigRegex, strategyLine, 1);
      logOnce(
        `🛠️ expo-iap: Added missingDimensionStrategy for ${flavor} flavor`,
      );
    }
  }

  return modified;
};

const withIapAndroid: ConfigPlugin<
  {
    addDeps?: boolean;
    horizonAppId?: string;
    isHorizonEnabled?: boolean;
    isFireOsEnabled?: boolean;
  } | void
> = (config, props) => {
  const addDeps = props?.addDeps ?? true;

  config = withProjectBuildGradle(config, (config) => {
    const language = (config.modResults as any).language || 'groovy';
    if (language === 'groovy') {
      config.modResults.contents = normalizeGeneratedGroovyProjectBuildGradle(
        config.modResults.contents,
      );
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    const language = (config.modResults as any).language || 'groovy';
    const normalized =
      language === 'groovy'
        ? normalizeGeneratedGroovyAppBuildGradle(config.modResults.contents)
        : config.modResults.contents;

    config.modResults.contents = addDeps
      ? modifyAppBuildGradle(
          normalized,
          language,
          props?.isHorizonEnabled,
          props?.isFireOsEnabled,
        )
      : normalized;

    return config;
  });

  // Set store flags in gradle.properties so expo-iap module can pick them up.
  config = withGradleProperties(config, (config) => {
    const horizonValue = props?.isHorizonEnabled ?? false;
    const fireOsValue = props?.isFireOsEnabled ?? false;

    config.modResults = config.modResults.filter(
      (item) =>
        item.type !== 'property' ||
        !['horizonEnabled', 'fireOsEnabled'].includes(item.key),
    );

    config.modResults.push({
      type: 'property',
      key: 'horizonEnabled',
      value: String(horizonValue),
    });
    config.modResults.push({
      type: 'property',
      key: 'fireOsEnabled',
      value: String(fireOsValue),
    });

    logOnce(`✅ Set horizonEnabled=${horizonValue} in gradle.properties`);
    logOnce(`✅ Set fireOsEnabled=${fireOsValue} in gradle.properties`);

    return config;
  });

  // Note: missingDimensionStrategy for local dev is handled in withLocalOpenIAP

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

    if (props?.isFireOsEnabled) {
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
      props?.isHorizonEnabled,
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
  if (!fs.existsSync(AUTOLINKING_CONFIG_PATH)) {
    return;
  }

  try {
    const raw = fs.readFileSync(AUTOLINKING_CONFIG_PATH, 'utf8');
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

type AmazonPlatformFlagOptions = Pick<
  ExpoIapPluginOptions,
  'android' | 'modules'
>;

interface LegacyAndroidAmazonOptions {
  fireOS?: boolean;
  vegaOS?: boolean | VegaProjectOptions;
}

interface LegacyAmazonPlatformFlagOptions {
  android?: {
    amazon?: LegacyAndroidAmazonOptions;
  };
  modules?: ExpoIapPluginOptions['modules'];
}

type AmazonPlatformFlagInput =
  | AmazonPlatformFlagOptions
  | LegacyAmazonPlatformFlagOptions;

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
  options?: AmazonPlatformFlagInput | void,
): AmazonPlatformFlags {
  const androidAmazon = options?.android?.amazon;
  const legacyAndroidAmazon: LegacyAndroidAmazonOptions | undefined =
    androidAmazon;
  const moduleAmazon = options?.modules?.amazon;
  const isFireOsEnabled = hasOwnKey(moduleAmazon, 'fireOS')
    ? moduleAmazon?.fireOS === true
    : legacyAndroidAmazon?.fireOS ?? isEnvFlagEnabled('EXPO_IAP_FIREOS');
  const legacyAndroidVegaFlag =
    typeof legacyAndroidAmazon?.vegaOS === 'boolean'
      ? legacyAndroidAmazon.vegaOS
      : undefined;
  const isVegaEnabled = hasOwnKey(moduleAmazon, 'vegaOS')
    ? moduleAmazon?.vegaOS === true
    : legacyAndroidVegaFlag ?? isEnvFlagEnabled('EXPO_IAP_VEGA');
  const modules = options?.modules;
  const isHorizonEnabled = isFireOsEnabled
    ? false
    : hasOwnKey(modules, 'horizon')
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
  const canonicalHorizon = options?.android?.horizon;
  if (hasOwnKey(canonicalHorizon, 'appId')) {
    return canonicalHorizon?.appId ?? undefined;
  }

  const androidOptions = options?.android;
  if (hasOwnKey(androidOptions, 'horizonAppId')) {
    return androidOptions?.horizonAppId ?? undefined;
  }

  return options?.horizonAppId;
}

export function resolveAlternativeBillingIOS(
  options?: ExpoIapPluginOptions | void,
): IOSAlternativeBillingConfig | undefined {
  const iosOptions = options?.ios;
  if (hasOwnKey(iosOptions, 'alternativeBilling')) {
    return iosOptions?.alternativeBilling ?? undefined;
  }

  return options?.iosAlternativeBilling;
}

export function resolveVegaProjectOptions(
  options?: ExpoIapPluginOptions | void,
): VegaProjectOptions | undefined {
  const androidAmazon = options?.android?.amazon;

  return typeof androidAmazon?.vegaOS === 'object'
    ? androidAmazon.vegaOS
    : undefined;
}

export function warnLegacyPluginOptions(
  options?: ExpoIapPluginOptions | void,
): void {
  const legacyOptions = options as
    | {
        android?: {
          amazon?: LegacyAndroidAmazonOptions;
          horizonAppId?: string;
        };
        horizonAppId?: string;
        iosAlternativeBilling?: IOSAlternativeBillingConfig;
      }
    | undefined;
  const legacyAmazon = legacyOptions?.android?.amazon;

  if (legacyAmazon?.fireOS !== undefined) {
    addLegacyPluginWarningOnce(
      'android',
      'android.amazon.fireOS',
      'android.amazon.fireOS is deprecated and will be removed in expo-iap 5.0.0. Use modules.amazon.fireOS instead.',
    );
  }
  if (typeof legacyAmazon?.vegaOS === 'boolean') {
    addLegacyPluginWarningOnce(
      'android',
      'android.amazon.vegaOS.boolean',
      'The boolean form of android.amazon.vegaOS is deprecated and will be removed in expo-iap 5.0.0. Use modules.amazon.vegaOS instead; the object form remains supported for Vega project overrides.',
    );
  }
  if (legacyOptions?.android?.horizonAppId !== undefined) {
    addLegacyPluginWarningOnce(
      'android',
      'android.horizonAppId',
      'android.horizonAppId is deprecated and will be removed in expo-iap 5.0.0. Use android.horizon.appId instead.',
    );
  }
  if (legacyOptions?.horizonAppId !== undefined) {
    addLegacyPluginWarningOnce(
      'android',
      'horizonAppId',
      'horizonAppId is deprecated and will be removed in expo-iap 5.0.0. Use android.horizon.appId instead.',
    );
  }
  if (legacyOptions?.iosAlternativeBilling !== undefined) {
    addLegacyPluginWarningOnce(
      'ios',
      'iosAlternativeBilling',
      'iosAlternativeBilling is deprecated and will be removed in expo-iap 5.0.0. Use ios.alternativeBilling instead.',
    );
  }
}

/**
 * Determines which modules to include based on configuration.
 * - ExpoIap: Always included (standard StoreKit 2 support)
 * - Onside: Only when modules.onside is true (iOS alternative billing)
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
  warnLegacyPluginOptions(options);
  const {isFireOsEnabled, isVegaEnabled, isHorizonEnabled, isOnsideEnabled} =
    resolveAmazonPlatformFlags(options);

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
    const iosAlternativeBilling = resolveAlternativeBillingIOS(options);

    logOnce(
      `🔍 [expo-iap] Config values: horizonAppId=${horizonAppId}, isHorizonEnabled=${isHorizonEnabled}, isFireOsEnabled=${isFireOsEnabled}, isVegaEnabled=${isVegaEnabled}, isOnsideEnabled=${isOnsideEnabled}`,
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
    // Apply Android modifications (skip adding deps when linking local module)
    let result = withIapAndroid(config, {
      addDeps: !isLocalDev,
      horizonAppId,
      isHorizonEnabled,
      isFireOsEnabled,
    });

    // iOS: choose one path to avoid overlap
    if (isLocalDev) {
      if (!options?.localPath) {
        WarningAggregator.addWarningIOS(
          'expo-iap',
          'enableLocalDev is true but no localPath provided. Skipping local OpenIAP integration.',
        );
      } else {
        const raw = options.localPath;
        const resolved =
          typeof raw === 'string'
            ? path.resolve(raw)
            : {
                ios: raw.ios ? path.resolve(raw.ios) : undefined,
                android: raw.android ? path.resolve(raw.android) : undefined,
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
          horizonAppId,
          isHorizonEnabled,
          isFireOsEnabled,
          enableOnside: includeOnside,
        });
      }
    } else {
      // Ensure iOS Podfile is set up to resolve public CocoaPods specs
      result = withIapIOS(result, {
        enableOnside: includeOnside,
        iosAlternativeBilling,
      });
      if (includeExpoIap) {
        logOnce('📦 [expo-iap] Using OpenIAP from CocoaPods');
      }
    }

    syncAutolinking(autolinkState);

    if (isVegaEnabled) {
      result = withVega(result, resolveVegaProjectOptions(options));
    }

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
