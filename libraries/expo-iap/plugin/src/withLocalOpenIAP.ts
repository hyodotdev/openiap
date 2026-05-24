import {
  ConfigPlugin,
  withDangerousMod,
  withSettingsGradle,
  withAppBuildGradle,
  withProjectBuildGradle,
} from 'expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';
import {
  withIosAlternativeBilling,
  type IOSAlternativeBillingConfig,
} from './withIosAlternativeBilling';

/**
 * Plugin to add local OpenIAP pod dependency for development
 * This is only for local development with openiap-apple library
 */
export type LocalPathOption = string | {ios?: string; android?: string};
type GradleLanguage = 'groovy' | 'kotlin';

export const getAndroidLocalPathInput = (
  raw?: LocalPathOption,
): string | undefined => {
  return typeof raw === 'string' ? raw : raw?.android;
};

interface AndroidGradlePluginVersions {
  kotlin: string;
  vanniktechMavenPublish: string;
}

const DEFAULT_ANDROID_GRADLE_PLUGIN_VERSIONS: AndroidGradlePluginVersions = {
  kotlin: '2.2.0',
  vanniktechMavenPublish: '0.35.0',
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readGradlePluginVersion = (
  contents: string,
  pluginId: string,
): string | null => {
  const pattern = new RegExp(
    `id\\("${escapeRegExp(pluginId)}"\\)\\s+version\\s+"([^"]+)"`,
  );
  return pattern.exec(contents)?.[1] ?? null;
};

const setGradlePluginVersion = (
  contents: string,
  pluginId: string,
  version: string,
): string => {
  const pattern = new RegExp(
    `id\\("${escapeRegExp(pluginId)}"\\)\\s+version\\s+"[^"]+"`,
    'g',
  );
  return contents.replace(pattern, `id("${pluginId}") version "${version}"`);
};

const resolveAndroidGradlePluginVersions = (
  androidModulePath: string,
): AndroidGradlePluginVersions => {
  const rootBuildGradle = path.resolve(
    androidModulePath,
    '..',
    'build.gradle.kts',
  );
  if (!fs.existsSync(rootBuildGradle)) {
    return DEFAULT_ANDROID_GRADLE_PLUGIN_VERSIONS;
  }

  const contents = fs.readFileSync(rootBuildGradle, 'utf8');
  const kotlin =
    readGradlePluginVersion(contents, 'org.jetbrains.kotlin.android') ??
    DEFAULT_ANDROID_GRADLE_PLUGIN_VERSIONS.kotlin;
  const vanniktechMavenPublish =
    readGradlePluginVersion(contents, 'com.vanniktech.maven.publish') ??
    DEFAULT_ANDROID_GRADLE_PLUGIN_VERSIONS.vanniktechMavenPublish;

  return {kotlin, vanniktechMavenPublish};
};

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

const LOCAL_OPENIAP_FLAVOR_BLOCK_START =
  '// Added by expo-iap (local openiap-google flavor selection)';
const LOCAL_OPENIAP_FLAVOR_BLOCK_END =
  '// End expo-iap local openiap-google flavor selection';

const normalizeGradleLanguage = (language?: string): GradleLanguage =>
  language === 'kotlin' ? 'kotlin' : 'groovy';

export const ensureLocalOpenIapFlavorStrategy = (
  contents: string,
  flavor: 'play' | 'horizon',
  language: GradleLanguage = 'groovy',
): string => {
  const existingBlockPattern = new RegExp(
    `\\n?${escapeRegExp(LOCAL_OPENIAP_FLAVOR_BLOCK_START)}[\\s\\S]*?${escapeRegExp(
      LOCAL_OPENIAP_FLAVOR_BLOCK_END,
    )}\\n?`,
    'gm',
  );
  const cleaned = contents
    .replace(existingBlockPattern, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();

  const strategyBlock =
    language === 'kotlin'
      ? `subprojects {
  plugins.withId("com.android.library") {
    extensions.configure<com.android.build.gradle.LibraryExtension>("android") {
      defaultConfig {
        missingDimensionStrategy("platform", "${flavor}")
      }
    }
  }
}`
      : `subprojects { subproject ->
  subproject.plugins.withId("com.android.library") {
    subproject.android {
      defaultConfig {
        missingDimensionStrategy "platform", "${flavor}"
      }
    }
  }
}`;

  return `${cleaned}

${LOCAL_OPENIAP_FLAVOR_BLOCK_START}
${strategyBlock}
${LOCAL_OPENIAP_FLAVOR_BLOCK_END}
`;
};

const withLocalOpenIAP: ConfigPlugin<
  {
    localPath?: LocalPathOption;
    iosAlternativeBilling?: IOSAlternativeBillingConfig;
    horizonAppId?: string;
    /** Resolved from modules.horizon by withIAP */
    isHorizonEnabled?: boolean;
    /** Resolved from modules.fireOS by withIAP */
    isFireOsEnabled?: boolean;
  } | void
> = (config, props) => {
  // Import and apply iOS alternative billing configuration if provided
  if (props?.iosAlternativeBilling) {
    config = withIosAlternativeBilling(config, props.iosAlternativeBilling);
  }
  // Helper to resolve Android module path
  const resolveAndroidModulePath = (p?: string): string | null => {
    if (!p) return null;
    // Prefer the module directory if it exists
    const candidates = [
      path.join(p, 'openiap-google'),
      path.join(p, 'openiap'),
      p,
    ];
    for (const c of candidates) {
      if (
        fs.existsSync(path.join(c, 'build.gradle')) ||
        fs.existsSync(path.join(c, 'build.gradle.kts'))
      ) {
        return c;
      }
    }
    return null;
  };

  // iOS: inject local pod path with wrapper podspec
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const {platformProjectRoot, projectRoot} = config.modRequest as any;
      const raw = props?.localPath;
      const iosPath =
        (typeof raw === 'string' ? raw : raw?.ios) ||
        path.resolve(projectRoot, 'openiap-apple');
      const podfilePath = path.join(platformProjectRoot, 'Podfile');

      if (!fs.existsSync(iosPath)) {
        console.warn(`⚠️  Local openiap-apple path not found: ${iosPath}`);
        console.warn('   Skipping local pod injection.');
        return config;
      }

      if (!fs.existsSync(podfilePath)) {
        console.warn(`⚠️  Podfile not found at ${podfilePath}. Skipping.`);
        return config;
      }

      logOnce(`✅ Using local OpenIAP from: ${iosPath}`);

      let podfileContent = fs.readFileSync(podfilePath, 'utf8');

      // Check if local OpenIAP pod is already configured
      if (podfileContent.includes("pod 'openiap',")) {
        logOnce('✅ Local OpenIAP pod already configured');
        return config;
      }

      const targetRegex =
        /target\s+['"][\w]+['"]\s+do\s*\n\s*use_expo_modules!/;
      const relativePath = path
        .relative(platformProjectRoot, iosPath)
        .replace(/\\/g, '/');

      if (targetRegex.test(podfileContent)) {
        podfileContent = podfileContent.replace(targetRegex, (match) => {
          return `${match}

  # Local OpenIAP pod for development (added by expo-iap plugin)
  pod 'openiap', :path => '${relativePath}'`;
        });
        fs.writeFileSync(podfilePath, podfileContent);
        logOnce(`✅ Added local OpenIAP pod at: ${iosPath}`);
      } else {
        console.warn('⚠️  Could not find target block in Podfile');
      }

      return config;
    },
  ]);

  // Android: include local module and add dependency if available
  config = withSettingsGradle(config, (config) => {
    const raw = props?.localPath;
    const projectRoot = (config.modRequest as any).projectRoot as string;
    const androidInput = getAndroidLocalPathInput(raw);
    const androidModulePath =
      resolveAndroidModulePath(androidInput) ||
      resolveAndroidModulePath(path.resolve(projectRoot, 'openiap-google')) ||
      null;

    if (!androidModulePath || !fs.existsSync(androidModulePath)) {
      if (androidInput) {
        console.warn(
          `⚠️  Could not resolve Android OpenIAP module at: ${androidInput}. Skipping local Android linkage.`,
        );
      }
      return config;
    }
    const pluginVersions =
      resolveAndroidGradlePluginVersions(androidModulePath);
    const settingsRoot =
      ((config.modRequest as any).platformProjectRoot as string | undefined) ??
      path.join(projectRoot, 'android');
    const relativeAndroidModulePath = path
      .relative(settingsRoot, androidModulePath)
      .replace(/\\/g, '/');

    // 1) settings.gradle: include and map projectDir
    const settings = config.modResults;
    const settingsLanguage = normalizeGradleLanguage(settings.language);
    const includeLine =
      settingsLanguage === 'kotlin'
        ? 'include(":openiap-google")'
        : "include ':openiap-google'";
    const projectDirLine =
      settingsLanguage === 'kotlin'
        ? `project(":openiap-google").projectDir = File(settingsDir, "${relativeAndroidModulePath}")`
        : `project(':openiap-google').projectDir = new File(settingsDir, '${relativeAndroidModulePath}')`;
    const includePattern =
      /include\s*(?:\(\s*)?["']:openiap-google["']\s*\)?/;
    const projectDirPattern =
      /^\s*project\(["']:openiap-google["']\)\.projectDir\s*=.*$/gm;
    let contents = settings.contents ?? '';

    // Ensure pluginManagement has plugin mappings required by the included module
    const injectPluginManagement = () => {
      const header = 'pluginManagement {';
      const needsVannik =
        !/id\s*\(\s*["']com\.vanniktech\.maven\.publish["']/.test(contents);
      const needsKotlinAndroid =
        !/id\s*\(\s*["']org\.jetbrains\.kotlin\.android["']/.test(contents);
      const needsCompose =
        !/id\s*\(\s*["']org\.jetbrains\.kotlin\.plugin\.compose["']/.test(
          contents,
        );
      const needsRepos = !/pluginManagement[\s\S]*?repositories\s*\{/.test(
        contents,
      );

      contents = setGradlePluginVersion(
        contents,
        'com.vanniktech.maven.publish',
        pluginVersions.vanniktechMavenPublish,
      );
      contents = setGradlePluginVersion(
        contents,
        'org.jetbrains.kotlin.android',
        pluginVersions.kotlin,
      );
      contents = setGradlePluginVersion(
        contents,
        'org.jetbrains.kotlin.plugin.compose',
        pluginVersions.kotlin,
      );

      const pluginLines: string[] = [];
      if (needsVannik)
        pluginLines.push(
          `  id("com.vanniktech.maven.publish") version "${pluginVersions.vanniktechMavenPublish}"`,
        );
      if (needsKotlinAndroid)
        pluginLines.push(
          `  id("org.jetbrains.kotlin.android") version "${pluginVersions.kotlin}"`,
        );
      if (needsCompose)
        pluginLines.push(
          `  id("org.jetbrains.kotlin.plugin.compose") version "${pluginVersions.kotlin}"`,
        );

      // If everything already present, skip
      if (pluginLines.length === 0 && !needsRepos) return;

      const pluginsBlock = pluginLines.length
        ? `plugins {\n${pluginLines.join('\n')}\n}`
        : '';
      const reposBlock = `repositories { gradlePluginPortal(); google(); mavenCentral() }`;

      if (contents.includes(header)) {
        contents = contents.replace(/pluginManagement\s*\{/, (m) => {
          let injection =
            m + `\n  // Added by expo-iap (local openiap-google)\n`;
          if (pluginsBlock) injection += `  ${pluginsBlock}\n`;
          if (needsRepos) injection += `  ${reposBlock}\n`;
          return injection;
        });
      } else {
        contents =
          `pluginManagement {\n  // Added by expo-iap (local openiap-google)\n` +
          (pluginsBlock ? `  ${pluginsBlock}\n` : '') +
          `  ${reposBlock}\n}\n\n${contents}`;
      }
    };

    injectPluginManagement();
    if (!includePattern.test(contents)) contents += `\n${includeLine}\n`;
    if (projectDirPattern.test(contents)) {
      contents = contents.replace(projectDirPattern, projectDirLine);
    } else if (!contents.includes(projectDirLine)) {
      contents += `${projectDirLine}\n`;
    }
    settings.contents = contents;
    logOnce(`✅ Linked local Android module at: ${androidModulePath}`);
    return config;
  });

  // 2) app/build.gradle: add implementation project(':openiap-google')
  config = withAppBuildGradle(config, (config) => {
    const projectRoot = (config.modRequest as any).projectRoot as string;
    const raw = props?.localPath;
    const androidInput = getAndroidLocalPathInput(raw);
    const androidModulePath =
      resolveAndroidModulePath(androidInput) ||
      resolveAndroidModulePath(path.resolve(projectRoot, 'openiap-google')) ||
      null;

    if (!androidModulePath || !fs.existsSync(androidModulePath)) {
      return config;
    }

    const gradle = config.modResults;
    const appLanguage = normalizeGradleLanguage(gradle.language);
    const dependencyLine =
      appLanguage === 'kotlin'
        ? `    implementation(project(":openiap-google"))`
        : `    implementation project(':openiap-google')`;
    const flavor = props?.isFireOsEnabled
      ? 'amazon'
      : props?.isHorizonEnabled
        ? 'horizon'
        : 'play';
    const strategyLine =
      appLanguage === 'kotlin'
        ? `        missingDimensionStrategy("platform", "${flavor}")`
        : `        missingDimensionStrategy "platform", "${flavor}"`;

    let contents = gradle.contents;

    // Remove Maven deps for all openiap-google flavors
    // to avoid duplicate classes with local module
    const mavenPattern =
      /^\s*(?:implementation|api)\s*\(?\s*["']io\.github\.hyochan\.openiap:openiap-google(?:-(?:horizon|amazon))?:[^"']+["']\s*\)?\s*$/gm;
    if (mavenPattern.test(contents)) {
      contents = contents.replace(mavenPattern, '\n');
      logOnce(
        '🧹 Removed Maven openiap-google* dependencies (using local module)',
      );
    }

    // Add missingDimensionStrategy (required for flavored module)
    // Remove any existing platform strategies first to avoid duplicates
    const strategyPattern =
      /^\s*missingDimensionStrategy\s*\(?\s*["']platform["']\s*,\s*["'](play|horizon|amazon)["']\s*\)?\s*$/gm;
    if (strategyPattern.test(contents)) {
      contents = contents.replace(strategyPattern, '');
      logOnce('🧹 Removed existing missingDimensionStrategy for platform');
    }

    if (!contents.includes(strategyLine)) {
      const lines = contents.split('\n');
      const idx = lines.findIndex((line) => line.match(/defaultConfig\s*\{/));
      if (idx !== -1) {
        lines.splice(idx + 1, 0, strategyLine);
        contents = lines.join('\n');
        logOnce(
          `🛠️ expo-iap: Added missingDimensionStrategy for ${flavor} flavor`,
        );
      }
    }

    // Add project dependency
    if (!contents.includes(dependencyLine)) {
      const anchor = /dependencies\s*\{/m;
      if (anchor.test(contents)) {
        contents = contents.replace(anchor, (m) => `${m}\n${dependencyLine}`);
      } else {
        contents += `\n\ndependencies {\n${dependencyLine}\n}\n`;
      }
      logOnce('🛠️ Added dependency on local :openiap-google project');
    }

    gradle.contents = contents;
    return config;
  });

  // 2b) project build.gradle: Expo autolinked library modules can consume the
  // local flavored OpenIAP module transitively, so give them the same default.
  config = withProjectBuildGradle(config, (config) => {
    const projectRoot = (config.modRequest as any).projectRoot as string;
    const raw = props?.localPath;
    const androidInput = getAndroidLocalPathInput(raw);
    const androidModulePath =
      resolveAndroidModulePath(androidInput) ||
      resolveAndroidModulePath(path.resolve(projectRoot, 'openiap-google')) ||
      null;

    if (!androidModulePath || !fs.existsSync(androidModulePath)) {
      return config;
    }

    const flavor = props?.isFireOsEnabled
      ? 'amazon'
      : props?.isHorizonEnabled
        ? 'horizon'
        : 'play';
    config.modResults.contents = ensureLocalOpenIapFlavorStrategy(
      config.modResults.contents,
      flavor,
      normalizeGradleLanguage(config.modResults.language),
    );
    logOnce(
      `🛠️ expo-iap: Added local OpenIAP flavor strategy for ${flavor}`,
    );
    return config;
  });

  // 3) Set store flags in gradle.properties
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const {platformProjectRoot} = config.modRequest as any;
      const gradlePropertiesPath = path.join(
        platformProjectRoot,
        'gradle.properties',
      );

      if (fs.existsSync(gradlePropertiesPath)) {
        let contents = fs.readFileSync(gradlePropertiesPath, 'utf8');
        const isHorizon = props?.isHorizonEnabled ?? false;
        const isFireOS = props?.isFireOsEnabled ?? false;

        contents = contents.replace(/^horizonEnabled=.*$/gm, '');
        contents = contents.replace(/^fireOsEnabled=.*$/gm, '');
        if (!contents.endsWith('\n')) contents += '\n';
        contents += `horizonEnabled=${isHorizon}\n`;
        contents += `fireOsEnabled=${isFireOS}\n`;

        fs.writeFileSync(gradlePropertiesPath, contents);
        logOnce(
          `🛠️ expo-iap: Set horizonEnabled=${isHorizon} in gradle.properties`,
        );
        logOnce(
          `🛠️ expo-iap: Set fireOsEnabled=${isFireOS} in gradle.properties`,
        );
      }

      return config;
    },
  ]);

  return config;
};

export default withLocalOpenIAP;
