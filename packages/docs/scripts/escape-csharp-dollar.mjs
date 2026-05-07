#!/usr/bin/env bun
// Re-escape `${` → `\${` inside csharp CodeBlock bodies. Required after the
// replace-csharp-tabs pass because Kotlin source had pre-escaped `\${` and
// over-trimming the backslash left bare `${` that JSX treats as live
// template interpolation.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const root = new URL('../src/pages/docs', import.meta.url).pathname;
const files = execSync(`grep -rln '\\\${' "${root}" || true`, { shell: '/bin/bash', encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);

let touched = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  // Match the csharp CodeBlock body and escape any unescaped `${` inside.
  const updated = original.replace(
    /(<CodeBlock language="csharp">\{`)([\s\S]*?)(`\}<\/CodeBlock>)/g,
    (_full, open, body, close) => {
      const escaped = body.replace(/(^|[^\\])\$\{/g, '$1\\${');
      return open + escaped + close;
    },
  );
  if (updated !== original) {
    writeFileSync(file, updated);
    touched++;
  }
}

console.log(`escaped \${} in ${touched} file(s)`);
