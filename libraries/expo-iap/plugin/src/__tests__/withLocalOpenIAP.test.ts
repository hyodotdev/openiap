import {
  ensureLocalOpenIapFlavorStrategy,
  LOCAL_STRATEGY_LINE_GROOVY,
  LOCAL_STRATEGY_LINE_KOTLIN,
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
      'kotlin',
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

  it('points at the resolver that ships beside this plugin', () => {
    const relative = storeScriptPathFrom('/tmp/app/android');
    expect(relative).toMatch(/android\/openiap-store\.gradle$/);
    expect(relative).not.toContain('\\');
  });
});
