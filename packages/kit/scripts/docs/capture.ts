#!/usr/bin/env bun
/**
 * Docs screenshot driver.
 *
 * Walks the IAPKit dashboard via Playwright and writes WebPs into
 * `public/docs/screenshots/`. Intended to be run locally, by hand,
 * when a UI change lands — CI does NOT run this (see
 * scripts/docs/README.md for the rationale).
 *
 * On the first run the script navigates to /sign-in and pauses so a
 * human can complete GitHub OAuth or email OTP. Afterwards Playwright
 * keeps the session in `scripts/docs/.auth/state.json` and subsequent
 * runs skip straight to the captures.
 *
 * Prereqs:
 *   bun add -d @playwright/test
 *   bunx playwright install chromium
 */

import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

// Playwright is a dev-only dependency; import lazily so `bun install`
// on a CI image without the dep doesn't fail the script's type check.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } =
  require("@playwright/test") as typeof import("@playwright/test");

const BASE_URL = process.env.DOCS_BASE_URL ?? "http://localhost:5173";
const ORG_SLUG = process.env.DOCS_ORG_SLUG ?? "test-org";
const PROJECT_SLUG = process.env.DOCS_PROJECT_SLUG ?? "testapp";
const AUTH_STATE = resolve(__dirname, ".auth", "state.json");
const OUT_DIR = resolve(__dirname, "..", "..", "public", "docs", "screenshots");

async function screenshotWebp(
  page: import("@playwright/test").Page,
  filename: string,
) {
  const buffer = await page.screenshot({ fullPage: false });
  await sharp(buffer).webp({ quality: 90 }).toFile(resolve(OUT_DIR, filename));
}

async function main() {
  await mkdir(resolve(__dirname, ".auth"), { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // retina WebPs
    storageState: existsSync(AUTH_STATE) ? AUTH_STATE : undefined,
    // Pin locale so the dashboard's i18n always resolves to English
    // for screenshots — host `LANG=ko_KR` etc. would otherwise produce
    // mixed-language captures depending on whose machine ran the
    // script.
    locale: "en-US",
  });
  const page = await context.newPage();

  // 1. Ensure we're signed in. If storageState had no session, the
  //    app will bounce to its sign-in page; pause for manual auth.
  await page.goto(`${BASE_URL}/`);
  const url = page.url();
  if (url.includes("/sign-in") || url.includes("/login")) {
    console.log(
      "\n🔑 Please complete sign-in in the opened browser window. Press Enter here when the dashboard loads…",
    );
    process.stdin.resume();
    await new Promise<void>((done) => process.stdin.once("data", () => done()));
    await context.storageState({ path: AUTH_STATE });
  }

  const shots: Array<[string, string]> = [
    // [relative path, output filename]
    ["/", "dashboard.webp"],
    [`/${ORG_SLUG}/projects`, "project-list.webp"],
    [`/${ORG_SLUG}/project/${PROJECT_SLUG}/purchases`, "purchases.webp"],
    [`/${ORG_SLUG}/project/${PROJECT_SLUG}/apikeys`, "api-keys.webp"],
    [`/${ORG_SLUG}/project/${PROJECT_SLUG}/settings`, "project-settings.webp"],
  ];

  for (const [path, filename] of shots) {
    console.log(`📸  ${path} → ${filename}`);
    await page.goto(`${BASE_URL}${path}`);
    // Wait for a stable render. `networkidle` covers Convex query
    // settle; `document.fonts.ready` covers font swap (which fires
    // after networkidle and used to leave glyphs unstyled in the
    // screenshot). Both are deterministic — no fixed-time hedge.
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await screenshotWebp(page, filename);
  }

  await browser.close();
  console.log(`\n✅ Saved ${shots.length} screenshots to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
