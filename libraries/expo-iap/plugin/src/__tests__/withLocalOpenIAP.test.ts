import {
  ensureLocalOpenIapFlavorStrategy,
  LOCAL_STRATEGY_LINE_GROOVY,
  LOCAL_STRATEGY_LINE_KOTLIN,
} from '../withLocalOpenIAP';

describe('ensureLocalOpenIapFlavorStrategy', () => {
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

  it('resolves the platform flavor at build time for Android library subprojects', () => {
    const result = ensureLocalOpenIapFlavorStrategy(baseProjectBuildGradle);

    expect(result).toContain(
      '"../node_modules/expo-iap/android/openiap-store.gradle"',
    );
    expect(result).toContain('subprojects { subproject ->');
    expect(result).toContain(
      'subproject.plugins.withId("com.android.library")',
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
      'kotlin',
    );

    expect(result).toContain('apply(from = listOf(');
    expect(result).toContain('subprojects {');
    expect(result).toContain(
      'extensions.configure<com.android.build.gradle.LibraryExtension>("android")',
    );
    expect(result).toContain(LOCAL_STRATEGY_LINE_KOTLIN.trim());
    expect(result).not.toContain(LOCAL_STRATEGY_LINE_GROOVY.trim());
  });

  it('replaces the managed block instead of stacking copies', () => {
    const first = ensureLocalOpenIapFlavorStrategy(baseProjectBuildGradle);
    const second = ensureLocalOpenIapFlavorStrategy(`${first}\n${first}`);

    expect(
      second.match(
        /Added by expo-iap \(local openiap-google flavor selection\)/g,
      ) ?? [],
    ).toHaveLength(1);
    expect(second.match(/openIapResolveStore/g) ?? []).toHaveLength(1);
  });
});
