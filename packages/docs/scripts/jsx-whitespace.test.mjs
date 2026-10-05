import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// JSX drops whitespace around newlines, so `word\n<code>x</code>` renders
// "wordx". This reports cross-line joins between prose text and an inline
// element or expression. It skips same-line pairs, `{' '}` joins,
// non-inline elements, pairs without prose text (a newline there drops no
// space), comments, and unspaced em/en dash joins.
const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, '..');

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else if (entry.name.endsWith('.tsx')) found.push(path);
  }
  return found.sort();
}

const JOIN_END = /[A-Za-z0-9.!?;:'")\]}%]/;
const JOIN_START = /[A-Za-z0-9]/;
const INLINE = new Set([
  'a',
  'code',
  'em',
  'strong',
  'span',
  'Link',
  'small',
  'sub',
  'sup',
]);

// JSX text decodes entities so `;` is not misread; literals stay as written.
const MDASH_ENTITY = /&(?:mdash|#8212|#x2014);/gi;
const NDASH_ENTITY = /&(ndash|#8211|#x2013);/gi;
const DASH = /[—–]/;

function decodeDashes(s) {
  return s.replace(MDASH_ENTITY, '—').replace(NDASH_ENTITY, '–');
}

function jsxText(raw) {
  raw = decodeDashes(raw);
  if (!raw.includes('\n')) return raw;
  const lines = raw.split('\n');
  let last = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/[^ \t]/.test(lines[i])) last = i;
  }
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/\t/g, ' ');
    if (i !== 0) line = line.replace(/^[ ]+/, '');
    if (i !== lines.length - 1) line = line.replace(/[ ]+$/, '');
    if (line) out += line + (i === last ? '' : ' ');
  }
  return out;
}

// Join edge of a decoded text, or null. A dash edge joins only with
// a space on its far side inside the same text.
function joinEdge(text, first) {
  if (!text) return null;
  const edge = first ? text[0] : text[text.length - 1];
  if ((first ? JOIN_START : JOIN_END).test(edge)) return edge;
  if (text.length < 2 || !DASH.test(edge)) return null;
  const far = first ? text[1] : text[text.length - 2];
  return /\s/.test(far) ? edge : null;
}

// First or last decoded text inside an element, or null.
function edgeText(element, first) {
  const kids = first ? element.children : [...element.children].reverse();
  for (const child of kids) {
    if (ts.isJsxText(child)) {
      const text = jsxText(child.text);
      if (text) return text;
    } else if (ts.isJsxElement(child) || ts.isJsxFragment(child)) {
      const found = edgeText(child, first);
      if (found) return found;
    } else if (ts.isJsxExpression(child)) {
      const inner = child.expression;
      if (inner && ts.isStringLiteral(inner)) {
        if (inner.text) return inner.text;
      } else if (inner) {
        return null;
      }
    }
  }
  return null;
}

function isSpaceExpr(node) {
  return (
    ts.isJsxExpression(node) &&
    !node.dotDotDotToken &&
    node.expression &&
    ts.isStringLiteral(node.expression) &&
    node.expression.text.trim() === ''
  );
}

function scanSource(text, path) {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const findings = [];
  const lineOf = (pos) => source.getLineAndCharacterOfPosition(pos).line + 1;
  const check = (children) => {
    for (let i = 0; i + 1 < children.length; i++) {
      const a = children[i];
      const b = children[i + 1];
      if (isSpaceExpr(a) || isSpaceExpr(b)) continue;
      if (
        (ts.isJsxElement(a) &&
          !INLINE.has(a.openingElement.tagName.getText())) ||
        (ts.isJsxElement(b) && !INLINE.has(b.openingElement.tagName.getText()))
      ) {
        continue;
      }
      let endPos = a.end;
      if (ts.isJsxText(a)) {
        const last = a.text.search(/\S(?=\s*$)/);
        endPos = last < 0 ? a.end : a.getFullStart() + last + 1;
      }
      if (lineOf(endPos - 1) === lineOf(b.getStart(source))) continue;
      let end = null;
      let endUnknown = false;
      if (ts.isJsxText(a)) {
        end = joinEdge(jsxText(a.text), false);
      } else if (ts.isJsxElement(a) || ts.isJsxFragment(a)) {
        end = joinEdge(edgeText(a, false), false);
      } else if (ts.isJsxExpression(a)) {
        const inner = a.expression;
        if (!inner) continue;
        if (!ts.isStringLiteral(inner)) endUnknown = true;
        else if (!inner.text) continue;
        else end = joinEdge(inner.text, false);
      } else {
        continue;
      }
      if (!endUnknown && end === null) continue;
      let start = null;
      let startUnknown = false;
      if (ts.isJsxText(b)) {
        start = joinEdge(jsxText(b.text), true);
      } else if (ts.isJsxElement(b) || ts.isJsxFragment(b)) {
        start = joinEdge(edgeText(b, true), true);
      } else if (ts.isJsxExpression(b)) {
        const inner = b.expression;
        if (!inner) continue;
        if (!ts.isStringLiteral(inner)) startUnknown = true;
        else if (!inner.text) continue;
        else start = joinEdge(inner.text, true);
      } else {
        continue;
      }
      if (!startUnknown && start === null) continue;
      const show = (char, unknown) => (unknown ? '{expr}' : `'${char}'`);
      findings.push(
        `${path}:${lineOf(endPos - 1)} ${show(end, endUnknown)} + ${show(start, startUnknown)}`
      );
    }
    for (const child of children) {
      if (ts.isJsxElement(child) || ts.isJsxFragment(child)) {
        check(child.children);
      }
    }
  };
  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      check(node.children);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

function scanFile(path) {
  return scanSource(readFileSync(path, 'utf8'), path);
}

const page = (body) =>
  `export function Fixture() {\n  return (\n    <div>\n${body}\n    </div>\n  );\n}\n`;

test('text to inline element joins are still reported', () => {
  const flagged = page(`      <p>
        word
        <code>x</code>
      </p>`);
  assert.equal(scanSource(flagged, 'fixture.tsx').length, 1);
});

test('expression neighbors follow the same newline rule', () => {
  const flagged = page(`      <p>
        word
        {value}
      </p>
      <p>
        {value}
        word
      </p>
      <p>
        word
        {'suffix'}
      </p>`);
  assert.equal(scanSource(flagged, 'fixture.tsx').length, 3);
});

test('punctuation literals, comments, and explicit spaces stay clean', () => {
  const clean = page(`      <p>
        word
        {'.'}
      </p>
      <p>
        word
        {/* note */}
      </p>
      <p>
        word{' '}
        {value}
      </p>`);
  assert.deepEqual(scanSource(clean, 'fixture.tsx'), []);
});

test('dash joins are accepted', () => {
  const clean = page(`      <p>
        word&mdash;
        <code>y</code>
      </p>
      <p>
        word&ndash;
        <code>y</code>
      </p>
      <p>
        word&#8212;
        <code>y</code>
      </p>
      <p>
        word&#8211;
        <code>y</code>
      </p>
      <p>
        word&#x2014;
        <code>y</code>
      </p>
      <p>
        word&#x2013;
        <code>y</code>
      </p>
      <p>
        word—
        <code>y</code>
      </p>
      <p>
        word–
        <code>y</code>
      </p>
      <p>
        <code>x</code>
        &mdash;word
      </p>
      <p>
        <code>x</code>
        &mdash;
        <code>y</code>
      </p>`);
  assert.deepEqual(scanSource(clean, 'fixture.tsx'), []);
});

test('one-sided spaced dash joins are reported', () => {
  const flagged = page(`      <p>
        word &mdash;
        <code>y</code>
      </p>
      <p>
        word &ndash;
        <code>y</code>
      </p>
      <p>
        word &#8212;
        <code>y</code>
      </p>
      <p>
        word &#8211;
        <code>y</code>
      </p>
      <p>
        word &#x2014;
        <code>y</code>
      </p>
      <p>
        word &#x2013;
        <code>y</code>
      </p>
      <p>
        word —
        <code>y</code>
      </p>
      <p>
        word –
        <code>y</code>
      </p>
      <p>
        <code>x</code>
        &mdash; word
      </p>`);
  assert.equal(scanSource(flagged, 'fixture.tsx').length, 9);
});

test('element-wrapped dash edges follow the same spacing rule', () => {
  const clean = page(`      <p>
        word
        <em>—x</em>
      </p>
      <p>
        <em>x—</em>
        word
      </p>`);
  assert.deepEqual(scanSource(clean, 'fixture.tsx'), []);
  const flagged = page(`      <p>
        word
        <em>— x</em>
      </p>
      <p>
        <em>x —</em>
        word
      </p>
      <p>
        <strong>Note —</strong>
        word
      </p>
      <p>
        word
        <em>— note</em>
      </p>`);
  assert.equal(scanSource(flagged, 'fixture.tsx').length, 4);
});

test('string-literal dash edges follow the same spacing rule', () => {
  const clean = page(`      <p>
        {'x—'}
        word
      </p>
      <p>
        word
        <em>{'—x'}</em>
      </p>`);
  assert.deepEqual(scanSource(clean, 'fixture.tsx'), []);
  const flagged = page(`      <p>
        word
        {'— x'}
      </p>
      <p>
        {'x —'}
        word
      </p>
      <p>
        word
        <em>{'— x'}</em>
      </p>`);
  assert.equal(scanSource(flagged, 'fixture.tsx').length, 3);
});

test('string literals keep entities as written', () => {
  const flagged = page(`      <p>
        {'x&mdash;'}
        word
      </p>`);
  assert.equal(scanSource(flagged, 'fixture.tsx').length, 1);
  const clean = page(`      <p>
        word
        {'&mdash; x'}
      </p>`);
  assert.deepEqual(scanSource(clean, 'fixture.tsx'), []);
});

test('element edges use the nearest text in each direction', () => {
  const flagged = page(`      <p>
        <em>a <code>b</code> c</em>
        word
      </p>
      <p>
        word
        <em>a <code>b</code> c</em>
      </p>`);
  const findings = scanSource(flagged, 'fixture.tsx');
  assert.equal(findings.length, 2);
  assert.ok(findings[0].includes("'c' + 'w'"));
  assert.ok(findings[1].includes("'d' + 'a'"));
});

test('element edges skip comments and empty literals', () => {
  const flagged = page(`      <p>
        word
        <em>{/* c */}x</em>
      </p>
      <p>
        word
        <em>{''}x</em>
      </p>`);
  assert.equal(scanSource(flagged, 'fixture.tsx').length, 2);
  const clean = page(`      <p>
        word
        <em>{value}x</em>
      </p>`);
  assert.deepEqual(scanSource(clean, 'fixture.tsx'), []);
});

test('nested element edges recurse inward in the right direction', () => {
  const literal = page(`      <p>
        <em>{'x&mdash;'}</em>
        word
      </p>`);
  const literalFindings = scanSource(literal, 'fixture.tsx');
  assert.equal(literalFindings.length, 1);
  assert.ok(literalFindings[0].includes("';' + 'w'"));
  const nested = page(`      <p>
        word
        <a><code>x</code></a>
      </p>`);
  const nestedFindings = scanSource(nested, 'fixture.tsx');
  assert.equal(nestedFindings.length, 1);
  assert.ok(nestedFindings[0].includes("'d' + 'x'"));
  const clean = page(`      <p>
        word
        <em><code>{'.'}x</code></em>
      </p>`);
  assert.deepEqual(scanSource(clean, 'fixture.tsx'), []);
});

test('element-only joins stay unchecked', () => {
  const clean = page(`      <p>
        <code>a</code>
        <code>b</code>
      </p>`);
  assert.deepEqual(scanSource(clean, 'fixture.tsx'), []);
});

test('no cross-line JSX joins in docs pages', () => {
  const findings = walk(join(docs, 'src')).flatMap((page) => scanFile(page));
  assert.deepEqual(findings, []);
});
