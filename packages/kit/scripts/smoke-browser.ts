#!/usr/bin/env bun
// Headless-browser smoke for the kit SPA.
//
// Why this exists: smoke-server.sh only HTTP-probes /health, /, /api/v1
// — those return 200 even when the JS bundle crashes on hydration. PR
// #120 shipped a manualChunks misconfiguration that left React in the
// main chunk while antd was split out, creating a cross-chunk cycle
// that crashed antd at boot ("Cannot set properties of undefined
// (setting 'Activity')"). The page still served a 200, so HTTP probes
// missed it. This script loads the SPA in headless Chromium, listens
// for pageerror + console.error, and asserts the page mounts content.

import { chromium } from "@playwright/test";

const url = process.env.SMOKE_URL ?? "http://localhost:3100/";

// Errors that are expected when the SPA is built against placeholder env
// (CI smoke and local `bun run smoke:server`). We still want the smoke to
// fail on bundle-integrity problems — chunk cycles, missing modules,
// hydration crashes — but a Convex/Sentry config rejection that fires
// AFTER React has already mounted #root is not a bundle bug.
const IGNORED_ERROR_PATTERNS: RegExp[] = [
  /CONVEX FATAL ERROR.*Couldn't parse deployment name/i,
  /Sentry.*Invalid DSN/i,
];

function isIgnored(message: string): boolean {
  return IGNORED_ERROR_PATTERNS.some((re) => re.test(message));
}

async function main(): Promise<number> {
  const errors: string[] = [];

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on("pageerror", (err) => {
      if (isIgnored(err.message)) return;
      errors.push(`pageerror: ${err.message}`);
    });
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (isIgnored(text)) return;
      errors.push(`console.error: ${text}`);
    });

    // Catch goto/locator failures (timeouts etc.) so the errors array
    // gets reported AND the finally below still runs to close the
    // browser. Calling process.exit() inside the try block would skip
    // both — leaving a zombie chromium process and hiding any
    // pageerror/console.error we already collected.
    try {
      // `waitUntil: "networkidle"` hangs in apps with persistent
      // sockets (Convex WebSockets, Sentry beacons). Use
      // domcontentloaded + an explicit wait for #root to mount
      // children — that's the actual signal we want, and it surfaces
      // bundle crashes as a clean TimeoutError.
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await page.waitForSelector("#root > *", { timeout: 30_000 });

      // Defensive: confirm content actually rendered. waitForSelector
      // already covers this, but keep the explicit emptiness check so
      // a future change that swaps the assertion still has a tripwire.
      const rootHtml = await page.locator("#root").innerHTML();
      if (rootHtml.trim().length === 0) {
        errors.push("SPA mount target #root is empty — bundle likely crashed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`navigation failed: ${message}`);
    }
  } finally {
    await browser.close();
  }

  if (errors.length > 0) {
    console.error("smoke-browser: FAILED");
    for (const e of errors) console.error(`  - ${e}`);
    return 1;
  }

  console.log(`smoke-browser: ${url} mounted cleanly ✓`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("smoke-browser: unexpected error", err);
    process.exitCode = 1;
  });
