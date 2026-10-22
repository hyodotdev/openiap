#!/usr/bin/env node
// Vercel's Ignored Build Step (ignoreCommand in vercel.json): exit 0 skips the
// deployment, exit 1 builds. Production always builds; a preview builds only
// when it changes a file the docs site is built from.
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// packages/docs, the workspace packages it bundles, and the root files that
// installCommand and buildCommand read.
export const DOCS_INPUTS = [
  'packages/docs',
  'packages/mcp-server',
  'specs/commerce-protocol',
  'package.json',
  'bun.lock',
  'scripts/release-branch-policy.mjs',
  'scripts/verify-docs-version-metadata.mjs',
];
const UPSTREAM = 'https://github.com/hyodotdev/openiap.git';

const repoGit = (args) =>
  execFileSync('git', args, {
    cwd: fileURLToPath(new URL('../../..', import.meta.url)),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

// Returns whether to build and why; anything it cannot compare builds.
export function decide(env = process.env, git = repoGit) {
  if (env.VERCEL_ENV !== 'preview')
    return { build: true, reason: `${env.VERCEL_ENV ?? 'unknown'} deployment` };
  const pullRequest = env.VERCEL_GIT_PULL_REQUEST_ID;
  const previous = env.VERCEL_GIT_PREVIOUS_SHA;
  let from = 'FETCH_HEAD';
  let to = 'HEAD';
  let base;
  try {
    if (pullRequest) {
      // GitHub's test merge of the PR: parent 1 is its base, parent 2 must be
      // the commit Vercel is deploying.
      base = `PR #${pullRequest}`;
      git([
        'fetch',
        '--quiet',
        '--depth=2',
        UPSTREAM,
        `refs/pull/${pullRequest}/merge`,
      ]);
      if (git(['rev-parse', 'FETCH_HEAD^2']) !== git(['rev-parse', 'HEAD']))
        return { build: true, reason: `${base}'s test merge is stale` };
      [from, to] = ['FETCH_HEAD^1', 'FETCH_HEAD'];
    } else if (previous) {
      base = 'the last deployment';
      git(['fetch', '--quiet', '--depth=1', UPSTREAM, previous]);
    } else {
      // A branch's first push, usually before its PR exists. A branch behind
      // main on docs still builds, which is the safe side.
      base = 'main';
      git(['fetch', '--quiet', '--depth=1', UPSTREAM, 'main']);
    }
  } catch (error) {
    return { build: true, reason: `cannot fetch ${base}: ${error.message}` };
  }
  try {
    git(['diff', '--quiet', from, to, '--', ...DOCS_INPUTS]);
    return { build: false, reason: `no docs input differs from ${base}` };
  } catch (error) {
    return {
      build: true,
      reason:
        error.status === 1
          ? `a docs input differs from ${base}`
          : `cannot compare with ${base}: ${error.message}`,
    };
  }
}

if (realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { build, reason } = decide();
  console.log(`${build ? 'Building' : 'Skipping'}: ${reason}.`);
  process.exit(build ? 1 : 0);
}
