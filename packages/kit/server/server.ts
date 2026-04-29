import "./sentry";

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { promises as fs } from "node:fs";
import path from "node:path";

import { apiRoutes } from "./api/v1/routes";
import { parsePort } from "./utils/env";

const app = new Hono();

// Liveness/readiness probe. No DB hit — Fly.io health checks fire
// frequently and hitting Convex from here would both mask real
// outages (a slow backend should still report "proc is alive") and
// waste quota.
app.get("/health", (c) => c.json({ ok: true }));

// Receipt validation + purchase management API.
// Mounted under both /api/v1 and /v1 for backwards compatibility with
// existing api.iapkit.com clients.
app.route("/api/v1", apiRoutes);
app.route("/v1", apiRoutes);

const STATIC_ROOT = process.env.STATIC_ROOT ?? "./dist";

// Serve the built SPA (hashed assets, favicons, llms.txt, etc.).
app.use("/*", serveStatic({ root: STATIC_ROOT }));

// If a *root-level* static-document URL (`/llms.txt`, `/robots.txt`,
// `/manifest.json`, …) reaches this point, `serveStatic` already
// couldn't match it, so return 404 instead of falling through to the
// SPA shell. Otherwise a typo at `/llm.txt` would render `index.html`,
// React Router's `:orgSlug` route would match the typo as a slug, and
// the user (or a bot) would see "Organization not found" with a 200
// status code — wrong for humans and doubly wrong for crawlers.
//
// Scope is deliberately narrow: only single-segment paths at the
// site root. Hashed build assets under `/assets/*.json` (i18n, chunks)
// and nested paths still fall through to the SPA handler below.
const ROOT_STATIC_DOC =
  /^\/[a-z0-9._-]+\.(txt|xml|json|pdf|csv|yaml|yml|md|webmanifest)$/i;
app.get("*", async (c, next) => {
  if (ROOT_STATIC_DOC.test(c.req.path)) {
    return c.notFound();
  }
  return next();
});

// SPA fallback: any unmatched path returns index.html so React Router
// can take over for deep links and page reloads.
//
// Cache the file contents in module scope. The compiled-in-Docker SPA
// is immutable for the lifetime of the process, so a per-request
// `fs.readFile` would just be repeated work — under SPA traffic
// (deep-link refreshes, OG-tag previews) the file is read on every
// React Router miss, which adds up.
const indexPath = path.join(STATIC_ROOT, "index.html");
let cachedIndexHtml: string | null = null;
let cachedIndexHtmlError: string | null = null;
async function loadIndexHtml(): Promise<string> {
  if (cachedIndexHtml !== null) {
    return cachedIndexHtml;
  }
  if (cachedIndexHtmlError !== null) {
    throw new Error(cachedIndexHtmlError);
  }
  try {
    const html = await fs.readFile(indexPath, "utf-8");
    cachedIndexHtml = html;
    return html;
  } catch (err) {
    // Cache the *failure* too, but keep it on a separate channel so a
    // future successful read (e.g. dev hot-reload regenerated dist/)
    // can still take over by clearing it. We only set it for the
    // missing-file case so that every request gets the same friendly
    // 500 instead of repeatedly hitting the disk.
    cachedIndexHtmlError = `index.html missing at ${indexPath} — run \`bun run build\` first.`;
    throw err;
  }
}

app.get("*", async (c) => {
  try {
    const html = await loadIndexHtml();
    return c.html(html);
  } catch {
    return c.text(cachedIndexHtmlError ?? "index.html unavailable", 500);
  }
});

// Defensive parse: reject non-numeric / out-of-range PORT values so
// Bun.serve never binds to 0 (random port, breaks Fly health checks)
// or throws on NaN. See server/utils/env.ts.
const port = parsePort(process.env.PORT, 3000);

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`IAPKit server listening on :${server.port}`);

// Fly.io sends SIGTERM before stopping a machine; SIGINT covers
// local Ctrl-C. `server.stop()` (no args) lets in-flight requests
// finish before the listener closes — essential for the verify
// endpoint, which has a multi-hundred-ms round-trip to Apple/Google.
let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, draining connections…`);
  void server.stop();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// NOTE: intentionally NO `export default app`. When a module exports a
// default with a `fetch` handler, Bun auto-binds it to a port at module
// load — which would race the explicit `Bun.serve(...)` above and fail
// with EADDRINUSE when the compiled binary boots. Keep the explicit
// server the single source of truth for lifecycle (signals, drain,
// logging).
