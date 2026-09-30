# Android provider verification — 2026-10-01

Implemented on `feat/google-pluggable-store-providers` from clean `main` at
`69ab74bf`. The previous local main commits were preserved on
`backup/main-before-store-providers-20260930`. The inventory and design were
committed first in `12fa7b88`.

## Result

An unregistered provider in its own namespace compiles against local Maven
core and conformance artifacts, passes the Android provider profile, and runs
through Expo and KMP on a Pixel 2 running Android 11. Both SDKs preserve
`store = unknown` and `storeId = community-fixture` through purchase delivery
and transaction completion. No real store implementation was added.

The changes include core extraction, one manifest discovery path, typed
compatibility errors, R8 consumer rules, external dependency selection in all
six SDKs, generated store identity fields, a publishable Kotlin suite, and a
registry that generates the alias tables, constants, and docs listing.

## Executed checks

| Check | Result |
| --- | --- |
| Independent provider | 21 JVM tests pass; 17 required behavior results pass on suite 4.0.0 / Client Protocol 0.1.1 |
| Missing declared capability | Exactly one expected test failure; report is nonconformant |
| Minified standalone host | Factory retained; no Play, Horizon, or Amazon billing SDK in R8 output; installed and purchased on device |
| Duplicate providers | Manifest merge fails on the fixed provider metadata key |
| Expo device example | Connected, fetched three fixture products, purchased, finished, and displayed `community-fixture` in purchase details |
| KMP device example | Connected, fetched three fixture products, purchased, finished, and displayed `Store ID: community-fixture` |
| Published KMP metadata consumed locally | Both plain and flavored apps resolve `kmp-iap-android-provider,openiap-core,provider` |
| Gradle selection | 93 resolver cases; 22 plugin cases; external plain/flavored graphs pass and missing provider coordinates fail |
| Google | Core and all three official unit-test variants pass; conformance AAR builds |
| Official consumers | Kotlin 2.1 and minified release consumers pass for Play, Horizon, and Amazon |
| React Native | 665 tests pass; all three official example APKs build |
| Expo | 490 SDK/example tests and 116 plugin tests pass; all three official example APKs build |
| Flutter | 385 tests and analysis pass; all three official example APKs build |
| KMP | Android tests and neutral build pass; all three official example APKs and iOS simulator compilation pass |
| MAUI | 122 tests and 32 selection cases pass; all three official example APKs build |
| Godot | Types 248, API 139, envelope 220, wrapper 223, and selection 46 assertions pass; Android plugin builds and unit tests pass |
| Apple | 167 tests pass |
| Client Protocol and CLI | 185 schema tests and canonical generation pass; 184 CLI tests pass |
| JavaScript conformance | 40 tests pass |
| Registry and release wiring | Registry validation/drift checks pass; release preflight and sync/policy tests pass; edited workflows parse as YAML and Bash |
| Repository and docs | Parity, layout, docs, release-state, CI path, and fact audits pass; docs build, lint, formatting, and discoverability pass |
| Rendered docs | New guide checked on desktop and 390px mobile viewport; page has no horizontal overflow or browser warnings/errors |

Reproduce the provider checks with the command in [README.md](README.md).
Local device evidence is in `build/reports/device/`; those build outputs are
ignored by Git. The positive and negative reports are in
`provider/build/reports/openiap/`.

## Deviations from decisions

- Core owns compilation and publication of the shared sources, which remain
  physically under `openiap/src/main`. This preserves the established generated
  sync paths and avoids moving a second generated-type owner.
- KMP's neutral variant still needs Play Billing on the compile-only classpath
  because its existing Android source set contains the Play implementation.
  The consumer runtime graph excludes that SDK; the external delegate runs on
  device. Splitting that source set is a separate refactor.
- The Kotlin `android-provider` profile checks the public Android contract and
  declared capabilities. It cannot exercise server-only lifecycle behaviors
  from the full conformance spec through `OpenIapProtocol`. Reports state their
  narrower required scope; a mapping-only report cannot qualify for community
  status.
- Godot's export hook cannot cancel an export. Invalid provider settings emit
  an error and an unresolvable Maven coordinate so the Android build fails.
- Apple changes also include the required generated constants/types and test
  fixture updates; its runtime edits only populate store identity.
- The published release card remains outstanding because the Client Protocol
  target is unspecified. The skill explicitly requires a maintainer-selected
  version and a matching committed manifest. No version was invented or
  manually changed in the CI-owned native version mirror.

## Unverified locally

Official store sandbox purchases across the complete device matrix were not
rerun. Official results above cover unit tests, dependency resolution, APK
builds, and the Kotlin/R8 consumers. Godot's full exported game, a minified KMP
APK, and the iOS framework examples were not exercised on devices. Godot's
headless suites also emit existing unavailable-StoreKit and ObjectDB shutdown
warnings; their assertion suites pass without script errors.

Maven Central publication, remote CI, signing/provenance of remote releases,
and production deployment were not tested or executed. All new artifacts were
published only into local Maven repositories. There was no push or PR.

## Release follow-ups

Before a PR or release, select and commit the Client Protocol target through its
publishing manifest, resolve the coordinated package targets, and add the
consolidated release card with tag aliases and expected release links. The PR
release-note completeness gate is not satisfied yet.

| Affected publication | Current metadata; no release bump performed |
| --- | --- |
| Client Protocol | 0.1.1 |
| Google, core, Gradle plugin | 3.6.2 |
| Android conformance | New AAR uses suite 4.0.0 |
| Apple | 3.6.1 |
| React Native | 16.7.2 |
| Expo | 5.8.2 |
| Flutter | 10.7.2 |
| Godot / KMP | 3.6.2 |
| MAUI | 2.6.2 |
| CLI | 0.1.1 |

The card's behavior text is ready to use: select an independently maintained
Android provider in any SDK without adding store code to OpenIAP; preserve
`storeId` alongside the frozen `IapStore` discriminator; verify providers with
the public conformance profile and register them optionally. Mention that
manually constructed purchase and verification-result objects now require
`storeId`, and that selecting a provider does not add IAPKit receipt-validation
support. Commerce Protocol and IAPKit have no publication in this change.

The guide currently renders this checkout's version metadata. Its core and
plugin coordinates must follow the release's generated version metadata before
the docs are deployed. The new core AAR does not exist at the previously
published Google version simply because this checkout builds it locally.
