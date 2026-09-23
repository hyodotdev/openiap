import {
  appStoreLines,
  ensureLocalOpenIapFlavorStrategy,
  LOCAL_STRATEGY_LINE_GROOVY,
  LOCAL_STRATEGY_LINE_KOTLIN,
  removeLocalOpenIapAppWiring,
  removeLocalOpenIapFlavorStrategy,
  removeLocalOpenIapSettings,
  setLocalOpenIapPodPath,
  storeScriptPathFrom,
} from '../withLocalOpenIAP';

describe('ensureLocalOpenIapFlavorStrategy', () => {
  const scriptPath = '../node_modules/expo-iap/android/openiap-store.gradle';
  const baseProjectBuildGradle = [
    '// Top-level build file where you can add configuration options common to all sub-projects/modules.',
    '',
    'buildscript {',
    '  repositories {',
    '    google()',
    '    mavenCentral()',
    '  }',
    '}',
    '',
  ].join('\n');

  it('applies the resolver once and shares the resolved store', () => {
    const result = ensureLocalOpenIapFlavorStrategy(
      baseProjectBuildGradle,
      scriptPath,
    );

    expect(result).toContain(`apply from: "${scriptPath}"`);
    expect(result).toContain(
      'def openIapStore = openIapResolveStore("expo-iap").store',
    );
    expect(result).toContain('subprojects { subproject ->');
    // The app module is an application, not a library, and needs the strategy too.
    expect(result).toContain(
      '["com.android.library", "com.android.application"].each { pluginId ->',
    );
    expect(result).toContain(LOCAL_STRATEGY_LINE_GROOVY.trim());
    expect(result).not.toMatch(
      /missingDimensionStrategy "platform", "(play|horizon|amazon)"/,
    );
    expect(result).toMatch(
      /project\(":openiap-google"\)\s*\{\s*layout\.buildDirectory\.set\(rootProject\.layout\.buildDirectory\.dir\("openiap-google"\)\)\s*\}/,
    );
  });

  it('emits Kotlin DSL for Kotlin project build files', () => {
    const result = ensureLocalOpenIapFlavorStrategy(
      baseProjectBuildGradle,
      scriptPath,
      'kt',
    );

    expect(result).toContain(`apply(from = "${scriptPath}")`);
    expect(result).toContain('val openIapStore =');
    expect(result).toContain(
      'listOf("com.android.library", "com.android.application").forEach',
    );
    expect(result).toContain(LOCAL_STRATEGY_LINE_KOTLIN.trim());
    expect(result).not.toContain(LOCAL_STRATEGY_LINE_GROOVY.trim());
  });

  it('replaces the managed block instead of stacking copies', () => {
    const first = ensureLocalOpenIapFlavorStrategy(
      baseProjectBuildGradle,
      scriptPath,
    );
    const second = ensureLocalOpenIapFlavorStrategy(
      `${first}\n${first}`,
      scriptPath,
    );

    expect(
      second.match(
        /Added by expo-iap \(local openiap-google flavor selection\)/g,
      ) ?? [],
    ).toHaveLength(1);
    expect(second.match(/openIapResolveStore/g) ?? []).toHaveLength(1);
  });

  it('gives the app its own apply and resolver call', () => {
    // `:app` evaluates before the root build file, so it cannot read a value
    // the root computed.
    const groovy = appStoreLines('../x/openiap-store.gradle', 'groovy');
    expect(groovy.apply).toBe('apply from: "../x/openiap-store.gradle"');
    expect(groovy.strategy).toContain('openIapResolveStore("app").store');
    expect(groovy.strategy).not.toContain('rootProject');

    const kotlin = appStoreLines('../x/openiap-store.gradle', 'kt');
    expect(kotlin.apply).toBe('apply(from = "../x/openiap-store.gradle")');
    expect(kotlin.strategy).toContain('openIapResolveStore');
    expect(kotlin.strategy).not.toContain('rootProject');
  });

  it('removes the Kotlin DSL wiring a local build wrote', () => {
    const {apply, strategy} = appStoreLines('../x/openiap-store.gradle', 'kt');
    const app = [
      'plugins {',
      '    id("com.android.application")',
      '}',
      '',
      'android {',
      '    defaultConfig {',
      '    }',
      '}',
      '',
      'dependencies {',
      '    implementation("com.facebook.react:react-android")',
      '}',
      '',
    ].join('\n');
    const localApp = app
      .replace('android {', `${apply}\n\nandroid {`)
      .replace('defaultConfig {', `defaultConfig {\n${strategy}`)
      .replace(
        'dependencies {',
        'dependencies {\n    implementation(project(":openiap-google"))',
      );
    expect(removeLocalOpenIapAppWiring(localApp)).toBe(app);

    const settings = 'rootProject.name = "app"\ninclude(":app")\n';
    const localSettings = `${settings}\ninclude(":openiap-google")\nproject(":openiap-google").projectDir = File(settingsDir, "../x")\n`;
    expect(removeLocalOpenIapSettings(localSettings)).toBe(settings);

    expect(
      removeLocalOpenIapFlavorStrategy(
        ensureLocalOpenIapFlavorStrategy(
          baseProjectBuildGradle,
          scriptPath,
          'kt',
        ),
      ),
    ).toBe(baseProjectBuildGradle);
  });

  it('removes the Groovy wiring and keeps the next line intact', () => {
    const {apply, strategy} = appStoreLines(
      '../x/openiap-store.gradle',
      'groovy',
    );
    const app = [
      'android {',
      '    defaultConfig {',
      '    }',
      '}',
      '',
      'dependencies {',
      '    // React Native sets this version',
      '    implementation("com.facebook.react:react-android")',
      '}',
      '',
    ].join('\n');
    const localApp = app
      .replace('android {', `${apply}\n\nandroid {`)
      .replace('defaultConfig {', `defaultConfig {\n${strategy}`)
      .replace(
        'dependencies {',
        "dependencies {\n    implementation project(':openiap-google')",
      );
    expect(removeLocalOpenIapAppWiring(localApp)).toBe(app);
  });

  it('keeps build lines the local build did not write', () => {
    const app =
      'android {\n    defaultConfig {\n        missingDimensionStrategy "env", "prod"\n    }\n}\ndependencies {\n    implementation project(":feature")\n}\n';
    expect(removeLocalOpenIapAppWiring(app)).toBe(app);
    const settings = "include ':app'\ninclude ':feature'\n";
    expect(removeLocalOpenIapSettings(settings)).toBe(settings);
  });

  it('moves the local pod when localPath moves', () => {
    const podfile =
      "target 'App' do\n  use_expo_modules!\n\n  pod 'openiap', :path => '../../old/apple'\nend\n";
    expect(setLocalOpenIapPodPath(podfile, '../../new/apple')).toBe(
      podfile.replace('../../old/apple', '../../new/apple'),
    );
    // A versioned pod is the app's own choice.
    const versioned = "  pod 'openiap', '~> 1.3'\n";
    expect(setLocalOpenIapPodPath(versioned, '../x')).toBe(versioned);
  });

  it('points at the resolver that ships beside this plugin', () => {
    const relative = storeScriptPathFrom('/tmp/app/android');
    expect(relative).toMatch(/android\/openiap-store\.gradle$/);
    expect(relative).not.toContain('\\');
  });
});
