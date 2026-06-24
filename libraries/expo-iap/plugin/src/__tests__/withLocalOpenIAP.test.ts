import {ensureLocalOpenIapFlavorStrategy} from '../withLocalOpenIAP';

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

  it('adds a default platform flavor for Android library subprojects', () => {
    const result = ensureLocalOpenIapFlavorStrategy(
      baseProjectBuildGradle,
      'play',
    );

    expect(result).toContain('subprojects { subproject ->');
    expect(result).toContain('subproject.plugins.withId("com.android.library")');
    expect(result).toContain('missingDimensionStrategy "platform", "play"');
  });

  it('emits Kotlin DSL for Kotlin project build files', () => {
    const result = ensureLocalOpenIapFlavorStrategy(
      baseProjectBuildGradle,
      'horizon',
      'kotlin',
    );

    expect(result).toContain('subprojects {');
    expect(result).toContain(
      'extensions.configure<com.android.build.gradle.LibraryExtension>("android")',
    );
    expect(result).toContain(
      'missingDimensionStrategy("platform", "horizon")',
    );
    expect(result).not.toContain(
      'missingDimensionStrategy "platform", "horizon"',
    );
  });

  it('replaces the managed block when the target flavor changes', () => {
    const playResult = ensureLocalOpenIapFlavorStrategy(
      baseProjectBuildGradle,
      'play',
    );
    const horizonResult = ensureLocalOpenIapFlavorStrategy(
      `${playResult}\n${playResult}`,
      'horizon',
    );

    expect(horizonResult).toContain(
      'missingDimensionStrategy "platform", "horizon"',
    );
    expect(horizonResult).not.toContain(
      'missingDimensionStrategy "platform", "play"',
    );
    expect(
      horizonResult.match(
        /Added by expo-iap \(local openiap-google flavor selection\)/g,
      ) ?? [],
    ).toHaveLength(1);
  });
});
