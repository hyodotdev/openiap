import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';

const root = fileURLToPath(new URL('..', import.meta.url));
export const origin = 'https://openiap.dev';

// The page's SEO declaration also owns its sitemap and static HTML address.
export async function canonicalPaths(directory) {
  const paths = new Set();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const path of await canonicalPaths(filename)) paths.add(path);
    } else if (entry.name.endsWith('.tsx')) {
      const source = ts.createSourceFile(
        filename,
        await readFile(filename, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      function visit(node) {
        if (
          (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
          node.tagName.getText(source) === 'SEO'
        ) {
          const path = node.attributes.properties.find(
            (prop) =>
              ts.isJsxAttribute(prop) && prop.name.getText(source) === 'path'
          );
          if (!path) paths.add('/');
          else if (path.initializer && ts.isStringLiteral(path.initializer)) {
            paths.add(path.initializer.text || '/');
          } else
            assert.equal(
              path.initializer?.getText(source),
              '{config.seo.path}',
              `${filename}: add canonical path discovery for this SEO expression`
            );
        }
        // Store example pages pass their SEO fields to a shared template.
        if (
          ts.isPropertyAssignment(node) &&
          node.name.getText(source) === 'seo' &&
          ts.isObjectLiteralExpression(node.initializer)
        ) {
          const path = node.initializer.properties.find(
            (prop) =>
              ts.isPropertyAssignment(prop) &&
              prop.name.getText(source) === 'path'
          );
          if (path && ts.isStringLiteral(path.initializer))
            paths.add(path.initializer.text);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  return [...paths].sort();
}

export function pageHtml(template, rendered, path) {
  assert(
    /^\/(?:[a-z0-9-]+\/?)*$/.test(path),
    `Invalid canonical path: ${path}`
  );
  const metadata = [];
  // An SVG icon's <title> is body content, not the document title.
  const svgs = [];
  const body = rendered
    .replace(
      /<svg[\s\S]*?<\/svg>/g,
      (svg) => `\u0000${svgs.push(svg) - 1}\u0000`
    )
    .replace(/<title>[\s\S]*?<\/title>|<(?:meta|link)\s[^>]*\/>/g, (tag) => {
      metadata.push(tag.replace(/^<(\w+)/, '<$1 data-prerender="true"'));
      return '';
    })
    .replace(/\u0000(\d+)\u0000/g, (_, index) => svgs[Number(index)]);
  const head = metadata.join('\n');
  const canonicals = [
    ...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g),
  ];
  assert.equal(canonicals.length, 1, `${path}: expected one canonical`);
  assert.equal(
    canonicals[0][1],
    `${origin}${path}`,
    `${path}: wrong canonical`
  );
  assert.equal(
    (head.match(/<title\b/g) ?? []).length,
    1,
    `${path}: expected one title`
  );
  assert(
    /name="description" content="[^"]+"/.test(head),
    `${path}: missing description`
  );
  assert(
    /property="og:title" content="[^"]+"/.test(head),
    `${path}: missing social title`
  );
  assert(
    /<h1\b[^>]*>[\s\S]*?<\/h1>/.test(body),
    `${path}: missing rendered heading`
  );
  assert(
    body.replace(/<[^>]*>/g, '').trim().length > 100,
    `${path}: missing readable content`
  );
  assert(template.includes('<div id="root"></div>'), 'Missing HTML root');
  return template
    .replace('</head>', `${head}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

export function sitemapXml(pages) {
  const indexable = pages.filter(
    ({ html }) =>
      !/<meta\b[^>]*name="robots"[^>]*content="[^"]*\bnoindex\b/i.test(html)
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable.map(({ path }) => `  <url><loc>${origin}${path}</loc></url>`).join('\n')}\n</urlset>\n`;
}

async function prerender() {
  const paths = await canonicalPaths(join(root, 'src/pages'));
  const template = await readFile(join(root, 'dist/index.html'), 'utf8');
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom',
    // React Router's Node export uses the module-sync ESM condition.
    ssr: { resolve: { externalConditions: ['node', 'module-sync'] } },
  });
  try {
    const { render, LIBRARIES } = await vite.ssrLoadModule(
      '/src/entry-server.tsx'
    );
    const pages = paths.map((path) => {
      try {
        return { path, html: pageHtml(template, render(path), path) };
      } catch (error) {
        throw new Error(`Cannot prerender ${path}: ${error.message}`, {
          cause: error,
        });
      }
    });
    const sdkPage =
      pages.find((page) => page.path === '/languages')?.html ?? '';
    for (const library of LIBRARIES) {
      assert(
        paths.includes(library.setupPath),
        `${library.frameworkName}: missing setup page`
      );
      assert(
        sdkPage.includes(`href="${library.setupPath}"`),
        `${library.frameworkName}: missing setup link`
      );
      assert(
        sdkPage.includes(`href="${library.url}"`),
        `${library.frameworkName}: missing source link`
      );
      assert(
        sdkPage.includes(library.displayName),
        `${library.frameworkName}: missing package name`
      );
      if (library.installCommand) {
        assert(
          sdkPage.includes(renderToStaticMarkup(library.installCommand)),
          `${library.frameworkName}: missing install command`
        );
      }
    }
    // Unknown and client-redirected routes fall back to the bare shell, not
    // to the prerendered homepage with its canonical URL and body.
    await writeFile(join(root, 'dist/_app.html'), template);
    for (const { path, html } of pages) {
      const destination = join(
        root,
        'dist',
        path === '/' ? 'index.html' : `${path.slice(1)}.html`
      );
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, html);
    }
    await writeFile(join(root, 'dist/sitemap.xml'), sitemapXml(pages));
    console.log(
      `Prerendered ${paths.length} canonical pages with readable HTML, metadata, and a sitemap of indexable pages.`
    );
  } finally {
    await vite.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await prerender();
}
