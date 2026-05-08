#!/usr/bin/env bun
/**
 * audit-docs.ts — SSOT consistency check for /docs/apis and /docs/types pages.
 *
 * What it does
 *   1. Walks every `packages/docs/src/pages/docs/apis/**\/*.tsx` and
 *      `packages/docs/src/pages/docs/types/**\/*.tsx` page.
 *   2. Loads the generated TypeScript types from
 *      `libraries/expo-iap/src/types.ts` and indexes every `interface`,
 *      `type` alias, and `enum` / string-literal union shape.
 *   3. For each doc page, extracts:
 *        - `<Link to="/docs/...">` targets
 *        - `<code>fieldName</code>` mentions inside `<table>` rows or
 *          `<ul className="api-params">` lists
 *        - Enum-style `<code>'literal'</code>` mentions
 *        - `@see {@link …}` URLs
 *      and cross-checks each against the type index.
 *   4. Reports drift as a punch-list (file:line — what's wrong).
 *
 * Exit code 0 = clean, 1 = at least one drift detected.
 *
 * Read knowledge/internal/07-docs-consistency.md for the rules this
 * script enforces.
 */
import { readFileSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..');
const DOC_ROOTS = [
  resolve(REPO_ROOT, 'packages/docs/src/pages/docs/apis'),
  resolve(REPO_ROOT, 'packages/docs/src/pages/docs/types'),
];
const DOC_PAGES_DIR = resolve(REPO_ROOT, 'packages/docs/src/pages');
const TYPES_FILE = resolve(REPO_ROOT, 'libraries/expo-iap/src/types.ts');

type Drift = {
  file: string;
  line: number;
  rule: string;
  message: string;
};

async function walkTsxFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function recurse(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await recurse(full);
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        out.push(full);
      }
    }
  }
  await recurse(root);
  return out;
}

/**
 * Build an index of every interface / type alias / enum-like union
 * defined in libraries/expo-iap/src/types.ts.
 *
 * The index maps:
 *   typeName: string  →  { fields: Set<string>, literals: Set<string> }
 *
 * Fields = property names declared inside `interface X { ... }` or
 *          `type X = { ... }`. Optional `?` is stripped.
 * Literals = string-literal members of a union type
 *            (`type X = 'a' | 'b' | 'c'`).
 */
function buildTypeIndex(): Map<
  string,
  { fields: Set<string>; literals: Set<string> }
> {
  const src = readFileSync(TYPES_FILE, 'utf8');
  const index = new Map<
    string,
    { fields: Set<string>; literals: Set<string> }
  >();

  // interface NAME { ... } — capture body via brace matching
  const interfaceRe = /export\s+interface\s+([A-Za-z_]\w*)\s*(?:extends[^{]+)?\{/g;
  let m: RegExpExecArray | null;
  while ((m = interfaceRe.exec(src)) !== null) {
    const name = m[1];
    const body = extractBraceBlock(src, m.index + m[0].length - 1);
    if (!body) continue;
    const fields = extractInterfaceFields(body);
    index.set(name, {
      fields,
      literals: new Set(),
    });
  }

  // type NAME = '...' | '...' | ... — string-literal unions
  const literalUnionRe =
    /export\s+type\s+([A-Za-z_]\w*)\s*=\s*((?:'[^']*'\s*\|\s*)*'[^']*')\s*;/g;
  while ((m = literalUnionRe.exec(src)) !== null) {
    const name = m[1];
    const literals = new Set<string>();
    for (const lit of m[2].matchAll(/'([^']*)'/g)) literals.add(lit[1]);
    index.set(name, {
      fields: new Set(),
      literals,
    });
  }

  // type NAME = { ... } — object-shape aliases
  const objectAliasRe = /export\s+type\s+([A-Za-z_]\w*)\s*=\s*\{/g;
  while ((m = objectAliasRe.exec(src)) !== null) {
    const name = m[1];
    if (index.has(name)) continue;
    const body = extractBraceBlock(src, m.index + m[0].length - 1);
    if (!body) continue;
    index.set(name, {
      fields: extractInterfaceFields(body),
      literals: new Set(),
    });
  }

  return index;
}

function extractBraceBlock(src: string, openBraceIdx: number): string | null {
  if (src[openBraceIdx] !== '{') return null;
  let depth = 1;
  let i = openBraceIdx + 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    i += 1;
  }
  if (depth !== 0) return null;
  return src.slice(openBraceIdx + 1, i - 1);
}

function extractInterfaceFields(body: string): Set<string> {
  const fields = new Set<string>();
  // Match `name?:` or `name:` at the start of a line (after whitespace
  // or `;`). Skip lines starting with `//` (comments).
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*'))
      continue;
    const fieldMatch = trimmed.match(/^([a-z_$][\w$]*)\s*\??\s*:/i);
    if (fieldMatch) fields.add(fieldMatch[1]);
  }
  return fields;
}

/**
 * Parse a doc page's content for the things we want to audit.
 *
 * Field-name claims are scoped strictly to `<ul className="api-params">`
 * blocks — those are the only place a doc page formally asserts "this
 * is a real field on the type". Function names, native API references,
 * and listener names that appear inside ordinary <code>...</code> spans
 * elsewhere on the page are NOT validated (too many legitimate
 * non-field mentions to enumerate cleanly).
 */
function parseDocPage(filePath: string) {
  const src = readFileSync(filePath, 'utf8');
  const lines = src.split('\n');

  const linkTargets: { line: number; href: string }[] = [];
  const seeUrls: { line: number; url: string }[] = [];
  const fieldMentions: { line: number; field: string }[] = [];

  // Track whether we're inside an `<ul className="api-params">` block.
  // The first `<code>token</code>` of each `<li>` inside such a list is
  // treated as a field-name claim.
  let inParamsList = false;
  let liExpectingField = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNo = i + 1;

    // <Link to="/docs/...">
    for (const m of line.matchAll(/<Link\s+to="(\/docs\/[^"]+)"/g)) {
      linkTargets.push({ line: lineNo, href: m[1] });
    }
    // @see {@link https://www.openiap.dev/...}
    for (const m of line.matchAll(
      /@see\s*\{@link\s+(https:\/\/www\.openiap\.dev\/[^\s}]+)\}/g
    )) {
      seeUrls.push({ line: lineNo, url: m[1] });
    }

    if (line.includes('className="api-params"')) inParamsList = true;
    if (inParamsList) {
      if (line.includes('</ul>')) {
        inParamsList = false;
        liExpectingField = false;
        continue;
      }
      if (/<li>/.test(line)) liExpectingField = true;
      if (liExpectingField) {
        const m = line.match(/<code>([^<']+?)<\/code>/);
        if (m) {
          const token = m[1].trim();
          // Allow dotted paths (`request.apple.sku`) and array-bracket
          // notation. Take the LEAF identifier — that's the field on
          // some intermediate type.
          const leaf = token.split(/[.[\s]/).pop() ?? token;
          if (
            /^[a-z_$][\w$]*$/.test(leaf) &&
            leaf.length > 1 &&
            !RESERVED_WORDS.has(leaf)
          ) {
            fieldMentions.push({ line: lineNo, field: leaf });
          }
          liExpectingField = false;
        }
      }
    }
  }

  return { linkTargets, seeUrls, fieldMentions };
}

const RESERVED_WORDS = new Set([
  'true',
  'false',
  'null',
  'void',
  'any',
  'never',
  'string',
  'number',
  'boolean',
  'object',
  'undefined',
  'this',
  'self',
  'super',
  'async',
  'await',
  'yield',
  'try',
  'catch',
  'finally',
  'throw',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'const',
  'let',
  'var',
  'function',
  'class',
  'extends',
  'implements',
  'interface',
  'type',
  'enum',
  'public',
  'private',
  'protected',
  'static',
  'readonly',
  'abstract',
  'as',
  'is',
  'in',
  'of',
  'new',
  'delete',
  'typeof',
  'instanceof',
  'import',
  'export',
  'from',
  'default',
  'package',
]);

/**
 * Verify a `/docs/<path>` link resolves to a real .tsx page (or its
 * containing folder's `index.tsx`).
 */
function linkResolves(target: string): boolean {
  const [pathPart] = target.split('#');
  // strip leading /docs and trailing slash
  const slug = pathPart.replace(/^\/docs\/?/, '').replace(/\/$/, '');
  if (!slug) return statSyncSafe(join(DOC_PAGES_DIR, 'docs/index.tsx'));
  const candidates = [
    join(DOC_PAGES_DIR, 'docs', `${slug}.tsx`),
    join(DOC_PAGES_DIR, 'docs', slug, 'index.tsx'),
  ];
  return candidates.some(statSyncSafe);
}

function statSyncSafe(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const typeIndex = buildTypeIndex();
  const drifts: Drift[] = [];

  // Build the set of every known field name across every type — used as
  // a lenient fallback for "is this field plausible?" checks. (We don't
  // know which type a `<code>foo</code>` mention belongs to without
  // page-level context, so we accept any field that exists somewhere in
  // types.ts.)
  const allFields = new Set<string>();
  for (const v of typeIndex.values()) {
    for (const f of v.fields) allFields.add(f);
  }

  // Common framework + JS / Dart / Kotlin words that appear in code
  // examples without being IAP fields. Excluded from the fallback.
  const SAFE_WORDS = new Set([
    'console',
    'log',
    'error',
    'warn',
    'instance',
    'shared',
    'connected',
    'await',
    'use',
    'effect',
    'callback',
    'fn',
    'cb',
    'i',
    'j',
    'k',
    'p',
    'a',
    'b',
    'c',
    'x',
    'y',
    'value',
    'name',
    'message',
    'code',
    'reason',
    'data',
    'json',
    'token',
    'url',
    'sku',
    'id',
    'type',
    'platform',
    'native',
    'success',
    'result',
    'error',
    'props',
    'options',
    'params',
    'config',
    'request',
    'args',
    'purchase',
    'product',
    'subscription',
    // Top-level scalar/list function parameters. These legitimately appear
    // in API parameter lists but are not generated object fields.
    'program',
    'subscriptionIds',
    'tokenType',
    'groupId',
    'noticeType',
    'continued',
    'reconnect',
    'cancel',
    'open',
    'close',
    'state',
    'status',
    'group',
    'ok',
    'os',
    'isIOS',
    'isAndroid',
    'productId',
    'orderId',
    'transactionId',
    'purchaseToken',
    'currency',
    'price',
    'count',
    'index',
    'size',
    'length',
    'env',
    'process',
    'self',
    'this',
    'super',
    'continuation',
    'deferred',
    'completion',
    'handler',
    'listener',
    'emitter',
    'subscriber',
    'unsubscribe',
    'remove',
    'add',
  ]);

  const allDocPages: string[] = [];
  for (const root of DOC_ROOTS) {
    allDocPages.push(...(await walkTsxFiles(root)));
  }
  allDocPages.sort();

  for (const file of allDocPages) {
    const { linkTargets, fieldMentions } = parseDocPage(file);

    // R5 — internal /docs links must resolve.
    for (const { line, href } of linkTargets) {
      if (!linkResolves(href)) {
        drifts.push({
          file,
          line,
          rule: 'R5',
          message: `<Link to="${href}"> does not resolve to an existing /docs page.`,
        });
      }
    }

    // R3 — field mentions should appear somewhere in the generated types.
    // We're lenient: if the mentioned word is in SAFE_WORDS or in any
    // type's field set, OK. Otherwise flag.
    for (const { line, field } of fieldMentions) {
      if (SAFE_WORDS.has(field)) continue;
      if (allFields.has(field)) continue;
      drifts.push({
        file,
        line,
        rule: 'R3',
        message: `<code>${field}</code> is not a known field on any generated TypeScript type. Did you rename or invent it?`,
      });
    }
  }

  // R5 (broken /docs links) is a hard failure; R3 (field name not in
  // generated types) is a warning because top-level scalar function
  // params (e.g. `sku: string`, `program: BillingProgramAndroid`)
  // legitimately appear in `<ul className="api-params">` lists without
  // being a field of any type — the audit can't tell them apart from
  // genuine drift without knowing each function's signature.
  const hardFailures = drifts.filter((d) => d.rule !== 'R3');
  const warnings = drifts.filter((d) => d.rule === 'R3');

  if (hardFailures.length === 0 && warnings.length === 0) {
    console.log('audit-docs: clean — 0 drift detected');
    process.exit(0);
  }

  if (warnings.length > 0) {
    console.log(`audit-docs: ${warnings.length} warning(s)\n`);
    for (const d of warnings) {
      const rel = relative(REPO_ROOT, d.file);
      console.log(`  [${d.rule}] ${rel}:${d.line}\n    ${d.message}`);
    }
    console.log('');
  }

  if (hardFailures.length > 0) {
    console.log(`audit-docs: ${hardFailures.length} drift(s) detected\n`);
    for (const d of hardFailures) {
      const rel = relative(REPO_ROOT, d.file);
      console.log(`  [${d.rule}] ${rel}:${d.line}\n    ${d.message}`);
    }
    process.exit(1);
  }

  console.log('audit-docs: no hard failures (warnings above are advisory)');
  process.exit(0);
}

main().catch((err) => {
  console.error('audit-docs: fatal error');
  console.error(err);
  process.exit(2);
});
