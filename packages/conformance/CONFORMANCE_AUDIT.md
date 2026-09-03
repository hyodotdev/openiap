# OpenIAP Conformance Testing Audit

**Audit date:** 2026-08-12
**Repository state:** `main` @ `03091c0c`
**Scope:** Repository/design audit. Sections 1–15 record the state *as audited*, before any changes.

> **Four remediation rounds followed this audit** (§16–19), taking the overall score from
> **2 → 4.5**. §16 fixed defects, including a live entitlement leak the audit predicted.
> §17 built the versioned conformance suite. §18 bound real implementations to it and
> **corrects an error in this audit's own §10.1/R3**. §19 fixes R3 as a breaking change. Read §16–19 for the current state;
> §1–15 remain as originally written so the two can be compared.

---

## 1. Executive Summary

OpenIAP has an unusually disciplined **type and API-surface** contract system, and essentially **no behavioral conformance system**.

The GraphQL schema in `specs/client/src/` is a genuine single source of truth. It generates six language bindings, those bindings are synced into eight downstream targets through a manifest, and CI fails on any drift. A 8,827-line parity audit (`scripts/audit-non-godot-parity.mjs`) runs on every pull request and enforces that every schema operation has a corresponding binding in every framework SDK. This machinery is real, it is enforced, and it is better than most projects of this size have.

But it verifies **shape, not behavior**. `audit-non-godot-parity.mjs` works by reading source files as text and regex-matching for the presence of symbols and declarations — for example, `hasTypeScriptFieldBinding()` (line 1129) passes if a top-level `const` mentioning the operation name and a `QueryField<`/`MutationField<` type parameter exists in the file. An SDK that declares `restorePurchases` and returns immediately without doing anything passes the parity audit. Nothing in the repository asserts what `restorePurchases` should *do*.

The three artifacts in the repo that carry conformance-adjacent names are, on inspection, mostly not conformance tests:

| Artifact | Name suggests | Actually is |
| --- | --- | --- |
| `scripts/audit-non-godot-parity.mjs` | Cross-SDK parity | Static source-text presence checking |
| `libraries/maui-iap/tests/OpenIap.Maui.ContractTests/` | Contract tests | HTTP/JSON tests against a fake handler for the IAPKit REST client |
| `libraries/flutter_inapp_purchase/test/native_wire_contract_test.dart` | Wire contract | `File(...).readAsStringSync()` + `expect(source, contains(...))` |
| `specs/client/src/schema-contract.test.ts` | Schema contract | GraphQL directive/type-shape assertions (legitimately schema validation) |
| `packages/kit/convex/webhooks/conformance.test.ts` | Conformance | **A genuine deterministic conformance harness** — the one real instance |

The single real conformance kernel in the repository is on the server side: `packages/kit/convex/webhooks/conformance.test.ts` drives Apple ASN v2 and Google RTDN payloads through a **shared** normalizer → **shared** state machine (`applySubscriptionTransition`) → **shared** entitlement predicate (`entitlementActive`), and asserts the normalized outcome. That is the correct architecture. It covers 6 scenarios and 2 of IAPKit's 4 providers.

On the client side, every behavioral test is written against one implementation. Where two implementations test the same concept, the test is copy-pasted and has already drifted — `SubscriptionGroupMappingPlayTest.kt` and `SubscriptionGroupMappingHorizonTest.kt` share an identical test name and assertions, but Play additionally asserts `pending subscriptions are not active entitlements` and Horizon does not.

Two findings deserve immediate attention independent of any conformance program:

1. **`packages/docs/src/pages/docs/foundation/one-pager.tsx:198` lists "Conformance Tests — Cross-platform test matrix ensuring behavioral consistency" under a heading titled "Core Components"**, and `sponsorship.tsx:65` presents "Conformance and test matrix" as a present-tense sponsor benefit. `roadmap-budget.tsx:69` correctly marks "Conformance test suite v1" as **Planned**. The public foundation materials contradict each other, and the optimistic reading is the one a Linux Foundation reviewer or prospective sponsor will encounter first.

2. **Store implementations diverge on entitlement-relevant semantics with no test detecting it.** Amazon never produces `PurchaseState.Pending` and maps a cancelled receipt to `PurchaseState.Unknown` (`packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt:352`), while Play and Horizon map their SDK's `PENDING` to `PurchaseState.Pending`. A consumer branching on `purchaseState` grants entitlements differently depending on which store flavor is compiled in.

**Direct answer to the headline question:** No — OpenIAP cannot honestly claim today that its implementations are conformance-tested against a shared specification. It can honestly claim that its implementations are *type-conformant* and *API-surface-complete* against a shared schema, which is a real and defensible claim, and a materially different one.

---

## 2. Overall Conformance Maturity Score

| Subject | Score | Band |
| --- | --- | --- |
| **Client OpenIAP** (schema, Apple, Google, 6 framework SDKs) | **1.5 / 5** | Ad hoc → Emerging |
| **IAPKit** (server-side verification + webhooks) | **2.5 / 5** | Emerging → Functional |
| **Overall** | **2 / 5** | Emerging |

**Client OpenIAP — 1.5.** Scores above pure "Ad hoc" because a shared contract layer genuinely exists and is CI-enforced (schema SSOT, 6-language codegen, drift gates, operation-binding parity). Cannot reach a clean "Emerging" because *none* of that shared layer is behavioral: there is not one test in the repository that defines an expected behavior once and executes it against more than one implementation. Every one of the ~136 Apple test functions, ~380 Google test functions, and the framework SDK suites is implementation-specific.

**IAPKit — 2.5.** Scores highest in the repo because `convex/subscriptions/stateMachine.ts` is a real shared normalized model and `webhooks/conformance.test.ts` is a real deterministic multi-step scenario harness executing two providers against it. Held below "Functional" because only 2 of 4 providers are in the harness, the scenario scripts are duplicated per provider (`runAppleScenario` / `runGoogleScenario`) rather than shared, and the *verification* layer — the part that actually grants entitlement — has no shared adapter interface at all.

**Overall — 2.** Weighted toward the client side, which is the larger surface and the one that "OpenIAP compatible" would refer to.

---

## 3. Current Architecture

### 3.1 Specification source of truth

The canonical spec is the GraphQL schema set in `specs/client/src/` — 9 files, 3,224 lines:

| File | Lines | Role |
| --- | --- | --- |
| `schema.graphql` | 22 | Root types + `@openiapDeprecated` directive |
| `type.graphql` | 846 | Cross-platform types, `IapPlatform`, `IapStore`, `ProductType`, `PurchaseState`, `IapEvent` |
| `type-ios.graphql` | 804 | iOS-specific types |
| `type-android.graphql` | 1,040 | Android-specific types |
| `api.graphql` | 100 | Cross-platform Query/Mutation operations |
| `api-ios.graphql` | 175 | iOS-only operations |
| `api-android.graphql` | 121 | Android-only operations |
| `error.graphql` | 64 | `ErrorCode` enum (37 members) + `PurchaseError` |
| `event.graphql` | 52 | Subscription/event operations |

Generation runs through two guarded lanes (`specs/client/package.json` → `generate`): graphql-codegen for TypeScript, and a custom Parser → IR → language-plugin pipeline for Swift, Kotlin, Dart, GDScript, and C#. Output lands in `specs/client/src/generated/` and is distributed by `specs/client/generated-sync-manifest.mjs` to eight targets (Apple `Types.swift`, Google `Types.kt`, and the six framework SDKs' generated type files).

**Is the spec precise enough to base conformance testing on?** For types, yes. For behavior, no. The schema defines shape and vocabulary; behavioral requirements exist only as free-text docstrings, and they are sparse. The strongest normative statements found in the entire schema are:

- `api.graphql:30` — `getStorefront`: *"The operation fails when the store cannot provide a value; implementations must not synthesize a locale fallback."* This is a genuine normative MUST NOT. Nothing tests it.
- `api.graphql:60` — `finishTransaction`: *"Required on Android within 3 days."*
- `type.graphql:36` — `IapEvent.SubscriptionBillingIssue`: *"NOT emitted by Amazon Appstore or the Horizon flavor, whose Billing Compatibility SDK implements only Play Billing 7.0."* This is capability information encoded in prose.

There is no RFC-2119 keyword discipline, no distinction between normative requirements and implementation guidance, no defined state machine for `PurchaseState` transitions, and no mapping table stating which platform error conditions MUST normalize to which `ErrorCode`.

### 3.2 Store implementation architecture

**Apple** (`packages/apple/`) — single StoreKit 2 implementation, Swift Package.

**Android** (`packages/google/`) — three stores implemented as **Gradle product flavors** (`packages/google/openiap/build.gradle.kts:106-123`), not as runtime adapters:

```
packages/google/openiap/src/
  main/      15 .kt   shared
  play/       7 .kt   Google Play Billing
  horizon/    5 .kt   Meta Horizon
  amazon/     2 .kt   Amazon Appstore
```

Each flavor supplies its own file with the same class/function names — for example, three separate `OpenIapErrorExtensions.kt` files each defining `OpenIapError.Companion.fromBillingResponseCode`. This is compile-time duck typing: **there is no Kotlin interface that all three flavors must implement**, so the compiler enforces nothing about their mutual consistency, and each flavor has its own isolated test source set (`testPlay/`, `testHorizon/`, `testAmazon/`).

### 3.3 IAPKit architecture

Two distinct layers with very different maturity:

**Verification layer** (`packages/kit/convex/purchases/`) — four bespoke provider modules with no shared interface:

| Provider | Module | Lines | Entry point |
| --- | --- | --- | --- |
| Apple | `ios.ts` | 572 | `verifyAppStoreReceiptInternalV1` |
| Google | `android.ts` | 676 | `verifyGooglePlayReceiptInternalV1` |
| Amazon | `amazon.ts` | 666 | `verifyAmazonReceiptInternalV1` |
| Meta Horizon | `horizon.ts` | 292 | `verifyMetaHorizonReceiptInternalV1` |

**Webhook/lifecycle layer** (`packages/kit/convex/webhooks/`, `convex/subscriptions/`) — genuinely normalized:

```
apple.ts   ──► normalizeAppleAsn  ──┐
                                     ├─► NormalizedWebhookEvent
google.ts  ──► normalizeGoogleRtdn ──┘         │
                                                ▼
                                  applySubscriptionTransition   (stateMachine.ts, 279 lines)
                                                │
                                                ▼
                                       entitlementActive
```

`SubscriptionState` (`webhooks/shared.ts:42`) is the shared normalized vocabulary. Only Apple and Google have webhook normalizers; Amazon uses a polling reconciler (`reconcileAmazonPurchases`, `purchases/amazon.ts:564`) and Horizon has neither.

---

## 4. Existing Test Inventory

### 4.1 Volume

| Area | Test files | Notes |
| --- | --- | --- |
| `specs/client` | 20 | Schema + codegen validation |
| `packages/apple` | 9 files / 136 `func test` | |
| `packages/google` | 41 files / 380 `@Test` | Split across `test/`, `testPlay/`, `testHorizon/`, `testAmazon/` |
| `packages/kit` | 86 | Includes the one real conformance harness |
| `packages/mcp-server` | 4 | |
| `libraries/react-native-iap` | 26 | |
| `libraries/expo-iap` | 37 | |
| `libraries/flutter_inapp_purchase` | 27 | |
| `libraries/kmp-iap` | 23 | |
| `libraries/maui-iap` | 9 | |
| `libraries/godot-iap` | 3 | |
| `scripts/` | ~12 | Audit-script self-tests |

### 4.2 Classification of significant suites

| Suite | Verifies | Class |
| --- | --- | --- |
| `specs/client/src/schema-contract.test.ts` | Directive locations, union allowlist, `platform` field removed from `PurchaseAndroid`/`PurchaseIOS` in favor of `store` | Schema validation |
| `specs/client/src/generated-compatibility.test.ts` | Deprecation tags, doc-comment preservation, blank-line formatting, published-signature stability across generated languages | Code-generation validation |
| `specs/client/src/generated-sync-verifier.test.mjs`, `generated-sync-manifest.test.mjs` | Generated files match manifest targets | Drift detection |
| `specs/client/src/schema-linter.test.ts`, `schema-*.test.mjs` | Schema hygiene, deprecation markers | Schema validation |
| **`scripts/audit-non-godot-parity.mjs`** | Presence of symbols/bindings/example routes across 5 SDKs by regex over source text | **Static analysis — not a test** |
| `scripts/audit-docs.ts` | Doc pages' `<code>` field mentions exist in generated types; release-note link integrity; version metadata | Docs/type drift detection |
| `scripts/audit-purchase-payload-parity.mjs` | Purchase payload field parity across SDKs by source-text extraction | Static analysis |
| `packages/apple/Tests/**` | Serialization failures, app-account tokens, external purchase links, renewal info, `verifyPurchase`, intro-offer eligibility, connection/listener lifecycle | Unit |
| `packages/google/**/test/` (shared) | Billing converters, error construction, offer types, request-props invariants, continuation guards | Unit |
| `packages/google/**/testPlay,testHorizon,testAmazon/` | Flavor-specific mapping, ownership, race conditions | Unit (per-flavor, duplicated) |
| **`packages/kit/convex/webhooks/conformance.test.ts`** | 6 multi-step lifecycle scenarios → shared state machine → entitlement | **Conformance/contract** |
| `packages/kit/convex/purchases/{ios,android,amazon,horizon}.test.ts` | Each provider's own parsing/mapping/verification functions | Unit (per-provider, independent) |
| `packages/kit/convex/subscriptions/stateMachine.test.ts` | State machine transitions directly | Unit (on a shared component) |
| `packages/kit/server/api/v1/*.test.ts` | REST routes, schemas, rate/replay guards | Integration |
| `libraries/*/example/__tests__/**` | Example app UI with `useIAP` fully mocked (`purchase-flow.test.tsx` mocks `mockUseIAP` wholesale) | Unit (UI), **not SDK behavior** |
| `libraries/flutter_inapp_purchase/test/native_wire_contract_test.dart` | `expect(source, contains('params["skus"]'))` over plugin source files | Static analysis dressed as a test |
| `libraries/maui-iap/tests/OpenIap.Maui.ContractTests/Program.cs` | 6 tests of URI escaping / JSON round-tripping against `FakeHttpMessageHandler` for the IAPKit REST client | Unit |
| `scripts/e2e-web-sites.mjs` | Playwright over docs + kit marketing sites | E2E (web, not IAP) |
| `.claude/skills/iapkit-e2e-martie`, `iapkit-e2e-petgu`, `/e2e-tests` | Manual, human-driven device + sandbox procedures | Manual E2E |

### 4.3 What does not exist

- No `conformance/` directory on the client side.
- No shared fixture corpus. A repo-wide search for fixture/scenario/golden data files returns only `libraries/expo-iap/plugin/__tests__/fixtures` (Expo config-plugin fixtures, unrelated to IAP behavior).
- No adapter/harness abstraction that lets one test body run against multiple implementations.
- No `.storekit` StoreKit Test configuration in `packages/apple` (one exists at `libraries/flutter_inapp_purchase/example/ios/Runner/StoreKit.storekit`, used by the example app, not by a test suite).
- No automated real-store or sandbox testing anywhere in CI.

---

## 5. Conformance Coverage Matrix

Assessed strictly: "Covered" requires a reusable test asserting spec-defined behavior against more than one implementation.

| # | Category | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Product fetching | **Not covered** | Implementation-specific only: `FetchProductsAmazonTest.kt`, `fetch_products_all_test.dart`, `fetch-products-discriminated-union.test.ts`. No shared assertion of what a normalized `Product` must contain per store. |
| 2 | Purchases | **Not covered** | No test drives `requestPurchase` against a contract. Framework example tests mock the hook entirely. |
| 3 | Transaction completion / acknowledgement | **Not covered** | `finishTransaction` is bound in every SDK (parity audit) but its semantics — consumable vs non-consumable, Android's 3-day window from `api.graphql:60` — are untested. |
| 4 | Restoration / available purchases | **Not covered** | `available-purchases.test.tsx`, `available_purchases_screen_test.dart` are mocked UI tests. |
| 5 | Subscriptions | **Partially covered** | Server-side only: `webhooks/conformance.test.ts` (Apple + Google). Client-side `getActiveSubscriptions` has independent per-flavor tests. |
| 6 | Purchase lifecycle / state transitions | **Partially covered** | `stateMachine.ts` + `conformance.test.ts` cover the *server* lifecycle well. No client-side `PurchaseState` transition contract exists. |
| 7 | Pending purchases | **Partially covered** | `AmazonPendingPurchasesTest.kt`, `PendingEventBufferTest.kt`, `PendingPurchaseOwnershipRaceTest.kt` — all independent. **Amazon never emits `PurchaseState.Pending`** (`amazon/OpenIapModule.kt:352`); no test asserts this divergence is intended. |
| 8 | Cancellation | **Partially covered** | Amazon's cancellation signals tested in `AmazonSubscriptionGroupMappingTest.kt:12`; server-side via `cancellationReason` in `conformance.test.ts`. No cross-implementation contract. |
| 9 | Already-owned | **Not covered** | `ErrorCode.AlreadyOwned` exists. Google maps `ITEM_ALREADY_OWNED → ItemAlreadyOwned` (`play/OpenIapErrorExtensions.kt:33`). Apple has **no construction site for it** anywhere in `packages/apple/Sources/`. Untested on both. |
| 10 | Normalized error codes | **Partially covered** | Per-implementation mapping tests exist (`OpenIapErrorTest.kt`, `ErrorMappingTest.kt`, `IosErrorMappingTest.kt`, `AmazonErrorMappingTest.kt`, `errorMapping.test.ts`). **No shared table.** See §7.1 for the divergence this hides. |
| 11 | Product / transaction identifiers | **Partially covered** | `extract-order-id.test.ts`, `extract-product-id.test.ts` (kit), `HorizonBlankOrderIdTest.kt`. Client-side identifier normalization is untested cross-store. |
| 12 | Optional / unsupported capabilities | **Not covered** | No machine-readable capability model exists. See §8. `OpenRedeemOfferCodeAmazonNoOpTest.kt` / `...HorizonNoOpTest.kt` test no-op behavior per flavor, independently. |
| 13 | Platform-specific extensions | **Partially covered** | `audit-non-godot-parity.mjs` enforces that `*IOS`/`*Android` operations are bound everywhere; behavior untested. |
| 14 | Event / listener behavior | **Partially covered** | `ListenerThreadSafetyTest.kt`, `PendingEventBufferTest.kt`, `OpenIapProviderTests.swift:35-104`. Ordering and delivery guarantees are not specified, so nothing cross-checks them. |

**Score: 0 Covered / 8 Partially covered / 6 Not covered.**

---

## 6. CI Enforcement Assessment

### 6.1 What runs on pull requests

| Job | Workflow | Blocking | Path-filtered |
| --- | --- | --- | --- |
| Audit Release Branch State | `ci.yml:17` | Yes | No |
| Audit Lockfile Sync | `ci.yml:45` | Yes | No |
| **Audit SDK Parity** | `ci.yml:120` | Yes | No |
| Test GQL Types + drift gate | `ci.yml:163` | Yes | `gql` filter |
| Test Android (`:openiap:test`, 3 flavor builds, 3 lints) | `ci.yml:201` | Yes | `android` filter |
| Test iOS (`swift build`, `swift test`) | `ci.yml:254` | Yes | `ios` filter |
| Test Docs (`audit:docs`, typecheck, lint, build) | `ci.yml:276` | Yes | `docs` filter |
| Web E2E (Playwright) | `ci.yml:~340` | Yes | `web` filter |
| Test Agent Scripts | `ci.yml:385` | Yes | No |
| Kit verify (lint, `test:coverage`, coverage gates, Docker, smoke) | `deploy-kit.yml:29` | Yes | `packages/kit/**` |
| Per-library CI | `ci-*.yml` × 6 | Yes | Per-library paths |

CI enforcement of the *type* contract is strong. `ci.yml:154` regenerates, syncs, and then runs `scripts/assert-clean-worktree.mjs` — generated-artifact drift cannot merge. The parity audit runs unfiltered on every PR and additionally shells out to six self-test suites before running (`audit-non-godot-parity.mjs:19-57`).

### 6.2 Gaps

**Coverage gates are applied unevenly.** `assert-lcov-coverage.mjs` enforces 90% line coverage on `react-native-iap`, `expo-iap`, `flutter_inapp_purchase`, and kit's `server/` (48% for kit's `convex/`). **`packages/apple`, `packages/google`, `kmp-iap`, `maui-iap`, and `godot-iap` have no coverage gate at all** — including the two reference implementations that define what every binding wraps.

**KMP does not run its iOS tests.** `ci-kmp-iap.yml:48` runs `:library:testPlayDebugUnitTest` (which picks up `commonTest` + `androidUnitTest`) plus compile-only tasks. The iOS job (`ci-kmp-iap.yml:81`) runs `compileKotlinIosSimulatorArm64` only — **no `iosSimulatorArm64Test`**. `IosErrorMappingTest.kt` and `IosConnectionLifecycleTest.kt` in `library/src/iosTest/` never execute in CI. Amazon and Horizon variant unit tests also never run (Play variant only).

**Godot is excluded from parity by design.** `audit-non-godot-parity.mjs:88` puts `godot-iap` in `parityExcludedLibraries` with the comment *"intentionally excluded until its example parity is brought back into the same automated build/test lane."* `ci-godot-iap.yml:57` is largely `test -f` file-existence checks plus an Android `testDebugUnitTest`. Godot is effectively outside the contract system.

**MAUI runs no behavioral tests on device targets.** `ci-maui-iap.yml` builds the Android binding and an App Store artifact but executes tests only against the shared `net10.0` target.

**Platform limitations meaningfully cap coverage.** No CI runner can complete a real purchase. Apple's `swift test` cannot drive StoreKit purchase flows without a StoreKit Test configuration, which does not exist in `packages/apple`. Google's unit tests run on the JVM against mocked billing clients. This is a genuine constraint, and it is exactly the constraint a deterministic fake-store conformance harness is designed to work around — see §13.

**Real-store testing is entirely manual and undocumented in CI.** The `/e2e-tests`, `iapkit-e2e-martie`, and `iapkit-e2e-petgu` skills describe human-driven device procedures against Apple/Google sandbox accounts. There is a clean separation from deterministic testing (manual work never gates merges), but there is also no record of what was run, against which spec version, with what result. Nothing links a released version to a conformance run.

---

## 7. Cross-Implementation Consistency Findings

### 7.1 Error normalization diverges sharply between Apple and Android

`ErrorCode` (`error.graphql:4`) defines 37 members. Actual reachability:

**Google Play** (`packages/google/openiap/src/play/java/dev/hyo/openiap/OpenIapErrorExtensions.kt:20-38`) maps 12 `BillingResponseCode` values to 12 distinct errors, `else → UnknownError`.

**Apple** constructs **19 distinct `ErrorCode` values** across `packages/apple/Sources/` — 17 at explicit `PurchaseError.make(code:)` call sites plus `itemNotOwned` and `itemUnavailable` reached only through the `wrap()` switch. Apple is therefore *not* impoverished overall; several codes (`developerError` at 25 sites, `featureNotSupported` at 23) are used far more heavily than on Android.

The divergence is narrower and more specific than raw counts suggest, and it has two parts.

**First, the StoreKit catch-all path is shallow.** `OpenIapError.swift:169-190` maps only 5 `StoreKitError` cases:

```swift
case .userCancelled:            errorCode = .userCancelled
case .networkError:             errorCode = .networkError
case .notAvailableInStorefront: errorCode = .itemUnavailable
case .notEntitled:              errorCode = .itemNotOwned
case .systemError:              errorCode = .serviceError
default:                        errorCode = fallback   // .purchaseError
```

Any StoreKit error outside those five arrives at the consumer as `.purchaseError`.

**Second, four codes that Android produces are never constructed on Apple at all.** Verified by enumerating every construction site (`code: .X` and `errorCode = .X`) across `packages/apple/Sources/`:

| ErrorCode | Google Play | Apple |
| --- | --- | --- |
| `AlreadyOwned` | `ITEM_ALREADY_OWNED →` `ItemAlreadyOwned` | **never constructed** — appears only in the generated `Types.swift` enum (`:112`) and the `defaultMessage` description table |
| `BillingUnavailable` | `BILLING_UNAVAILABLE →` mapped | **never constructed** |
| `ServiceDisconnected` | `SERVICE_DISCONNECTED →` mapped | **never constructed** |
| `ServiceTimeout` | `SERVICE_TIMEOUT →` mapped | **never constructed** |

So a duplicate purchase yields `ErrorCode.AlreadyOwned` on Android and `ErrorCode.PurchaseError` on iOS — an outcome an app branching on `ErrorCode` will handle differently per platform.

Both behaviors have passing tests. Neither test knows the other exists. **Nothing in the repository states which of the two is correct**, because no normative error-mapping table exists.

### 7.2 Android flavors diverge on purchase state

| Flavor | `PENDING` handling | Cancelled handling |
| --- | --- | --- |
| Play | `BillingPurchase.PurchaseState.PENDING → PurchaseState.Pending` (`play/utils/BillingConverters.kt:351`) | — |
| Horizon | `...PurchaseState.PENDING → PurchaseState.Pending` (`horizon/utils/BillingConverters.kt:191`) | — |
| **Amazon** | **No mapping — `Pending` is never produced** | `isCanceled ? PurchaseState.Unknown : PurchaseState.Purchased` (`amazon/OpenIapModule.kt:352`) |

Amazon additionally computes `isActive = purchase.purchaseState == PurchaseState.Purchased` (`amazon/OpenIapModule.kt:627`), so a cancelled Amazon purchase becomes `Unknown` rather than a cancelled/revoked state. An app that treats `Unknown` as "retry later" and `Pending` as "do not grant" behaves differently per store with no signal that it should.

### 7.3 Duplicated tests have already drifted

`SubscriptionGroupMappingPlayTest.kt` (54 lines) and `SubscriptionGroupMappingHorizonTest.kt` (42 lines) contain a byte-identical test — same backtick name, same six assertions:

```kotlin
fun `active subscriptions keep independent product ids for multiple groups`()
```

Play has a second test that Horizon does not:

```kotlin
fun `pending subscriptions are not active entitlements`()   // testPlay only
    assertEquals(false, pending.isActive)
```

This is the drift signature of copy-paste conformance. The behavior "a pending subscription is not an active entitlement" is an entitlement-integrity rule; it is asserted for exactly one of three Android stores.

`AmazonSubscriptionGroupMappingTest.kt` (150 lines) tests the same *concept* with an entirely different structure and different assertions, so even manual comparison is hard.

### 7.4 Where two implementations can pass CI while behaving differently

All of the following pass CI today:

| Scenario | Apple | Google Play | Amazon | Horizon |
| --- | --- | --- | --- | --- |
| Duplicate purchase error code | `PurchaseError` (`AlreadyOwned` never constructed) | `AlreadyOwned` | `AlreadyOwned` (numeric 7) | `AlreadyOwned` |
| Billing unavailable | `PurchaseError` (`BillingUnavailable` never constructed) | `BillingUnavailable` | `BillingUnavailable` | `BillingUnavailable` |
| Pending purchase state | n/a | `Pending` | **never emitted** | `Pending` |
| Cancelled purchase state | — | — | **`Unknown`** | — |
| `SubscriptionBillingIssue` event | emitted (iOS 16.4+) | emitted (PB 8.1+) | **not emitted** | **not emitted** |
| Pending-is-not-active assertion | untested | tested | untested | untested |

The `SubscriptionBillingIssue` row is the only one where the difference is *documented* — in a prose docstring at `type.graphql:36`. It is still not machine-checkable.

---

## 8. Capability Modeling Assessment

OpenIAP currently expresses capability differences through four informal mechanisms:

| Mechanism | Example | Machine-testable? |
| --- | --- | --- |
| Naming suffix | `syncIOS`, `acknowledgePurchaseAndroid` | Partly — parity audit checks binding existence |
| Separate schema files | `api-ios.graphql` vs `api-android.graphql` | Partly — determines which SDK surface gets the op |
| Prose docstrings | `type.graphql:36` "NOT emitted by Amazon Appstore or the Horizon flavor" | **No** |
| Gradle product flavors | `play` / `horizon` / `amazon` source sets | No — compile-time only, no interface |

**There is no `@capability`, `@required`, `@optional`, or `@unsupported` directive in the schema.** `schema.graphql` defines exactly one custom directive, `@openiapDeprecated`, scoped to deprecation. The `IapStore` enum (`type.graphql:50`) enumerates `Unknown | Apple | Google | Horizon | Amazon` but carries no capability metadata.

The consequence: **the four-way distinction the audit asks about (required / optional / unsupported / platform-specific) does not exist as data anywhere in the repository.** It exists as English prose in docstrings and docs pages, and as the tacit knowledge encoded in which flavor directory a file lives in.

This is the single biggest structural blocker to a conformance suite. A conformance runner needs to answer "should this implementation support `openRedeemOfferCode`?" before it can decide whether a no-op is a pass or a failure. Today that answer is only available by reading `OpenRedeemOfferCodeAmazonNoOpTest.kt` and inferring intent from the filename.

**Assessment: not machine-testable in its current form.** Making it so is a schema change (add capability directives) plus a generator change (emit a capability manifest per store), and it is a prerequisite for both a conformance suite and a Samsung onboarding.

---

## 9. Samsung Galaxy Store Readiness

### 9.1 Could a Samsung implementation demonstrate conformance today?

**No — because there is nothing to demonstrate conformance against.** A Samsung implementation could be built, could pass `audit-non-godot-parity.mjs`, could ship, and the project would have no more evidence of its behavioral correctness than it has for Amazon today.

What Samsung *would* be able to do immediately: satisfy the type contract. That is not nothing — it is a real integration cost avoided — but it is not conformance.

### 9.2 The good news: the type model already has the right shape

This is the strongest positive finding for Samsung readiness. `PurchaseAndroid` and `PurchaseIOS` carry `store: IapStore!` and **not** `platform` — `schema-contract.test.ts:45-55` actively enforces the removal of the legacy `platform` field from concrete purchase types:

```typescript
expect(purchaseType.getFields().platform, `${typeName}.platform`).toBeUndefined();
expect(purchaseType.getFields().store, `${typeName}.store`).toBeDefined();
```

Samsung Galaxy Store is an Android-platform store, so it slots in cleanly as `IapPlatform.Android` + `IapStore.Samsung`. The platform/store split already exists and is defended by a test. Amazon and Horizon proved the multi-store-on-Android pattern works.

### 9.3 What a Samsung implementation would need to satisfy

**Schema changes (small, well-understood):**
- Add `Samsung` to `IapStore` (`type.graphql:50`) → regenerate 6 languages → sync 8 targets. The existing drift gates make this safe.

**Implementation (follows the Amazon precedent):**
- New Gradle flavor `samsung` in `packages/google/openiap/build.gradle.kts:106`
- `src/samsung/java/dev/hyo/openiap/OpenIapModule.kt` + `OpenIapErrorExtensions.kt`
- New `testSamsung/` source set
- IAPKit: `packages/kit/convex/purchases/samsung.ts` + verification wiring

**Parity audit updates:**
- `GOOGLE_FLAVOR_MODULES` (`audit-non-godot-parity.mjs:1584`) and `checkGoogleFlavorHandlerWiring` (`:1642`) enumerate flavors explicitly and would need Samsung added.

### 9.4 Which tests could be reused unchanged?

**Client side: essentially none.** Every Android test lives in a flavor-specific source set (`testPlay/`, `testHorizon/`, `testAmazon/`) and constructs flavor-specific SDK objects. `packages/google/openiap/src/test/` (the shared set) contains 13 files, but these test shared utilities (`BillingConvertersTest`, `OpenIapErrorTest`, `ContinuationResumeGuardTest`) rather than store behavior — useful, but they do not validate a store implementation.

**Server side: partially reusable.** `applySubscriptionTransition` and `entitlementActive` are store-agnostic. A Samsung normalizer producing a `NormalizedWebhookEvent` would immediately inherit the entire state machine and its test suite. **This is the reuse story the client side lacks**, and it is the clearest argument for adopting the IAPKit pattern on the client.

### 9.5 Which tests are Apple/Google-specific and would need refactoring?

| Test | Why it doesn't generalize |
| --- | --- |
| `SubscriptionGroupMappingPlayTest.kt` / `...HorizonTest.kt` | Assertions are generic; setup constructs flavor-specific purchases. **Prime candidate for extraction into a shared parameterized suite.** |
| `BillingResultConvertersTest.kt`, `BillingPurchasePayloadMappingTest.kt` | Bound to Play Billing types |
| `OpenIapErrorTest.kt` + flavor `fromBillingResponseCode` tests | Each asserts its own store's numeric codes; would need a normative mapping table to generalize |
| `webhooks/conformance.test.ts` | `runAppleScenario` / `runGoogleScenario` are separate functions with duplicated bodies. Refactoring to `runScenario(adapter, steps)` would let Samsung reuse all 6 scenarios. |

### 9.6 What belongs outside the common suite?

Samsung-specific capability tests that should stay in a `capabilities/samsung/` area rather than the core suite: Samsung IAP SDK initialization and `Samsung Checkout` flows, Galaxy Store-specific promotional/reward mechanics, Samsung's operational modes (test/production toggles), and Samsung-specific error codes with no cross-store analogue. The core suite should assert only that these surface through the spec's `unsupported`/optional-capability channel where the spec says they must.

---

## 10. IAPKit Provider Conformance Assessment

IAPKit has the same conformance problem as the client, but it has already solved a meaningful slice of it — asymmetrically, across two layers.

### 10.1 Verification layer — no provider contract

> **Corrected.** See [§18.1](#181-a-correction-to-this-audit): all four providers declare
> `returns: receiptResponseValidator`, a shared normalized shape. The claim below that they
> "share no interface" is wrong; the real divergence is in the SDK-facing GraphQL union.


The four providers (`ios.ts`, `android.ts`, `amazon.ts`, `horizon.ts`) share **no interface**. Their entry points have different names, different signatures, and different return shapes. The spec itself acknowledges the divergence rather than normalizing it — `api.graphql:78-83`:

> *"Returns a platform-specific variant of VerifyPurchaseResult — VerifyPurchaseResultIOS exposes isValid + receipt/JWS metadata, VerifyPurchaseResultAndroid carries Play Store receipt fields (no isValid), and VerifyPurchaseResultHorizon uses success. Inspect the concrete variant before reading fields."*

**A caller cannot ask "is this purchase valid?" uniformly.** iOS exposes `isValid`, Horizon exposes `success`, and Android exposes neither — validity must be inferred from Play receipt fields. Each provider's test file (`ios.test.ts` 254 lines, `android.test.ts` 892, `amazon.test.ts` 727, `horizon.test.ts` 428) tests its own functions independently. **These are per-provider unit tests, not provider contract tests.**

### 10.2 Webhook/lifecycle layer — a real conformance kernel

`webhooks/conformance.test.ts` is the best conformance artifact in the repository and deserves credit. Its design is correct: deterministic pre-canned payloads, a shared target model, multi-step scenario scripts (not single-edge assertions), and assertions on both the state and the derived entitlement boolean. The header comment is candid about what it is — *"the 'sandbox-without-Apple/Google' suite."*

It also shows evidence of adversarial maintenance. Lines 79-87 document a fixed weakness where `transition.next ?? current` silently masked no-op transitions, and line 307 records that PR #123 review caught a wrong Google `pause-schedule-changed` mapping. This is a suite that has caught real bugs.

### 10.3 Semantic outcome coverage

| Outcome | Apple | Google | Amazon | Horizon |
| --- | --- | --- | --- | --- |
| Valid purchase | Unit (`ios.test.ts`) | Unit | Unit | Unit |
| Invalid purchase | Unit | Unit | Unit | Unit |
| Active subscription | **Conformance** | **Conformance** | ✗ | ✗ |
| Expired subscription | **Conformance** | ✗ | ✗ | ✗ |
| Cancelled subscription | **Conformance** | ✗ | ✗ | ✗ |
| Refunded / revoked | **Conformance** | **Conformance** (voided) | Reconciler unit only | ✗ |
| Grace period | **Conformance** | ✗ | ✗ | ✗ |
| Billing retry / on-hold | ✗ | **Conformance** | ✗ | ✗ |
| Paused / resumed | ✗ | **Conformance** | ✗ | ✗ |
| Normalized identifiers | Unit | Unit | Unit | Unit (`HorizonBlankOrderIdTest`) |
| Normalized errors | `purchases/errors.test.ts` (shared helper) | same | same | same |

Two structural gaps stand out. First, **Apple and Google are tested on disjoint scenario sets** — Apple gets expiry/grace-period, Google gets on-hold/pause. Because the scenarios are hand-written per provider rather than shared, the matrix is sparse where it should be dense. Second, **Amazon and Horizon have no lifecycle conformance at all.** Amazon relies on `reconcileAmazonPurchases` polling and Horizon has no revocation path from store notifications; neither appears in the conformance harness.

**Verdict: IAPKit has a provider contract at the lifecycle layer and no provider contract at the verification layer.** The lifecycle pattern is directly extensible to Amazon, Horizon, and Samsung and should be the template.

---

## 11. Security / Entitlement Integrity Risks

Ranked by plausibility × impact. All are consequences of inconsistent normalization, which is precisely the failure mode a conformance suite exists to prevent.

**R1 — Amazon cancelled purchases normalize to `PurchaseState.Unknown` (High).**
`amazon/OpenIapModule.kt:352` — `isCanceled ? PurchaseState.Unknown : PurchaseState.Purchased`. An app whose entitlement check treats `Unknown` as inconclusive (retry, or fall back to cached entitlement) will keep granting access after an Amazon cancellation. On Play the same situation surfaces distinguishably. No test covers this divergence.

**R2 — "Pending is not an active entitlement" is asserted for one store in three (High).**
`SubscriptionGroupMappingPlayTest.kt:25` asserts `pending.isActive == false`. Horizon has no equivalent test; Amazon cannot reach the state. Pending purchases granting entitlement is the classic IAP fraud vector (deferred payment that never completes). The rule is correct where tested and unverified elsewhere.

**R3 — No uniform validity signal in the SDK-facing verification result (High).**
*(Corrected in [§18.1](#181-a-correction-to-this-audit): IAPKit's server-side providers
DO share a normalized `receiptResponseValidator` with a uniform `isValid`. The divergence
is in the client-facing GraphQL union only.)*
Per `api.graphql:78-83`, `isValid` exists on iOS, `success` on Horizon, neither on Android. Integration code must branch on the concrete variant. A developer who checks `result.isValid` and gets `undefined` on Android — a falsy value — fails closed, which is the safe direction; but one who writes `if (result.isValid !== false)` fails open. The spec makes the second reading easy to reach.

**R4 — Four Android-reachable error codes are never produced on Apple (Medium).**
`AlreadyOwned`, `BillingUnavailable`, `ServiceDisconnected`, and `ServiceTimeout` have no construction site anywhere in `packages/apple/Sources/`; the StoreKit catch-all at `OpenIapError.swift:186` routes the corresponding conditions to `.purchaseError` via `default: errorCode = fallback`. Error-driven retry, entitlement-restoration, and support-triage logic cannot distinguish "already owned" from a generic failure on iOS. Cross-platform apps that branch on `ErrorCode` behave differently per platform in ways neither platform's tests describe.

**R5 — `getStorefront`'s explicit MUST NOT is unenforced (Medium).**
`api.graphql:30` — *"implementations must not synthesize a locale fallback."* Storefront drives pricing, availability, and regional compliance. The parity audit has a related guard (`expectNoExampleStorefrontIOS`, line 1687) but it checks example app source text, not implementation behavior.

**R6 — Amazon and Horizon have no webhook-driven revocation path (Medium).**
Only `apple.ts` and `google.ts` normalizers exist; `IapPlatform` in `webhooks/shared.ts:60` is `"IOS" | "Android"`. Amazon revocation depends on the `reconcileAmazonPurchases` polling reconciler, and Horizon has neither webhook nor reconciler. Refund-to-revocation latency differs by store with no documented bound.

**R7 — KMP's iOS tests never execute (Low-Medium).**
`ci-kmp-iap.yml:81` compiles `iosSimulatorArm64` without running `iosSimulatorArm64Test`. `IosErrorMappingTest.kt` and `IosConnectionLifecycleTest.kt` provide no signal. Low direct impact, but it means a green CI badge overstates verification.

**R8 — The two reference implementations have no coverage floor (Low-Medium).**
`packages/apple` and `packages/google` are the only packages every binding wraps, and they are exempt from the 90% gate applied to the JS/Dart SDKs.

---

## 12. Gaps and Technical Debt

**G1 — No behavioral specification.** The schema specifies shape; behavior lives in scattered prose. Without normative statements there is no contract to test against, and this blocks everything downstream.

**G2 — No capability model.** §8. Blocks conformance-runner decision-making and Samsung onboarding.

**G3 — No test reuse mechanism on the client.** No adapter interface, no fixtures, no parameterized suites. Every implementation is tested in isolation.

**G4 — Static analysis is doing conformance's job.** `audit-non-godot-parity.mjs` (8,827 lines) and `audit-purchase-payload-parity.mjs` (2,316 lines) are large, sophisticated, well-maintained — and structurally incapable of detecting behavioral divergence. They are also brittle: `checkFrameworkOperationBindings` (line 1263) depends on exact marker strings like `"gentype.QueryHandlers get queryHandlers"` and breaks on innocuous refactors. This is real maintenance cost buying shape assurance only.

**G5 — Duplicated tests drifting.** §7.3.

**G6 — Store variants as compile-time flavors, not runtime adapters.** No interface means no compiler-enforced contract and no way to run one test body against all stores in one process.

**G7 — IAPKit verification layer has no shared model.** §10.1.

**G8 — Conformance-harness scenarios duplicated per provider.** `runAppleScenario` / `runGoogleScenario` in `conformance.test.ts` have near-identical bodies, producing the sparse disjoint matrix in §10.3.

**G9 — Uneven CI enforcement.** Coverage gates on 4 of 9 testable packages; KMP iOS tests unrun; Godot excluded from parity; MAUI device targets untested.

**G10 — Foundation docs overstate current state.** `one-pager.tsx:198` lists conformance tests as a delivered "Core Component"; `sponsorship.tsx:65` sells it as a present benefit; `roadmap-budget.tsx:69` marks it "Planned." Under LF scrutiny this reads as overclaiming.

**G11 — No versioned conformance artifact.** `openiap-versions.json` tracks `spec: 3.2.0`, but no conformance suite is versioned against it, so "conformant to OpenIAP 3.2.0" has no meaning.

---

## 13. Recommended Target Architecture

The design principle: **define expected behavior once, execute it against every implementation through a thin adapter, and make capability differences data rather than prose.** Two things in the repo already prove this works — `applySubscriptionTransition` (shared model, multiple providers) and the codegen pipeline (one schema, six languages). The proposal extends both patterns rather than introducing a new one.

### 13.1 Structure

```text
specs/client/src/
  capability.graphql            # NEW: @capability directive + store capability matrix
  *.graphql                     # existing schema, extended with normative annotations

conformance/                    # NEW top-level package
  spec/
    behaviors/                  # Normative behaviors as data (YAML/JSON)
      products.yaml             #   fetch-products-returns-normalized-product
      purchases.yaml            #   purchase-already-owned-yields-AlreadyOwned
      subscriptions.yaml
      lifecycle.yaml            #   PurchaseState transition table
      errors.yaml               #   NORMATIVE platform-error -> ErrorCode mapping
    capabilities/
      matrix.yaml               # store x capability -> required|optional|unsupported
  fixtures/                     # Deterministic store responses, shared by all runners
    apple/  google/  amazon/  horizon/  samsung/
  runner/
    core.ts                     # Loads behaviors + capabilities, drives adapters
    report.ts                   # Emits versioned conformance report
  adapters/
    README.md                   # Adapter contract for third-party implementations
```

### 13.2 Per-implementation harness

Each implementation supplies a **fake store driver** plus a thin adapter, so the runner can execute real implementation code against canned store responses without a network or a real purchase — which is what makes this work in CI where real purchases cannot happen.

```text
packages/google/openiap/src/conformanceTest/     # shared across ALL flavors
  ConformanceSuite.kt          # parameterized; runs spec/behaviors against the flavor
  FakeBillingClient.kt         # replays conformance/fixtures/<store>/

packages/apple/Tests/Conformance/
  ConformanceSuite.swift
  StoreKitTestConfiguration.storekit   # StoreKit Test config (does not exist today)

libraries/*/conformance/                # per-SDK adapter, asserts the SDK forwards
                                        # normalized results unchanged
```

The key move on Android: replace three isolated `testPlay/testHorizon/testAmazon` suites with **one `conformanceTest` source set compiled into every flavor**, parameterized by the capability matrix. Adding Samsung then means adding a flavor and a fixture directory — the behavioral suite comes for free. This directly fixes G3, G5, and G6.

### 13.3 Capability directive sketch

```graphql
directive @capability(
  required:    [IapStore!]
  optional:    [IapStore!]
  unsupported: [IapStore!]
) on FIELD_DEFINITION | ENUM_VALUE

extend type Mutation {
  openRedeemOfferCodeAndroid: VoidResult!
    @capability(required: [Google], unsupported: [Amazon, Horizon])
}

enum IapEvent {
  SubscriptionBillingIssue
    @capability(required: [Apple, Google], unsupported: [Amazon, Horizon])
}
```

This makes §8's prose machine-readable, lets the runner decide whether a no-op is pass or fail, and lets codegen emit a per-store capability manifest each SDK can expose at runtime.

### 13.4 IAPKit alignment

- Introduce a `PurchaseVerificationProvider` TypeScript interface that all four modules implement, returning a normalized `{ valid: boolean, ... }` — fixes R3 and G7.
- Refactor `runAppleScenario`/`runGoogleScenario` into `runScenario(adapter, steps)` and move the scenario scripts into `conformance/spec/behaviors/lifecycle.yaml` so every provider runs every scenario — fixes G8 and the sparse matrix in §10.3.
- Add Amazon and Horizon lifecycle normalizers, or explicitly declare in the capability matrix that they are reconciliation-only — fixes R6.

---

## 14. Prioritized Action Plan

### P0 — Before claiming formal conformance

**P0-1. Correct the foundation documentation.** *(S — implement now)*
Why: `one-pager.tsx:198` and `sponsorship.tsx:65` present conformance testing as delivered; `roadmap-budget.tsx:69` correctly says Planned. This is the cheapest fix in the plan and the one with the most reputational exposure, since these are the pages LF reviewers and sponsors read.
Files: `packages/docs/src/pages/docs/foundation/{one-pager,sponsorship}.tsx`. Dependencies: none.

**P0-2. Write the normative error-mapping table and close the Apple gap.** *(M — implement now)*
Why: R4/§7.1. `AlreadyOwned`, `BillingUnavailable`, `ServiceDisconnected`, and `ServiceTimeout` are produced on Android and never constructed on Apple, and Apple's `StoreKitError` catch-all maps only 5 cases before falling back to `.purchaseError`. Today neither platform is "wrong" because nothing says what's right. Document the required mapping, then extend `OpenIapError.wrap` and its call sites.
Files: `specs/client/src/error.graphql`, `packages/apple/Sources/Models/OpenIapError.swift`, `conformance/spec/behaviors/errors.yaml`. Dependencies: none.

**P0-3. Resolve the Amazon purchase-state divergence.** *(M — implement now)*
Why: R1/R2, the highest-impact entitlement-integrity finding. Either map Amazon cancellation to a distinct state or declare `Pending`/cancellation unsupported for Amazon in the capability matrix — but decide explicitly and test it.
Files: `packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt`, `src/testAmazon/`. Dependencies: benefits from P1-1.

**P0-4. Replicate the "pending is not active" assertion across all Android flavors.** *(S — implement now)*
Why: R2. The rule is asserted only in `testPlay`. Even before shared suites exist, copy it to `testHorizon` (and assert Amazon's documented inability to reach the state).
Files: `packages/google/openiap/src/testHorizon/`, `src/testAmazon/`. Dependencies: none.

**P0-5. Run KMP iOS tests and add coverage floors to Apple/Google.** *(S — implement now)*
Why: R7/R8/G9. `iosSimulatorArm64Test` is written but never executed; the two reference implementations have no coverage gate while their wrappers are held to 90%.
Files: `.github/workflows/ci-kmp-iap.yml`, `ci.yml` (test-android, test-ios). Dependencies: none.

**P0-6. Publish a "what is and isn't verified" statement.** *(S — implement now)*
Why: G11. Until a suite exists, state plainly that OpenIAP enforces type/API-surface conformance and that behavioral conformance is in development. This preserves the credibility of the real claim.
Files: `packages/docs/src/pages/docs/foundation/`, `README.md`. Dependencies: P0-1.

### P1 — Before onboarding another major store such as Samsung

**P1-1. Add the capability model to the schema.** *(M — implement now)*
Why: G2/§8. Every other conformance decision depends on knowing whether a behavior is required, optional, or unsupported for a given store. This is the true blocker, and it should land before Samsung rather than after.
Files: `specs/client/src/capability.graphql`, `specs/client/codegen/`, all 6 language plugins, `generated-sync-manifest.mjs`. Dependencies: none. Note: the existing drift gates (`assert-clean-worktree.mjs`) make this schema change mechanically safe.

**P1-2. Extract a shared Android conformance source set.** *(L — implement now)*
Why: G3/G5/G6/§9.4. Replaces copy-paste-and-drift with one parameterized suite compiled into every flavor. `SubscriptionGroupMappingPlayTest`/`...HorizonTest` are the obvious first migration since they are already near-identical.
Files: new `packages/google/openiap/src/conformanceTest/`, `build.gradle.kts`, `audit-non-godot-parity.mjs` (flavor lists at :1584/:1642). Dependencies: P1-1.

**P1-3. Build the fake-store driver and fixture corpus.** *(L — implement now)*
Why: G3. This is what makes behavioral testing possible in CI at all, given that no runner can complete a real purchase (§6.2). Start with Android (fake `BillingClient`) where the flavor architecture makes injection easiest.
Files: `conformance/fixtures/`, `packages/google/openiap/src/conformanceTest/FakeBillingClient.kt`. Dependencies: P1-1, P1-2.

**P1-4. Unify the IAPKit verification interface.** *(M — implement now)*
Why: R3/G7. A shared `PurchaseVerificationProvider` interface with a normalized validity signal removes the fail-open hazard and gives Samsung a slot to implement rather than a pattern to imitate.
Files: `packages/kit/convex/purchases/{ios,android,amazon,horizon}.ts`, `shared.ts`, `specs/client/src/api.graphql` (result union). Dependencies: none.

**P1-5. Parameterize the IAPKit lifecycle harness and add Amazon/Horizon.** *(M — implement now)*
Why: G8/R6/§10.3. `runScenario(adapter, steps)` turns 6 provider-specific scenarios into 6 × N provider-agnostic ones and closes the disjoint-coverage gap.
Files: `packages/kit/convex/webhooks/conformance.test.ts`, new `amazon.ts`/`horizon.ts` normalizers. Dependencies: P1-4 helps but is not required.

**P1-6. Draft the Samsung onboarding checklist.** *(S — document now, implement later)*
Why: §9.3 identified the concrete touchpoints (`IapStore` enum, new flavor, `GOOGLE_FLAVOR_MODULES`, kit provider). Writing this down while the Amazon precedent is fresh makes the eventual work mechanical.
Files: `docs/` or `knowledge/internal/`. Dependencies: none.

### P2 — Foundation / ecosystem maturity

**P2-1. Add normative language discipline to the specification.** *(L — implement now, incrementally)*
Why: G1. Adopt RFC 2119 keywords and separate normative requirements from guidance. `getStorefront`'s existing "must not synthesize a locale fallback" shows the project already thinks this way; the practice just needs to be systematic and enforced by a schema linter rule.
Files: all `specs/client/src/*.graphql`, `specs/client/src/schema-linter.test.ts`. Dependencies: none, but P1-1 shares the tooling.

**P2-2. Version the conformance suite against the spec version.** *(M — document now, implement after P1)*
Why: G11. "Conformant to OpenIAP 3.2.0" needs a versioned artifact and a machine-readable report to mean anything, and it is the precondition for any compatibility badge.
Files: `conformance/`, `openiap-versions.json`, release workflows. Dependencies: P1-1 through P1-3.

**P2-3. Publish the third-party adapter contract.** *(M — document now, implement after P1)*
Why: The audit's framing question — can an independent implementation demonstrate compatibility without manual review? — needs a documented adapter interface and a runnable suite an external party can execute.
Files: `conformance/adapters/README.md`, `CONTRIBUTING.md`. Dependencies: P1-2, P1-3.

**P2-4. Bring Godot into the contract system.** *(M — implement later)*
Why: G9. `audit-non-godot-parity.mjs:88` excludes Godot with a comment describing this as temporary; the exclusion is visible in the script's own name.
Files: `.github/workflows/ci-godot-iap.yml`, `libraries/godot-iap/`, parity script. Dependencies: none.

**P2-5. Retire static parity checks as behavioral coverage lands.** *(L — implement later)*
Why: G4. As real conformance tests cover a behavior, the corresponding regex guard in the 8,827-line parity script becomes redundant and brittle. Shrinking it deliberately converts maintenance cost into real assurance. Keep the parts that check genuinely structural properties (generated-file drift, symlink targets, version floors).
Files: `scripts/audit-non-godot-parity.mjs`, `scripts/audit-purchase-payload-parity.mjs`. Dependencies: P1-2, P1-3.

**P2-6. Record manual E2E runs against spec versions.** *(S — implement now)*
Why: §6.2. Device/sandbox testing via `/e2e-tests` and the `iapkit-e2e-*` skills is real verification that currently leaves no auditable trace.
Files: `.claude/skills/e2e-tests/`, a results log. Dependencies: none.

---

## 15. Three Closing Questions

### 1. Can OpenIAP honestly say today that its implementations are conformance-tested against a shared specification?

**No.** It can honestly say something narrower and still valuable: *OpenIAP implementations are type-conformant and API-surface-complete against a shared GraphQL specification, enforced in CI on every pull request.* That claim is well-supported by `specs/client/`, the six-language codegen pipeline, `generated-sync-manifest.mjs`, the clean-worktree drift gates, and `audit-non-godot-parity.mjs`.

Behavioral conformance testing does not exist on the client. Zero of the 14 audited behavior categories are Covered by the strict definition; 8 are Partial and 6 are absent. The one genuine conformance harness — `packages/kit/convex/webhooks/conformance.test.ts` — covers server-side subscription lifecycle for 2 of 4 providers across 6 scenarios.

The gap between the honest claim and the current public wording in `one-pager.tsx:198` and `sponsorship.tsx:65` should be closed before any Linux Foundation conversation, and `roadmap-budget.tsx:69` already shows the project knows the accurate answer.

### 2. Could Samsung Galaxy Store be added today and validated using the same reusable conformance suite?

**No — there is no reusable conformance suite to validate it with.** Samsung could be implemented and could pass every existing gate while behaving differently from Play in ways nothing would detect, exactly as Amazon does today (§7.2, §7.4).

The type model is genuinely ready: `IapStore` (`type.graphql:50`) is a real store discriminator that `schema-contract.test.ts:45-55` actively defends, `IapPlatform.Android` covers Samsung correctly, and Amazon and Horizon have already proven the multi-store-on-Android flavor pattern. Adding `Samsung` to the enum and a `samsung` Gradle flavor is well-understood, low-risk work.

What is missing is behavioral reuse. On the client, essentially no Android test would carry over — every one lives in a flavor-isolated source set. On the server, `applySubscriptionTransition` and `entitlementActive` would be inherited immediately by any Samsung normalizer, which is precisely why the IAPKit lifecycle pattern is the right template for the client side. P1-1 through P1-3 are the work that would make Samsung onboarding safe rather than merely possible.

### 3. What are the three highest-leverage changes to make OpenIAP conformance ecosystem-grade?

**First — make capabilities machine-readable (P1-1).** Add a `@capability` directive to the schema and generate a per-store capability matrix. Today the required/optional/unsupported distinction exists only as prose in docstrings like `type.graphql:36` and as tacit knowledge in directory layout. Nothing else in the plan can proceed without it: a conformance runner cannot judge whether Amazon's `openRedeemOfferCode` no-op is a pass or a failure until the answer is data. This unblocks the conformance suite, the Samsung onboarding, and any future compatibility program simultaneously.

**Second — replace flavor-isolated tests with one shared, parameterized conformance suite driven by fake stores (P1-2, P1-3).** Collapse `testPlay/`, `testHorizon/`, `testAmazon/` into a single `conformanceTest` source set compiled into every flavor, backed by a fixture corpus and a fake `BillingClient`. This is the change that converts "we test each store" into "we test the contract," eliminates the drift already visible between `SubscriptionGroupMappingPlayTest` and `SubscriptionGroupMappingHorizonTest`, works within CI's inability to make real purchases, and makes each new store cost a fixture directory instead of a test suite.

**Third — generalize the IAPKit conformance harness and apply its pattern to the client (P1-4, P1-5).** `webhooks/conformance.test.ts` already demonstrates the correct architecture inside this repository — shared normalized model, deterministic payloads, multi-step scenarios, entitlement assertions — and it has caught real bugs (the PR #123 mapping error at line 307, the masked-transition weakness at lines 79-87). Refactoring `runAppleScenario`/`runGoogleScenario` into `runScenario(adapter, steps)`, adding Amazon and Horizon, and unifying the verification interface turns a working prototype into the project's conformance standard. The client-side suite should then be built in its image rather than invented from scratch.

Together these convert OpenIAP's existing strength — a rigorously enforced single source of truth — from covering types to covering behavior, which is the whole distance between "OpenIAP compatible" as a claim and as a certification.

---

## 16. Remediation Applied

This section records work done *after* the audit above, in response to it. Everything
in §1–15 describes the pre-remediation state.

### 16.1 A predicted risk turned out to be a live defect

Audit risk **R2** flagged that "pending is not an active entitlement" was asserted for
Google Play only. Following that thread into the implementation found the rule was not
merely untested on Horizon — it was **violated**:

```kotlin
// packages/google/openiap/src/horizon/.../BillingConverters.kt (before)
fun HorizonPurchase.toActiveSubscription(): ActiveSubscription = ActiveSubscription(
    isActive = true,   // hardcoded
    ...
)
fun PurchaseAndroid.toActiveSubscription(): ActiveSubscription = ActiveSubscription(
    isActive = true,   // hardcoded
    ...
)
```

Horizon maps its billing-compatibility `PENDING` state through `fromHorizonState`, so
pending purchases genuinely occur there — and both entitlement derivations reported
them as active. Play (`isActive = purchaseState == PurchaseState.Purchased`) and Amazon
were correct; Horizon was the outlier.

**Impact:** on Meta Horizon, an unpaid pending subscription was reported as an active
entitlement. Both functions now gate on `Purchased`.

This is the concrete cost of the copy-paste drift described in §7.3: the assertion that
would have caught it existed, in the file next door, and was never copied across.

### 16.2 What was implemented

| # | Change | Files |
| --- | --- | --- |
| 1 | Fixed the Horizon entitlement leak | `packages/google/openiap/src/horizon/java/dev/hyo/openiap/utils/BillingConverters.kt` |
| 2 | Shared Android conformance suite + per-flavor adapters | `packages/google/openiap/src/conformanceTest/`, `src/test{Play,Horizon,Amazon}/java/dev/hyo/openiap/conformance/`, `build.gradle.kts` |
| 3 | Extracted Amazon's entitlement seam to match the other flavors | `packages/google/openiap/src/amazon/java/dev/hyo/openiap/utils/AmazonBillingConverters.kt`, `OpenIapModule.kt` |
| 4 | StoreKit 1 + StoreKit 2 error normalization on Apple | `packages/apple/Sources/Models/OpenIapError.swift` |
| 5 | Apple error-normalization test suite (13 tests) | `packages/apple/Tests/OpenIapTests/ErrorNormalizationTests.swift` |
| 6 | Machine-checked store capability matrix | `specs/client/src/capability-matrix.mjs`, `capability-matrix.test.ts` |
| 7 | IAPKit harness rebuilt around shared scenarios + provider adapters | `packages/kit/convex/webhooks/conformance.test.ts` |
| 8 | Parity audit gate for the conformance architecture | `scripts/audit-non-godot-parity.mjs` |
| 9 | KMP iOS tests now execute in CI | `.github/workflows/ci-kmp-iap.yml` |
| 10 | Foundation docs corrected to match reality | `packages/docs/src/pages/docs/foundation/{one-pager,sponsorship,roadmap-budget}.tsx` |
| 11 | Comment-style convention (AI over-explanation) | `knowledge/internal/03-coding-style.md`, `AGENTS.md` |

### 16.3 Android: one suite, every store

`StoreConformanceSuite` declares the expectations once and is compiled into all three
flavor test source sets. Each flavor supplies only a `StoreConformanceAdapter`:

```text
src/conformanceTest/java/.../conformance/
  StoreConformanceAdapter.kt   seam: store, capabilities, toActiveSubscription, errorForResponseCode
  StoreConformanceSuite.kt     8 behavioral tests, declared once

src/testPlay/.../PlayStoreConformanceTest.kt        -> IapStore.Google
src/testHorizon/.../HorizonStoreConformanceTest.kt  -> IapStore.Horizon
src/testAmazon/.../AmazonStoreConformanceTest.kt    -> IapStore.Amazon
```

Covered: purchased-is-entitled, **pending-is-not-entitled**, unknown-is-not-entitled,
identifier independence across subscription groups, token field parity, the normative
12-entry Play-response-code → `ErrorCode` table, unrecognized-code fallback, and a
concrete store discriminator.

The pending assertion is deliberately unconditional. Whether a store can *produce*
`Pending` is a capability; what `Pending` *means* is not negotiable.

Because `:openiap:test` aggregates all variant unit-test tasks, CI already runs this
suite for all three flavors with no workflow change.

### 16.4 Apple: real error normalization

`PurchaseError.wrap` previously routed every StoreKit 1 condition except
`paymentCancelled` into the caller's fallback. Two extraction points were added —
`skErrorCode(from:)` (typed `SKError` or bridged `NSError`) and `errorCode(for:)` (the
normative table) — mapping `paymentNotAllowed → iapNotAvailable`,
`storeProductNotAvailable → itemUnavailable`, `clientInvalid`/`paymentInvalid →
developerError`, offer failures → `skuOfferMismatch`, signature failures →
`transactionValidationFailed`, and more. The StoreKit 2 switch gained `.unknown` and
`.unsupported` (the compiler flagged the latter as a genuinely missing case).

`errorCode(for:)` returns `nil` rather than guessing, so unmapped conditions still take
the caller's fallback instead of a fabricated code.

**Deliberately not "fixed":** `AlreadyOwned`, `BillingUnavailable`, `ServiceDisconnected`,
and `ServiceTimeout` remain unreachable on Apple. StoreKit has no equivalent condition —
re-purchasing an owned non-consumable succeeds and returns the existing transaction. The
honest fix is a capability declaration, not a synthesized mapping, so these are recorded
as Android-only in the capability matrix and guarded by
`testAndroidOnlyCodesAreNeverSynthesizedFromStoreKit`, which sweeps every `SKError.Code`
and fails if any maps into that set.

### 16.5 Capability modeling (closes G2)

`specs/client/src/capability-matrix.mjs` makes §8's prose machine-checkable: ten
behaviors × four stores, each `required` / `optional` / `unsupported`, with `evidence`
required for every non-`required` level and `notes` for behaviors that are required
everywhere but *delivered* differently.

`capability-matrix.test.ts` (10 tests) binds it to the schema — it reads the `IapStore`
enum and fails if the matrix and the enum disagree. **Adding a store to the schema
without deciding its capabilities now fails CI.**

The matrix also records a genuine shape divergence the audit had not surfaced: pending
purchases are `required` on both platforms, but Apple delivers them as an
`ErrorCode.DeferredPayment` *error* while Android delivers a `Purchase` carrying
`PurchaseState.Pending`.

### 16.6 IAPKit: shared scenarios, and what they immediately caught

Scenarios are now declared once as abstract lifecycle events; each provider supplies an
adapter that renders them into its own wire payload:

```text
SCENARIOS (6)  x  ADAPTERS (apple, google)  ->  11 executed + 1 explicitly skipped
```

Rewriting `runAppleScenario`/`runGoogleScenario` into `runScenario(adapter, scenario)`
surfaced a real semantic divergence on the first run: Apple `REFUND` normalizes to
`Refunded`, while Google `SUBSCRIPTION_REVOKED` (12) normalizes to `Revoked`. The
original suite hid this because each provider's scenario list was hand-written and used
a different signal. Both providers in fact express *both* concepts, so `Refund` (money
returned — Apple `REFUND` / Google `voidedPurchaseNotification`) and `Revoke`
(entitlement withdrawn — Apple `REVOKE` / Google RTDN 12) are now distinct events with
distinct expected states.

Coverage went from 6 disjoint provider-specific scenarios to 6 shared scenarios run
against every capable provider. The Apple/Google split described in §10.3 is closed:
Apple now covers billing-retry and revoke; Google now covers grace-period and expiry.
Apple's unsupported pause/resume is reported as a visible `it.skip` rather than an
absence.

### 16.7 Making it load-bearing

`checkGoogleStoreConformanceSuite()` in the parity audit asserts the suite files exist,
each flavor has an adapter binding into `StoreConformanceSuite()`, and each test source
set includes `src/conformanceTest/java` in Gradle. Verified by negative test: removing a
flavor's `srcDirs` entry and deleting an adapter each produce a specific failure, and the
audit passes again once restored.

`ci-kmp-iap.yml` now runs `:library:iosSimulatorArm64Test` instead of only compiling the
source set, so `IosErrorMappingTest` and `IosConnectionLifecycleTest` execute.

### 16.8 Verification

Run locally, all passing:

| Suite | Result |
| --- | --- |
| `swift test` (packages/apple) | **149 passed** (136 before, +13 new) |
| `bun run test` (specs/client) | **171 passed**, 20 files (+10 capability tests) |
| `bun run test` (packages/kit) | **1185 passed**, 1 skipped, 86 files |
| `node scripts/audit-non-godot-parity.mjs` | **passed** (+ 23 self-tests) |
| `bun run audit:docs` | clean — 0 drift |
| `bun run audit:deprecations` | passed |
| `bun run audit:release-state` | passed |
| `packages/kit` typecheck + prettier | clean |
| `packages/docs` typecheck + lint + build + prettier | clean |

**Not verified locally — no toolchain in this environment:**

- **`packages/google` Android tests, including the new conformance suite.** No JDK 17 or
  Android SDK available (only JDK 26, no `ANDROID_HOME`). The Kotlin was statically
  checked against the real API surface — `ErrorCode` members, `OpenIapError` subclass
  codes, the two `fromBillingResponseCode` overloads, `PurchaseAndroid`/
  `ActiveSubscription` constructors, and the existing `HorizonBillingConverters`
  import pattern — but **it has not been compiled**. CI is the first real check.
- Flutter, MAUI (no `dart`/`dotnet`), and Godot.

### 16.9 Revised scores

| Subject | Before | After | Rationale |
| --- | --- | --- | --- |
| **Client OpenIAP** | 1.5 | **2.5** | A shared behavioral suite now runs across all three Android stores, and capability modeling is machine-checked. Held below 3 because Apple and the six framework bindings still have no shared suite, and no fake-store driver exists — the Android suite tests normalization functions, not purchase flows. |
| **IAPKit** | 2.5 | **3.5** | Reusable contract tests cover core lifecycle behavior across both webhook providers with CI enforcement — the definition of "Functional". Short of 4 because the verification layer still has no shared provider interface (R3) and Amazon/Horizon have no lifecycle normalizer (R6). |
| **Overall** | 2 | **3** | Functional: reusable contract tests cover core behavior for the major implementations, and CI enforces them. |

**These are not 5/5, and claiming so would repeat the exact overclaiming this audit
flagged as G10.** Level 5 requires a versioned conformance suite an *independent*
implementation can run to demonstrate compatibility. What exists now is an internal
suite covering internal implementations. The remaining distance is unchanged from §14:

- **P1-3 fake-store driver** — the Android suite covers normalization functions, not
  `fetchProducts`/`requestPurchase`/`finishTransaction` behavior. Categories 1–4 of the
  coverage matrix are still **Not covered**.
- **Apple + framework bindings** — the shared-suite pattern is proven on Android and has
  not been extended to Apple or the six SDKs.
- **P1-4 IAPKit verification interface** — R3's fail-open hazard is unresolved.
- **P2-2/P2-3 versioning + adapter contract** — nothing yet lets a third party run the
  suite and produce a compatibility report.

### 16.10 Revised answers to the three closing questions

**1. Can OpenIAP honestly say its implementations are conformance-tested against a
shared specification?** Partially, and the boundary is now precise: **yes** for
entitlement derivation and error normalization across the three Android stores, and for
subscription lifecycle across both IAPKit webhook providers — these run from shared
definitions with CI enforcement. **No** for purchase flows, for Apple's client
implementation, and for the six framework bindings.

**2. Could Samsung Galaxy Store be added today and validated using the same reusable
conformance suite?** Substantially better than at audit time. A Samsung flavor would
add `Samsung` to `IapStore` (the capability-matrix test forces its capabilities to be
declared), implement `StoreConformanceAdapter`, and inherit all 8 Android behavioral
tests unchanged — including the pending-entitlement rule that Horizon was violating.
That is real reuse where §9.4 found none. It still would not validate purchase flows,
which need the fake-store driver.

**3. Highest-leverage remaining changes.** The first recommendation from §15 is done
(capability modeling) and the second is half done (shared suite on Android, no fake-store
driver). Remaining, in order:

1. **Build the fake-store driver (P1-3)** — the only way to reach the four uncovered core
   categories, and the difference between testing normalization and testing behavior.
2. **Extend the shared-suite pattern to Apple and the framework bindings** — the pattern
   is proven; Apple's client implementation and all six SDKs are still tested in isolation.
3. **Version the suite and publish the adapter contract (P2-2/P2-3)** — what turns an
   internal suite into something an independent implementation can run, and the
   precondition for any "OpenIAP Compatible" program.

---

## 17. Second Remediation Round — Versioned Conformance Suite

§16 fixed defects and built shared suites per area. This round adds the layer that
makes those suites a *contract*: one versioned behavioral specification, a runner that
executes it against any implementation through an adapter, and a compatibility report.

### 17.1 What was missing after round one

Round one produced two good but disconnected suites — Kotlin for Android stores, TypeScript
for IAPKit lifecycle — each with its own structure and its own implicit notion of what
"correct" meant. Nothing named the behaviors, versioned them, or let an outside
implementation run them. The four core categories (product fetching, purchases,
transaction completion, restoration) were still **Not covered** because no fake store
existed to exercise a purchase flow in CI.

### 17.2 `packages/conformance`

```text
packages/conformance/
  README.md                              adapter contract for third parties
  src/spec/behaviors.mjs                 35 behaviors across 9 categories — the SSOT
  src/spec/version.mjs                   suite version + spec version binding
  src/runner/runner.mjs                  capability-gated execution
  src/runner/report.mjs                  human + JSON compatibility report
  src/fake-store/fake-store.mjs          deterministic store backend
  src/fake-store/reference-implementation.mjs
  src/adapters/reference-adapter.mjs     worked example of the contract
  scripts/generate-behavior-ids.mjs      Kotlin/Swift export + drift gate
  scripts/run-reference-report.mjs
```

Each behavior carries a permanent id, a category, an RFC-2119 level, an optional
capability gate, and a testable statement:

```js
{
  id: 'subscriptions.pending-subscription-is-not-active',
  category: 'subscriptions',
  level: 'MUST',
  capability: 'getActiveSubscriptions',
  statement: 'A subscription whose purchase is not in the Purchased state is never reported as an active entitlement.',
}
```

That is the rule Horizon was violating (§16.1), now stated once as versioned data rather
than living only inside one flavor's test file.

### 17.3 The runner enforces what makes a suite trustworthy

Three properties, each covered by its own negative test in `test/runner.test.mjs`:

- **A missing MUST behavior fails.** An adapter implementing nothing is reported
  non-conformant, not compliant. This is the failure mode that would make the whole
  exercise worthless.
- **Capability gating comes from the matrix, not the adapter.** An implementation cannot
  excuse itself from its own store's requirements. A behavior gated on a capability the
  store must support is required; one gated on a capability the store cannot support
  becomes an *absence check* rather than a silent skip.
- **Unknown stores fail closed.**

### 17.4 Fake store — closing categories 1–4

`FakeStore` is a deterministic in-memory store backend: catalog, ownership, unfinished
transactions, and forced outcomes (`UserCancelled`, `AlreadyOwned`, `Pending`). It models
the *store*, not OpenIAP — it returns store-shaped results and knows nothing about
normalized types, so normalization remains the implementation's job.

This is what allows purchase flows to run in CI, where a real purchase is impossible.
The reference run covers all 27 client-side behaviors:

```text
  implementation : openiap-reference
  store          : Google
  suite version  : 1.0.0
  spec version   : 3.2.0
  ...
  27 pass
  RESULT: conformant with OpenIAP 3.2.0 (suite 1.0.0)
```

**A passing reference run says nothing about any shipped SDK.** It proves the suite is
executable and shows adapter authors the expected shape. The README states this plainly.

### 17.5 One spec, four languages

`generate-behavior-ids.mjs` exports the ids into Kotlin and Swift so native suites assert
against the same versioned spec:

| Language | Generated file | Bound suite |
| --- | --- | --- |
| TypeScript | `src/spec/behaviors.mjs` (source) | reference adapter, IAPKit |
| Kotlin | `.../conformance/ConformanceBehaviors.kt` | `StoreConformanceSuite` declares 7 covered ids |
| Swift | `packages/apple/Tests/OpenIapTests/ConformanceBehaviors.swift` | generated; adapter not yet written |

IAPKit's scenarios now declare `covers: [...]`, and two tests fail if a `lifecycle.*`
behavior has no scenario or a scenario references an id the spec does not define.

Drift is gated: `--check` runs in CI and in the parity audit. Verified by negative test —
renaming one behavior id makes the audit fail.

### 17.6 Verification

| Suite | Result |
| --- | --- |
| `packages/conformance` | **20 passed** (2 files) |
| Reference conformance report | **27 pass, conformant** |
| `specs/client` | **171 passed** |
| `packages/kit` | **1187 passed**, 1 skipped (86 files) |
| `swift test` | **149 passed** |
| parity audit (+ conformance + id drift gates) | **passed** |
| `audit:docs`, `audit:deprecations`, lockfile, kit typecheck/prettier | clean |

Negative tests confirming the gates bite: empty adapter → non-conformant; renamed behavior
id → parity failure; removed flavor `srcDirs` → parity failure; deleted adapter → parity
failure.

**Still unverified locally:** Android (no JDK 17 / Android SDK), Flutter, MAUI, Godot.
The Kotlin added this round (`ConformanceBehaviors.kt`, the `coveredBehaviors` test) has
**not been compiled**; CI is the first real check.

### 17.7 Revised scores

| Subject | Audited | Round 1 | Round 2 | Rationale |
| --- | --- | --- | --- | --- |
| **Client OpenIAP** | 1.5 | 2.5 | **4.0** | Versioned suite, explicit capability modeling, deterministic fixtures, fake-store driver covering purchase flows, CI enforcement with drift gates — the "Strong" criteria. Not 5: only the reference implementation and the Android stores are actually bound; Apple's client and all six framework bindings have no adapter yet. |
| **IAPKit** | 2.5 | 3.5 | **4.0** | Lifecycle behaviors bound to the versioned spec with coverage enforced across both providers. Not 5: the verification layer still has no shared provider interface (R3), and Amazon/Horizon have no lifecycle normalizer (R6). |
| **Overall** | 2 | 3 | **4.0** | Strong: broad coverage, explicit capability modeling, robust CI, deterministic fixtures. |

### 17.8 Why this is 4, not 5

Level 5 requires that **independent implementations can demonstrate compatibility**. The
machinery for that now exists — versioned spec, documented adapter contract, capability
gating, signed-off report — but the evidence does not. Three gaps, each concrete:

1. **Most implementations have no adapter.** The reference implementation (purpose-built
   to pass) and three Android stores are bound. Apple's client, react-native-iap,
   expo-iap, flutter_inapp_purchase, kmp-iap, maui-iap, and godot-iap are not. A suite
   that no shipped SDK runs is a contract nobody has signed.

2. **No implementation has been proven against it end-to-end in CI.** The Android suite
   and the generated Kotlin have not been compiled in this environment. Until CI runs
   green, the strongest honest claim is "the contract is defined and enforced", not
   "the implementations are proven conformant".

3. **No external party has run it.** Level 5 is about a certification program — the
   suite must be published, its version negotiated, and at least one third-party
   implementation must produce a report. None of that has happened.

**These are not paperwork items, and describing the current state as 5/5 would repeat
G10 — the overclaiming this audit was written to catch.** The gap between "we built a
conformance suite" and "our implementations are certified conformant" is exactly the gap
between 4 and 5, and it is closed by adapters and CI runs, not by wording.

### 17.9 The path to 5

| Step | Scope | Unblocks |
| --- | --- | --- |
| Write adapters for Apple + the six framework bindings | L | The main coverage gap; the pattern and contract already exist |
| Get the Android conformance suite green in CI | S | Converts "written" into "proven" |
| Add per-implementation conformance report artifacts to CI | S | Makes each release's conformance auditable |
| Publish `openiap-conformance` | S | Lets a third party run the suite at all |
| Provider interface for IAPKit verification (R3) | M | Last structural gap on the server side |
| Amazon + Horizon lifecycle normalizers (R6) | M | Completes provider lifecycle coverage |
| One external implementation produces a passing report | M | The actual definition of ecosystem-grade |

### 17.10 Revised answers to the three closing questions

**1. Can OpenIAP honestly say its implementations are conformance-tested against a shared
specification?** For the three Android stores and both IAPKit webhook providers: **yes** —
against a versioned, capability-gated spec with CI drift gates. For Apple's client and the
six framework bindings: **no** — the spec covers them, but no adapter binds them to it yet.
The distinction is now precisely stateable per implementation, which it was not at audit time.

**2. Could Samsung Galaxy Store be added today and validated using the same reusable
conformance suite?** Yes, for everything the suite covers. Samsung would add `Samsung` to
`IapStore` (the capability-matrix test forces its capabilities to be declared), implement
`StoreConformanceAdapter`, and inherit the Android behavioral suite plus the versioned
behavior ids — then produce a dated report naming the suite and spec version it passed
against. That is a materially different answer from the audit's original "no".

**3. Highest-leverage remaining changes.** All three from §15 are now done or substantially
done. The remaining three, in order: **write adapters for Apple and the framework
bindings** (the coverage gap that keeps this at 4); **get every suite green in CI and
publish per-release report artifacts** (turns written into proven); **publish the package
and have one external implementation produce a passing report** (the actual threshold for
ecosystem-grade).

---

## 18. Third Remediation Round — Real Implementations Bound

§17 built the versioned suite but left it bound mostly to a reference implementation
written to pass it. This round binds real shipped code.

### 18.1 A correction to this audit

**§10.1 and R3 were wrong.** The audit stated that IAPKit's four verification providers
"share no interface" and that "a caller cannot ask 'is this purchase valid?' uniformly."

Verified against the source: all four — `ios.ts`, `android.ts`, `amazon.ts`,
`horizon.ts` — declare `returns: receiptResponseValidator`
(`packages/kit/convex/purchases/shared.ts:100`), a shared normalized shape:

```ts
{ isValid: boolean, state: HarmonizedPurchaseState, productId?, environment?, stableRejection? }
```

The server-side verification layer **is** normalized, with a uniform `isValid`. The audit
generalized from the entry-point names differing to the contract differing.

The real divergence is one layer out, in the **SDK-facing GraphQL union** — `api.graphql:78`,
where `VerifyPurchaseResultIOS.isValid` exists, `VerifyPurchaseResultHorizon` uses
`success`, and `VerifyPurchaseResultAndroid` (`type-android.graphql:523`) has no validity
field at all. R3's fail-open hazard is real, but it is a client-type problem, not an
IAPKit provider problem.

**Not fixed here, deliberately.** Making the union uniform means adding a non-nullable
field to generated types across six languages and eight sync targets, which breaks every
constructor call site until all are updated. Only Swift is verifiable in this environment.
Shipping that blind would break Android, Flutter, KMP, MAUI, and Godot builds. It is
recorded as a planned breaking change; see §18.6.

### 18.2 Real implementations bound to the spec

| Implementation | Behaviors | Verified how |
| --- | --- | --- |
| **expo-iap** | 14 | **425 tests pass** — real `src/index.ts` over a fake native module |
| **react-native-iap** | 18 | Typechecks clean; jest preset absent locally, CI-first |
| **apple-client** | 5 | **155 swift tests pass** |
| **android** (Play/Horizon/Amazon) | 7 × 3 | CI-first (no JDK/SDK locally) |
| **iapkit** (Apple/Google) | 7 × 2 | Passing in kit's suite |
| openiap-reference | 27 | Passing; not a shipped SDK |

The TypeScript adapters replace the native module with a deterministic fake store and run
the **real SDK wrappers** — so `fetchProducts`, `requestPurchase`, `finishTransaction`,
`getAvailablePurchases`, `getActiveSubscriptions` are exercised as shipped, not mocked
around.

Running against real code immediately caught two things the reference adapter could not:
the SDKs require `request.google` / `request.apple` (not `android`/`ios`), and expo-iap
delegates `hasActiveSubscriptions` to the native module rather than deriving it. Both were
adapter bugs, found because the real implementation rejected them.

### 18.3 Ecosystem coverage report

`packages/conformance/scripts/coverage-report.mjs` parses each suite's declared behavior
ids from source — not self-reported at runtime — and reports which implementation covers
what:

```text
  implementations: android-google, android-horizon, android-amazon, apple-client,
                   iapkit-apple, iapkit-google, react-native-iap, expo-iap, openiap-reference
  31/34 behaviors covered by a real implementation
  3 covered only by the reference adapter or not at all
```

Up from **16/34** at the start of this round. `--check` fails if any MUST behavior has no
implementation at all, and runs in the parity audit.

### 18.4 Enforcement added

- Parity audit now requires the conformance package, the coverage script, and **each
  adapter file** to exist, and runs both the behavior-id drift gate and the coverage gate.
- CI job `test-conformance` runs the suite, the drift check, the reference report, and the
  coverage report, uploading `conformance-report.json` + `conformance-coverage.json` as
  artifacts with `if-no-files-found: error`.
- Framework CI already runs the new adapters through the existing `bun run test` /
  `yarn test:library` scripts.
- Package prepared for publication (`files`, `publishConfig`, `bin`, `repository`).
  **Not published** — that is an outward-facing action requiring your approval.

### 18.5 Verification

| Suite | Result |
| --- | --- |
| `packages/conformance` | **20 passed** |
| `specs/client` | **171 passed** |
| `packages/kit` | **1187 passed**, 1 skipped |
| `swift test` | **155 passed** |
| `expo-iap` (full suite) | **425 passed**, 16 files |
| parity audit (+ conformance, drift, coverage gates) | **passed** |
| `audit:docs`, lockfile | clean |
| react-native-iap typecheck | 17 errors before, 17 after — no new errors |

**Still unverified locally:** Android (no JDK 17 / SDK), react-native-iap jest (missing
`@react-native/jest-preset`), Flutter, MAUI, KMP, Godot.

### 18.6 Final scores

| Subject | Audited | R1 | R2 | R3 | Rationale |
| --- | --- | --- | --- | --- | --- |
| **Client OpenIAP** | 1.5 | 2.5 | 4.0 | **4.5** | Versioned suite bound to four real implementations across three languages; fake-store driver covers purchase flows; capability modeling machine-checked; CI gates on drift and coverage. |
| **IAPKit** | 2.5 | 3.5 | 4.0 | **4.5** | Lifecycle behaviors bound to the spec across both providers, verification layer confirmed already normalized. |
| **Overall** | 2 | 3 | 4.0 | **4.5** | Everything in "Strong", plus a versioned suite real implementations run. |

### 18.7 Why this is 4.5 and not 5

Level 5 is *"independent implementations can demonstrate compatibility through a versioned
conformance suite suitable for an external compatibility/certification program."* Three
things stand between here and there, and none is wording:

1. **No third party has run it.** Every implementation bound so far lives in this
   repository. "Independent" means someone else's code, and that has not happened. This is
   the single largest gap and it cannot be closed from inside the repo.

2. **The package is unpublished.** It is prepared, but nobody outside can install it. I
   have not published it — publishing is outward-facing and irreversible, and is your call.

3. **Four of nine implementations are CI-first.** Android, Flutter, KMP, MAUI, and Godot
   have not been compiled in this environment. Android's suite in particular is the one
   protecting the entitlement rule that Horizon was violating; until CI runs it green,
   that protection is written but unproven.

Concretely remaining: publish the package (your approval), get a green CI run across all
suites, extend adapters to Flutter/KMP/MAUI/Godot, make the `VerifyPurchaseResult` union
uniform as a planned breaking change (§18.1), and have one external implementation produce
a passing report.

### 18.8 Final answers

**1. Can OpenIAP honestly say its implementations are conformance-tested against a shared
specification?** For expo-iap, apple-client, and IAPKit: **yes, and demonstrably** — those
run against a versioned, capability-gated spec with passing local runs. For
react-native-iap and the three Android stores: written and gated, awaiting a CI run. For
Flutter, KMP, MAUI, Godot: **no** — the spec covers them, no adapter binds them yet.
31/34 behaviors have at least one real implementation.

**2. Could Samsung Galaxy Store be added today and validated using the same reusable
conformance suite?** Yes. Add `Samsung` to `IapStore` (the capability-matrix test forces
its capabilities to be declared), implement `StoreConformanceAdapter`, and inherit the
Android behavioral suite and versioned behavior ids — then produce a dated report naming
the suite and spec version passed. The audit's original answer was "no, there is nothing
to demonstrate conformance against."

**3. Highest-leverage remaining changes.** (1) Publish the package and get one external
implementation to produce a report — the only thing that makes "independent" true. (2) A
green CI run across all suites, converting the CI-first work into evidence. (3) Adapters
for the four remaining bindings, closing the last coverage gap.

---

## 19. Fourth Round — The Breaking Change (R3 Fixed Properly)

§18.1 deferred the `VerifyPurchaseResult` fix as too risky to ship unverified. On
reconsideration that call was overcautious: the hand-written construction surface turned
out to be **two sites**, not the ecosystem-wide rewrite I estimated. The change is done.

### 19.1 What changed in the spec

`VerifyPurchaseResultAndroid` and `VerifyPurchaseResultHorizon` gained `isValid: Boolean!`,
so every variant of the union answers validity identically. Horizon's `success` is
deprecated in favour of it:

```graphql
isValid: Boolean!
success: Boolean!
  @deprecated(
    reason: "Renamed to isValid so every VerifyPurchaseResult variant answers validity the same way. Scheduled for removal in OpenIAP 4.0."
  )
```

`api.graphql`'s `verifyPurchase` description previously instructed callers to *"inspect the
concrete variant before reading fields."* That instruction is gone — it was the fail-open
hazard written into the spec.

### 19.2 Derivation rules, not guesses

`isValid` had to mean something real at each producer:

| Producer | Rule | Why |
| --- | --- | --- |
| `verifyPurchaseWithGooglePlay` | `.copy(isValid = true)` after parse | Every non-2xx throws above, so reaching the parse means Play returned a purchase record. gson bypasses constructors, so it must be set explicitly rather than read from a body that has no such field. |
| `verifyPurchaseWithHorizon` | `isValid = success` | Meta's `success` is exactly this signal. |
| react-native-iap `verifyPurchase` | `isValid: true` on the Android branch | The native layer throws on failure. |
| Apple | already present | — |

`OpenIapModule.kt` (Horizon) now gates on `horizonResult.isValid` instead of `.success`.

### 19.3 The deprecation policy had to be fixed too

`audit-deprecation-schedule.mjs` rejected the deprecation with *"completed major train must
not retain schema deprecation"* — it failed **any** entry, because it was written when the
only possible deprecations were already-removed OpenIAP 3 ones. That rule cannot express a
future train, which makes normal spec evolution impossible.

Replaced with a stricter, more useful rule: parse the removal major from the reason and fail
only when it is **due** (`removalMajor <= currentSpecMajor`), plus fail any deprecation that
does not name a train at all. A test constructing an overdue OpenIAP 1.0 deprecation guards
the rule itself.

`schema-deprecations.test.mjs` and `generated-compatibility.test.ts` both asserted
`entries === []`. The first now lists the agreed deprecation explicitly (an unlisted one is
an accident or a forgotten removal). The second's empty-assertion was short-circuiting the
per-language validation below it; it now asserts non-empty, so the real check — that every
generator emits the deprecation into its docs — actually runs. It passes: all six languages
emit it, including `@Deprecated(...)` in Kotlin.

### 19.4 What the change caught

Regenerating and rebuilding surfaced three real call sites that would have silently shipped
a wrong or absent validity signal:

- `libraries/react-native-iap/src/index.ts:2142` — **production code** constructing
  `VerifyPurchaseResultAndroid` with no validity field
- `packages/apple/Tests/.../VerifyPurchaseTests.swift` and four KMP `VerificationTest.kt`
  fixtures
- `example/__tests__/utils/vegaRuntime.test.ts` — a `{success: false}` fixture

The conformance runner also failed the reference adapter the moment the new behavior was
added, because a missing MUST is a failure — the runner behaving exactly as designed.

### 19.5 Verification

| Suite | Result |
| --- | --- |
| `specs/client` | **171 passed** (regenerated schema + updated deprecation tests) |
| `packages/conformance` | **20 passed** |
| `packages/kit` | **1187 passed**, 1 skipped |
| `swift test` | **156 passed** |
| `expo-iap` | **425 passed** |
| react-native-iap typecheck | no `isValid` errors remain |
| parity, deprecations, docs audits | **passed** |
| Coverage | **32/35 behaviors** covered by a real implementation |

Generated types propagated to all 8 sync targets; `bun run generate` is deterministic
(re-running produces no further diff).

**Unverified locally, as before:** Android (no JDK 17 / SDK), Flutter, MAUI, KMP, Godot,
react-native-iap jest.

### 19.6 Scores

| Subject | Audited | R1 | R2 | R3 | R4 |
| --- | --- | --- | --- | --- | --- |
| **Client OpenIAP** | 1.5 | 2.5 | 4.0 | 4.5 | **4.5** |
| **IAPKit** | 2.5 | 3.5 | 4.0 | 4.5 | **4.5** |
| **Overall** | 2 | 3 | 4.0 | 4.5 | **4.5** |

R3's fail-open hazard is closed and the spec no longer instructs callers to branch on the
concrete variant, which removes a real entitlement-integrity risk. It does not move the
score, because the three things holding it at 4.5 are unchanged and none is a code defect:

1. **No third party has run the suite.** Every bound implementation is in this repository.
2. **The package is unpublished.** Prepared, not shipped — that is an owner decision.
3. **Five of nine implementations are CI-first.** Android, Flutter, KMP, MAUI, Godot have
   not been compiled here.

Reaching 5 requires evidence from outside this repository, not more code inside it.

### 19.7 Release lane

The suite publishes as **`openiap-conformance`** (unscoped, so third parties install it
without the vendor scope that would make it look internal).

`.github/workflows/release-conformance.yml` follows the same two-phase pattern as the other
npm lanes — bump and tag on the release branch, then dispatch on the tag ref so npm
provenance attests the commit the tag names — with the release-branch guard, tag-reachable
check, source-run verification, and provenance verification carried over. Its validate phase
additionally runs the suite tests, the behavior-id drift check, and the coverage gate,
because a suite published with drifted ids would invalidate every report produced against
it. It is registered as lane 9 in `.claude/commands/release.md`, independent of the
`spec = min(google, apple)` floor since its version is the suite version, not the spec
version.

**Nothing has been published.** The lane exists so a maintainer can dispatch it; the first
run is the first real test of the workflow.

---

## 20. Fifth Round — Defect Sweep

Binding the three remaining reference-only behaviors was proposed as coverage cleanup. It
turned into a defect sweep, which is the point: a behavior covered only by an adapter
written to pass it has never actually asked a shipped SDK anything.

### 20.1 Confirmed defects found and fixed

**D1 — react-native-iap threw an uncoded error for an empty sku list.**

```ts
// libraries/react-native-iap/src/index.ts:887 (before)
if (!skus?.length) {
  throw new Error('No SKUs provided');
}
```

`ErrorCode.EmptySkuList` exists in the spec, expo-iap used it, and **react-native-iap's own
Vega adapter used it with the identical message** (`vega-adapter.ts:1432`). Only the main
path missed it. A consumer branching on `error.code === ErrorCode.EmptySkuList` got
`undefined` on react-native-iap and the correct code on expo-iap.

**D2 — both SDKs threw uncoded errors for an empty sku list in `requestPurchase`.**

Every native implementation emits `EmptySkuList` for this condition — Play
(`OpenIapModule.kt:842`), Horizon (`:729`), Amazon (`:637`), Apple
(`OpenIapModule.swift:269`). Both JS layers validate first and short-circuited with a bare
`Error`, so the same user-facing condition produced a coded error when it reached native and
an uncoded one when it did not.

Fixed at four sites (react-native-iap iOS + Android branches, expo-iap both branches). The
developer-guidance messages are preserved verbatim; only the error gained its code.

### 20.2 Checked and found clean

- **`isActive` derivation in the JS layers.** Both SDKs pass `isActive` straight through from
  native (`react-native-iap/src/index.ts:2481`); neither re-derives it, so the Horizon leak
  class does not recur above the native boundary.
- **Apple's `isActive`** uses expiration (`OpenIapModule.swift:1123`) rather than purchase
  state. Different rule from Android, but correct for StoreKit, whose
  `currentEntitlements` is already filtered. Not a defect.

### 20.3 Capability declarations are now enforced

`StoreCapability` was decorative: the Kotlin adapters declared a capability set and nothing
compared it to `capability-matrix.mjs`. That was debt I introduced in §16 when I made the
pending assertion unconditional.

The generator now emits the per-store capability levels into `ConformanceBehaviors.kt`, and
`StoreConformanceSuite` asserts each adapter's declaration matches the matrix
(`declared ⟺ level != "unsupported"`). An adapter can no longer claim a capability its store
lacks, which would have let capability-gated checks pass vacuously.

### 20.4 Coverage

**35/35 behaviors are now covered by a real implementation**, up from 32/35. No behavior is
left to the reference adapter alone.

| Suite | Result |
| --- | --- |
| `specs/client` | 171 passed |
| `packages/conformance` | 20 passed |
| `packages/kit` | 1187 passed, 1 skipped |
| `swift test` | 156 passed |
| `expo-iap` | **427 passed** (+2 new behavior bindings) |
| react-native-iap typecheck | 17 baseline, 17 after — no new errors |
| parity, deprecations, docs audits | passed |

react-native-iap's jest cannot run here (`@react-native/jest-preset` absent), so its two new
bindings and the D1/D2 fixes are typechecked but CI-first.

### 20.5 Scores

Unchanged at **4.5**. D1 and D2 are real defects and their fixes are real improvements, but
the three conditions holding the score at 4.5 are unchanged: no third party has run the
suite, the package is unpublished, and five implementations are CI-first. What this round
does change is the honesty of the coverage number — 35/35 now means every behavior has been
asked of shipped code, not of a reference adapter written to agree with it.

---

## 21. Self-Review Round — Packaging Defects

A `review-self` pass over the whole session's diff found six actionable gaps. Two of them
made the published package unusable, which matters because an external run is the only
thing standing between 4.5 and 5.

### 21.1 The published package could not be installed

`packages/conformance` reached outside its own root in two places:

```js
// src/runner/runner.mjs    — module does not exist in the tarball
import { capabilityLevel } from '../../../../specs/client/src/capability-matrix.mjs';

// src/spec/version.mjs     — file is not in the tarball
new URL('../../../../openiap-versions.json', import.meta.url)
```

Both resolve inside the monorepo, so every test in this checkout passed. An installed copy
would have failed at module resolution — the suite was publishable and unusable, and no
existing check could see it.

**Fixed** by generating `src/spec/generated-spec.mjs` (capability matrix + spec version)
from the gql SSOT through the same generator and drift gate already used for the Kotlin and
Swift behavior ids. `specs/client` remains the source of truth; the package no longer reads
across its own boundary.

Verified by packing the tarball, installing it into an empty project outside the repo, and
running the suite plus every documented subpath export (`/spec`, `/runner`, `/report`,
`/fake-store`) and the `openiap-conformance-report` bin.

`test/packaging.test.mjs` now fails on any import or file read that escapes the package root
and on any source file missing from the tarball. Confirmed by reintroducing the original
import and watching it fail.

### 21.2 The coverage gate was masked by the reference adapter

`coverage-report.mjs --check` failed only when a behavior had **zero** implementations.
Since the reference adapter is written to pass, deleting every real implementation of a
behavior still exited 0 — the gate could not detect the loss it exists to detect.

Confirmed by removing the Android suite's coverage declaration: exit 0. Now gated on
coverage by a non-reference implementation; the same experiment exits 1 and names the
behaviors as "reference only".

### 21.3 Other findings

| Finding | Fix |
| --- | --- |
| `verifyPurchaseWithHorizon` had no test; the Play `isValid` derivation had no assertion | Added 2 Horizon tests and an `assertTrue(result.isValid)` on the Play success path |
| Two comments narrated change history, violating the convention added this session | Trimmed to the constraint |
| `openiap-conformance-coverage` bin read monorepo paths | Removed from `bin`; the two repo-only scripts are no longer published |
| Trailing blank line at EOF | Removed |

### 21.4 Verification

gql 171 · conformance 25 · kit 1187 · apple 156 · expo-iap 427 · parity · coverage gate ·
deprecations · docs — all passing. Generators re-run clean. Isolated tarball install runs
the suite end to end.

### 21.5 Effect on the score

Still **4.5**, but one of the three blockers is materially closer: the package is now
genuinely installable and runnable by someone outside this repository, which it was not
before this round. Publishing and a first external report remain.
