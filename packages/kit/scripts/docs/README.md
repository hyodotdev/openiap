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

## Re-recording the interop evidence

[`commerce-interop.md`](commerce-interop.md#keep-documentation-evidence-current)
says when `bun audit:commerce-evidence` drift needs a re-record. The docs build
(`packages/docs/scripts/check-commerce-composition.mjs`) accepts only a
recording that ran end to end, from a clean committed tree.

Clone both examples at the revisions the last recording used, not the branch
tips: `packages/docs/public/commerce-composition/iapkit-run.json` names them in
`reproduction.originalExampleCommit` and `reproduction.freshExampleCommit`.
Start from the openiap checkout root, with no `/tmp/openiap-evidence` left
from an earlier run:

```sh
repo=$PWD
report=packages/docs/public/commerce-composition/iapkit-run.json
evidence=/tmp/openiap-evidence
out=$evidence/interop-run
mkdir -p "$evidence/tmp"
for example in original fresh; do
  git clone https://github.com/hyodotdev/openiap-commerce-protocol-example.git "$evidence/$example-example"
  git -C "$evidence/$example-example" checkout "$(node -p "require('./$report').reproduction.${example}ExampleCommit")"
  (cd "$evidence/$example-example" && npm ci --ignore-scripts)
done

bun --conditions=openiap-source packages/kit/scripts/docs/run-commerce-interop.mjs "$evidence/original-example" "$out" "$evidence/fresh-example"
bun packages/kit/scripts/docs/export-commerce-interop.mjs "$out" "$evidence/original-example"
(cd "$evidence/fresh-example" && env -u CLAUDECODE -u AGENT -u REPL_ID -u FORCE_COLOR TMPDIR="$evidence/tmp" npm run verify && node export-paywall.mjs "$repo/packages/docs/public/commerce-example" .runtime/verification.json "$out/report.json")
```

The last line avoids two traps, and the docs build rejects either one:

- `env -u CLAUDECODE -u AGENT -u REPL_ID -u FORCE_COLOR`: Bun hides its
  per-test `(pass)` lines in agent mode (any of the first three set) and
  colors its output under `FORCE_COLOR`; `verify.mjs` passes its environment to
  `npm test`, so the published test log would lose those lines or carry escape
  codes.
- The neutral clone path and `TMPDIR`: `paywall-harness.json` publishes the
  checkout path (in `Project path`) and a `DATA_DIR` under `TMPDIR`, so a home
  folder, the per-user macOS temp folder or an agent scratchpad would publish
  the user name.

Then point the first `git checkout` in
`packages/docs/public/commerce-example/paywall-provider-reproduction.md` at the
openiap commit the harness ran from, and run `cd packages/docs && bun run build`.

Two other public replays publish local paths the same way and need the same
prefix. `fresh-public-replay.json` comes from the example's
`docs/example-backend-reference` branch, at the commit `fresh-build.json`
records and with the scope sentence the replay records;
`experience-verification.json` comes from
`packages/docs/scripts/replay-experience-archive.mjs`. From the openiap
checkout root, with no `/tmp/openiap-evidence/backend-reference` left:

```sh
repo=$PWD
evidence=/tmp/openiap-evidence
assets=packages/docs/public/commerce-example
mkdir -p "$evidence/tmp"
scope=$(node -p "require('./$assets/fresh-public-replay.json').scope")
git clone --branch docs/example-backend-reference https://github.com/hyodotdev/openiap-commerce-protocol-example.git "$evidence/backend-reference"
git -C "$evidence/backend-reference" checkout "$(node -p "require('./$assets/fresh-build.json').sourceCommit")"
(cd "$evidence/backend-reference" && env -u CLAUDECODE -u AGENT -u REPL_ID -u FORCE_COLOR TMPDIR="$evidence/tmp" node export-public-replay.mjs "$repo/$assets" "$scope")
env -u CLAUDECODE -u AGENT -u REPL_ID -u FORCE_COLOR TMPDIR="$evidence/tmp" bun packages/docs/scripts/replay-experience-archive.mjs
```
