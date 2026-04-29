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
hook (`.husky/pre-commit`) is paths-aware: it only runs when staged
changes touch `packages/kit/**`, and it runs only the fast `lint`
script:

```bash
bun run --filter @hyodotdev/openiap-kit lint
```

which is `tsc --noEmit` + `eslint`. The fuller `precommit` script
(`bunx lint-staged && bun run lint && bun run test && bun run smoke:server`)
is available as `bun run --filter @hyodotdev/openiap-kit precommit` for
ad-hoc use, but the husky hook intentionally skips `test` and
`smoke:server` to keep the local gate ~5–10 s — that's CI's job.

`smoke:server` (`scripts/smoke-server.sh`) compiles the Bun binary,
boots it on port 3100, and probes `/health`, `/`, `/api/v1`. Adds
~10–15 s but catches startup regressions (missing env, bind
conflicts, missing `dist/index.html`).

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
