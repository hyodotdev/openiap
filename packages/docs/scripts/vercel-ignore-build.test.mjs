import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { DOCS_INPUTS, decide } from './vercel-ignore-build.mjs';

const repo = new URL('../../../', import.meta.url);
const readJson = (path) =>
  JSON.parse(readFileSync(new URL(path, repo), 'utf8'));
const vercel = readJson('packages/docs/vercel.json');

// A fake git: `fail` lists the subcommands that exit non-zero (a diff exits 1
// when it finds a change); `mergeHead` is FETCH_HEAD^2's commit.
const fakeGit = ({ fail = [], mergeHead = 'head' } = {}) => {
  const calls = [];
  const git = (args) => {
    calls.push(args);
    if (fail.includes(args[0]))
      throw Object.assign(new Error(`${args[0]} failed`), { status: 1 });
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
  for (const [name, version] of Object.entries(
    readJson('packages/docs/package.json').dependencies
  )) {
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
  assert.deepEqual(decide(pr, fakeGit({ fail: ['diff'] }).git), {
    build: true,
    reason: 'a docs input differs from PR #552',
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
    assert.equal(decide(env, fakeGit({ fail: ['fetch'] }).git).build, true);
});

test('the command exits 1 when it builds', () => {
  const production = spawnSync(
    process.execPath,
    ['scripts/vercel-ignore-build.mjs'],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { PATH: process.env.PATH, VERCEL_ENV: 'production' },
      encoding: 'utf8',
    }
  );
  assert.equal(production.status, 1);
  assert.match(production.stdout, /^Building: production deployment\./u);
});
