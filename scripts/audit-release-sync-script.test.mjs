import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { auditGitAddBlocks } from './audit-release-sync-script.mjs';

test('catches the dropped line continuation that broke a release', () => {
  const broken = [
    'git add \\',
    '  packages/docs/public/llms.txt \\',
    '  knowledge/_agent-context/context.md',
    '  knowledge/_claude-context',
  ].join('\n');

  const failures = auditGitAddBlocks(broken);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /would run it as a command/u);
});

test('accepts the same list once the continuation is restored', () => {
  const fixed = [
    'git add \\',
    '  packages/docs/public/llms.txt \\',
    '  knowledge/_agent-context/context.md \\',
    '  knowledge/_claude-context',
  ].join('\n');

  assert.deepEqual(auditGitAddBlocks(fixed), []);
});

test('reports a staged path that no longer exists', () => {
  const stale = ['git add \\', '  knowledge/_removed-context/context.md'].join(
    '\n',
  );

  const failures = auditGitAddBlocks(stale);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /staged path does not exist/u);
});

test('the committed script passes its own audit', () => {
  const source = readFileSync('scripts/sync-release-generated.sh', 'utf8');
  assert.deepEqual(auditGitAddBlocks(source), []);
});
