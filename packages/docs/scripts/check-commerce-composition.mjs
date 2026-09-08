import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const assets = new URL('../public/commerce-composition/', import.meta.url);
const read = (name) => readFileSync(new URL(name, assets));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const report = JSON.parse(read('run.json'));
const sources = JSON.parse(read('source.json'));
assert(report.checks.length > 0 && report.results.length === 2);
assert.equal(report.archiveVerification.sameSourceAndResults, true);
assert.equal(report.negativeControl.detected, true);
assert.equal(hash(read('source.tar.gz')), report.archiveVerification.sha256);
for (const [file, source] of Object.entries(sources))
  assert.equal(
    hash(source),
    report.sourceHashes[file],
    `${file}: visible source and executed source differ`
  );
assert.equal(
  hash(read('README.md')),
  report.sourceHashes['composition/README.md']
);
console.log(
  'Commerce composition: report, visible source, and verified archive match.'
);

const reproductionAssets = new URL(
  '../public/commerce-example/',
  import.meta.url
);
const reproduction = JSON.parse(
  readFileSync(new URL('ai-reproduction.json', reproductionAssets))
);
assert.equal(
  hash(
    readFileSync(new URL(reproduction.sourceArchive.file, reproductionAssets))
  ),
  reproduction.sourceArchive.sha256,
  'AI reproduction: source archive does not match the recorded result'
);
assert.equal(hash(reproduction.prompt), reproduction.promptSha256);
console.log('AI reproduction: recorded prompt and source archive match.');

const interop = JSON.parse(read('iapkit-run.json'));
const interopSources = JSON.parse(read('iapkit-source.json'));
const interopManifest = JSON.parse(read('iapkit-source-manifest.json'));
assert.equal(interop.checkCount, interop.checks.length);
assert.deepEqual(interop.changedConsumerFiles, []);
assert.deepEqual(interop.providerOrder, ['example', 'iapkit', 'example']);
for (const result of Object.values(interop.results)) {
  assert.deepEqual(result.before.productIds, []);
  assert.deepEqual(result.bound.productIds, ['premium.monthly']);
  assert.equal(result.canceled.active, true);
  assert.equal(result.canceled.subscription.willRenew, false);
  assert.deepEqual(result.expired.productIds, []);
  assert.deepEqual(result.erased.productIds, []);
  assert.equal(result.erasure.status, 'completed');
}
for (const [file, source] of Object.entries(interopSources)) {
  assert.equal(
    hash(source),
    interopManifest[file],
    `${file}: source snapshot drift`
  );
  const [project, ...parts] = file.split('/');
  const name = parts.join('/');
  const executed =
    project === 'kit' && name.startsWith('scripts/docs/')
      ? interop.harnessHashes[name.slice('scripts/docs/'.length)]
      : interop.sources[project === 'kit' ? 'openiap' : 'example'].hashes[name];
  assert(executed, `${file}: readable source was not pinned for this run`);
  assert.equal(hash(source), executed, `${file}: executed source drift`);
}
const kitRoot = new URL('../../kit/', import.meta.url);
if (existsSync(new URL('package.json', kitRoot))) {
  const { assertSourceHashes } =
    await import('../../kit/scripts/docs/commerce-source-snapshot.mjs');
  for (const [project, root] of [
    ['openiap', kitRoot],
    ['workspace', new URL('../../../', import.meta.url)],
  ]) {
    const recorded = interop.sources[project];
    const missing = assertSourceHashes(fileURLToPath(root), recorded?.hashes, {
      allowMissing: recorded?.optionalGeneratedFiles ?? [],
    });
    if (missing.length)
      console.log(
        `${project}: ${missing.length} recorded optional generated inputs are absent from this checkout.`
      );
  }
  assertSourceHashes(
    fileURLToPath(new URL('scripts/docs/', kitRoot)),
    interop.harnessHashes
  );
  console.log(
    'IAPKit replacement: recorded outcomes, source snapshots, and available monorepo inputs match.'
  );
} else {
  console.log(
    'IAPKit replacement: recorded outcomes and source snapshots match; current service sources are unavailable in this docs-only checkout.'
  );
}
