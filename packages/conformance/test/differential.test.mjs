import { describe, expect, it } from 'vitest';
import { createReferenceAdapter } from '../src/adapters/reference-adapter.mjs';
import {
  formatDifferentialReport,
  runDifferential,
} from '../src/runner/differential.mjs';

/** Reference adapter with one behavior deliberately broken — the known-bug
 * oracle a differential run must catch. */
function createMutantAdapter() {
  const adapter = createReferenceAdapter();
  return {
    ...adapter,
    implementation: 'openiap-reference-mutant',
    behaviors: {
      ...adapter.behaviors,
      // Mutant treats a forged token as valid — the VirtualSwindle failure.
      'verification.forged-token-is-invalid': async () => {
        throw new Error('mutant accepted a forged token');
      },
    },
  };
}

describe('differential conformance mode', () => {
  it('rejects fewer than two adapters', async () => {
    await expect(runDifferential([createReferenceAdapter()])).rejects.toThrow(
      /at least two adapters/,
    );
  });

  it('rejects indistinguishable adapters', async () => {
    await expect(
      runDifferential([createReferenceAdapter(), createReferenceAdapter()]),
    ).rejects.toThrow(/distinguishable/);
  });

  it('agrees when adapters behave identically', async () => {
    const left = createReferenceAdapter();
    const right = {
      ...createReferenceAdapter(),
      implementation: 'openiap-reference-b',
    };
    const result = await runDifferential([left, right]);
    expect(result.agreed).toBe(true);
    expect(result.divergences).toEqual([]);
  });

  it('surfaces a seeded bug as a divergence', async () => {
    const result = await runDifferential([
      createReferenceAdapter(),
      createMutantAdapter(),
    ]);
    expect(result.agreed).toBe(false);
    const ids = result.divergences.map((divergence) => divergence.behaviorId);
    expect(ids).toContain('verification.forged-token-is-invalid');

    const report = formatDifferentialReport(result);
    expect(report).toMatch(/DIVERGE verification\.forged-token-is-invalid/);
    expect(report).toMatch(/mutant accepted a forged token/);
  });

  it('does not count capability-driven not-applicable as divergence', async () => {
    const google = createReferenceAdapter({ store: 'Google' });
    const horizon = createReferenceAdapter({ store: 'Horizon' });
    const result = await runDifferential([google, horizon]);
    // Stores differ in capability coverage; only comparable outcomes diverge.
    for (const divergence of result.divergences) {
      const outcomes = Object.values(divergence.outcomes).map(
        (entry) => entry.outcome,
      );
      expect(outcomes).not.toContain('not-applicable');
    }
  });
});
