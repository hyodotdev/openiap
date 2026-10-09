#!/usr/bin/env node
// Refresh public Play install floors and optional store review counts.
// `--downloads-only` skips Apple's review-only storefront sweep.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { format } from 'prettier';
import { parsePlayMetrics } from './showcase-play-metrics.mjs';
export { parsePlayMetrics } from './showcase-play-metrics.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(HERE, '..', 'showcase-apps.json');
const USER_AGENT = 'Mozilla/5.0 (compatible; openiap-showcase-metrics/1.0)';

// Apple exposes ratings per storefront; sum them for a worldwide count.
const APP_STORE_STOREFRONTS =
  `ae ag ai al am ao ar at au az bb be bf bg bh bj bm bn bo br bs bt bw by bz
   ca cd cg ch ci cl cm cn co cr cv cy cz de dk dm do dz ec ee eg es fi fj fm
   fr ga gb gd gh gm gr gt gw gy hk hn hr hu id ie il in iq is it jm jo jp ke
   kg kh kn kr kw ky kz la lb lc lk lr lt lu lv ly ma md me mg mk ml mm mn mo
   mr ms mt mu mv mw mx my mz na ne ng ni nl no np nz om pa pe pg ph pk pl pt
   pw py qa ro rs ru rw sa sb sc se sg si sk sl sn sr st sv sz tc td th tj tm
   tn tr tt tw tz ua ug us uy uz vc ve vg vn vu ws ye za zm zw`.split(/\s+/);

const STOREFRONT_CONCURRENCY = 5;
const STOREFRONT_BATCH_PAUSE_MS = 150;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry throttled storefront lookups with backoff.
async function fetchText(url, attempts = 4) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) return response.text();
      lastError = new Error(`${response.status} ${url}`);
      if (response.status !== 403 && response.status !== 429) throw lastError;
    } catch (error) {
      lastError = error;
    }
    await sleep(500 * 2 ** attempt);
  }
  throw lastError;
}

/** Sums userRatingCount across every App Store storefront the app ships in. */
async function appleRatings(iosUrl) {
  const id = /\/id(\d+)/.exec(iosUrl)?.[1];
  if (!id) return { ratings: undefined, markets: 0 };

  let ratings = 0;
  let markets = 0;

  const lookup = async (country) => {
    const body = await fetchText(
      `https://itunes.apple.com/lookup?id=${id}&country=${country}`
    );
    return JSON.parse(body).results?.[0]?.userRatingCount ?? 0;
  };

  const record = (count) => {
    if (count > 0) markets += 1;
    ratings += count;
  };

  let pending = APP_STORE_STOREFRONTS;

  for (let round = 0; round < 3 && pending.length > 0; round += 1) {
    const failed = [];

    for (
      let offset = 0;
      offset < pending.length;
      offset += STOREFRONT_CONCURRENCY
    ) {
      const batch = pending.slice(offset, offset + STOREFRONT_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (country) => {
          try {
            return { count: await lookup(country) };
          } catch {
            return { country };
          }
        })
      );
      for (const result of results) {
        if (result.country) failed.push(result.country);
        else record(result.count);
      }
      await sleep(STOREFRONT_BATCH_PAUSE_MS);
    }

    pending = failed;
    // Throttled storefronts usually clear after a short cool-down.
    if (pending.length > 0) await sleep(5000);
  }

  if (pending.length > 0) {
    // Partial storefront sweeps undercount reviews.
    throw new Error(
      `${pending.length}/${APP_STORE_STOREFRONTS.length} storefront lookups failed — ratings would be under-counted`
    );
  }
  return { ratings, markets };
}

async function playMetrics(androidUrl) {
  const packageName = new URL(androidUrl).searchParams.get('id');
  if (!packageName) return {};
  const html = await fetchText(
    `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}&hl=en&gl=US`
  );
  return parsePlayMetrics(html, packageName);
}

export async function refreshApprovedDownloads(
  query,
  readMetrics = playMetrics
) {
  const rows = await query(
    "SELECT id, payload->>'android' AS android FROM showcase_submissions WHERE status = 'approved' AND payload->>'android' IS NOT NULL"
  );
  let updated = 0;
  let stale = 0;
  for (const row of rows) {
    try {
      const { installs } = await readMetrics(row.android);
      if (!Number.isSafeInteger(installs) || installs < 0)
        throw new Error('No install count');
      await query(
        "UPDATE showcase_submissions SET installs = $2 WHERE id = $1 AND status = 'approved'",
        [row.id, installs]
      );
      updated += 1;
    } catch {
      stale += 1;
    }
  }
  return { updated, stale };
}

async function main() {
  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const downloadsOnly = process.argv.includes('--downloads-only');
  const apps = [...data.apps, ...(data.github?.apps ?? [])];
  let changed = 0;

  let stale = 0;

  for (const app of apps) {
    if (downloadsOnly && !app.android) continue;
    // No public store means no new reading.
    if (!app.ios && !app.android) {
      console.log(`  ${app.name}: no store links — metrics left untouched`);
      continue;
    }

    let ratings = 0;
    let installs;
    let appleMarkets = 0;
    let incomplete = false;

    if (app.ios && !downloadsOnly) {
      try {
        const apple = await appleRatings(app.ios);
        ratings += apple.ratings ?? 0;
        appleMarkets = apple.markets;
      } catch (error) {
        console.warn(`  ! ${app.name}: App Store — ${error.message}`);
        incomplete = true;
      }
    }

    if (app.android) {
      try {
        const play = await playMetrics(app.android);
        ratings += play.ratings ?? 0;
        installs = play.installs;
        if (installs === undefined) throw new Error('No install count');
      } catch (error) {
        console.warn(`  ! ${app.name}: Play — ${error.message}`);
        incomplete = true;
      }
    }

    // A zero must not erase an established review count.
    if (!downloadsOnly && ratings === 0 && (app.ratings ?? 0) > 0) {
      incomplete = true;
      console.warn(
        `  ! ${app.name}: refusing to drop ratings ${app.ratings} → 0 — check the store selectors`
      );
    }

    if (incomplete) {
      // Keep the previous numbers rather than replacing them with a partial sweep.
      stale += 1;
      console.log(`  ${app.name}: kept existing ratings=${app.ratings ?? 0}`);
      continue;
    }

    const nextInstalls = installs ?? app.installs;
    if (
      (!downloadsOnly && app.ratings !== ratings) ||
      app.installs !== nextInstalls
    )
      changed += 1;

    if (!downloadsOnly) app.ratings = ratings;
    if (nextInstalls === undefined) delete app.installs;
    else app.installs = nextInstalls;

    console.log(
      `  ${app.name}:` +
        (downloadsOnly ? '' : ` ratings=${ratings}`) +
        (appleMarkets ? ` (App Store in ${appleMarkets} markets)` : '') +
        (nextInstalls === undefined ? '' : ` installs=${nextInstalls}`)
    );
  }

  await writeFile(
    DATA_PATH,
    await format(JSON.stringify(data), { parser: 'json' })
  );

  const ranking = [...apps]
    .sort(
      (a, b) =>
        (b.installs ?? -1) - (a.installs ?? -1) ||
        a.name.localeCompare(b.name, 'en')
    )
    .map(
      (app, index) =>
        `  ${index + 1}. ${app.name} (${app.installs ?? 'unknown'} installs)`
    )
    .join('\n');

  console.log(`\nUpdated ${changed} of ${apps.length} entries.`);
  if (stale > 0) {
    console.log(`${stale} kept previous numbers — rerun to refresh them.`);
    process.exitCode = 1;
  }
  console.log(`\nRanking\n${ranking}`);
  if (process.env.SHOWCASE_DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.SHOWCASE_DATABASE_URL);
    const approved = await refreshApprovedDownloads((text, params) =>
      sql.query(text, params)
    );
    console.log(
      `Updated ${approved.updated} approved entries; ${approved.stale} kept previous downloads.`
    );
    if (approved.stale) process.exitCode = 1;
  }
}

// Only refresh when run directly; importing for tests must stay side-effect free.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
