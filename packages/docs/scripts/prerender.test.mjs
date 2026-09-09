import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { mkdir } from 'node:fs/promises';
import { archiveDownloads } from '../vite.config.ts';
import { canonicalPaths, pageHtml, sitemapXml } from './prerender.mjs';

const template = '<html><head></head><body><div id="root"></div></body></html>';
const content =
  '<h1>Verify a purchase</h1><p>The provider checks store evidence. Verification does not attach a user or grant account access. Bind ownership before reading what the user can use.</p>';
const metadata =
  '<title>Verification | OpenIAP</title><meta name="description" content="Check purchase evidence before binding ownership."/><link rel="canonical" href="https://openiap.dev/commerce-protocol/operations"/><meta property="og:title" content="Verification | OpenIAP"/>';
const path = '/commerce-protocol/operations';

test('serves source archives as unchanged downloads, including AI reproduction', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'openiap-archives-'));
  const bytes = gzipSync('Recorded source bytes');
  const archives = [
    'commerce-example/source.tar.gz',
    'commerce-example/ai-reproduction-source.tar.gz',
    'commerce-example/07-account-erasure/source.tar.gz',
    'commerce-composition/source.tar.gz',
  ];
  const middleware = archiveDownloads(directory);
  const server = createServer((request, response) =>
    middleware(request, response, () => {
      response.writeHead(404).end();
    })
  );
  try {
    for (const archive of archives) {
      await mkdir(join(directory, archive, '..'), { recursive: true });
      await writeFile(join(directory, archive), bytes);
    }
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const archive of archives) {
      for (const method of ['GET', 'HEAD']) {
        const response = await fetch(`${base}/${archive}`, { method });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-encoding'), null);
        assert.equal(response.headers.get('content-type'), 'application/gzip');
        assert.equal(
          response.headers.get('content-disposition'),
          `attachment; filename="${archive.split('/').at(-1)}"`
        );
        assert.equal(
          Number(response.headers.get('content-length')),
          bytes.length
        );
        assert.deepEqual(
          Buffer.from(await response.arrayBuffer()),
          method === 'GET' ? bytes : Buffer.alloc(0)
        );
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test('publishes the same readable content and route metadata without JavaScript', () => {
  const html = pageHtml(template, metadata + content, path);
  assert(html.includes(`<div id="root">${content}</div>`));
  assert(html.indexOf('<title data-prerender') < html.indexOf('</head>'));
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1);
});

test('rejects the empty SPA shell and homepage canonical regression', () => {
  assert.throws(
    () => pageHtml(template, metadata, path),
    /missing rendered heading/
  );
  assert.throws(
    () => pageHtml(template, metadata.replace(path, '/') + content, path),
    /wrong canonical/
  );
  assert.throws(
    () => pageHtml(template, metadata + metadata + content, path),
    /one canonical/
  );
  assert.throws(
    () =>
      pageHtml(
        template,
        metadata.replace(/<meta name="description"[^>]*\/>/, '') + content,
        path
      ),
    /missing description/
  );
});

test('renders noindex pages without advertising them in the sitemap', () => {
  const noIndex = '<meta name="robots" content="noindex, follow"/>';
  const html = pageHtml(template, metadata + noIndex + content, path);
  assert(html.indexOf('content="noindex, follow"') < html.indexOf('</head>'));
  const sitemap = sitemapXml([
    { path: '/404', html },
    { path, html: pageHtml(template, metadata + content, path) },
  ]);
  assert(!sitemap.includes('/404'));
  assert(sitemap.includes(`https://openiap.dev${path}`));
});

test('discovers direct pages and shared store templates, ignoring unrelated path fields', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'openiap-canonical-'));
  try {
    await writeFile(
      join(directory, 'pages.tsx'),
      `
      const page = <SEO path="/docs/setup/expo" />;
      const home = <SEO />;
      const store = { seo: { path: '/docs/example/ios' } };
      const unrelated = { path: '/not-a-page' };
    `
    );
    assert.deepEqual(await canonicalPaths(directory), [
      '/',
      '/docs/example/ios',
      '/docs/setup/expo',
    ]);
    await writeFile(
      join(directory, 'dynamic.tsx'),
      '<SEO path={unknownPath} />'
    );
    await assert.rejects(canonicalPaths(directory), /canonical path discovery/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
