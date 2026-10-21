// Re-records `distributionFollowup.steps` in experience-verification.json:
// extract the published archive into a new temporary directory, then install
// and test it. The steps publish their cwd, and Bun drops its `(pass)` lines
// when CLAUDECODE is set, so run it as
//   env -u CLAUDECODE TMPDIR=/tmp/openiap-evidence/tmp bun packages/docs/scripts/replay-experience-archive.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const assets = new URL('../public/commerce-example/', import.meta.url);
const recordFile = fileURLToPath(
  new URL('experience-verification.json', assets)
);
const archive = fileURLToPath(new URL('experience-source.tar.gz', assets));
const record = JSON.parse(readFileSync(recordFile, 'utf8'));
const followup = record.distributionFollowup;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(
  hash(readFileSync(archive)),
  followup.archiveSha256,
  'experience-source.tar.gz is not the archive the follow-up records'
);

const workspace = mkdtempSync(join(tmpdir(), 'commerce-experience-bundle-'));
const source = join(workspace, 'source');
const run = (command) => {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: source,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `${command.join(' ')}\n${result.stderr}`);
  return {
    command,
    cwd: source,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

try {
  mkdirSync(source);
  execFileSync('tar', ['-xzf', archive, '-C', source]);
  assert.equal(
    hash(readFileSync(join(source, followup.changedFile))),
    followup.fileSha256,
    `${followup.changedFile} differs from the recorded follow-up`
  );
  const steps = [run(['npm', 'ci']), run(['npm', 'test'])];
  Object.assign(followup, { recordedAt: new Date().toISOString(), steps });
  // The record was first written with ASCII escapes; keeping them limits the
  // diff to the re-recorded block.
  const json = JSON.stringify(record, null, 2).replace(
    /[^\x00-\x7f]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
  writeFileSync(recordFile, `${json}\n`);
  console.log(`Re-recorded the experience archive replay in ${source}.`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
