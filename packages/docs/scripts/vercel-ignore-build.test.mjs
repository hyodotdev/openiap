import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { DOCS_INPUTS, decide } from './vercel-ignore-build.mjs';

const repo = new URL('../../../', import.meta.url);
const readJson = (path) =>
  JSON.parse(readFileSync(new URL(path, repo), 'utf8'));
const vercel = readJson('packages/docs/vercel.json');

// A fake git: `fail` maps a subcommand to its exit status (a diff exits 1 when
// it finds a change); `mergeHead` is FETCH_HEAD^2's commit.
const fakeGit = ({ fail = {}, mergeHead = 'head' } = {}) => {
  const calls = [];
  const git = (args) => {
    calls.push(args);
    if (fail[args[0]])
      throw Object.assign(new Error(`${args[0]} failed`), {
        status: fail[args[0]],
      });
    if (args[0] === 'rev-parse') return args[1] === 'HEAD' ? 'head' : mergeHead;
    return '';
  };
  return { calls, git };
};
const preview = { VERCEL_ENV: 'preview' };
const pr = { ...preview, VERCEL_GIT_PULL_REQUEST_ID: '552' };
const fetched = (calls) =>
  calls.filter(([command]) => command === 'fetch').map((args) => args.at(-1));

test('vercel.json runs this script as its ignored build step', () => {
  assert.equal(vercel.ignoreCommand, 'node scripts/vercel-ignore-build.mjs');
});

test('docs inputs cover the workspace packages and root scripts the build uses', () => {
  for (const path of DOCS_INPUTS) assert(existsSync(new URL(path, repo)), path);
  const members = readJson('package.json').workspaces.flatMap((glob) => {
    const parent = glob.replace('/*', '');
    return readdirSync(new URL(parent, repo))
      .map((name) => `${parent}/${name}`)
      .filter((dir) => existsSync(new URL(`${dir}/package.json`, repo)));
  });
  const docs = readJson('packages/docs/package.json');
  for (const [name, version] of Object.entries({
    ...docs.dependencies,
    ...docs.devDependencies,
    ...docs.peerDependencies,
    ...docs.optionalDependencies,
  })) {
    if (!version.startsWith('workspace:')) continue;
    const dir = members.find(
      (member) => readJson(`${member}/package.json`).name === name
    );
    assert(DOCS_INPUTS.includes(dir), `${name} (${dir}) is not a docs input`);
  }
  for (const [, script] of vercel.buildCommand.matchAll(
    /\.\.\/\.\.\/(scripts\/\S+\.mjs)/gu
  ))
    assert(DOCS_INPUTS.includes(script), `${script} is not a docs input`);
  // installCommand runs a frozen install from the root manifest.
  assert.match(vercel.installCommand, /--frozen-lockfile/u);
  for (const file of ['package.json', 'bun.lock'])
    assert(DOCS_INPUTS.includes(file), `${file} is not a docs input`);
});

test('anything but a preview builds', () => {
  for (const env of [
    { VERCEL_ENV: 'production' },
    { VERCEL_GIT_PREVIOUS_SHA: 'abc' },
  ]) {
    const { calls, git } = fakeGit();
    assert.equal(decide(env, git).build, true);
    assert.equal(calls.length, 0);
  }
});

test('a PR that changes no docs input is skipped', () => {
  const { calls, git } = fakeGit();
  assert.deepEqual(decide(pr, git), {
    build: false,
    reason: 'no docs input differs from PR #552',
  });
  assert.deepEqual(fetched(calls), ['refs/pull/552/merge']);
  // Depth 2 brings the merge's parents, which the comparison needs.
  assert(calls[0].includes('--depth=2'));
  assert.deepEqual(calls.at(-1), [
    'diff',
    '--quiet',
    'FETCH_HEAD^1',
    'FETCH_HEAD',
    '--',
    ...DOCS_INPUTS,
  ]);
});

test('a PR that changes a docs input builds', () => {
  assert.deepEqual(decide(pr, fakeGit({ fail: { diff: 1 } }).git), {
    build: true,
    reason: 'a docs input differs from PR #552',
  });
});

test('a diff that errors builds and says so', () => {
  assert.deepEqual(decide(pr, fakeGit({ fail: { diff: 128 } }).git), {
    build: true,
    reason: 'cannot compare with PR #552: diff failed',
  });
});

test('a stale test merge builds without diffing', () => {
  const { calls, git } = fakeGit({ mergeHead: 'older' });
  assert.equal(decide(pr, git).build, true);
  assert(!calls.some(([command]) => command === 'diff'));
});

test('a branch compares with its last deployment, else with main', () => {
  for (const [env, base] of [
    [{ ...preview, VERCEL_GIT_PREVIOUS_SHA: 'abc' }, 'abc'],
    [preview, 'main'],
  ]) {
    const { calls, git } = fakeGit();
    assert.equal(decide(env, git).build, false);
    assert.deepEqual(fetched(calls), [base]);
    assert.deepEqual(calls[1].slice(0, 4), [
      'diff',
      '--quiet',
      'FETCH_HEAD',
      'HEAD',
    ]);
  }
});

test('a fetch failure builds', () => {
  for (const env of [
    pr,
    { ...preview, VERCEL_GIT_PREVIOUS_SHA: 'abc' },
    preview,
  ])
    assert.equal(
      decide(env, fakeGit({ fail: { fetch: 128 } }).git).build,
      true
    );
});

test('the command exits 1 to build and 0 to skip', () => {
  // A stub git that succeeds without output: every comparison finds no change.
  const bin = mkdtempSync(join(tmpdir(), 'vercel-ignore-git-'));
  writeFileSync(join(bin, 'git'), '#!/bin/sh\nexit 0\n');
  chmodSync(join(bin, 'git'), 0o755);
  const run = (env) =>
    spawnSync(process.execPath, ['scripts/vercel-ignore-build.mjs'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { PATH: `${bin}:${process.env.PATH}`, ...env },
      encoding: 'utf8',
    });
  const production = run({ VERCEL_ENV: 'production' });
  assert.equal(production.status, 1);
  assert.match(production.stdout, /^Building: production deployment\./u);
  const skipped = run({ VERCEL_ENV: 'preview' });
  assert.equal(skipped.status, 0);
  assert.match(skipped.stdout, /^Skipping: no docs input differs from main\./u);
});
