import { describe, expect, it } from 'vitest';
import { BEHAVIORS } from '../src/spec/behaviors.mjs';
import { NOT_IMPLEMENTED, runConformance } from '../src/runner/runner.mjs';
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

  it('fails an applicable MUST behavior that explicitly reports not-implemented', async () => {
    const behavior = clientBehaviors.find(
      (item) => item.id === 'identifiers.purchase-carries-a-concrete-store',
    );
    const adapter = {
      implementation: 'not-implemented',
      store: 'Google',
      behaviors: { [behavior.id]: async () => NOT_IMPLEMENTED },
    };

    const report = await runConformance(adapter, { behaviors: [behavior] });

    expect(report.conformant).toBe(false);
    expect(report.results[0]).toMatchObject({
      outcome: 'fail',
      reason: 'adapter reported not-implemented',
    });
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
    const adapter = createReferenceAdapter({ store: 'Apple' });
    const report = await runConformance(adapter, { behaviors: clientBehaviors });

    const alreadyOwned = report.results.find(
      (item) => item.id === 'purchases.already-owned-surfaces-already-owned-error',
    );
    expect(alreadyOwned.outcome).toBe('not-applicable');
    expect(alreadyOwned.capabilityLevel).toBe('unsupported');
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

  it('does not require an optional capability that the adapter omits', async () => {
    const behavior = BEHAVIORS.find(
      (item) => item.id === 'lifecycle.purchase-starts-active-entitlement',
    );
    const adapter = { implementation: 'amazon-without-webhooks', store: 'Amazon', behaviors: {} };

    const report = await runConformance(adapter, { behaviors: [behavior] });

    expect(report.conformant).toBe(true);
    expect(report.results[0]).toMatchObject({
      outcome: 'not-applicable',
      capabilityLevel: 'optional',
    });
  });

  it('checks an optional capability when the adapter implements it', async () => {
    const behavior = BEHAVIORS.find(
      (item) => item.id === 'lifecycle.purchase-starts-active-entitlement',
    );
    const adapter = {
      implementation: 'amazon-with-webhooks',
      store: 'Amazon',
      behaviors: {
        [behavior.id]: async () => {
          throw new Error('optional implementation violated the behavior');
        },
      },
    };

    const report = await runConformance(adapter, { behaviors: [behavior] });

    expect(report.conformant).toBe(false);
    expect(report.results[0]).toMatchObject({
      outcome: 'fail',
      capabilityLevel: 'optional',
    });
  });

  it('runs an absence check for an unsupported capability when the adapter supplies one', async () => {
    const adapter = createReferenceAdapter({ store: 'Apple' });
    let ran = false;
    adapter.absenceChecks = {
      'purchases.already-owned-surfaces-already-owned-error': async () => {
        ran = true;
      },
    };

    const report = await runConformance(adapter, { behaviors: clientBehaviors });
    const alreadyOwned = report.results.find(
      (item) => item.id === 'purchases.already-owned-surfaces-already-owned-error',
    );

    expect(ran).toBe(true);
    expect(alreadyOwned.outcome).toBe('pass');
  });

  it('rejects an adapter missing its identity', async () => {
    await expect(runConformance({ store: 'Google' })).rejects.toThrow(/implementation is required/);
    await expect(runConformance({ implementation: 'x' })).rejects.toThrow(/store is required/);
  });

  it('rejects a store that is absent from the capability matrix', async () => {
    await expect(
      runConformance({ implementation: 'future-store', store: 'Samsung', behaviors: {} }),
    ).rejects.toThrow(/adapter\.store must be one of/);
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
