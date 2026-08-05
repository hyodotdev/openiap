#!/usr/bin/env node
// =============================================================================
// Refresh showcase ordering metrics
// =============================================================================
// Fills `ratings` (App Store + Google Play review counts) and `installs`
// (Google Play install floor) for every entry in showcase-apps.json.
//
// The home page and /showcase order apps by `ratings` first, then `installs`.
// Neither store publishes download totals — Apple exposes no install data at
// all and Play only reports a bucket like "1K+" — so review count is the one
// verifiable signal both stores share.
//
//   bun run showcase:metrics
// =============================================================================

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(HERE, '..', 'showcase-apps.json');
const USER_AGENT = 'Mozilla/5.0 (compatible; openiap-showcase-metrics/1.0)';

// Apple reports userRatingCount per storefront and publishes no global total,
// so a US-only lookup misses every review left in other markets. Summing every
// storefront reconstructs the worldwide count. (Google Play already reports a
// single global review count, so it needs no equivalent pass.)
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

/** "1.2K" -> 1200, "3M" -> 3000000, "55" -> 55 */
function parseCompact(value) {
  const match = /^([\d.,]+)\s*([KMB])?/i.exec(value.trim());
  if (!match) return undefined;
  const base = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(base)) return undefined;
  const scale = { k: 1e3, m: 1e6, b: 1e9 }[match[2]?.toLowerCase()] ?? 1;
  return Math.round(base * scale);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Apple throttles bursts of storefront lookups (HTTP 403), so retry with
 * exponential backoff instead of silently recording a zero.
 */
async function fetchText(url, attempts = 4) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
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
    // A partial sweep would silently under-count, so surface it loudly rather
    // than writing a number that looks authoritative.
    throw new Error(
      `${pending.length}/${APP_STORE_STOREFRONTS.length} storefront lookups failed — ratings would be under-counted`
    );
  }
  return { ratings, markets };
}

// Text nodes that end in "reviews" but are chrome, not a count.
const PLAY_REVIEW_CHROME = /^(ratings and reviews|reviews|all reviews)$/i;

/**
 * Extracts Play metrics from a store page, fail-closed.
 *
 * Play omits the review element entirely for apps with few or no reviews, so an
 * absent count is a legitimate zero. Anything else is treated as our selectors
 * having drifted from Play's markup, which must not be written over a real
 * number:
 *
 * - install block missing → the page shape changed (it renders on every app
 *   page, so it is the canary that our selectors still match)
 * - a count-shaped review node present but unparseable → the review markup
 *   changed underneath us
 */
export function parsePlayMetrics(html, packageName = 'app') {
  const installs = />([\d.,]+\s*[KMB]?\+)<\/div><div class="[^"]+">Downloads</i.exec(
    html
  )?.[1];
  if (installs === undefined) {
    throw new Error(
      `install count not found for ${packageName} — Play markup likely changed`
    );
  }

  const reviews = /">([\d.,]+\s*[KMB]?)\s*reviews</i.exec(html)?.[1];
  if (reviews !== undefined) {
    const parsed = parseCompact(reviews);
    if (parsed === undefined) {
      throw new Error(
        `review count "${reviews}" not parseable for ${packageName}`
      );
    }
    return { ratings: parsed, installs: parseCompact(installs) };
  }

  const orphaned = [...html.matchAll(/>([^<]{0,40}?reviews)</gi)]
    .map((match) => match[1].trim())
    .filter((text) => !PLAY_REVIEW_CHROME.test(text))
    .filter((text) => /\d/.test(text));

  if (orphaned.length > 0) {
    throw new Error(
      `found review element "${orphaned[0]}" but could not read its count for ${packageName}`
    );
  }

  return { ratings: 0, installs: parseCompact(installs) };
}

async function playMetrics(androidUrl) {
  const packageName = /[?&]id=([^&]+)/.exec(androidUrl)?.[1];
  if (!packageName) return {};
  const html = await fetchText(
    `https://play.google.com/store/apps/details?id=${packageName}&hl=en&gl=US`
  );
  return parsePlayMetrics(html, packageName);
}

async function main() {
  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  let changed = 0;

  let stale = 0;

  for (const app of data.apps) {
    // Web-only entries have no store to measure; leave whatever is on record
    // instead of writing a zero that looks like a real reading.
    if (!app.ios && !app.android) {
      console.log(`  ${app.name}: no store links — metrics left untouched`);
      continue;
    }

    let ratings = 0;
    let installs;
    let appleMarkets = 0;
    let incomplete = false;

    if (app.ios) {
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
      } catch (error) {
        console.warn(`  ! ${app.name}: Play — ${error.message}`);
        incomplete = true;
      }
    }

    // Last line of defence: every reading can look individually valid and still
    // collapse a real count to zero if a selector drifts silently. Losing an
    // established count is always a regression, never a legitimate reading.
    if (ratings === 0 && (app.ratings ?? 0) > 0) {
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
    if (app.ratings !== ratings || app.installs !== nextInstalls) changed += 1;

    app.ratings = ratings;
    if (nextInstalls === undefined) delete app.installs;
    else app.installs = nextInstalls;

    console.log(
      `  ${app.name}: ratings=${ratings}` +
        (appleMarkets ? ` (App Store in ${appleMarkets} markets)` : '') +
        (nextInstalls === undefined ? '' : ` installs=${nextInstalls}`)
    );
  }

  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`);

  const ranking = [...data.apps]
    .sort(
      (a, b) =>
        (b.ratings ?? 0) - (a.ratings ?? 0) ||
        (b.installs ?? 0) - (a.installs ?? 0)
    )
    .map((app, index) => `  ${index + 1}. ${app.name} (${app.ratings ?? 0})`)
    .join('\n');

  console.log(`\nUpdated ${changed} of ${data.apps.length} entries.`);
  if (stale > 0) {
    console.log(`${stale} kept previous numbers — rerun to refresh them.`);
  }
  console.log(`\nRanking\n${ranking}`);
}

// Only refresh when run directly; importing for tests must stay side-effect free.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
