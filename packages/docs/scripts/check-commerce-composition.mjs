import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { COMMERCE_IMPLEMENTATION_TOPICS } from '../src/lib/commerceImplementations.ts';

const assets = new URL('../public/commerce-composition/', import.meta.url);
const read = (name) => readFileSync(new URL(name, assets));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
// `git archive` names its commit in the pax global header, so the archive
// itself says which commit it was cut from; nothing else in the gate can.
const archiveCommit = (gz) => {
  const tar = gunzipSync(gz);
  assert.equal(String.fromCharCode(tar[156]), 'g', 'archive has no pax header');
  const size = parseInt(tar.subarray(124, 136).toString(), 8);
  const commit = tar
    .subarray(512, 512 + size)
    .toString()
    .match(/comment=([0-9a-f]{40})/u)?.[1];
  assert(commit, 'archive pax header names no commit');
  return commit;
};
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
// Retired records: nothing here could regenerate them, and a record that
// cannot be re-recorded cannot be kept true, so they are gone rather than
// edited. The Field Notes reproduction (ai-reproduction*) recorded a
// 2026-09-08 session against the deprecated unscoped package, assembled by
// hand. paywall-public-replay.json was copied from hand-recorded example
// evidence by the 2026-09-13 exporter; paywall-harness.json replaced it.
for (const retired of [
  'ai-reproduction.json',
  'ai-reproduction.md',
  'ai-reproduction-source.tar.gz',
  'paywall-public-replay.json',
]) {
  assert(
    !existsSync(new URL(retired, reproductionAssets)),
    `${retired} was retired; re-record it with a producer before publishing it again`
  );
}

const paywallRead = (name) => readFileSync(new URL(name, reproductionAssets));
const fresh = JSON.parse(paywallRead('fresh-build.json'));
const freshReplay = JSON.parse(paywallRead('fresh-public-replay.json'));
const freshArchive = paywallRead('fresh-source.tar.gz');
assert.equal(hash(freshArchive), fresh.archiveSha256);
assert.equal(
  archiveCommit(freshArchive),
  fresh.sourceCommit,
  'fresh-source.tar.gz was cut from a different commit'
);
assert.equal(freshReplay.sourceCommit, fresh.sourceCommit);
assert(freshReplay.steps.every((step) => step.exitCode === 0));
// The declared branch is hand-written metadata; a branch that does not carry
// the recorded commit makes the published clone command fail outright.
const replayClone = freshReplay.steps.find((step) =>
  step.command.includes('clone')
);
assert(replayClone, 'fresh-public-replay.json records no clone step');
assert.equal(
  replayClone.command[replayClone.command.indexOf('--branch') + 1],
  fresh.branch,
  'fresh-build.json names a branch the public replay did not clone'
);
// from-scratch.md is hand-maintained too; it must check out the recorded
// fresh commit and walk the recorded milestones, in order.
const freshPage = String(paywallRead('from-scratch.md'));
assert.deepEqual(
  [...freshPage.matchAll(/^git clone --branch (\S+) /gmu)].map((m) => m[1]),
  [fresh.branch],
  'from-scratch.md must clone the recorded branch'
);
assert.deepEqual(
  [...freshPage.matchAll(/^git checkout ([0-9a-f]{40})$/gmu)].map((m) => m[1]),
  [fresh.sourceCommit],
  'from-scratch.md must check out the recorded fresh commit'
);
assert.deepEqual(
  [...freshPage.matchAll(/\/tree\/([0-9a-f]{40})\)/gu)].map((m) => m[1]),
  fresh.milestones.map((m) => m.commit),
  'from-scratch.md must link the recorded milestones, in order'
);
assert.deepEqual(
  new Set(
    [
      ...freshPage.matchAll(
        /(?:\/(?:blob|tree|commit)\/|raw\.githubusercontent\.com\/[^/]+\/[^/]+\/)([0-9a-f]{40})/gu
      ),
    ].map((m) => m[1])
  ),
  new Set([fresh.sourceCommit, ...fresh.milestones.map((m) => m.commit)]),
  'from-scratch.md links a commit the recording does not'
);
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
// Bun omits its per-test `(pass)` lines in agent mode (CLAUDECODE, AGENT or
// REPL_ID set) and with --only-failures; allow indentation, as in a log quoted
// in a list or code block. --dots logs are not recognised; the recipe never
// uses it.
const assertPassLines = (name, log, tests) =>
  assert.equal(
    log.match(/^[ \t]*\(pass\) /gmu)?.length ?? 0,
    tests,
    `${name} must log one (pass) line per test; re-record it outside agent mode (env -u CLAUDECODE -u AGENT -u REPL_ID) and without --only-failures`
  );
assert(
  harness.suite.tests > 0,
  'paywall-harness.json records no passing tests'
);
assertPassLines(
  'paywall-harness.json',
  harness.commands.flatMap(({ stdout, stderr }) => [stdout, stderr]).join('\n'),
  harness.suite.tests
);
for (const [name, steps] of [
  ['fresh-public-replay.json', freshReplay.steps],
  ['experience-verification.json', experience.distributionFollowup.steps],
])
  assert(
    steps.some(
      (step) =>
        step.command.join(' ') === 'npm test' &&
        /^ [1-9]\d* pass$/mu.test(step.stderr)
    ),
    `${name} records no passing npm test run`
  );
const paywallArchive = paywallRead('paywall-source.tar.gz');
assert.equal(hash(paywallArchive), connection.archiveSha256);
assert.equal(
  archiveCommit(paywallArchive),
  connection.sourceCommit,
  'paywall-source.tar.gz was cut from a different commit'
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

// Recorders publish their checkout, temp and working paths as they ran, so a run
// from a home folder, the macOS temp folder or an agent scratchpad names its user.
// Archives are not scanned: paywall-source.tar.gz and fresh-source.tar.gz
// (git archive) carry local paths from the pinned example commits' evidence/
// files, and the other source archives name the recording account as owner.
// These 2026-09-16 walkthrough records hold agent-mode Bun logs. Each entry
// pins the file's sha256, so a re-record must also drop its entry.
const unreplayedLogs = new Map([
  [
    'commerce-example/verification.json',
    '989ae654e5deed5d00f9abb786f7e930beef6c01fe77ca720481c969ba06bb29',
  ],
  [
    'commerce-example/06-recover/attempt-1.txt',
    '0f83c59cbf809b87d4f26b50e5317c37fb079f257c997668a2385ba4a2cb0464',
  ],
  [
    'commerce-example/07-account-erasure/attempt-1.txt',
    '0d95eb7193d3fd26c4adc76c229f053876f44472ca4cb588cdfb251200e71f2b',
  ],
]);
// Bun prints its summary as ` N pass`, with one leading space.
const bunLogs = (value) =>
  typeof value === 'string'
    ? /^[ \t]* \d+ pass$/mu.test(value)
      ? [value]
      : []
    : Object.values(value ?? {}).flatMap(bunLogs);
const publicRoot = new URL('../public/', import.meta.url);
for (const [name, sha256] of unreplayedLogs) {
  const url = new URL(name, publicRoot);
  assert(
    existsSync(url) && hash(readFileSync(url)) === sha256,
    `${name} changed or was removed; drop its unreplayedLogs entry so its Bun logs are checked`
  );
}
const localPath =
  /\/Users\/|\/home\/|\/var\/folders\/|\/claude-\d+\/|\/scratchpad\//u;
// Windows paths ignore case, and nested JSON escaping repeats the separator.
// The drive letter must start a word or follow a JSON escape (\n, \t, \uXXXX).
const windowsUserPath =
  /(?:(?<![a-z\d_])|(?<=\\[bfnrt]|\\u[0-9a-f]{4}))[a-z]:[/\\]+users[/\\]+/iu;
for (const dir of readdirSync(publicRoot).filter(
  (name) =>
    name.startsWith('commerce-') &&
    statSync(new URL(name, publicRoot)).isDirectory()
))
  for (const file of readdirSync(new URL(`${dir}/`, publicRoot), {
    recursive: true,
  })) {
    const url = new URL(`${dir}/${file}`, publicRoot);
    if (
      /\.(?:gif|gz|jpe?g|mp4|pdf|png|webm|webp)$/u.test(file) ||
      !statSync(url).isFile()
    )
      continue;
    const text = readFileSync(url, 'utf8');
    assert(
      !localPath.test(text) && !windowsUserPath.test(text),
      `${dir}/${file} publishes a local path; re-record it from a neutral checkout and TMPDIR`
    );
    // Terminal escapes (FORCE_COLOR output), raw or JSON-escaped, can hide a
    // Bun summary from the log check.
    assert(
      !/\x1b|\\u001b/iu.test(text),
      `${dir}/${file} publishes terminal escape codes; re-record it without FORCE_COLOR`
    );
    const name = `${dir}/${file}`;
    if (unreplayedLogs.has(name)) continue;
    // Some .txt records hold JSON; other text is scanned as it is.
    let value = text;
    try {
      value = JSON.parse(text);
    } catch (error) {
      assert(
        !file.endsWith('.json'),
        `${name} is not valid JSON: ${error.message}`
      );
    }
    for (const log of bunLogs(value))
      assertPassLines(
        name,
        log,
        [...log.matchAll(/^[ \t]* (\d+) pass$/gmu)].reduce(
          (sum, [, count]) => sum + Number(count),
          0
        )
      );
  }
console.log(
  'Commerce evidence: no published text file names a local path, and every published Bun log outside the recorded exemptions lists its passing tests (archives are not scanned).'
);
