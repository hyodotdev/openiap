#!/usr/bin/env node
// The release lanes all call sync-release-generated.sh, and nothing else ever
// runs it — a dropped line continuation in its `git add` shipped once and only
// surfaced mid-release (exit 126, the next path ran as a command). Neither
// `bash -n` nor shellcheck flags that, so check the shape here.

import { readFileSync, existsSync } from 'node:fs';

const SCRIPT = 'scripts/sync-release-generated.sh';

export function auditGitAddBlocks(source) {
  const failures = [];
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    if (!/^\s*git add\s*\\\s*$/.test(line)) return;

    for (let i = index + 1; i < lines.length; i += 1) {
      const raw = lines[i];
      const continues = /\\\s*$/.test(raw);
      const path = raw.replace(/\\\s*$/, '').trim();

      if (path === '') {
        failures.push(`${SCRIPT}:${i + 1}: blank line inside the git add list`);
        break;
      }

      failures.push(...auditPath(path, i + 1));

      if (!continues) {
        // Last entry. A following indented path means a lost continuation.
        const next = lines[i + 1] ?? '';
        if (/^\s+\S/.test(next) && !/^\s*(#|fi\b|done\b|esac\b|\})/.test(next)) {
          failures.push(
            `${SCRIPT}:${i + 1}: git add list ends here but line ${i + 2} ` +
              `("${next.trim()}") is indented — a lost "\\" would run it as a command`,
          );
        }
        break;
      }
    }
  });

  if (!/^\s*git add\s*\\\s*$/m.test(source)) {
    failures.push(`${SCRIPT}: no multi-line git add block found`);
  }

  return failures;
}

function auditPath(path, line) {
  if (path.includes('$') || path.includes('*')) return [];
  return existsSync(path)
    ? []
    : [`${SCRIPT}:${line}: staged path does not exist: ${path}`];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = auditGitAddBlocks(readFileSync(SCRIPT, 'utf8'));
  if (failures.length) {
    console.error('Release sync script audit failed:');
    failures.forEach((f) => console.error(`- ${f}`));
    process.exit(1);
  }
  console.log('Release sync script audit passed.');
}
