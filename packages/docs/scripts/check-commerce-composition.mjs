import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COMMERCE_IMPLEMENTATION_TOPICS } from '../src/lib/commerceImplementations.ts';

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
// The purchase guide deep-links `#L<n>` into these snapshots; a regenerated
// snapshot silently moves lines unless each one still names its symbol.
const snapshots = new URL('../public/commerce-source/', import.meta.url);
const unescape = (text) =>
  text
    .replace(/<[^>]+>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
for (const [topic, comparison] of Object.entries(
  COMMERCE_IMPLEMENTATION_TOPICS
))
  for (const project of ['example', 'kit']) {
    const reference = comparison[project];
    if (reference.line === undefined) continue;
    const html = readFileSync(
      new URL(`${project}/${reference.file}.html`, snapshots),
      'utf8'
    );
    const line = html.match(
      new RegExp(`<code id="L${reference.line}">(.*?)</code>`)
    )?.[1];
    assert(
      line,
      `${topic}/${project}: ${reference.file} has no line ${reference.line}`
    );
    // Symbols may be descriptive ("REST operation handlers"); the line must
    // still carry at least one of their identifiers.
    const tokens = reference.symbol.match(/[A-Za-z_$][\w$]*/g) ?? [];
    const text = unescape(line);
    assert(
      tokens.some((token) => text.includes(token)),
      `${topic}/${project}: ${reference.file}#L${reference.line} no longer names ${reference.symbol}`
    );
  }
console.log(
  'Commerce guide: every source deep link still lands on its symbol. Freshness against the current IAPKit sources is advisory: bun run audit:commerce-evidence.'
);
