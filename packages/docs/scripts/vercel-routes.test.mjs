import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { canonicalPaths } from './prerender.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const vercel = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const pages = [...(await canonicalPaths(join(root, 'src/pages')))];
// Vercel serves prerendered pages only; these client routes pick their target
// from the URL hash, which never reaches the server, so they get the bare shell.
const shellRoutes = vercel.rewrites
  .filter(({ destination }) => destination === '/_app')
  .map(({ source }) => source);
// Where each router file mounts its relative paths.
const routers = {
  'src/App.tsx': '/',
  'src/pages/docs/index.tsx': '/docs/',
  'src/pages/commerce-protocol/index.tsx': '/commerce-protocol/',
};
// A `/:path*` source also matches its bare prefix.
const redirects = vercel.redirects.map((redirect) => {
  const prefix = redirect.source.replace(/\/:path\*$/, '');
  const matches =
    prefix === redirect.source
      ? (path) => path === prefix
      : (path) => path === prefix || path.startsWith(`${prefix}/`);
  return { ...redirect, matches };
});
const pathOf = (url) => url.replace(/[?#].*$/, '').replace(/(.)\/$/, '$1');

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(join(root, directory), {
    withFileTypes: true,
  })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await sourceFiles(file)));
    else if (/\.tsx?$/.test(entry.name)) files.push(file);
  }
  return files;
}
const sources = await Promise.all(
  (await sourceFiles('src')).map(async (file) => [
    file,
    ts.createSourceFile(
      file,
      await readFile(join(root, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    ),
  ])
);

function walk(source, visit) {
  const next = (node) => {
    visit(node);
    ts.forEachChild(node, next);
  };
  next(source);
}

test('Vercel serves every client route', () => {
  const routes = [];
  for (const [file, source] of sources) {
    const mount = routers[file];
    walk(source, (node) => {
      if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node))
        return;
      const tag = node.tagName.getText(source);
      if (tag === 'Routes')
        assert(mount, `${file}: add where its <Routes> mount to routers`);
      if (tag !== 'Route' || !mount) return;
      const path = node.attributes.properties.find(
        (prop) =>
          ts.isJsxAttribute(prop) && prop.name.getText(source) === 'path'
      )?.initializer?.text;
      // Layouts and splats (not-found pages) are not addresses.
      if (ts.isJsxOpeningElement(node) || path?.endsWith('*')) return;
      routes.push(pathOf(mount + (path ?? '')));
    });
  }
  for (const route of routes) {
    if (pages.includes(route) || shellRoutes.includes(route)) continue;
    assert.fail(
      redirects.some(({ matches }) => matches(route))
        ? `${route}: vercel.json already redirects it; drop the client route`
        : `${route}: Vercel returns 404 for a client-only route; give it a page, redirect it in vercel.json, or rewrite a hash-routed redirect to /_app`
    );
  }
  for (const route of shellRoutes)
    assert(
      routes.includes(route) && !pages.includes(route),
      `${route}: rewrite only hash-routed client pages to /_app`
    );
});

test('redirects leave pages alone and land on a page', () => {
  const sourcePaths = redirects.map(({ source }) => source);
  assert.equal(new Set(sourcePaths).size, sourcePaths.length, 'duplicate');
  for (const { source, destination, permanent, matches } of redirects) {
    assert.equal(permanent, true, `${source}: moved pages redirect with 308`);
    const shadowed = pages.find(matches);
    assert(!shadowed, `${source}: redirect shadows the page ${shadowed}`);
    if (destination.startsWith('https://')) continue;
    const page = pathOf(destination).replace(/\/:path\*$/, '');
    assert(pages.includes(page), `${source}: ${destination} is not a page`);
  }
});

test('in-app navigation skips server redirects', () => {
  // React Router follows an in-app link or navigate() without asking the
  // server, so a path that only the server redirects renders the not-found page.
  for (const [file, source] of sources) {
    walk(source, (node) => {
      if (!ts.isStringLiteralLike(node)) return;
      // A prefix test such as pathname.startsWith('/docs') is not a link.
      const call = node.parent;
      if (
        ts.isCallExpression(call) &&
        ts.isPropertyAccessExpression(call.expression) &&
        call.expression.name.text === 'startsWith'
      )
        return;
      const path = pathOf(node.text);
      assert(
        !redirects.some(({ matches }) => matches(path)),
        `${file}: ${node.text} redirects on the server; use its vercel.json destination`
      );
    });
  }
});
