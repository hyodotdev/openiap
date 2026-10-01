# Android provider verification — 2026-10-01

Implemented on `feat/google-pluggable-store-providers` from clean `main` at
`69ab74bf`. The previous local main commits were preserved on
`backup/main-before-store-providers-20260930`. The inventory and design were
committed first in `b66ed0ad`. The branch was rebased onto current `origin/main`
at `64158e8e`; review policy was held at the original `69ab74bf` baseline.

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

| Check                                   | Result                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Independent provider                    | 21 JVM tests pass; 17 required behavior results pass on suite 4.0.0 / Client Protocol 0.2.0                                                                                                      |
| Missing declared capability             | Exactly one expected test failure; report is nonconformant                                                                                                                                       |
| Minified standalone host                | Factory retained; no Play, Horizon, or Amazon billing SDK in R8 output; installed and purchased on device                                                                                        |
| Duplicate providers                     | Manifest merge fails on the fixed provider metadata key                                                                                                                                          |
| Expo device example                     | Connected, fetched three fixture products, purchased, finished, and displayed `community-fixture` in purchase details                                                                            |
| KMP device example                      | Connected, fetched three fixture products, purchased, finished, and displayed `Store ID: community-fixture`                                                                                      |
| Published KMP metadata consumed locally | Both plain and flavored apps resolve `kmp-iap-android-provider,openiap-core,provider`                                                                                                            |
| Gradle selection                        | 93 resolver cases; 22 plugin cases; external plain/flavored graphs pass and missing provider coordinates fail                                                                                    |
| Google                                  | Core and all three official unit-test variants pass; conformance AAR builds                                                                                                                      |
| Official consumers                      | Kotlin 2.1 and minified release consumers pass for Play, Horizon, and Amazon                                                                                                                     |
| React Native                            | 691 tests and typecheck pass; initial builds of all three official example APKs pass                                                                                                             |
| Expo                                    | 516 SDK tests, 116 plugin tests, and typecheck pass; three provider-destruction regressions pass; initial builds of all three official example APKs pass                                         |
| Flutter                                 | 391 tests and analysis pass; two native provider-configuration regressions pass; initial builds of all three official example APKs pass                                                          |
| KMP                                     | Android tests and neutral build pass; all three official example APKs and iOS simulator compilation pass                                                                                         |
| MAUI                                    | 139 tests and 32 selection cases pass; typed provider-init failure regression passes; initial builds of all three official example APKs pass                                                     |
| Godot                                   | Types 271, API 139, envelope 251, wrapper 223, and selection 46 assertions pass; Android plugin builds and unit tests pass                                                                       |
| Apple                                   | 169 tests pass                                                                                                                                                                                   |
| Client Protocol and CLI                 | 187 schema tests and canonical generation pass; 185 CLI tests pass                                                                                                                               |
| JavaScript conformance                  | 40 tests pass                                                                                                                                                                                    |
| Registry and release wiring             | Registry validation/drift checks pass; 71 registry/preflight/sync/policy tests pass; fresh checkout dependency installation and release generation pass; edited workflows parse as YAML and Bash |
| Repository and docs                     | Parity, layout, docs, release-state, CI path, and fact audits pass; docs build, lint, formatting, and discoverability pass                                                                       |
| Rendered docs                           | New guide checked on desktop and 390px mobile viewport; page has no horizontal overflow or browser warnings/errors                                                                               |

Reproduce the provider checks with the command in [README.md](README.md).
Local device evidence is in `build/reports/device/`; those build outputs are
ignored by Git. The positive and negative reports are in
`provider/build/reports/openiap/`.

## Independent review

Three read-only review scopes covered core/conformance/code generation,
registry/CLI/release wiring, and all six SDKs. Their final snapshots reported
no remaining actionable findings. Fixes include legacy official identity
inference, malformed community identity rejection, verification-result identity
validation, Kotlin JVM compatibility bridges, Swift/Dart constant collisions,
C# record equality, typed initialization failures, and safe Expo destruction.

KMP forwards default subscription options to community providers while retaining
Amazon/Horizon's existing default no-op. Flutter's bridge preserves raw
`storeId` values so the generated decoder rejects malformed identities instead
of converting them to strings. Its 391 tests, analysis, four rebuilt store
binaries, and repeated device flows pass.

The final registry/CLI/release review covered `bb386321` with no findings;
the SDK review covered the strict decoder fix at `9af1820d` with no findings.
The full device run is recorded in [E2E_RESULTS.md](E2E_RESULTS.md): 31 successful
build cells, 21 completed sandbox purchase/verification/finish chains, seven
Horizon checkout gates, two Vega installs/launches, and the Onside build.
Amazon Live App Testing and Vega purchases remain explicitly blocked there.
Review and remote CI results must be evaluated at the PR's exact current head.

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

## Release targets and remaining external verification

Client Protocol 0.2.0 is committed in its publishing manifest and generated
mirrors. The consolidated release card includes the affected packages and
future release links. Native and framework release metadata remains under
its existing release workflow; no stable package was published in this run.
Existing official aliases, legacy flags, and deprecated configuration paths
remain supported through this provider release. Their scheduled removals move
to the following major releases, as the task requires.

| Publication                   | Release card target |
| ----------------------------- | ------------------- |
| Client Protocol / CLI         | 0.2.0 / 0.2.0       |
| Google / core / Gradle plugin | 4.0.0               |
| Android conformance           | Suite 4.0.0         |
| Apple                         | 4.0.0               |
| React Native                  | 17.0.0              |
| Expo                          | 6.0.0               |
| Flutter                       | 11.0.0              |
| Godot / KMP                   | 4.0.0 / 4.0.0       |
| MAUI                          | 3.0.0               |

The guide renders the checkout's generated native version metadata. Its new
core and conformance coordinates become publicly usable only after their
release artifacts are published. The card's future tag links do not claim
that publication has occurred. Selecting a provider does not add IAPKit
receipt-validation support for that store. Commerce Protocol and IAPKit have
no source or publication change in this task.

Maven Central publication, remote release signing/provenance, and production
deployment were not performed. All new artifacts were published only into
local Maven repositories. The maintainer retains final device verification,
merge, release, and deployment authority.
