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

  it('replaces the managed block when the target flavor changes', () => {
    const playResult = ensureLocalOpenIapFlavorStrategy(
      baseProjectBuildGradle,
      'play',
    );
    const horizonResult = ensureLocalOpenIapFlavorStrategy(
      playResult,
      'horizon',
    );

    expect(horizonResult).toContain(
      'missingDimensionStrategy "platform", "horizon"',
    );
    expect(horizonResult).not.toContain(
      'missingDimensionStrategy "platform", "play"',
    );
    expect(
      horizonResult.match(/local openiap-google flavor selection/g) ?? [],
    ).toHaveLength(2);
  });
});
