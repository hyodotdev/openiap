import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { refreshApprovedDownloads } from './refresh-showcase-metrics.mjs';

test('showcase discovery keeps categories, combined filters, and download order', async (t) => {
  const vite = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const {
      SHOWCASE_APPS,
      SHOWCASE_CATEGORIES,
      filterShowcaseApps,
      mergeShowcaseApps,
    } = await vite.ssrLoadModule('/src/lib/showcase.ts');
    const filters = { query: '', category: '', library: '' };
    const { parseApprovedShowcaseApps, SHOWCASE_QUEUE_SCHEMA } =
      await vite.ssrLoadModule('/src/lib/showcase-submissions.ts');

    await t.test(
      'legacy categories and one malformed public row do not hide other apps or block review',
      () => {
        const app = {
          name: 'Legacy app',
          tagline: 'A useful legacy application',
          category: 'Retired category',
          logo: 'https://example.com/icon.png',
          library: ['retired-library', 'expo-iap'],
          iapkit: false,
          web: 'https://legacy.example.com',
        };
        const parsed = parseApprovedShowcaseApps({
          apps: [
            { app, installs: 1000 },
            { app: {}, installs: null },
            { app: { ...app, logo: '/showcase/icon.png' }, installs: 100 },
          ],
        });
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].category, 'Retired category');
        assert.deepEqual(parsed[0].library, ['expo-iap']);
        const queue = SHOWCASE_QUEUE_SCHEMA.parse({
          submissions: [
            {
              id: '12345678-1234-1234-1234-123456789abc',
              createdAt: '2026-10-09T00:00:00Z',
              submission: {
                ...app,
                contactEmail: 'owner@example.com',
                ownershipConfirmed: true,
              },
            },
          ],
        });
        assert.equal(queue.submissions.length, 1);
      }
    );

    await t.test('every app can be found through its category', () => {
      for (const app of SHOWCASE_APPS) {
        assert.ok(app.category.trim(), `Missing category for ${app.name}`);
        assert.ok(SHOWCASE_CATEGORIES.includes(app.category));
        assert.ok(
          filterShowcaseApps(SHOWCASE_APPS, {
            ...filters,
            category: app.category,
          }).includes(app)
        );
      }
    });

    await t.test('search and category and library must all match', () => {
      const combined = {
        query: '  BOXING  ',
        category: 'Health & wellness',
        library: 'expo-iap',
      };
      assert.deepEqual(
        filterShowcaseApps(SHOWCASE_APPS, combined).map((app) => app.name),
        ['Boxa']
      );
      assert.deepEqual(
        filterShowcaseApps(SHOWCASE_APPS, {
          ...combined,
          library: 'react-native-iap',
        }),
        []
      );
    });

    await t.test(
      'multiple search words and multi-library apps are searchable',
      () => {
        assert.ok(
          filterShowcaseApps(SHOWCASE_APPS, {
            ...filters,
            query: 'PRIVATE notes',
          }).some((app) => app.name === 'Notesnook')
        );
        for (const library of ['expo-iap', 'react-native-iap']) {
          assert.deepEqual(
            filterShowcaseApps(SHOWCASE_APPS, {
              ...filters,
              query: 'ecency',
              library,
            }).map((app) => app.name),
            ['Ecency']
          );
        }
        assert.ok(
          filterShowcaseApps(SHOWCASE_APPS, {
            ...filters,
            query: 'flutter Japanese',
          }).some((app) => app.name === 'Immersion Reader')
        );
      }
    );

    await t.test(
      'filtering preserves catalog ranking without changing it',
      () => {
        const before = [...SHOWCASE_APPS];
        assert.deepEqual(filterShowcaseApps(SHOWCASE_APPS, filters), before);
        const matches = filterShowcaseApps(SHOWCASE_APPS, {
          ...filters,
          category: 'Work & productivity',
        });
        const indices = matches.map((app) => SHOWCASE_APPS.indexOf(app));
        assert.deepEqual(
          indices,
          [...indices].sort((a, b) => a - b)
        );
        assert.deepEqual(SHOWCASE_APPS, before);
      }
    );
    await t.test(
      'different apps remain visible when they share a name or company website',
      () => {
        const base = {
          ...SHOWCASE_APPS[0],
          ios: undefined,
          web: 'https://company.example.com',
          android:
            'https://play.google.com/store/apps/details?id=dev.company.first',
        };
        const other = {
          ...base,
          android:
            'https://play.google.com/store/apps/details?id=dev.company.second',
        };
        assert.equal(mergeShowcaseApps([base], [other]).length, 2);
        assert.equal(
          mergeShowcaseApps(
            [base],
            [
              {
                ...base,
                name: 'Localized app name',
                android: `${base.android}&hl=ko`,
              },
            ]
          ).length,
          1
        );
      }
    );
    await t.test(
      'one app remains one card when only some store links are supplied',
      () => {
        const app = SHOWCASE_APPS.find((entry) => entry.ios && entry.android);
        assert.ok(app);
        const iosOnly = { ...app, android: undefined };
        assert.equal(mergeShowcaseApps([app], [iosOnly]).length, 1);
        assert.equal(mergeShowcaseApps([iosOnly], [app]).length, 1);
        assert.equal(mergeShowcaseApps([], [app, iosOnly]).length, 1);
      }
    );
    await t.test(
      'approved apps share download ranking and do not duplicate existing cards',
      () => {
        const before = [...SHOWCASE_APPS];
        const newApp = {
          ...SHOWCASE_APPS[0],
          name: 'Fresh app',
          ios: undefined,
          android: undefined,
          github: undefined,
          web: 'https://fresh.example.com',
          installs: 5000000,
        };
        const merged = mergeShowcaseApps(SHOWCASE_APPS, [
          newApp,
          newApp,
          { ...SHOWCASE_APPS[0], name: 'Duplicate' },
        ]);
        assert.equal(
          merged.filter((app) => app.name === 'Fresh app').length,
          1
        );
        assert.ok(!merged.some((app) => app.name === 'Duplicate'));
        assert.equal(merged.length, SHOWCASE_APPS.length + 1);
        assert.deepEqual(SHOWCASE_APPS, before);
        assert.ok(
          merged.every(
            (app, index) =>
              index === 0 ||
              (merged[index - 1].installs ?? -1) >= (app.installs ?? -1)
          )
        );
      }
    );
  } finally {
    await vite.close();
  }
});

test('approved download refresh leaves private rows and unavailable counts unchanged', async () => {
  const database = new PGlite();
  try {
    await database.exec(
      await readFile(new URL('../server/showcase.sql', import.meta.url), 'utf8')
    );
    for (const [index, status, android] of [
      [1, 'approved', 'good'],
      [2, 'approved', 'unavailable'],
      [3, 'pending', 'good'],
      [4, 'rejected', 'good'],
    ]) {
      await database.query(
        'INSERT INTO showcase_submissions (id, identity, payload, status, installs) VALUES ($1, $2, $3, $4, 100)',
        [
          `00000000-0000-4000-8000-00000000000${index}`,
          `app:${index}`,
          JSON.stringify({ android }),
          status,
        ]
      );
    }
    const result = await refreshApprovedDownloads(
      async (text, params) => (await database.query(text, params)).rows,
      async (url) => (url === 'good' ? { installs: 1000 } : {})
    );
    assert.deepEqual(result, { updated: 1, stale: 1 });
    assert.deepEqual(
      (
        await database.query(
          'SELECT installs::int FROM showcase_submissions ORDER BY id'
        )
      ).rows.map((row) => row.installs),
      [1000, 100, 100, 100]
    );
  } finally {
    await database.close();
  }
});
