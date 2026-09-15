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

const paywallRead = (name) => readFileSync(new URL(name, reproductionAssets));
const fresh = JSON.parse(paywallRead('fresh-build.json'));
const freshReplay = JSON.parse(paywallRead('fresh-public-replay.json'));
assert.equal(hash(paywallRead('fresh-source.tar.gz')), fresh.archiveSha256);
assert.equal(freshReplay.sourceCommit, fresh.sourceCommit);
assert(freshReplay.steps.every((step) => step.exitCode === 0));
const experience = JSON.parse(paywallRead('experience-verification.json'));
assert.equal(
  hash(paywallRead('experience-source.tar.gz')),
  experience.source.sha256
);
assert.equal(
  experience.distributionFollowup.archiveSha256,
  experience.source.sha256
);
assert(
  experience.distributionFollowup.steps.every((step) => step.exitCode === 0)
);
assert.equal(
  JSON.parse(paywallRead('reader-followup.json')).archives[
    'experience-source.tar.gz'
  ],
  experience.source.sha256
);
const connection = JSON.parse(paywallRead('paywall-build.json'));
const harness = JSON.parse(paywallRead('paywall-harness.json'));
const provider = JSON.parse(paywallRead('paywall-provider-run.json'));
assert(harness.ok && harness.source.status === '');
assert.equal(harness.source.commit, connection.sourceCommit);
assert.deepEqual(harness.suite, connection.verification);
assert.equal(
  hash(paywallRead('paywall-source.tar.gz')),
  connection.archiveSha256
);
// export-paywall.mjs derives these from paywall-harness.json in the same
// invocation as providerVerification; pin every field, not just the count.
assert.deepEqual(connection.harness, {
  checks: harness.checks.length,
  recordedAt: harness.finishedAt,
});
assert.deepEqual(connection.state, harness.state);
assert.equal(connection.implementationCommit, connection.sourceCommit);
for (const id of [
  'cli-handoff',
  'regressions',
  'purchase-outcomes',
  'purchase-renewal-cancel',
  'shared-receiver',
  'redelivery',
  'process-restart',
  'source-stability',
])
  assert(
    harness.checks.some((check) => check.id === id),
    `Missing connection check: ${id}`
  );
assert(provider.freshConnection.ok);
// The example's own verification pinned every file at this commit; the
// provider run must have executed the same bytes.
for (const [file, expected] of Object.entries(
  provider.freshConnection.source.hashes
))
  assert.equal(
    harness.source.files[file],
    expected,
    `${file}: provider run and paywall harness pin different sources`
  );
assert.equal(provider.freshConnection.source.revision, connection.sourceCommit);
assert.equal(provider.reproduction.freshExampleCommit, connection.sourceCommit);
// export-paywall.mjs derives this block from the same report in one
// invocation, so every field must come from this run, not just the count.
assert.deepEqual(
  connection.providerVerification,
  {
    checks: provider.freshConnection.checks.length,
    regressionChecks: provider.checkCount,
    recordedAt: provider.recordedAt,
    state: provider.freshConnection.state,
  },
  'paywall-build.json providerVerification was not derived from this run'
);
// The runner refuses to write a report whose sources were dirty, but a report
// can also arrive hand-assembled or reused from an older run. Enforce the same
// rule here, against the revisions the run itself recorded, so the publish gate
// does not depend on the generator having been the one that produced it.
for (const [key, recorded] of [
  ['openiapBaseCommit', provider.sources.openiap.baseRevision],
  ['originalExampleCommit', provider.sources.example.baseRevision],
  ['freshExampleCommit', provider.freshConnection.source.revision],
]) {
  assert.match(
    recorded,
    /^[0-9a-f]{40}$/u,
    `${key}: recorded from a dirty checkout`
  );
  assert.equal(
    provider.reproduction[key],
    recorded,
    `${key}: reproduction disagrees with the revision that ran`
  );
}
assert.equal(
  provider.sources.workspace.baseRevision,
  provider.sources.openiap.baseRevision,
  'Workspace and openiap sources must come from one revision'
);
// The harness ships in the repository now, so instructions that still told a
// reader to apply a patch would send them after a file they do not need.
assert(
  !('harnessPatch' in provider.reproduction) &&
    !('patchSha256' in provider.reproduction),
  'Reproduction must not claim a harness patch'
);
console.log(
  'Commerce connection: source archive, local replay and independent provider evidence agree.'
);

const interop = JSON.parse(read('iapkit-run.json'));
// Both files are the same report.json published at two paths. Comparing them
// whole puts every provenance rule above on both copies; comparing a few
// fields left the copy the React pages import unchecked.
assert.deepEqual(
  provider,
  interop,
  'paywall-provider-run.json and iapkit-run.json are not the same exported report'
);
// The page tells a reader which commits to check out. It is hand-maintained,
// so without this it silently keeps describing the previous recording.
const reproductionPage = String(
  paywallRead('paywall-provider-reproduction.md')
);
// Order matters: the three clone blocks are openiap, original, fresh. A
// substring check alone passes when two of them are swapped.
assert.deepEqual(
  [...reproductionPage.matchAll(/^git checkout ([0-9a-f]{40})$/gmu)].map(
    (match) => match[1]
  ),
  [
    provider.reproduction.openiapBaseCommit,
    provider.reproduction.originalExampleCommit,
    provider.reproduction.freshExampleCommit,
  ],
  'paywall-provider-reproduction.md must check out the recorded commits, in order'
);
for (const expected of [
  `passed ${provider.freshConnection.checks.length} current-paywall`,
  `${provider.checkCount} existing interoperability`,
  `Bun ${provider.runtime.bun}`,
]) {
  assert(
    reproductionPage.includes(expected),
    `paywall-provider-reproduction.md must state "${expected}"`
  );
}
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
