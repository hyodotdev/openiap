import { describe, expect, it } from 'vitest';
import { BEHAVIORS } from '../src/spec/behaviors.mjs';
import { runConformance } from '../src/runner/runner.mjs';
import { formatReport, toJsonReport } from '../src/runner/report.mjs';
import { createReferenceAdapter } from '../src/adapters/reference-adapter.mjs';

const clientBehaviors = BEHAVIORS.filter((behavior) => behavior.category !== 'lifecycle');

describe('conformance runner', () => {
  it('reports the reference adapter as conformant', async () => {
    const report = await runConformance(createReferenceAdapter(), { behaviors: clientBehaviors });

    const failures = report.results.filter((result) => result.outcome === 'fail');
    expect(failures, formatReport(report)).toEqual([]);
    expect(report.conformant).toBe(true);
  });

  it('stamps the report with both versions and the implementation identity', async () => {
    const report = await runConformance(createReferenceAdapter(), { behaviors: clientBehaviors });

    expect(report.suiteVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(report.specVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(report.implementation).toBe('openiap-reference');
    expect(report.store).toBe('Google');
  });

  // The failure mode that makes a suite worthless: an adapter that implements
  // nothing and is reported as compliant.
  it('fails an adapter that does not implement a MUST behavior', async () => {
    const adapter = { implementation: 'empty', store: 'Google', behaviors: {} };
    const report = await runConformance(adapter, { behaviors: clientBehaviors });

    expect(report.conformant).toBe(false);
    expect(report.counts.fail).toBeGreaterThan(0);
    expect(report.results.every((result) => result.outcome !== 'pass')).toBe(true);
  });

  it('propagates a violated assertion as a failure with its reason', async () => {
    const adapter = createReferenceAdapter();
    adapter.behaviors['identifiers.purchase-carries-a-concrete-store'] = async () => {
      throw new Error('store was Unknown');
    };

    const report = await runConformance(adapter, { behaviors: clientBehaviors });
    const result = report.results.find(
      (item) => item.id === 'identifiers.purchase-carries-a-concrete-store',
    );

    expect(result.outcome).toBe('fail');
    expect(result.reason).toBe('store was Unknown');
    expect(report.conformant).toBe(false);
  });

  // Capability gating must come from the matrix, not from the adapter, or an
  // implementation could excuse itself from its own requirements.
  it('marks capability-gated behavior not-applicable for a store that cannot support it', async () => {
    const adapter = createReferenceAdapter({ store: 'Amazon' });
    const report = await runConformance(adapter, { behaviors: clientBehaviors });

    const pending = report.results.find(
      (item) => item.id === 'purchases.pending-purchase-is-not-delivered-as-purchased',
    );
    expect(pending.outcome).toBe('not-applicable');
    expect(pending.capabilityLevel).toBe('unsupported');
  });

  it('still requires capability-gated behavior of a store that must support it', async () => {
    const report = await runConformance(createReferenceAdapter({ store: 'Google' }), {
      behaviors: clientBehaviors,
    });

    const pending = report.results.find(
      (item) => item.id === 'purchases.pending-purchase-is-not-delivered-as-purchased',
    );
    expect(pending.outcome).toBe('pass');
    expect(pending.capabilityLevel).toBe('required');
  });

  it('runs an absence check for an unsupported capability when the adapter supplies one', async () => {
    const adapter = createReferenceAdapter({ store: 'Amazon' });
    let ran = false;
    adapter.absenceChecks = {
      'purchases.pending-purchase-is-not-delivered-as-purchased': async () => {
        ran = true;
      },
    };

    const report = await runConformance(adapter, { behaviors: clientBehaviors });
    const pending = report.results.find(
      (item) => item.id === 'purchases.pending-purchase-is-not-delivered-as-purchased',
    );

    expect(ran).toBe(true);
    expect(pending.outcome).toBe('pass');
  });

  it('rejects an adapter missing its identity', async () => {
    await expect(runConformance({ store: 'Google' })).rejects.toThrow(/implementation is required/);
    await expect(runConformance({ implementation: 'x' })).rejects.toThrow(/store is required/);
  });
});

describe('conformance report', () => {
  it('renders a human-readable verdict naming both versions', async () => {
    const report = await runConformance(createReferenceAdapter(), { behaviors: clientBehaviors });
    const text = formatReport(report);

    expect(text).toContain('OpenIAP Conformance Report');
    expect(text).toContain('openiap-reference');
    expect(text).toContain(`suite ${report.suiteVersion}`);
    expect(text).toContain(`conformant with OpenIAP ${report.specVersion}`);
  });

  it('renders a non-conformant verdict when a behavior fails', async () => {
    const adapter = { implementation: 'empty', store: 'Google', behaviors: {} };
    const report = await runConformance(adapter, { behaviors: clientBehaviors });

    expect(formatReport(report)).toContain('NOT conformant');
  });

  it('emits a stable JSON artifact', async () => {
    const report = await runConformance(createReferenceAdapter(), { behaviors: clientBehaviors });
    const parsed = JSON.parse(toJsonReport(report));

    expect(parsed.suiteVersion).toBe(report.suiteVersion);
    expect(parsed.conformant).toBe(true);
    expect(parsed.results.length).toBe(clientBehaviors.length);
    expect(parsed.results[0]).toHaveProperty('id');
    expect(parsed.results[0]).toHaveProperty('outcome');
  });
});
