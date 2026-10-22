#!/usr/bin/env node
// Vercel's Ignored Build Step (ignoreCommand in vercel.json): exit 0 skips the
// deployment, exit 1 builds. Production always builds; a preview builds only
// when it changes a file the docs site is built from.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The site reads only packages/docs; installCommand and buildCommand also read
// these root files.
export const DOCS_INPUTS = [
  'packages/docs',
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

// Any failure, including a diff that finds a change, builds.
export function shouldBuild(env = process.env, git = repoGit) {
  if (env.VERCEL_ENV === 'production') return true;
  const pullRequest = env.VERCEL_GIT_PULL_REQUEST_ID;
  const previous = env.VERCEL_GIT_PREVIOUS_SHA;
  const changed = (from, to) =>
    git(['diff', '--quiet', from, to, '--', ...DOCS_INPUTS]);
  try {
    if (pullRequest) {
      // GitHub's test merge of the PR: parent 1 is its base, parent 2 must be
      // the commit Vercel is deploying.
      git([
        'fetch',
        '--quiet',
        '--depth=2',
        UPSTREAM,
        `refs/pull/${pullRequest}/merge`,
      ]);
      if (git(['rev-parse', 'FETCH_HEAD^2']) !== git(['rev-parse', 'HEAD']))
        return true;
      changed('FETCH_HEAD^1', 'FETCH_HEAD');
    } else if (previous) {
      // A branch without a PR: what changed since its last deployment.
      git(['fetch', '--quiet', '--depth=1', UPSTREAM, previous]);
      changed('FETCH_HEAD', 'HEAD');
    } else return true;
    return false;
  } catch {
    return true;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const build = shouldBuild();
  console.log(
    build
      ? 'Building: this deployment may change the docs site.'
      : 'Skipping: no docs input changed.'
  );
  process.exit(build ? 1 : 0);
}
