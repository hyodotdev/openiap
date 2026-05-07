#!/usr/bin/env bun
// One-shot helper: replace placeholder csharp: stubs in LanguageTabs blocks
// with C# code derived from each block's kotlin: entry. The transform is a
// deterministic rewrite of Kotlin into idiomatic C# for the OpenIAP MAUI
// library. Safe to re-run: it only touches stubs whose body starts with the
// known placeholder banner.

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const root = new URL('../src/pages/docs', import.meta.url).pathname;
const files = execSync(`grep -lr "LanguageTabs" "${root}"`, {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean);

function kotlinToCSharp(kotlin) {
  let s = kotlin;

  // Signature: `suspend fun name(args): RetType` → `Task<RetType> NameAsync(args)`
  s = s.replace(
    /suspend\s+fun\s+([a-z][A-Za-z0-9]*)\s*\(([\s\S]*?)\)\s*:\s*([A-Za-z0-9_<>\?,\s\.]+)/g,
    (_m, name, args, ret) => {
      const csName = name[0].toUpperCase() + name.slice(1) + 'Async';
      return `Task<${ret.trim()}> ${csName}(${convertArgs(args)})`;
    }
  );

  // Signature with no return: `suspend fun name(args)` → `Task NameAsync(args)`
  s = s.replace(
    /suspend\s+fun\s+([a-z][A-Za-z0-9]*)\s*\(([\s\S]*?)\)(?!\s*:)/g,
    (_m, name, args) => {
      const csName = name[0].toUpperCase() + name.slice(1) + 'Async';
      return `Task ${csName}(${convertArgs(args)})`;
    }
  );

  // Call sites: `openIapStore.x(`, `kmpIAP.x(`, `kmpIapInstance.x(`, `iap.x(` →
  // `await ((QueryResolver)Iap.Instance).XAsync(` (best-effort; reader can
  // swap to MutationResolver where appropriate).
  s = s.replace(
    /\b(openIapStore|kmpIAP|kmpIapInstance|iap)\.([a-z][A-Za-z0-9]*)\(/g,
    (_m, _recv, method) => {
      const csName = method[0].toUpperCase() + method.slice(1) + 'Async';
      return `await ((QueryResolver)Iap.Instance).${csName}(`;
    }
  );

  // Strip imports — replaced by usings below.
  s = s.replace(/^import\s+[^\n]*\n?/gm, '');

  // `val` → `var`; strip explicit type annotations on `var` decls.
  s = s.replace(/\bval\s+/g, 'var ');
  s = s.replace(
    /\bvar\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z0-9_<>\?,\.\s]+?)\s*=/g,
    'var $1 ='
  );

  // `listOf("a", "b")` → `new[] { "a", "b" }`
  s = s.replace(/\blistOf\(([^)]*)\)/g, 'new[] { $1 }');

  // Trim leading blank lines from the import-removal pass.
  s = s.replace(/^\s*\n/, '');

  // Prepend MAUI usings on example-style snippets (anything that isn't a bare
  // one-line method signature).
  const trimmed = s.trim();
  const isSignature =
    /^(?:(?:public|protected|internal|private|static|async|virtual|override|sealed)\s+)*Task(?:<[^>\n]+>)?\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*;?$/.test(
      trimmed
    );
  if (!isSignature) {
    s = `using OpenIap;\nusing OpenIap.Maui;\n\n${trimmed}`;
  } else {
    s = trimmed;
  }

  return s;
}

function convertArgs(args) {
  const parts = splitTopLevel(args);
  return parts
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return '';
      const m = trimmed.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^=]+?)(?:\s*=\s*([\s\S]+))?$/
      );
      if (!m) return trimmed;
      const [, n, t, d] = m;
      const csName = n[0].toUpperCase() + n.slice(1);
      const csType = t.trim();
      return d ? `${csType} ${csName} = ${d.trim()}` : `${csType} ${csName}`;
    })
    .join(', ');
}

function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let buf = '';
  for (const ch of s) {
    if (ch === '<' || ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

function escapeBacktick(s) {
  return s.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

let touched = 0;
let replaced = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let updated = '';
  let cursor = 0;

  while (cursor < original.length) {
    const openIdx = original.indexOf('<LanguageTabs', cursor);
    if (openIdx === -1) {
      updated += original.slice(cursor);
      break;
    }
    const closeIdx = original.indexOf('</LanguageTabs>', openIdx);
    if (closeIdx === -1) {
      updated += original.slice(cursor);
      break;
    }

    updated += original.slice(cursor, openIdx);
    let block = original.slice(openIdx, closeIdx + '</LanguageTabs>'.length);

    const kotlinMatch = block.match(
      /kotlin:\s*\(\s*<CodeBlock language="kotlin">\{`([\s\S]*?)`\}<\/CodeBlock>\s*\)/
    );

    const placeholderRegex =
      /csharp:\s*\(\s*<CodeBlock language="csharp">\{`\/\/ \.NET MAUI[\s\S]*?\`\}<\/CodeBlock>\s*\)/;

    if (kotlinMatch && placeholderRegex.test(block)) {
      const csharpBody = escapeBacktick(kotlinToCSharp(kotlinMatch[1]));
      block = block.replace(
        placeholderRegex,
        `csharp: (\n            <CodeBlock language="csharp">{\`${csharpBody}\`}</CodeBlock>\n          )`
      );
      replaced++;
    }

    updated += block;
    cursor = closeIdx + '</LanguageTabs>'.length;
  }

  if (updated !== original) {
    writeFileSync(file, updated);
    touched++;
  }
}

console.log(`replaced ${replaced} stub(s) across ${touched} file(s)`);
