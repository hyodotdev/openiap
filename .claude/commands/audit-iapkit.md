---
name: audit-iapkit
description: Audit the IAPKit product surface against OpenIAP as the source of truth, then fix the drift it finds. Use when the user asks to check whether IAPKit reflects OpenIAP updates, audit kit docs, or reconcile kit.openiap.dev with openiap.dev.
---

# Audit IAPKit Against OpenIAP

IAPKit is a deployable SaaS, not a library, so it sits outside the GQL type-sync
chain that keeps the SDKs aligned. Nothing regenerates its site copy when the
spec, the stores, or the SDKs move, so its documentation drifts silently. This
workflow finds that drift and fixes it.

Read `packages/kit/CONVENTION.md` before editing anything under `packages/kit`.

## Direction of truth

```text
OpenIAP spec + packages/kit implementation   →   IAPKit site copy
        (authoritative)                            (must follow)
```

Precedence when surfaces disagree: implementation > `packages/docs` >
`packages/kit` prose. `packages/docs` outranks kit prose only where the code
does not decide the question (product positioning, support claims). Never
"fix" the code to match a doc without saying so explicitly.

## Workflow

```text
1. Establish what changed upstream
         ↓
2. Check every prose claim against the implementation
         ↓
3. Check kit against packages/docs for contradictions
         ↓
4. Apply mechanical fixes; escalate product calls
         ↓
5. Verify
```

## Steps

### 1. Establish what changed upstream

```bash
# Spec and SDK movement since the kit surface was last reviewed.
git log --oneline -20 -- packages/gql/src/type.graphql openiap-versions.json
# Least recently reviewed kit files first — that is where drift concentrates.
for f in $(git ls-files packages/kit/src/pages/docs/sections packages/kit/src/content); do
  echo "$(git log -1 --format='%ad' --date=short -- "$f")  $f"
done | sort
```

Also check upstream store documentation for anything the kit pages describe:
App Store Server API, Google Play Developer API, Amazon RVS, Meta Horizon, and
the Vega SDK release notes.

### 2. Check prose against the implementation

This is the highest-value pass. For every checkable claim on the kit site, find
the code that implements it and confirm the claim matches. Cite `file:line` for
both sides.

Highest-yield targets, in order:

- **Verification order and cryptography** — `packages/kit/convex/purchases/*.ts`.
  A page saying IAPKit verifies something it does not verify is the worst class
  of error.
- **Error codes** — confirm each documented code can actually reach a caller.
  Codes raised internally and re-wrapped before the response must not be listed.
- **Endpoints, fields, and limits** — `packages/kit/server/api/v1/**`,
  especially `route-input-schemas.ts` for which fields are required. A field the
  server requires but the docs call optional makes every following example 400.
- **Negative verdicts that return 200** — outcomes that are not errors but are
  documented as if they were, or not documented at all.
- **Numbers** — retry counts, rate limits, size caps, file sizes, retention
  windows. These rot silently; recompute rather than trusting the page.

### 3. Check kit against `packages/docs`

The two sites describe one product. Find statements that contradict each other
and decide which side is right from the code, then fix the wrong side.

```bash
bun run audit:docs
```

### 4. Apply fixes, escalate decisions

Fix mechanically when the correct text is determined by the code: a wrong fact,
an unreachable error code, a stale number, a broken link, a naming violation.

Escalate to the user, do not guess, when the fix requires a product call:
what the product officially claims to support, support channels, pricing or
plan statements, legal document content, restructuring a page, or consolidating
pages that have published URLs.

Constraints that override any finding:

- **Production is read-only.** Never run a mutation or action against the
  production Convex deployment, from the dashboard runner or anywhere else, and
  never hand-edit production documents. Reads are fine when the user asks;
  report aggregates, not customer emails. Full rule in the root `AGENTS.md`.
- **Webhook direction.** The only supported direction is store → IAPKit. Never
  document an IAPKit → SDK/mobile webhook, SSE, WebSocket, push relay, or
  long-poll feed. See the root `AGENTS.md`.
- **Brand.** `OpenIAP` and `IAPKit`, never `Open IAP`, `IAP Kit`, or bare `Kit`.
- **Reader-first standard.** `knowledge/internal/05-docs-patterns.md`. Remove
  filler and state each fact once; do not restyle prose that is already clear.
- **Screenshots.** A figure that contradicts corrected text is worse than no
  figure. Open the image before trusting its caption.

### 5. Verify

```bash
bun run --filter @hyodotdev/openiap-kit lint
bun run --filter @hyodotdev/openiap-kit test
bun run --filter @hyodotdev/openiap-kit smoke:server
bun run audit:kit-contract
bun run audit:docs
```

`packages/kit` changes also trigger the CI-equivalent gate in
`.husky/pre-commit`, which mirrors `deploy-kit.yml`.

## Report

Group findings as **fixed** (with file:line), **needs a decision** (with the
options and your recommendation), and **rejected** (with the reason). Say
plainly when a surface is in good shape rather than manufacturing work.
