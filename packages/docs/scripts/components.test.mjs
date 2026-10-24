import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Route, Routes, StaticRouter } from 'react-router-dom';

const root = fileURLToPath(new URL('..', import.meta.url));
let vite;
const load = async (path) => (await vite.ssrLoadModule(path)).default;
const at = (location, element) => h(StaticRouter, { location }, element);
// The interactive view, without the no-JavaScript fallback.
const visible = (html) => html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');

before(async () => {
  vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom',
    ssr: { resolve: { externalConditions: ['node', 'module-sync'] } },
  });
});

after(() => vite.close());

test('opens the platform tab that holds the linked anchor', async () => {
  const PlatformTabs = await load('/src/components/PlatformTabs.tsx');
  const tabs = {
    ios: h('p', null, 'ios-content'),
    android: h('div', null, [
      h('h4', { key: 'h', id: 'external-payments-830---japan-only' }, 'Title'),
      h('p', { key: 'p' }, 'android-content'),
    ]),
    horizon: h('p', null, 'horizon-content'),
  };
  const render = (location) =>
    visible(
      renderToStaticMarkup(at(location, h(PlatformTabs, { children: tabs })))
    );

  const anchored = render('/guide#external-payments-830---japan-only');
  assert(anchored.includes('android-content'));
  assert(!anchored.includes('ios-content'));
  assert.match(anchored, /aria-pressed="true"[^>]*>Android</);

  // A hash that names a platform still selects it.
  assert(render('/types#product-horizon').includes('horizon-content'));
  const plain = render('/guide');
  assert(plain.includes('ios-content'));
  assert.match(plain, /role="group" aria-label="Platform"/);
  assert.equal(plain.match(/aria-pressed="true"/g)?.length, 1);
});

test('marks the selected code language', async () => {
  const LanguageTabs = await load('/src/components/LanguageTabs.tsx');
  const html = visible(
    renderToStaticMarkup(
      h(LanguageTabs, {
        children: { swift: h('code', null, 'a'), kotlin: h('code', null, 'b') },
      })
    )
  );
  assert.match(html, /role="group" aria-label="Code language"/);
  assert.match(html, /aria-pressed="true"[^>]*>Swift</);
  assert.match(html, /aria-pressed="false"[^>]*>Kotlin</);
});

test('opens the page that holds the linked release anchor', async () => {
  const Pagination = await load('/src/components/Pagination.tsx');
  const notes = Array.from({ length: 12 }, (_, index) =>
    h('section', { key: `note-${index}` }, [
      h('h4', { key: 'title', id: `note-${index}` }, `Note ${index}`),
      index === 8 && h('span', { key: 'alias', id: 'tag-alias' }),
    ])
  );
  const render = (location) =>
    renderToStaticMarkup(
      at(location, h(Pagination, { itemsPerPage: 5 }, notes))
    );

  const aliased = render('/docs/updates/releases#tag-alias');
  assert(aliased.includes('Note 8'));
  assert(!aliased.includes('Note 0'));
  assert(render('/docs/updates/releases#note-11').includes('Note 11'));
  assert(render('/docs/updates/releases#missing').includes('Note 0'));
  assert(render('/docs/updates/releases').includes('Note 0'));
});

test('renders one main landmark on every layout', async () => {
  const Layout = await load('/src/components/Layout.tsx');
  const DocsShell = await load('/src/components/DocsShell.tsx');
  const page = h('h1', null, 'Page');
  const render = (location) =>
    renderToStaticMarkup(
      at(
        location,
        h(Routes, null, [
          h(Route, { key: 'layout', path: '/', element: h(Layout) }, [
            h(Route, {
              key: 'docs',
              path: 'docs/*',
              element: h(DocsShell, {
                nav: () => null,
                navLabel: 'docs navigation',
                children: page,
              }),
            }),
            h(Route, { key: 'page', path: '*', element: page }),
          ]),
        ])
      )
    );

  const docs = render('/docs/getting-started');
  assert.equal(docs.match(/<main\b/g)?.length, 1);
  assert.match(docs, /<main[^>]*class="docs-content"/);
  assert.match(docs, /aria-label="Close navigation"/);
  for (const path of ['/', '/docsearch']) {
    assert.equal(render(path).match(/<main\b/g)?.length, 1, path);
  }
});

test('exposes search as a labelled dialog', async () => {
  const SearchModal = await load('/src/components/SearchModal.tsx');
  const render = (isOpen) =>
    renderToStaticMarkup(
      at('/', h(SearchModal, { isOpen, onClose: () => {} }))
    );
  assert.equal(
    render(false),
    '<dialog class="search-modal" aria-label="API search"></dialog>'
  );
  const open = render(true);
  assert.match(open, /<input[^>]*aria-label="Search APIs"/);
  assert.match(open, /<button[^>]*aria-label="Close search"/);
});

test('keeps preferences in memory when storage is blocked', async () => {
  const { readPreference, savePreference } = await vite.ssrLoadModule(
    '/src/lib/storage.ts'
  );
  const saved = new Map();
  const storages = {
    blocked: {
      get localStorage() {
        throw new Error('SecurityError');
      },
    },
    working: {
      localStorage: {
        getItem: (key) => saved.get(key) ?? null,
        setItem: (key, value) => saved.set(key, value),
        removeItem: (key) => saved.delete(key),
      },
    },
  };
  try {
    globalThis.window = storages.blocked;
    assert.equal(readPreference('theme'), null);
    assert.doesNotThrow(() => savePreference('theme', 'dark'));
    globalThis.window = storages.working;
    savePreference('theme', 'dark');
    assert.equal(readPreference('theme'), 'dark');
    savePreference('theme', null);
    assert.equal(readPreference('theme'), null);
  } finally {
    delete globalThis.window;
  }
  // Prerender has no window at all.
  assert.equal(readPreference('theme'), null);
});

test('applies the theme before first paint, even with storage blocked', async () => {
  const html = await readFile(
    new URL('../index.html', import.meta.url),
    'utf8'
  );
  // Inline head scripts are the bare <script> blocks; module scripts carry attributes.
  const scripts = html
    .split('<script>')
    .slice(1)
    .map((part) => part.slice(0, part.indexOf('</script>')));
  assert.equal(scripts.length, 1, 'expected one inline head script');
  const isDark = (stored, prefersDark) => {
    const classes = new Set();
    runInNewContext(scripts[0], {
      localStorage: {
        getItem: () => {
          if (stored instanceof Error) throw stored;
          return stored;
        },
      },
      matchMedia: () => ({ matches: prefersDark }),
      document: { documentElement: { classList: classes } },
    });
    return classes.has('dark');
  };
  assert.equal(isDark(new Error('SecurityError'), true), true);
  assert.equal(isDark(new Error('SecurityError'), false), false);
  assert.equal(isDark(null, true), true);
  assert.equal(isDark('light', true), false);
  assert.equal(isDark('dark', false), true);
});

test('search signatures match the client schema', async () => {
  const { apiData } = await vite.ssrLoadModule('/src/lib/searchData.ts');
  const schemaDir = new URL('../../../specs/client/src/', import.meta.url);
  let schema = '';
  for (const file of (await readdir(schemaDir)).sort()) {
    if (file.endsWith('.graphql'))
      schema += await readFile(new URL(file, schemaDir), 'utf8');
  }
  schema = schema.replace(/"""[\s\S]*?"""/g, '').replace(/#.*$/gm, '');
  const operations = new Map();
  for (const [, fields] of schema.matchAll(
    /type\s+(?:Query|Mutation|Subscription)\s*\{([\s\S]*?)\n\}/g
  )) {
    for (const [, name, args = '', returns] of fields.matchAll(
      /^\s*(\w+)\s*(?:\(([\s\S]*?)\))?\s*:\s*([\w![\]]+)/gm
    )) {
      const parameters = args
        .trim()
        .split(/\s*\n\s*|,\s*/)
        .filter(Boolean);
      operations.set(name, { parameters: parameters.join(', '), returns });
    }
  }
  assert(operations.has('requestPurchase'), 'schema operations not found');
  const signed = apiData.filter((item) => item.returns !== undefined);
  // Only these entries are not schema operations; a typo'd title fails here.
  assert.deepEqual(
    signed
      .filter((item) => !operations.has(item.title))
      .map((item) => item.title),
    [
      'iOS External Purchase',
      'enableBillingProgramAndroid',
      'Debugging & Logging',
      'Enable Logging',
      'Android basePlanId Limitation',
    ]
  );
  const checked = signed.filter((item) => operations.has(item.title));
  assert(checked.length > 40);
  for (const { title, parameters, returns } of checked) {
    assert.deepEqual({ parameters, returns }, operations.get(title), title);
  }
});

test('keeps Tab among the drawer elements a keyboard can reach', async () => {
  const { handleDrawerKey } = await vite.ssrLoadModule('/src/lib/focusTrap.ts');
  let focused = null;
  const element = (name, tabIndex = 0, rendered = true) => ({
    name,
    tabIndex,
    getClientRects: () => ({ length: rendered ? 1 : 0 }),
    closest: () => null,
    focus() {
      focused = this;
    },
  });
  const close = element('close');
  const collapsedLink = element('collapsed link', -1);
  const summary = element('summary');
  const hiddenLink = element('hidden link', 0, false);
  const lastLink = element('last link');
  // Unreachable elements sit at both ends, so wrapping only works if they are skipped.
  const items = [hiddenLink, close, summary, lastLink, collapsedLink];
  let selector = '';
  const drawer = {
    querySelectorAll: (query) => ((selector = query), items),
    contains: (node) => items.includes(node),
  };
  const outside = { closest: () => null };
  const inSearchDialog = {
    closest: (query) => (query === 'dialog[open]' ? {} : null),
  };
  const press = (
    key,
    active,
    { shiftKey = false, defaultPrevented = false } = {}
  ) => {
    focused = null;
    const event = {
      key,
      shiftKey,
      defaultPrevented,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    let closed = false;
    handleDrawerKey(event, drawer, active, () => (closed = true));
    return { prevented: event.defaultPrevented && !defaultPrevented, closed };
  };

  // Wraps at both ends, skipping collapsed and unrendered links.
  assert.deepEqual(press('Tab', lastLink), { prevented: true, closed: false });
  assert.equal(focused, close);
  assert.equal(press('Tab', close, { shiftKey: true }).prevented, true);
  assert.equal(focused, lastLink);
  assert.match(selector, /summary/);
  assert.match(selector, /\[tabindex\]/);
  // Inside the drawer, the browser moves focus.
  assert.equal(press('Tab', summary).prevented, false);
  assert.equal(focused, null);
  // Focus that escaped the drawer comes back.
  assert.equal(press('Tab', outside).prevented, true);
  assert.equal(focused, close);
  assert.equal(press('Escape', lastLink).closed, true);
  // The search modal over the drawer, or a handler that already acted, owns the key.
  assert.deepEqual(press('Tab', inSearchDialog), {
    prevented: false,
    closed: false,
  });
  assert.equal(press('Escape', inSearchDialog).closed, false);
  assert.deepEqual(press('Tab', lastLink, { defaultPrevented: true }), {
    prevented: false,
    closed: false,
  });
  assert.equal(focused, null);
});

test('custom verifier example rejects evidence for another purchase or environment', async () => {
  const source = await readFile(
    new URL('../src/pages/docs/features/validation.tsx', import.meta.url),
    'utf8'
  );
  const snippets = [
    ...source.matchAll(
      /<CodeBlock language="typescript">\{`([\s\S]*?)`\}<\/CodeBlock>/g
    ),
  ];
  const snippet = snippets.find(([, code]) =>
    code.includes('myVerifier.verify')
  )?.[1];
  assert.ok(snippet, 'the published custom verifier example exists');
  const purchase = {
    id: 'tx-1',
    productId: 'premium',
    store: 'apple',
    storeId: 'apple',
  };
  const valid = {
    valid: true,
    productId: 'premium',
    store: 'apple',
    storeId: 'apple',
    environment: 'Production',
  };
  for (const [changes, accepted] of [
    [{}, true],
    [{ productId: 'cheap' }, false],
    [{ productId: undefined }, false],
    [{ store: 'google' }, false],
    [{ storeId: 'other-provider' }, false],
    [{ environment: 'Sandbox' }, false],
    [{ environment: undefined }, false],
  ]) {
    const grants = [];
    const flow = runInNewContext(`${snippet}; flow`, {
      createPurchaseFlow: (options) => options,
      myVerifier: { verify: async () => ({ ...valid, ...changes }) },
      wallet: { creditOnce: async (...args) => grants.push(args) },
      CONSUMABLE_IDS: ['premium'],
    });
    const result = flow.confirmWithBackend(purchase, { isConsumable: true });
    if (accepted) {
      assert.equal((await result).status, 'entitled');
      assert.deepEqual(grants, [['tx-1', 'premium']]);
    } else {
      await assert.rejects(result, /evidence does not match/);
      assert.deepEqual(grants, []);
    }
  }
});
