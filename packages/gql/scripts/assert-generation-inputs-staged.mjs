import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GQL_GENERATION_INPUT_PATHS, isGqlGenerationInputPath } from '../generated-sync-manifest.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const gitLines = (...args) => {
  const output = execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim();
  return output ? output.split('\n') : [];
};

const changedInputs = (...args) => gitLines(...args, '--', ...GQL_GENERATION_INPUT_PATHS).filter(isGqlGenerationInputPath);

const staged = changedInputs('diff', '--cached', '--name-only', '--diff-filter=ACMRD');
const drift = [...changedInputs('diff', '--name-only'), ...changedInputs('ls-files', '--others', '--exclude-standard')]
  .filter((entry, index, entries) => entries.indexOf(entry) === index)
  .sort();

if (process.argv[2] === 'has-staged-inputs') {
  process.exitCode = staged.length > 0 ? 0 : 1;
} else if (process.argv[2] === 'assert-staged-clean') {
  if (drift.length === 0) process.exit(0);
  throw new Error(
    `Canonical GQL inputs contain unstaged or untracked changes. Stage the complete source snapshot before generation:\n${drift.map((path) => `- ${path}`).join('\n')}`,
  );
} else {
  throw new Error(`Unknown command "${process.argv[2] ?? ''}". Expected has-staged-inputs or assert-staged-clean.`);
}
