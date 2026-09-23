import {
  ConfigPlugin,
  WarningAggregator,
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
import {ensureOnsidePodIOS} from './onsidePodfile';

/**
 * Plugin to add local OpenIAP pod dependency for development
 * This is only for local development with openiap-apple library
 */
export type LocalPathOption = string | {ios?: string; android?: string};
// Expo's names for a .gradle and a .gradle.kts file.
type GradleLanguage = 'groovy' | 'kt';

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
  // Expo SDK 57 and React Native 0.86 compile their Gradle plugins with
  // Kotlin 2.1.20. The standalone openiap-google build can use a newer
  // compiler, but injecting it into an Expo consumer makes Expo modules load
  // incompatible Kotlin metadata.
  kotlin: '2.1.20',
  vanniktechMavenPublish: '0.37.0',
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
  // Keep the consumer on Expo's compatible Kotlin line. The local module is
  // source-compatible with it even when its standalone publishing build uses
  // a newer Kotlin plugin.
  const kotlin = DEFAULT_ANDROID_GRADLE_PLUGIN_VERSIONS.kotlin;
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

// The resolver ships beside this plugin, so locate it from here instead of
// guessing where the consumer hoisted node_modules.
const OPENIAP_STORE_SCRIPT = path.resolve(
  __dirname,
  '../../android/openiap-store.gradle',
);

export const storeScriptPathFrom = (platformProjectRoot: string): string =>
  path
    .relative(platformProjectRoot, OPENIAP_STORE_SCRIPT)
    .split(path.sep)
    .join('/');

// Every module that links the flavored project applies the resolver itself and
// calls it. The resolver caches its answer on the root project, so they all get
// the same store. Reading a value the root build file computed does not work:
// React Native's root plugin evaluates `:app` before the root script runs.
export const LOCAL_STRATEGY_LINE_GROOVY =
  '          missingDimensionStrategy "platform", openIapStore';
export const LOCAL_STRATEGY_LINE_KOTLIN =
  '            missingDimensionStrategy("platform", openIapStore)';

export const appStoreLines = (
  storeScriptPath: string,
  language: GradleLanguage,
): {apply: string; strategy: string} =>
  language === 'kt'
    ? {
        apply: `apply(from = "${storeScriptPath}")`,
        strategy:
          '        missingDimensionStrategy("platform", ((extra["openIapResolveStore"] as groovy.lang.Closure<*>).call("app") as Map<*, *>)["store"] as String)',
      }
    : {
        apply: `apply from: "${storeScriptPath}"`,
        strategy:
          '        missingDimensionStrategy "platform", openIapResolveStore("app").store',
      };

// Each removal also takes the blank line the local build wrote beside the line,
// so switching between local and published builds leaves the file as it was.
export const removeLocalOpenIapFlavorStrategy = (contents: string): string =>
  contents.replace(
    new RegExp(
      `(?:^[ \\t]*\\n)?${escapeRegExp(
        LOCAL_OPENIAP_FLAVOR_BLOCK_START,
      )}[\\s\\S]*?${escapeRegExp(LOCAL_OPENIAP_FLAVOR_BLOCK_END)}\\n?`,
      'gm',
    ),
    '',
  );

// The expo-iap module links an included :openiap-google in place of Maven, so a
// build that is not local must not keep an earlier local build's wiring.
export const removeLocalOpenIapSettings = (contents: string): string =>
  contents
    .replace(
      /(?:^[ \t]*\n)?^[ \t]*include[ \t]*\(?[ \t]*["']:openiap-google["'][ \t]*\)?[ \t]*\n?/gm,
      '',
    )
    .replace(
      /^[ \t]*project\(["']:openiap-google["']\)\.projectDir[ \t]*=.*\n?/gm,
      '',
    );

export const removeLocalOpenIapAppWiring = (contents: string): string =>
  contents
    .replace(
      /^[ \t]*implementation[ \t]*\(?[ \t]*project\([ \t]*["']:openiap-google["'][ \t]*\)[ \t]*\)?[ \t]*\n?/gm,
      '',
    )
    .replace(
      /^[ \t]*apply[ \t]*(?:from:|\(from = )[ \t]*"[^"]*openiap-store\.gradle"\)?[ \t]*\n?(?:^[ \t]*\n)?/gm,
      '',
    )
    .replace(
      /^[ \t]*missingDimensionStrategy[\s(]{0,4}["']platform["'][^\n]*openIapResolveStore[^\n]*\n?/gm,
      '',
    );

// A localPath that moved must move the pod with it.
export const setLocalOpenIapPodPath = (
  podfile: string,
  relativePath: string,
): string =>
  podfile.replace(
    /(pod\s+'openiap'\s*,\s*:path\s*=>\s*)(['"])[^'"\n]*\2/g,
    (_, prefix: string) => `${prefix}'${relativePath}'`,
  );

// Every Android library module in a local build links the flavor the resolver
// picks when Gradle runs, so the app and expo-iap always agree on one store.
export const ensureLocalOpenIapFlavorStrategy = (
  contents: string,
  storeScriptPath: string,
  language: GradleLanguage = 'groovy',
): string => {
  const cleaned = removeLocalOpenIapFlavorStrategy(contents).trimEnd();

  const strategyBlock =
    language === 'kt'
      ? `apply(from = "${storeScriptPath}")
val openIapStore =
  ((extra["openIapResolveStore"] as groovy.lang.Closure<*>).call("expo-iap") as Map<*, *>)["store"] as String

project(":openiap-google") {
  layout.buildDirectory.set(rootProject.layout.buildDirectory.dir("openiap-google"))
}

subprojects {
  listOf("com.android.library", "com.android.application").forEach { pluginId ->
    plugins.withId(pluginId) {
      extensions.configure<com.android.build.gradle.BaseExtension>("android") {
        defaultConfig {
${LOCAL_STRATEGY_LINE_KOTLIN}
        }
      }
    }
  }
}`
      : `apply from: "${storeScriptPath}"
def openIapStore = openIapResolveStore("expo-iap").store

project(":openiap-google") {
  layout.buildDirectory.set(rootProject.layout.buildDirectory.dir("openiap-google"))
}

subprojects { subproject ->
  ["com.android.library", "com.android.application"].each { pluginId ->
    subproject.plugins.withId(pluginId) {
      subproject.android {
        defaultConfig {
${LOCAL_STRATEGY_LINE_GROOVY}
        }
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
    /** Resolved from modules.onside by withIAP */
    enableOnside?: boolean;
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
  const androidInput = getAndroidLocalPathInput(props?.localPath);
  // The local openiap-google module: from localPath, else beside the app.
  const localAndroidModule = (projectRoot: string): string | null =>
    resolveAndroidModulePath(androidInput) ??
    resolveAndroidModulePath(path.resolve(projectRoot, 'openiap-google'));

  // iOS: inject local pod path with wrapper podspec
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const {platformProjectRoot, projectRoot} = config.modRequest;
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

      let podfileContent: string;
      try {
        podfileContent = fs.readFileSync(podfilePath, 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          throw error;
        }
        console.warn(`⚠️  Podfile not found at ${podfilePath}. Skipping.`);
        return config;
      }

      logOnce(`✅ Using local OpenIAP from: ${iosPath}`);

      let podfileChanged = false;

      if (props?.enableOnside) {
        const updatedContent = ensureOnsidePodIOS(podfileContent);
        if (updatedContent !== podfileContent) {
          podfileContent = updatedContent;
          podfileChanged = true;
          logOnce('📦 expo-iap: Enabled OnsideKit (EXPO_IAP_ONSIDE=1)');
        }
      }

      const relativePath = path
        .relative(platformProjectRoot, iosPath)
        .replace(/\\/g, '/');

      // Check if local OpenIAP pod is already configured
      if (podfileContent.includes("pod 'openiap',")) {
        const updatedContent = setLocalOpenIapPodPath(
          podfileContent,
          relativePath,
        );
        if (updatedContent !== podfileContent) {
          podfileContent = updatedContent;
          podfileChanged = true;
          logOnce(`✅ Moved the local OpenIAP pod to: ${iosPath}`);
        }
        if (podfileChanged) {
          fs.writeFileSync(podfilePath, podfileContent);
        }
        logOnce('✅ Local OpenIAP pod already configured');
        return config;
      }

      const targetRegex =
        /target\s+['"][\w]+['"]\s+do\s*\n\s*use_expo_modules!/;

      if (targetRegex.test(podfileContent)) {
        podfileContent = podfileContent.replace(targetRegex, (match) => {
          return `${match}

  # Local OpenIAP pod for development (added by expo-iap plugin)
  pod 'openiap', :path => '${relativePath}'`;
        });
        podfileChanged = true;
      }

      if (podfileChanged) {
        fs.writeFileSync(podfilePath, podfileContent);
      }

      if (podfileContent.includes("pod 'openiap',")) {
        logOnce(`✅ Added local OpenIAP pod at: ${iosPath}`);
      } else {
        console.warn('⚠️  Could not find target block in Podfile');
      }

      return config;
    },
  ]);

  // Android: include local module and add dependency if available
  config = withSettingsGradle(config, (config) => {
    const androidModulePath = localAndroidModule(config.modRequest.projectRoot);
    if (!androidModulePath) {
      if (androidInput) {
        console.warn(
          `⚠️  Could not resolve Android OpenIAP module at: ${androidInput}. Skipping local Android linkage.`,
        );
      }
      config.modResults.contents = removeLocalOpenIapSettings(
        config.modResults.contents,
      );
      return config;
    }
    const pluginVersions =
      resolveAndroidGradlePluginVersions(androidModulePath);
    const relativeAndroidModulePath = path
      .relative(config.modRequest.platformProjectRoot, androidModulePath)
      .replace(/\\/g, '/');

    // 1) settings.gradle: include and map projectDir
    const settings = config.modResults;
    const settingsLanguage = settings.language;
    const includeLine =
      settingsLanguage === 'kt'
        ? 'include(":openiap-google")'
        : "include ':openiap-google'";
    const projectDirLine =
      settingsLanguage === 'kt'
        ? `project(":openiap-google").projectDir = File(settingsDir, "${relativeAndroidModulePath}")`
        : `project(':openiap-google').projectDir = new File(settingsDir, '${relativeAndroidModulePath}')`;
    const includePattern = /include\s*(?:\(\s*)?["']:openiap-google["']\s*\)?/;
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
    if (!localAndroidModule(config.modRequest.projectRoot)) {
      config.modResults.contents = removeLocalOpenIapAppWiring(
        config.modResults.contents,
      );
      return config;
    }

    const gradle = config.modResults;
    const appLanguage = gradle.language;
    const dependencyLine =
      appLanguage === 'kt'
        ? `    implementation(project(":openiap-google"))`
        : `    implementation project(':openiap-google')`;
    let contents = gradle.contents;

    // `:app` is evaluated before the root build file, so it applies the
    // resolver itself; the resolver caches its answer and every module agrees.
    const {apply: applyLine, strategy: strategyLine} = appStoreLines(
      storeScriptPathFrom(
        path.join(config.modRequest.platformProjectRoot, 'app'),
      ),
      appLanguage,
    );
    const strategyPattern =
      /^[ \t]*missingDimensionStrategy[\s(]{0,4}["']platform["'][^\n]*\n?/gm;
    contents = removeLocalOpenIapAppWiring(contents).replace(
      strategyPattern,
      '',
    );

    const androidBlock = /^(\s*)android\s*\{/m;
    if (androidBlock.test(contents)) {
      contents = contents.replace(androidBlock, (m) => `${applyLine}\n\n${m}`);
    } else {
      contents = `${applyLine}\n\n${contents}`;
    }
    const lines = contents.split('\n');
    const defaultConfigIndex = lines.findIndex((line) =>
      /defaultConfig\s*\{/.test(line),
    );
    if (defaultConfigIndex !== -1) {
      lines.splice(defaultConfigIndex + 1, 0, strategyLine);
      contents = lines.join('\n');
      logOnce('🛠️ expo-iap: Wired app/build.gradle to the store resolver');
    } else {
      WarningAggregator.addWarningAndroid(
        'expo-iap',
        'app/build.gradle has no defaultConfig block, so the local OpenIAP flavor is unselected.',
      );
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
    if (!localAndroidModule(config.modRequest.projectRoot)) {
      config.modResults.contents = removeLocalOpenIapFlavorStrategy(
        config.modResults.contents,
      );
      return config;
    }

    config.modResults.contents = ensureLocalOpenIapFlavorStrategy(
      config.modResults.contents,
      storeScriptPathFrom(config.modRequest.platformProjectRoot),
      config.modResults.language,
    );
    logOnce('🛠️ expo-iap: Added the local OpenIAP build-time flavor strategy');
    return config;
  });

  return config;
};

export const withoutLocalOpenIAPAndroid: ConfigPlugin = (config) => {
  config = withSettingsGradle(config, (config) => {
    config.modResults.contents = removeLocalOpenIapSettings(
      config.modResults.contents,
    );
    return config;
  });
  config = withAppBuildGradle(config, (config) => {
    config.modResults.contents = removeLocalOpenIapAppWiring(
      config.modResults.contents,
    );
    return config;
  });
  return withProjectBuildGradle(config, (config) => {
    config.modResults.contents = removeLocalOpenIapFlavorStrategy(
      config.modResults.contents,
    );
    return config;
  });
};

export default withLocalOpenIAP;
