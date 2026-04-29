#!/usr/bin/env bun
/**
 * Capture the unauthenticated-accessible pages of kit.openiap.dev.
 * The dashboard screens (project settings, API keys, …) need a real
 * login session, so they're produced by `render-mockups.ts` —
 * Playwright renders hand-authored HTML mockups to PNG and writes
 * them next to the public captures under `public/docs/screenshots/`.
 * This script handles only what Playwright can grab against the
 * running app without signing in.
 *
 * Run after `bunx playwright install chromium`:
 *   bun run scripts/docs/capture-public.ts
 */

import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } =
  require("@playwright/test") as typeof import("@playwright/test");

// Default to localhost so the script mirrors `capture.ts` and doesn't
// accidentally beat on production when someone runs it without
// thinking. Override with `DOCS_CAPTURE_BASE=https://kit.openiap.dev`
// when you explicitly want prod screenshots.
const BASE = process.env.DOCS_CAPTURE_BASE ?? "http://localhost:5173";
const OUT = resolve(__dirname, "..", "..", "public", "docs", "screenshots");

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
    // The dashboard ships English-only, but pinning the browser locale
    // keeps `Intl.DateTimeFormat` / `toLocaleString()` output stable so
    // dated text in screenshots doesn't drift with the host machine.
    locale: "en-US",
  });
  const page = await context.newPage();

  // Helper: wait for layout to settle. `networkidle` fires before
  // late-loaded fonts paint, which used to leave the screenshot with
  // unstyled glyphs. `document.fonts.ready` is the deterministic
  // signal Playwright recommends in place of a `waitForTimeout` hedge.
  const settle = () => page.evaluate(() => document.fonts.ready);

  console.log(`→ landing ${BASE}/`);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await settle();
  await page.screenshot({
    path: resolve(OUT, "landing.png"),
    fullPage: false,
  });

  // Sign-in modal — the landing CTA opens the Auth modal via a
  // global Preact signal; the most reliable trigger is the header
  // "Sign In" button which every layout exposes. We fall through
  // silently if the selector isn't visible.
  console.log("→ sign-in modal");
  try {
    const signInTrigger = page.locator("text=Sign In").first();
    if (await signInTrigger.isVisible()) {
      await signInTrigger.click();
      // Wait for the modal's heading rather than a fixed delay; the
      // modal animates in and the heading is the last element to
      // become visible.
      await page
        .getByRole("heading", { name: /sign in/i })
        .first()
        .waitFor({ state: "visible", timeout: 3_000 });
      await settle();
      await page.screenshot({
        path: resolve(OUT, "signup.png"),
        fullPage: false,
      });
    }
  } catch (error) {
    console.warn("  could not capture sign-in modal:", error);
  }

  console.log(`→ docs ${BASE}/docs`);
  await page.goto(`${BASE}/docs`, { waitUntil: "networkidle" });
  await settle();
  await page.screenshot({
    path: resolve(OUT, "docs-home.png"),
    fullPage: false,
  });

  await browser.close();
  console.log(`\n✅ Wrote captures to ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
