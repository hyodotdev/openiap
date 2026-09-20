# Docs screenshot pipeline

Tools for producing the images under `public/docs/screenshots/` that
live inside the in-dashboard documentation at `/docs`.

## One-time setup

```bash
bun add -d @playwright/test
bunx playwright install chromium
```

## Seeding a TestApp

`seed-testapp.ts` creates (or re-syncs) a demo project named
**TestApp** in the Convex deployment pointed to by `CONVEX_URL` in
your `.env.local`. Run it against your dev deployment only — it
writes real rows.

```bash
bun run scripts/docs/seed-testapp.ts
```

The script is idempotent: if a project named `TestApp` already
exists in the target organization, it updates the existing row
instead of inserting a duplicate.

## Capturing screenshots

`capture.ts` drives Chromium through the real SPA (Vite dev server)
and writes WebPs to `public/docs/screenshots/`. Run this by hand on a
local dev environment — it needs interactive auth the first time.

```bash
# Terminal 1 — dev SPA
bun run dev

# Terminal 2 — dev server
bun run dev:server

# Terminal 3 — screenshot pass (will pause for you to sign in once)
bun run scripts/docs/capture.ts
```

Captured screenshots are committed alongside the docs so production
reads them straight out of `public/docs/screenshots/...` — no CDN or
object-store dependency.

## Keeping images fresh

When a dashboard flow changes (new field, renamed tab, etc.),
re-run the capture script and commit the updated WebPs with the PR
that changed the UI. Don't let docs screenshots drift.

## Commerce Protocol comparison

The runnable example is owned by
[openiap-commerce-protocol-example](https://github.com/hyodotdev/openiap-commerce-protocol-example).
After exporting its verified checkpoints to the docs site, run from `packages/kit`:

```sh
bun scripts/docs/compare-commerce-example.ts
```

This extracts the selected final archive into a temporary directory, installs
its published dependencies with npm, compares signature vectors with IAPKit,
and runs the existing IAPKit commerce tests with Convex/store I/O mocked.
It writes `packages/docs/public/commerce-lab/run.json` without contacting
production or making a store purchase.
