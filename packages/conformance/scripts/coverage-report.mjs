#!/usr/bin/env node
/**
 * Ecosystem coverage report: which implementation covers which behavior.
 *
 * Native suites cannot call the JS runner, so each declares the behavior ids it
 * covers in its own source. This reads those declarations and reports the
 * matrix, including behaviors no implementation covers.
 *
 * Declarations are parsed from source rather than self-reported at runtime so a
 * suite cannot claim coverage it does not have — the ids must resolve to real
 * generated constants, which the drift gate already ties to the spec.
 *
 * --json  emit the artifact instead of the table
 * --check fail if any MUST behavior has no implementation covering it
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BEHAVIORS } from '../src/spec/behaviors.mjs';
import { SUITE_VERSION, specVersion } from '../src/spec/version.mjs';

const ROOT = new URL('../../../', import.meta.url);

function read(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, ROOT)), 'utf8');
}

/** Resolves generated constant references back to behavior id literals. */
function resolveConstants(generatedSource, pattern) {
  const table = new Map();
  for (const match of generatedSource.matchAll(pattern)) {
    table.set(match[1], match[2]);
  }
  return table;
}

function declaredIds(source, blockMarker, constantTable, referencePattern) {
  const start = source.indexOf(blockMarker);
  if (start < 0) return [];
  // Read to the closing paren/bracket of the declaration block.
  const rest = source.slice(start);
  const end = rest.indexOf('\n    )');
  const block = rest.slice(0, end > 0 ? end : rest.indexOf('\n    ]'));
  return [...block.matchAll(referencePattern)]
    .map((match) => constantTable.get(match[1]))
    .filter(Boolean);
}

const IMPLEMENTATIONS = [];

// --- Android stores (one suite, three flavors) -----------------------------
{
  const generated = read(
    'packages/google/openiap/src/conformanceTest/java/dev/hyo/openiap/conformance/ConformanceBehaviors.kt',
  );
  const table = resolveConstants(generated, /const val (\w+) = "([^"]+)"/g);
  const suite = read(
    'packages/google/openiap/src/conformanceTest/java/dev/hyo/openiap/conformance/StoreConformanceSuite.kt',
  );
  const ids = declaredIds(suite, 'private val coveredBehaviors', table, /ConformanceBehaviors\.(\w+)/g);
  for (const store of ['Google', 'Horizon', 'Amazon']) {
    IMPLEMENTATIONS.push({ name: `android-${store.toLowerCase()}`, store, covered: ids });
  }
}

// --- Apple client -----------------------------------------------------------
{
  const generated = read('packages/apple/Tests/OpenIapTests/ConformanceBehaviors.swift');
  const table = resolveConstants(generated, /static let (\w+) = "([^"]+)"/g);
  const suite = read('packages/apple/Tests/OpenIapTests/StoreConformanceTests.swift');
  const ids = declaredIds(suite, 'static let coveredBehaviors', table, /ConformanceBehaviors\.(\w+)/g);
  IMPLEMENTATIONS.push({ name: 'apple-client', store: 'Apple', covered: ids });
}

// --- IAPKit lifecycle -------------------------------------------------------
{
  const suite = read('packages/kit/convex/webhooks/conformance.test.ts');
  const ids = [...suite.matchAll(/"(lifecycle\.[a-z-]+)"/g)].map((match) => match[1]);
  for (const store of ['Apple', 'Google']) {
    IMPLEMENTATIONS.push({ name: `iapkit-${store.toLowerCase()}`, store, covered: [...new Set(ids)] });
  }
}

// --- Framework bindings (real SDK code over a fake native module) ----------
for (const [name, path] of [
  ['react-native-iap', 'libraries/react-native-iap/src/__tests__/conformance.test.ts'],
  ['expo-iap', 'libraries/expo-iap/src/__tests__/conformance.test.ts'],
]) {
  const suite = read(path);
  const block = suite.slice(suite.indexOf('const COVERED_BEHAVIORS'));
  const ids = [...block.slice(0, block.indexOf('];')).matchAll(/'([a-z]+\.[a-z0-9-]+)'/g)].map(
    (match) => match[1],
  );
  IMPLEMENTATIONS.push({ name, store: 'Google', covered: ids });
}

// --- Reference implementation ----------------------------------------------
{
  const adapter = read('packages/conformance/src/adapters/reference-adapter.mjs');
  const ids = [...adapter.matchAll(/^      '([a-z]+\.[a-z0-9-]+)':/gm)].map((match) => match[1]);
  IMPLEMENTATIONS.push({ name: 'openiap-reference', store: 'Google', covered: ids });
}

// --- Build the matrix -------------------------------------------------------
const rows = BEHAVIORS.map((behavior) => {
  const by = IMPLEMENTATIONS.filter((impl) => impl.covered.includes(behavior.id)).map(
    (impl) => impl.name,
  );
  return { id: behavior.id, category: behavior.category, level: behavior.level, coveredBy: by };
});

const uncovered = rows.filter((row) => row.coveredBy.length === 0);
const realImplementations = IMPLEMENTATIONS.filter((impl) => impl.name !== 'openiap-reference');
const uncoveredByReal = rows.filter(
  (row) => !row.coveredBy.some((name) => name !== 'openiap-reference'),
);

const artifact = {
  suiteVersion: SUITE_VERSION,
  specVersion: specVersion(),
  implementations: IMPLEMENTATIONS.map(({ name, store, covered }) => ({
    name,
    store,
    coveredCount: covered.length,
  })),
  behaviors: rows,
  summary: {
    total: rows.length,
    coveredByAnyImplementation: rows.length - uncoveredByReal.length,
    coveredOnlyByReference: uncoveredByReal.length - uncovered.length,
    coveredByNothing: uncovered.length,
  },
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(artifact, null, 2));
} else {
  console.log('OpenIAP Conformance Coverage');
  console.log(`  suite ${SUITE_VERSION} / spec ${specVersion()}`);
  console.log('');
  let category = '';
  for (const row of rows) {
    if (row.category !== category) {
      category = row.category;
      console.log(`  ${category}`);
    }
    const by = row.coveredBy.length ? row.coveredBy.join(', ') : '— none —';
    console.log(`    ${row.coveredBy.length ? 'OK ' : 'GAP'}  ${row.id}  [${by}]`);
  }
  console.log('');
  console.log(`  implementations: ${IMPLEMENTATIONS.map((impl) => impl.name).join(', ')}`);
  console.log(
    `  ${artifact.summary.coveredByAnyImplementation}/${artifact.summary.total} behaviors covered by a real implementation`,
  );
  if (uncoveredByReal.length) {
    console.log(`  ${uncoveredByReal.length} covered only by the reference adapter or not at all`);
  }
}

// Gate on real implementations, not on coverage in general: the reference
// adapter is written to pass, so counting it would let every shipped
// implementation drop out of a behavior while the check stayed green.
if (process.argv.includes('--check')) {
  const failing = uncoveredByReal.filter((row) => row.level === 'MUST');
  if (failing.length > 0) {
    console.error(
      `\n${failing.length} MUST behavior(s) have no implementation beyond the reference adapter:`,
    );
    for (const row of failing) {
      console.error(`- ${row.id}${row.coveredBy.length ? ' (reference only)' : ' (no coverage)'}`);
    }
    process.exit(1);
  }
}

if (realImplementations.length === 0) {
  console.error('No real implementations were discovered — the parser is likely broken.');
  process.exit(1);
}
