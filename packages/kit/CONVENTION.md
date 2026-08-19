# Project Conventions

`packages/kit` contains IAPKit, the open-source purchase validation and
entitlement infrastructure for the OpenIAP ecosystem. The hosted service at
[kit.openiap.dev](https://kit.openiap.dev) is a React 19 SPA + Hono on Bun +
Convex backend, all shipped as one Fly.io binary. **Unlike other packages in
this monorepo, this is a deployable application, not a publishable library.**
It does not consume `@hyodotdev/openiap-gql` type generation; it has its own
Convex schema as the source of truth for purchase-validation models.

For setup, operations, and deploy details, see [`README.md`](./README.md).

## Production Is Read-Only For Agents

`healthy-kudu-836` is the production deployment and holds real customer data.
Never run a mutation or action against it — not from the Convex dashboard
function runner, not from `npx convex run --prod`, not from anywhere. The
dashboard runner reopens with the last function selected, which has included
`drainAccountDeletionBatch`; check what is selected before running anything.

Reads are fine when asked for. Report counts and aggregates rather than copying
customer emails or other personal data anywhere. Use the dev deployment for
anything that needs a new function.

See the root `AGENTS.md` for the full guardrail.

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

## Responsive card containment

Cards with dynamic text and trailing controls must keep every child inside the
card at every supported width:

- Let horizontal card rows wrap instead of assuming the label and actions fit
  on one line.
- Put `min-width: 0` on flexible flex/grid children; otherwise filenames and
  other intrinsic-width content can push controls outside the parent.
- Allow untrusted or user-provided strings to wrap anywhere, and keep icons and
  action buttons non-shrinking.
- Let the action group wrap onto its own row when necessary. Do not use clipping
  as the primary fix because it can hide reachable controls or focus rings.

Use the shared `contained-action-card` classes from `src/index.css` for this
layout instead of recreating the flex constraints per card.

## Convex Backend (CQRS)

Every domain folder under `convex/` follows the same split:

```
convex/<domain>/
├── query.ts      # Public reads — no side effects
├── mutation.ts   # Public writes — DB state changes
├── action.ts     # External APIs / cross-function orchestration
└── internal.ts   # Internal-only queries/mutations called from actions
```

One sanctioned exception: an operator-only `internalMutation` may stay
in `mutation.ts` when moving it to `internal.ts` would change its
generated function path (see `purchases/mutation.ts` —
`markReceiptInvalid` is invoked from the Convex dashboard, and the
in-file comment records the rationale). Do not "fix" such functions by
relocating them.

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

## IAPKit docs and messaging

- Default positioning: IAPKit is the open-source purchase validation and
  entitlement infrastructure for the OpenIAP ecosystem, managed by OpenIAP.
  The hosted service is a backend that apps can call directly. Describe a
  customer's own backend entitlement ledger as an optional advanced
  integration, not the default path.
- Keep docs concise and contract-driven. Request/response field claims
  must follow `server/api/v1/route-input-schemas.ts`,
  `server/api/v1/route-response-schemas.ts`, and Convex validators;
  update those sources and docs together.
- For product verification, never imply a client-provided product id is
  trustworthy. Use the store-verified `productId` and optional
  `expectedProductId` match guard.

## Product boundary

IAPKit is the open foundation beneath commercial purchase experiences. Keep it
useful and neutral without competing with paywall, experimentation, or marketing
platforms.

- **In scope:** purchase verification, subscription and entitlement state,
  inbound store lifecycle handling, reconciliation, catalog and store sync,
  neutral client payload transport, operational revenue/subscription analytics,
  and administration through APIs, the dashboard, and MCP.
- **Out of scope:** paywall builders or UI, audience targeting and segmentation,
  A/B or multivariate experiments, lifecycle campaigns, marketing automation,
  and conversion or paywall optimization recommendations.
- Analytics measure the purchase infrastructure developers operate and audit.
  Do not turn them into an experimentation or marketing-optimization product.
- Do not position IAPKit as a free RevenueCat alternative. Describe it as open
  purchase and entitlement infrastructure that commercial experience providers
  can build on.

## Webhook direction

IAPKit supports inbound store lifecycle delivery only:

```text
Apple ASN v2 / Google RTDN → IAPKit
```

Do not add an outbound IAPKit-to-SDK/mobile webhook stream, SSE route,
WebSocket, push relay, or long-poll event feed. Mobile clients must use the
bounded request/response verification, status, entitlement, product, and
client-payload endpoints. A developer backend may send APNs/FCM notifications
for resources it protects, but IAPKit must not publish project-wide lifecycle
events to shipped apps.

## `/v1` response contract

IAPKit deploys from `main` on its own workflow. The SDKs that decode its
responses are frozen inside apps already on the stores, so a kit-only change
reaches every user at once with no SDK release and no way to roll forward.
Treat the `/v1` response shape as a published API:

- **Additive only.** Never remove a field, rename one, or change what an
  existing value means. New fields must be optional, and anything that changes
  a response shape should be gated on an explicit request flag, the way
  `includeClientPayload` is.
- **Enum values are spec changes.** `IapkitPurchaseState`,
  `IapkitClientPayloadFormat`, and `IapStore` live in
  `packages/gql/src/type.graphql`. Change the schema first, regenerate, and
  confirm each SDK degrades an unknown value instead of failing the receipt —
  `bun audit:kit-contract` compares the three declarations and fails on drift.
- **`isValid` is the entitlement gate.** `isValidState` in
  `convex/purchases/shared.ts` decides what published apps unlock. Widening or
  narrowing it, or changing `mapAppStorePurchaseState` /
  `mapGooglePlayPurchaseState`, changes live behavior for existing users.
  Golden tests in `shared.test.ts` pin both; update them deliberately.
- **The emitted body is validated.** `enforceVerifyResponseContract` holds
  responses to `verifyPurchaseSuccessResponseSchema` before they are sent, so
  the OpenAPI document cannot drift from what clients receive. Extend the
  schema when you add a field; do not bypass the check.

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
boots it on port 3100, confirms that the spawned process owns the listener, and
probes `/health`, the SPA/API entry points, static 404 behavior, and a malformed
`POST /v1/purchase/verify` request that must return 400 without contacting a
store. This catches startup regressions (missing env, bind conflicts, missing
`dist/index.html`) without accepting responses from an older process.

## Long-running operations

Convex actions cap at ~10 minutes; the browser fetch holding an
action result open is bounded much more aggressively (iOS Safari
aborts pending fetches when a tab backgrounds or the network
flips, surfacing as `TypeError: Load failed`). Anything that walks
an external catalog or fans out per-product API calls — App Store
Connect / Play Console sync, Amazon RVS reconciliation, future
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
.../sync/jobs/{jobId}/cancel` cancels. Clients use ~3 s backoff
   intervals.

Failures arrays should pass through `truncateFailures` (cap 200,
sets `failuresTruncated: true`) so a runaway sync where every
product fails for the same reason can't blow past Convex's
per-document size budget.

## Commit messages

Follow the monorepo-wide convention from the root
[`AGENTS.md`](../../AGENTS.md): with a tag prefix everything after the
colon is lowercase (`feat: add foo`); without a tag the first letter
is uppercase (`Add foo`).

## Environment variables

See [`.env.example`](./.env.example) for the full list. Vite-prefixed
(`VITE_*`) values are inlined into the SPA bundle at `bun run build`
time and are public. Server-side runtime secrets go to Fly.io
(`flyctl secrets set`); auth-provider secrets and Apple root certs go
to the Convex dashboard (Settings → Environment Variables).
