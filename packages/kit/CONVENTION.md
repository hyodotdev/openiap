# Project Conventions

`packages/kit` is the receipt-validation SaaS at
[kit.openiap.dev](https://kit.openiap.dev) — React 19 SPA + Hono on
Bun + Convex backend, all shipped as one Fly.io binary. **Unlike other
packages in this monorepo, this is a deployable application, not a
publishable library.** It does not consume `@hyodotdev/openiap-gql`
type generation; it has its own Convex schema as the source of truth
for receipt-validation models.

For setup, operations, and deploy details, see [`README.md`](./README.md).

## Naming

- **Brand name in user-facing text/titles**: `IAPKit` (no space).
  Mention "managed by OpenIAP" when introducing the product.
- **Code identifiers**: `IapKit` (PascalCase for classes/types),
  `iapKit` (camelCase for instances).
- **Repo / package / Fly app**: keep the existing `openiap-kit`
  identifier. Do not rename the Fly app, npm name, or filesystem.

## Modal Pattern with Preact Signals

Modals are defined **once** at the app root (`src/App.tsx`) and
controlled via `@preact/signals-react` signals declared in
`src/lib/signals.ts`. Pages and components open/close modals by
mutating the signal — never render a second instance of the same
modal lower in the tree.

```ts
// src/lib/signals.ts
export const authModalSignal = signal({ isOpen: false });
export const openAuthModal = () => (authModalSignal.value = { isOpen: true });
export const closeAuthModal = () => (authModalSignal.value = { isOpen: false });
```

Modal components themselves use `createPortal` into `document.body`,
lock `document.body.style.overflow` while open, and handle
escape/backdrop dismissal.

## Component Organization

```
src/
├── components/             # Shared, used by 2+ pages
│   ├── AuthModal/          # Folder when there are scoped sub-components
│   │   ├── index.tsx
│   │   └── Modal.tsx       # Used only inside AuthModal
│   └── SignOutButton.tsx
├── pages/
│   ├── landing.tsx
│   └── auth/               # Folder mirrors route hierarchy
│       └── organization/
│           └── project/
│               └── detail.tsx
```

- Co-locate components with their only consumer until they're reused.
- Promote to `src/components/` the moment a second page imports them.
- Page folders with sub-components use `index.tsx` for the route
  entry point.

## Convex Backend (CQRS)

Every domain folder under `convex/` follows the same split:

```
convex/<domain>/
├── query.ts      # Public reads — no side effects
├── mutation.ts   # Public writes — DB state changes
├── action.ts     # External APIs / cross-function orchestration
└── internal.ts   # Internal-only queries/mutations called from actions
```

`convex/utils/validation.ts` holds shared `v.*` schemas. Do not edit
`convex/_generated/*`; regenerate via `bunx convex dev`.

When working on Convex code, **read `convex/_generated/ai/guidelines.md`
first** — it contains rules that override training-data assumptions
about Convex APIs.

## Promise-returning functions in event handlers

ESLint `@typescript-eslint/no-misused-promises` rejects passing any
promise-returning function (async function, `navigate(...)`, Convex
mutation, etc.) directly where a void return is expected. Always wrap
with `void`:

```tsx
// ✅
<button onClick={() => void handleSubmit()}>Save</button>
<button onClick={() => void navigate("/path")}>Go</button>
<button onClick={() => void deleteItem({ id })}>Delete</button>

// ❌
<button onClick={handleSubmit}>Save</button>
<button onClick={() => navigate("/path")}>Go</button>
```

For `<form onSubmit>`:

```tsx
<form onSubmit={(e) => { e.preventDefault(); void handleSubmit(e); }}>
```

## Language

The dashboard ships **English-only** by design — same as RevenueCat,
Stripe's developer dashboard, Linear, Vercel, Convex, Sentry, and
Mixpanel. The audience is mobile-app developers who already operate
in English-language tooling, and an OSS contributor shouldn't be
forced to update N locale files for a one-line UI tweak.

If you need a localized dashboard for your users, fork and add an
i18n layer of your choice. Don't reintroduce one upstream without
discussion — the simplification is intentional, not an oversight.

## Icons

Always use icon components, never inline `<svg>`:

- General icons → `lucide-react` (`User`, `Settings`, `ChevronLeft`, …)
- Brand icons → `@icons-pack/react-simple-icons` (`SiGithub`, `SiGoogle`, …)

## Pre-commit gate

Husky lives at the **monorepo root**, not inside `packages/kit`. The
hook (`.husky/pre-commit`) is paths-aware: when staged changes touch
`packages/kit/**` it runs the **full CI-equivalent gate** mirroring
the `verify` job in `.github/workflows/deploy-kit.yml`:

1. `bun install --frozen-lockfile` (catches lockfile drift)
2. `bun run --filter @hyodotdev/openiap-kit lint` (tsc + eslint)
3. prettier check on `src` / `server` / `convex`
4. `bun run --filter @hyodotdev/openiap-kit test` (vitest)
5. `bun run --filter @hyodotdev/openiap-kit smoke:server` (compile + boot probe)

The hook is intentionally CI-equivalent — past kit pushes failed in CI
for issues that were silently passing locally (e.g. tsc inferring
third-party callback types correctly against an incremental
`node_modules` but failing on CI's fresh install, or prettier flagging
files that local lint-staged hadn't reformatted). Running the same
checks on commit avoids the push → red CI → fix-up → push loop.

Cost: ~30-60 s on first run after a clean checkout, ~15-20 s on warm
checkouts. If you really need to bypass, fix the underlying issue
rather than passing `--no-verify`.

`smoke:server` (`scripts/smoke-server.sh`) compiles the Bun binary,
boots it on port 3100, and probes `/health`, `/`, `/v1`, `/api/v1` — catches
startup regressions (missing env, bind conflicts, missing
`dist/index.html`).

## Long-running operations

Convex actions cap at ~10 minutes; the browser fetch holding an
action result open is bounded much more aggressively (iOS Safari
aborts pending fetches when a tab backgrounds or the network
flips, surfacing as `TypeError: Load failed`). Anything that walks
an external catalog or fans out per-product API calls — App Store
Connect / Play Console sync, Meta Horizon reconciliation, future
Stripe price sync — must run as a background job, not as a
synchronous public action the dashboard awaits.

Pattern (mirrors `convex/products/jobs.ts` + `runProductSyncIOS` /
`runProductSyncAndroid`):

1. **Schema**: a `*Jobs` table with `status`
   (`queued | running | succeeded | failed`), `progress` (`{phase,
   current?, total?, failuresCount?}`), `result?`, `error?`,
   `cancelRequested?`, `expectedDeadline?`, `createdBy?`,
   `startedAt?`, `completedAt?`, `createdAt`. Indexes:
   `(projectId, platform, status)` for active-job lookup,
   `(status, expectedDeadline)` for the reaper,
   `(status, completedAt)` for the pruner.
2. **Enqueue mutation**: validates membership, dedups against an
   existing `queued`/`running` row for the same `(projectId,
   platform)`, inserts the row, schedules the worker via
   `ctx.scheduler.runAfter(0, internal.<module>.runX, { jobId })`.
   Returns `{ jobId, deduped }`.
3. **Worker internalAction**: `args: { jobId }`. Reads job →
   resolves project → runs the work, calling
   `updateJobProgress` at phase boundaries and
   `isCancelRequested` between phases. Wraps the body in
   try/catch and finishes via `markJobSucceeded` /
   `markJobFailed` so a thrown error never leaves the row in
   `running` forever.
4. **Cron pair**: `reapStaleProductSyncJobs` (5 min, flips
   `running` rows past `expectedDeadline + grace` to `failed`)
   and `pruneProductSyncJobs` (6 h, deletes `succeeded` rows
   older than 7 d / `failed` rows older than 30 d).
5. **Dashboard**: `useQuery(getActiveSyncJob)` for the reactive
   button state + progress label; `useMutation(enqueue*)` to
   start; `useMutation(cancel*)` to stop. The completion toast
   fires once via a `useRef`-gated `useEffect` so reactive
   updates don't re-toast.
6. **HTTP**: `POST .../sync/...` returns 202 with `{ jobId,
   deduped }`; `GET .../sync/jobs/{jobId}` polls; `POST
   .../sync/jobs/{jobId}/cancel` cancels. Clients backoff at ~3 s
   intervals.

Failures arrays should pass through `truncateFailures` (cap 200,
sets `failuresTruncated: true`) so a runaway sync where every
product fails for the same reason can't blow past Convex's
per-document size budget.

## Commit messages

Follow the monorepo-wide convention from the root
[`CLAUDE.md`](../../CLAUDE.md): with a tag prefix everything after the
colon is lowercase (`feat: add foo`); without a tag the first letter
is uppercase (`Add foo`).

## Environment variables

See [`.env.example`](./.env.example) for the full list. Vite-prefixed
(`VITE_*`) values are inlined into the SPA bundle at `bun run build`
time and are public. Server-side runtime secrets go to Fly.io
(`flyctl secrets set`); auth-provider secrets and Apple root certs go
to the Convex dashboard (Settings → Environment Variables).
