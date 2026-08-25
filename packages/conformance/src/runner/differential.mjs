/**
 * Differential conformance mode: run several adapters over the same behavior
 * inventory and treat disagreement as a bug oracle. Implementations of one
 * spec that diverge are wrong somewhere even when each passes alone
 * (brubaker2014frankencerts, kallus2024httpgarden in
 * knowledge/research/bibliography.md; backlog R4).
 */

import { runConformance } from './runner.mjs';
import { SUITE_VERSION, specVersion } from '../spec/version.mjs';

/**
 * Outcomes that legitimately differ across stores are not divergences:
 * capability gating makes `not-applicable` expected for an unsupported store.
 * Divergence means adapters that were both required to exhibit a behavior
 * did not agree on whether they do.
 */
function comparableOutcome(result) {
  return result.outcome === 'not-applicable' ? null : result.outcome;
}

/**
 * @param {ReadonlyArray<object>} adapters two or more runner adapters
 * @param {{ behaviors?: ReadonlyArray<object> }} [options]
 */
export async function runDifferential(adapters, options = {}) {
  if (!Array.isArray(adapters) || adapters.length < 2) {
    throw new Error('differential mode needs at least two adapters');
  }

  const reports = [];
  for (const adapter of adapters) {
    reports.push(await runConformance(adapter, options));
  }

  const names = reports.map(
    (report) => `${report.implementation}@${report.store}`,
  );
  if (new Set(names).size !== names.length) {
    throw new Error(
      `differential adapters must be distinguishable; received ${names.join(', ')}`,
    );
  }

  const behaviorIds = reports[0].results.map((result) => result.id);
  const divergences = [];

  for (const behaviorId of behaviorIds) {
    const outcomes = {};
    for (let i = 0; i < reports.length; i += 1) {
      const result = reports[i].results.find((item) => item.id === behaviorId);
      outcomes[names[i]] = {
        outcome: result.outcome,
        reason: result.reason,
      };
    }

    const comparable = Object.values(outcomes)
      .map(comparableOutcome)
      .filter((outcome) => outcome !== null);
    const agreed = new Set(comparable).size <= 1;
    if (!agreed) {
      divergences.push({ behaviorId, outcomes });
    }
  }

  return {
    suiteVersion: SUITE_VERSION,
    specVersion: specVersion(),
    adapters: names,
    evaluatedBehaviorCount: behaviorIds.length,
    divergences,
    agreed: divergences.length === 0,
    reports,
  };
}

/** @param {Awaited<ReturnType<typeof runDifferential>>} result */
export function formatDifferentialReport(result) {
  const lines = [
    `OpenIAP differential conformance — suite ${result.suiteVersion} / spec ${result.specVersion}`,
    `  adapters: ${result.adapters.join(', ')}`,
    `  behaviors: ${result.evaluatedBehaviorCount} · divergences: ${result.divergences.length}`,
  ];
  for (const divergence of result.divergences) {
    lines.push(`  DIVERGE ${divergence.behaviorId}`);
    for (const [name, { outcome, reason }] of Object.entries(
      divergence.outcomes,
    )) {
      lines.push(`    ${name}: ${outcome}${reason ? ` — ${reason}` : ''}`);
    }
  }
  if (result.agreed) lines.push('  all adapters agree.');
  return lines.join('\n');
}
