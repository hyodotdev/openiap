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

- `packages/gql/schema-files.mjs` — ordered inventory of every production SDL
  input. Every repository-owned generator imports it directly. Do not add
  another hard-coded schema list or an unverified external generator manifest.
- `packages/gql/schema-source-utils.mjs` — shared source identity normalization
  and block-string line detection. Metadata extractors must not duplicate this
  lexical bookkeeping.
- `packages/gql/src/*.graphql` — schema descriptions ARE the canonical doc
  string. Edits propagate via `bun run generate` to every generated
  `types.ts`, `Types.kt`, `Types.swift`, `types.dart`, `types.gd`, and
  `Types.cs`.
- `packages/gql/schema-markers.mjs` — the only parser for the SDL comment
  contracts `# Future` and `# => Union`. Generators and the schema linter must
  consume it rather than maintaining independent line-state machines. A union
  wrapper must be a non-root object with at least one field and all fields
  nullable; operation roots, empty wrappers, and required fields fail
  generation instead of silently degrading to an object.
- `packages/gql/schema-deprecations.mjs` — the only extractor and validator for
  canonical deprecation ownership. Standard GraphQL declarations use
  `@deprecated(reason: ...)`; named types use the project-scoped
  `@openiapDeprecated(reason: ...)` directive declared in `schema.graphql`.
  Do not duplicate an
  `@deprecated` tag inside the description or encode deprecation only as
  description prose. The schema linter rejects missing, duplicate, empty, and
  conflicting ownership. The generator appends the directive reason wherever
  the target exposes a corresponding declaration; TypeScript receives an
  explicit injection for project-scoped type-level directives.
  TypeScript string-union members have no per-member declaration and therefore
  cannot carry GraphQL enum-value docs; `ErrorCode` remains a real enum, so its
  member deprecations are required. Custom aliases such as
  `PurchaseInput = Purchase` rely on the aliased declaration's canonical docs
  instead of duplicating them. GDScript does not emit GraphQL interfaces, so
  implementation declarations carry the applicable field guidance. GDScript
  also expresses `# => Union` result wrappers only through operation return
  metadata rather than declarations, so wrapper-variant docs have no generated
  declaration target there; every language that emits a wrapper or variant
  declaration must preserve the canonical reason.
- `packages/gql/custom-input-contracts.ts` — typed
  field/type/nullability/default contracts for inputs that custom generators
  alias or project. The shared IR transformer validates these before any
  language plugin runs.
- `packages/gql/generated-sync-manifest.mjs` — generated source/target mapping
  shared by canonical platform sync and the pre-commit drift guard.
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
MUST exist in the canonical generated
`packages/gql/src/generated/types.ts` shape, which is synchronized into Expo
and React Native. The audit parses that TypeScript SSOT with the compiler AST
and flags fields that do not appear in the declaration.

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
appear in the generated enum definition. Compare documentation against the
generated target-language member names and wire values, not a manually copied
list. GraphQL enum identifiers are PascalCase, but serialized string values can
be lowercase or kebab-case.

`ExternalPurchaseCustomLinkNoticeTypeIOS` is the canonical recent miss —
the union is `'browser'` only, but the doc claimed
`'continue' | 'cancelled' | …`.

The audit script enforces exact generated values for the canonical offer
snippets covered by R12. Other enum examples still require review against the
generated types until a focused, fault-tested rule is added; do not describe a
broader automated guarantee than the script actually provides.

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

The audit script crawls every internal `<Link to="/docs/...">` and asserts the
target page file exists. Anchor semantics still require review against the
target page.

### R6 — Native version constraints are honest

`enableBillingProgramAndroid: 'external-payments'` is gated to Play Billing
8.3.0+ (Japan only). `EXTERNAL_CONTENT_LINK` / `EXTERNAL_OFFER` were introduced
in 8.2.0, but their production integration must require 8.2.1+ because Google
fixed the availability and reporting-details APIs in that release. External
Offer examples must generate fresh reporting details for each redirect session
immediately before `launchExternalLink`; they must not teach the deprecated external-offer or
alternative-only dialog/token flow. A page that mixes these up misleads readers
about what works on which SDK.

When you write `<X> 8.2.0+`, you should be able to point to the matching
release-notes line. Don't paraphrase — quote the version requirement
exactly as Google / Apple states it.

### R7 — Code-example snippets follow the real wrapper contract

Code examples in doc pages should at minimum parse / type-check against
the wrapper they target. The audit script does not compile every documentation
language. Its R11 rules reject a focused set of recurring phantom API shapes;
all other imports, calls, and field accesses still require a real example build
or a targeted fault-tested audit rule.

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

RC and npm `next` releases are managed on the on-demand `next` branch and do
not get release-history entries. Add one grouped entry only when the train is
promoted to a stable release on `main`.

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

### R11 — Active code examples reject recurring phantom API shapes

Fenced `CodeBlock` examples under active documentation must not reintroduce
known cross-language mistakes such as Kotlin syntax in C#, obsolete Flutter
listener names, legacy purchase request shapes, top-level Godot SKUs, or
obsolete Kotlin/KMP named arguments. Historical release notes are excluded
because they describe APIs as shipped at that time.

Keep R11 focused. Every new pattern needs a failing fixture and a valid nearby
shape so formatting, comments, or unrelated prose cannot trigger it.

### R12 — Canonical offer docs derive enum contracts from generated types

`DiscountOffer` is the canonical Android one-time product offer shape backed by
`ProductDetails.OneTimePurchaseOfferDetails`. Subscription discounts belong to
`SubscriptionOffer`, which maps to StoreKit `Product.SubscriptionOffer` and
Google Play `ProductDetails.SubscriptionOfferDetails`.

The canonical DiscountOffer page contains TypeScript, Swift, Kotlin, and Dart
`DiscountOfferType` snippets. The audit must parse the corresponding generated
files and compare each snippet with those generated members and wire values. Do
not hard-code a second expected enum list in the audit or its fixtures.

Search data must contain exactly one canonical entry for each page:

- `DiscountOffer` → `/docs/types/discount-offer`
- `SubscriptionOffer` → `/docs/types/subscription-offer`

Every R12 parser edge case needs a fault test. Required fixture transforms must
fail when their search pattern no longer matches; a no-op replacement can make
an invalid parser look green.

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

# 3. SSOT audit + parser fault fixtures (from the repository root)
cd <repo-root>
bun test scripts/audit-docs.test.ts
bun run audit:docs
```

The pre-commit hook runs the docs typecheck, audit fixtures, audit, and docs
format check when docs, the audit scripts, or the generated GQL contracts they
consume change. GitHub's `Test Docs` job runs the same audit fixtures and audit.
Do not bypass these gates.

## Audit script

`scripts/audit-docs.ts` is the executable companion to this guide. It
parses every `/docs/apis/*.tsx` and `/docs/types/*.tsx` page, extracts:

- `<Link to="/docs/...">` targets
- `<code>fieldName</code>` mentions inside Returns / Parameters tables
- published release entries and docs-local version metadata
- focused recurring phantom shapes from active fenced code examples
- canonical offer semantics, generated enum snippets, and search entries

Field mentions are cross-referenced against generated TypeScript shapes.
Canonical offer snippets are compared with the generated TypeScript, Swift,
Kotlin, and Dart outputs. Failures print a punch-list with the file, line, and
offending contract.

Run with:

```bash
cd <repo-root>
bun test scripts/audit-docs.test.ts
bun run audit:docs
```

Exit code 1 means at least one drift; 0 means clean.
