import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { DOCS_INPUTS, shouldBuild } from './vercel-ignore-build.mjs';

const repo = new URL('../../../', import.meta.url);
const vercel = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')
);

// A fake git: `fail` lists the subcommands that exit non-zero (a failed fetch,
// or a diff that found a change); `mergeHead` is FETCH_HEAD^2's commit.
const fakeGit = ({ fail = [], mergeHead = 'head' } = {}) => {
  const calls = [];
  const git = (args) => {
    calls.push(args);
    if (fail.includes(args[0])) throw new Error(args[0]);
    if (args[0] === 'rev-parse') return args[1] === 'HEAD' ? 'head' : mergeHead;
    return '';
  };
  return { calls, git };
};
const preview = { VERCEL_ENV: 'preview' };

test('vercel.json runs this script as its ignored build step', () => {
  assert.equal(vercel.ignoreCommand, 'node scripts/vercel-ignore-build.mjs');
});

test('docs inputs exist and cover every root script the build command runs', () => {
  for (const path of DOCS_INPUTS) assert(existsSync(new URL(path, repo)), path);
  for (const [, script] of vercel.buildCommand.matchAll(
    /\.\.\/\.\.\/(scripts\/\S+\.mjs)/gu
  ))
    assert(DOCS_INPUTS.includes(script), `${script} is not a docs input`);
});

test('production always builds', () => {
  const { calls, git } = fakeGit();
  assert.equal(shouldBuild({ VERCEL_ENV: 'production' }, git), true);
  assert.equal(calls.length, 0);
});

test('a PR that changes no docs input is skipped', () => {
  const { calls, git } = fakeGit();
  assert.equal(
    shouldBuild({ ...preview, VERCEL_GIT_PULL_REQUEST_ID: '552' }, git),
    false
  );
  assert.equal(calls[0].at(-1), 'refs/pull/552/merge');
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
  const { git } = fakeGit({ fail: ['diff'] });
  assert.equal(
    shouldBuild({ ...preview, VERCEL_GIT_PULL_REQUEST_ID: '552' }, git),
    true
  );
});

test('a stale test merge builds', () => {
  const { calls, git } = fakeGit({ mergeHead: 'older' });
  assert.equal(
    shouldBuild({ ...preview, VERCEL_GIT_PULL_REQUEST_ID: '552' }, git),
    true
  );
  assert(!calls.some(([command]) => command === 'diff'));
});

test('a branch without a PR compares with its last deployment', () => {
  const { calls, git } = fakeGit();
  assert.equal(
    shouldBuild({ ...preview, VERCEL_GIT_PREVIOUS_SHA: 'abc' }, git),
    false
  );
  assert.equal(calls[0].at(-1), 'abc');
  assert.deepEqual(calls[1].slice(0, 4), [
    'diff',
    '--quiet',
    'FETCH_HEAD',
    'HEAD',
  ]);
});

test('a preview builds when nothing can be compared', () => {
  assert.equal(shouldBuild(preview, fakeGit().git), true);
  const { git } = fakeGit({ fail: ['fetch'] });
  assert.equal(
    shouldBuild({ ...preview, VERCEL_GIT_PULL_REQUEST_ID: '552' }, git),
    true
  );
});
