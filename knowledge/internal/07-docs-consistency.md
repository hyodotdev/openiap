# Docs Consistency Rules — Single Source of Truth (SSOT)

This document captures the consistency rules for OpenIAP documentation, code
comments, and generated types. PR #107 (and earlier rounds) repeatedly
surfaced the same class of drift — the docs claimed one field/default/type,
but the SDK code actually used another. These rules + the companion audit
script (`scripts/audit-docs.ts`) catch those before review.

## Sources of truth

When two places disagree, the upstream wins:

```
GraphQL schema  →  generated Types  →  hand-written wrapper SDK  →  docs page
(packages/gql      (libraries/*/src       (Swift / Kotlin /          (packages/docs/
 /src/*.graphql)   /types.{ts,kt,...})    Dart / TS / GDScript)        src/pages/...)
```

- `packages/gql/src/*.graphql` — schema descriptions ARE the canonical doc
  string. Edits propagate via `bun run generate` to every generated
  `Types.{ts,kt,swift,dart,gd}`.
- `libraries/*/src/types.ts` (or equivalent) — generated; never hand-edit.
  When a docs page mentions a field name, that field MUST exist in the
  generated TS type. The audit script enforces this.
- Wrapper SDK source (e.g. `libraries/expo-iap/src/index.ts`) — JSDoc
  parameter names MUST match the actual function-signature parameter
  names. ESLint rule `tsdoc/syntax` + the audit script catch drift.
- Doc pages — the surface visible to users. Must reflect what each upstream
  layer actually exposes.

## Rules

### R1 — JSDoc / KDoc / Dartdoc / Swift `@param` names match the signature

If the function declares `(args) =>`, the JSDoc tag is `@param args …`.
If it declares `(request) =>`, the tag is `@param request …`. Don't carry
over the schema field name (`props`, `params`) when the wrapper destructured
or renamed.

```ts
// ✅ wrapper destructures from `args`
/** @param args Purchase request. … */
export const requestPurchase = async (args) => { … };

// ❌ JSDoc says `props`; signature says `args`
/** @param props … */
export const requestPurchase = async (args) => { … };
```

### R2 — Defaults match across SDKs

If `fetchProducts.type` defaults to `'in-app'` in Flutter / expo-iap /
react-native-iap / godot-iap, then the Apple wrapper must also default to
`.inApp` — and the Apple doc comment must say `.inApp`. The schema
description is the canonical statement.

When changing a default, update:

1. The GraphQL schema description.
2. Re-run `bun run generate`.
3. Every wrapper SDK's `?? <default>` expression and JSDoc / KDoc / etc.
4. Every API doc page (`packages/docs/src/pages/docs/apis/<symbol>.tsx`).

### R3 — Doc pages reference real fields only

When a Type doc page lists fields in a `<table>` or `<ul>`, every field name
MUST exist in the generated `libraries/expo-iap/src/types.ts` (or
`libraries/react-native-iap/src/types.ts` — they're identical in shape).
The audit script greps for fields that don't appear in the type definition
and flags them.

Example failure modes already encountered:

- `BillingProgramAvailabilityResultAndroid` doc listed
  `responseCode` + `debugMessage` — neither field exists; the type has
  `billingProgram` + `isAvailable`.
- `LaunchExternalLinkParamsAndroid` doc listed `program` + `url` — neither
  exists; the type has `billingProgram` + `launchMode` + `linkType` +
  `linkUri`.
- `ExternalPurchaseCustomLinkNoticeResultIOS` doc listed `result` +
  `noticeType` — neither exists; the type has `continued` + `error`.

### R4 — Enum values listed in docs must exist

When a doc page mentions enum values (e.g.
`'continue' | 'cancelled'`, `.acquisition`, `.services`), they must
appear in the generated enum definition. The audit script extracts string
literals from `<code>'…'</code>` blocks in doc pages and checks them
against the generated TypeScript union types.

`ExternalPurchaseCustomLinkNoticeTypeIOS` is the canonical recent miss —
the union is `'browser'` only, but the doc claimed
`'continue' | 'cancelled' | …`.

### R5 — `<Link to="/docs/...">` targets must resolve

Anchor links should point to existing pages and section anchors. Common
recent failures:

- "Use verifyPurchase" link pointed to `/docs/apis/get-active-subscriptions`
  (totally unrelated).
- `getExternalPurchaseCustomLinkTokenIOS` Returns linked to the
  `external-purchase-link` page without an anchor — but that page
  documents only `ExternalPurchaseNoticeResultIOS`, so users land in the
  wrong section. Add a precise `#external-purchase-custom-link-token-result-ios`
  anchor on the type page AND link to it.

The audit script crawls every internal `<Link to="/docs/...">` and asserts
the target file (and anchor when given) exists.

### R6 — Native version constraints are honest

`enableBillingProgramAndroid: 'external-payments'` is gated to Play Billing
8.3.0+ (Japan only); the 8.2.0+ programs are `EXTERNAL_CONTENT_LINK` /
`EXTERNAL_OFFER`. A doc page that mixes these up misleads readers about
what works on which SDK.

When you write `<X> 8.2.0+`, you should be able to point to the matching
release-notes line. Don't paraphrase — quote the version requirement
exactly as Google / Apple states it.

### R7 — Code-example snippets compile-check

Code examples in doc pages should at minimum parse / type-check against
the wrapper they target. The audit script does NOT yet run a full
TypeScript / Kotlin / Dart parser, but it does:

- Verify imports (`import {…} from 'expo-iap'`) reference symbols that
  expo-iap actually exports.
- Verify field accesses on shown objects (e.g. `purchase.purchaseToken`)
  exist on the corresponding generated type.

When in doubt, run the example in a real example app before publishing.

### R8 — Platform-only callouts use the right wrapper

iOS-suffixed APIs (`syncIOS`, `getStorefrontIOS`, …) and Android-suffixed
APIs (`acknowledgePurchaseAndroid`, …) are exposed via every framework
wrapper (expo-iap, rn-iap, kmp-iap, flutter, godot-iap). The TS / Dart /
KMP / GDScript example tabs MUST show how to call the function from each
wrapper, with a `Platform.OS === 'ios'` (or `Platform.isIOS` / etc.)
guard so readers don't accidentally call iOS-only methods on Android.

The native Swift / Kotlin tab keeps the platform-native call. The
wrapper tabs use the suffixed name (`syncIOS()`, etc.) — except in
`packages/google` Kotlin (the Android-only native), where convention
strips the `Android` suffix from method names.

### R9 — Published package release lists use links

When a release-note block is labeled `Package Releases`, every package/version
item in that list must link to the corresponding GitHub Release. Use
`Planned Package Releases` only while the release workflow is still running or
the GitHub Release does not exist yet.

`bun run audit:docs` fails bare package/version entries under published
`Package Releases` blocks so link regressions are caught before publishing.

### R10 — Docs version metadata stays synced with package metadata

`packages/docs/src/lib/versioning.ts` must not import package metadata from
outside `packages/docs`. Vercel uploads the docs package root, so imports such
as `../../../../libraries/expo-iap/package.json?raw` pass locally but fail in
Vercel builds.

Framework package versions and Android SDK constants used by docs must flow
through `packages/docs/src/generated/version-metadata.json`, which is generated
by `scripts/sync-versions.sh` from the real SSOT files:

- Expo / React Native: each library `package.json`
- Flutter: `libraries/flutter_inapp_purchase/pubspec.yaml`
- Godot: `libraries/godot-iap/addons/godot-iap/plugin.cfg`
- KMP: `libraries/kmp-iap/gradle.properties` and `gradle/libs.versions.toml`
- MAUI: `libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj`
- Google Android SDK / Play Billing: `packages/google/openiap/build.gradle.kts`

`bun run audit:docs` fails if this generated metadata drifts from the SSOT
files or if `versioning.ts` reintroduces raw imports outside `packages/docs`.

## Pre-commit checklist

Run before every `git push` on docs / SDK changes:

```bash
# 1. Format + lint the docs site
cd packages/docs
bunx prettier --check "src/**/*.{ts,tsx,css}"
bun run lint

# 2. Cross-library typecheck for SDKs you touched
cd libraries/expo-iap && bun run lint:tsc
cd libraries/react-native-iap && yarn typecheck
cd libraries/flutter_inapp_purchase && dart analyze lib
cd packages/apple && swift build
cd packages/google && ./gradlew :openiap:compilePlayDebugKotlin

# 3. SSOT audit — run the docs-consistency audit script
cd scripts && bun run audit-docs.ts
```

Auto-mode users: the `commit-push-pr` skill runs steps 1 + 2 automatically
before pushing. Step 3 is opt-in until the audit script has zero false
positives in CI.

## Audit script

`scripts/audit-docs.ts` is the executable companion to this guide. It
parses every `/docs/apis/*.tsx` and `/docs/types/*.tsx` page, extracts:

- `<Link to="/docs/...">` targets
- `<code>fieldName</code>` mentions inside Returns / Parameters tables
- String-literal enum values in `<code>'…'</code>` blocks
- `@see {@link openiap.dev/...}` URLs

…and cross-references each against the generated TypeScript types in
`libraries/expo-iap/src/types.ts`. Failures print as a punch-list with the
file, line, and the offending mention.

Run with:

```bash
cd <repo-root>
bun run scripts/audit-docs.ts
```

Exit code 1 means at least one drift; 0 means clean.
