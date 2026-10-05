import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// JSX drops whitespace around newlines, so `word\n<code>x</code>` renders
// "wordx". This scans every docs page for that join.
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

function jsxText(raw) {
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

function scanFile(path) {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
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
      if (ts.isJsxText(a)) {
        const text = jsxText(a.text);
        end = text ? text[text.length - 1] : null;
      } else if (ts.isJsxElement(a) || ts.isJsxFragment(a)) {
        end = lastChar(a);
      } else {
        continue;
      }
      if (end === null || !JOIN_END.test(end)) continue;
      let start = null;
      if (ts.isJsxText(b)) {
        const text = jsxText(b.text);
        start = text ? text[0] : null;
      } else if (ts.isJsxElement(b) || ts.isJsxFragment(b)) {
        start = firstChar(b);
      } else {
        continue;
      }
      if (start === null || !JOIN_START.test(start)) continue;
      findings.push(`${path}:${lineOf(endPos - 1)} '${end}' + '${start}'`);
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

test('no cross-line JSX joins in docs pages', () => {
  const findings = walk(join(docs, 'src')).flatMap((page) => scanFile(page));
  assert.deepEqual(findings, []);
});
