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

// Decode dash entities so `;` is not misread; a dash edge joins only
// when spaced on its far side inside the same text.
const MDASH_ENTITY = /&(?:mdash|#8212|#x2014);/gi;
const NDASH_ENTITY = /&(ndash|#8211|#x2013);/gi;
const DASH = /[—–]/;

function jsxText(raw) {
  raw = raw.replace(MDASH_ENTITY, '—').replace(NDASH_ENTITY, '–');
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

function firstChar(element) {
  for (const child of element.children) {
    if (ts.isJsxText(child)) {
      const text = jsxText(child.text);
      if (text) return text[0];
    } else if (ts.isJsxElement(child) || ts.isJsxFragment(child)) {
      const found = firstChar(child);
      if (found) return found;
    } else if (ts.isJsxExpression(child)) {
      if (child.expression && ts.isStringLiteral(child.expression)) {
        const text = child.expression.text;
        if (text) return text[0];
      }
      return null;
    }
  }
  return null;
}

function lastChar(element) {
  for (const child of [...element.children].reverse()) {
    if (ts.isJsxText(child)) {
      const text = jsxText(child.text);
      if (text) return text[text.length - 1];
    } else if (ts.isJsxElement(child) || ts.isJsxFragment(child)) {
      const found = lastChar(child);
      if (found) return found;
    } else if (ts.isJsxExpression(child)) {
      if (child.expression && ts.isStringLiteral(child.expression)) {
        const text = child.expression.text;
        if (text) return text[text.length - 1];
      }
      return null;
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

// Edge char of an expression container: a string literal's edge, null when
// the runtime value is unknown, undefined when it renders nothing.
function exprEdge(node, first) {
  const inner = node.expression;
  if (!inner) return undefined;
  if (!ts.isStringLiteral(inner)) return null;
  if (!inner.text) return undefined;
  return first ? inner.text[0] : inner.text[inner.text.length - 1];
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
      let endSpacedDash = false;
      if (ts.isJsxText(a)) {
        const text = jsxText(a.text);
        end = text ? text[text.length - 1] : null;
        endSpacedDash =
          text.length > 1 && DASH.test(end) && /\s/.test(text[text.length - 2]);
      } else if (ts.isJsxElement(a) || ts.isJsxFragment(a)) {
        end = lastChar(a);
      } else if (ts.isJsxExpression(a)) {
        const edge = exprEdge(a, false);
        if (edge === undefined) continue;
        if (edge === null) endUnknown = true;
        else end = edge;
      } else {
        continue;
      }
      if (
        !endUnknown &&
        (end === null || (!JOIN_END.test(end) && !endSpacedDash))
      )
        continue;
      let start = null;
      let startUnknown = false;
      let startSpacedDash = false;
      if (ts.isJsxText(b)) {
        const text = jsxText(b.text);
        start = text ? text[0] : null;
        startSpacedDash =
          text.length > 1 && DASH.test(start) && /\s/.test(text[1]);
      } else if (ts.isJsxElement(b) || ts.isJsxFragment(b)) {
        start = firstChar(b);
      } else if (ts.isJsxExpression(b)) {
        const edge = exprEdge(b, true);
        if (edge === undefined) continue;
        if (edge === null) startUnknown = true;
        else start = edge;
      } else {
        continue;
      }
      if (
        !startUnknown &&
        (start === null || (!JOIN_START.test(start) && !startSpacedDash))
      )
        continue;
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
