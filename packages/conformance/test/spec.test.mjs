import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_MATRIX,
  CAPABILITY_STORES,
} from '../../gql/src/capability-matrix.mjs';
import {
  BEHAVIORS,
  BEHAVIOR_CATEGORIES,
  BEHAVIOR_LEVELS,
  behaviorById,
  behaviorIds,
} from '../src/spec/behaviors.mjs';
import { SUITE_VERSION, specVersion } from '../src/spec/version.mjs';
import { runConformance } from '../src/runner/runner.mjs';

describe('conformance behavior spec', () => {
  it('gives every behavior a unique id', () => {
    const ids = behaviorIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('namespaces every id under its category', () => {
    for (const behavior of BEHAVIORS) {
      expect(behavior.id.startsWith(`${behavior.category}.`), behavior.id).toBe(true);
    }
  });

  it('uses only declared categories and levels', () => {
    for (const behavior of BEHAVIORS) {
      expect(BEHAVIOR_CATEGORIES, behavior.id).toContain(behavior.category);
      expect(BEHAVIOR_LEVELS, behavior.id).toContain(behavior.level);
    }
  });

  it('states every behavior as a testable requirement', () => {
    for (const behavior of BEHAVIORS) {
      expect(behavior.statement?.trim(), behavior.id).toBeTruthy();
      expect(behavior.statement.length, `${behavior.id} statement too terse`).toBeGreaterThan(20);
    }
  });

  // A capability gate that names a non-existent capability would silently make
  // the behavior inapplicable everywhere.
  it('gates behaviors only on capabilities the matrix defines', () => {
    for (const behavior of BEHAVIORS) {
      if (!behavior.capability) continue;
      expect(Object.keys(CAPABILITY_MATRIX), behavior.id).toContain(behavior.capability);
    }
  });

  it('covers every core conformance category', () => {
    const covered = new Set(BEHAVIORS.map((behavior) => behavior.category));
    for (const category of [
      'products',
      'purchases',
      'completion',
      'restoration',
      'subscriptions',
      'lifecycle',
      'errors',
      'identifiers',
      'capabilities',
    ]) {
      expect(covered, `no behavior covers ${category}`).toContain(category);
    }
  });

  it('binds the suite version to a released spec version', () => {
    expect(SUITE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(specVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('resolves behaviors by id and rejects unknown ids', () => {
    expect(behaviorById(BEHAVIORS[0].id)).toBe(BEHAVIORS[0]);
    expect(() => behaviorById('nope.not-real')).toThrow(/Unknown conformance behavior/);
  });

  it('keeps every capability-matrix store addressable by the runner', async () => {
    for (const store of CAPABILITY_STORES) {
      const report = await runConformance(
        { implementation: `matrix-addressability-${store}`, store, behaviors: {} },
        { behaviors: [] },
      );
      expect(report.store).toBe(store);
    }
  });
});
