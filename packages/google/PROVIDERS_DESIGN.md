# Pluggable Android store providers

An Android app selects one provider with `openiapStore=<id>` and, for a
community provider, `openiapProvider=<group:artifact:version>`. A provider can
live outside this repository and depends only on the published core contract.
No registry entry is required to build or run it.

## Inventory

| Location | Current store knowledge | Change |
| --- | --- | --- |
| `packages/google/openiap/build.gradle.kts` | Three flavors, billing dependencies and publications | Extract shared code into `openiap-core`; retain coordinates and flavor dependencies |
| `openiap/src/main/.../store/OpenIapStore.kt`, `OpenIapError.kt` | Direct flavor class and BuildConfig references | Discover a public factory from application manifest metadata; validate its core version |
| `packages/google/gradle/openiap-store.gradle` | Aliases, legacy flags, task/device precedence | Accept a validated external id and fixed Maven coordinate; own dependency selection |
| `packages/google/gradle-plugin/` | Official artifact substitutions and KMP flavor selection | Replace the Play dependency with core and add the provider; use the neutral KMP variant |
| RN, Expo and Flutter `android/build.gradle` and example settings | Local/published official artifacts | Select core plus provider before official wiring; include core for local builds |
| Expo `plugin/src/withIAP.ts` | Official store enum and deprecated Horizon settings | Accept external id/coordinate and emit Gradle properties |
| KMP `library/build.gradle.kts`, `settings.gradle.kts` | Official flavor publications and composite substitutions | Add a provider-neutral Android variant and core substitution |
| Godot `android_store.gd`, editor export plugin and Android build | Store dropdown, artifact rewrite and feature tags | Add provider coordinate export setting; link core plus provider |
| MAUI `buildTransitive/OpenIap.Maui.targets`, Android bridge and packaging | Bundled official AARs and Maven SDK dependencies | Ship core separately; permit external Maven provider and neutral bridge |
| `packages/cli/src/checks.mjs` | Alias table and official selection diagnostics | Recognize valid external selection and report incomplete configuration |
| `specs/client/src/type*.graphql`, generators and SDK bridges | Closed `IapStore` output | Freeze the enum; add required `storeId` and preserve it through all transports |
| `openiap/src/conformanceTest/`, `packages/conformance/` | Suite compiled inside each flavor, official matrix | Publish Kotlin suite; declare capabilities; include suite and protocol versions in reports |
| Five alias tables and `scripts/audit-non-godot-parity.mjs` | Repeated official aliases | Derive/check tables against one store registry; extend parity coverage |
| Docs store guides and release cards | Official-only installation paths | Explain authoring, conformance, selection in six SDKs, registration and tiers |

## Contract and discovery

`openiap-core` compiles the existing shared source owner (`openiap/src/main`)
without compiling any flavor or linking any billing SDK. Official artifacts
expose it through `api`. Its version follows the Google version SSOT.
`OpenIapProtocol` and referenced types are public semver contracts. Default
interface methods preserve binary compatibility for later optional additions.

`OpenIapProviderFactory` exposes `storeId`, `coreVersion`, capabilities and
`create(Context)`. One application metadata key, `dev.hyo.openiap.PROVIDER`,
contains its no-argument factory class. Official flavor manifests use the same
key. Manifest merging rejects conflicting values. Core consumer rules retain
implementations and their constructors. Discovery errors, linkage errors and
incompatible core versions become actionable `OpenIapError`s. Compatibility
requires the same stable core major and a runtime at least as new as the
provider's declared build version; prerelease cores require an exact match.
Provider settings remain in its own manifest or resources.

## Identity, conformance and registry

Every output containing `IapStore` gains non-null `storeId`. Official values are
`apple`, `play`, `horizon`, `amazon`; an external provider returns `Unknown`
with its own stable id. Generated contracts, native producers and all bridge
round trips must agree. `IapStore` gets no more cases.

The Kotlin suite lives under `packages/conformance` and is published as
`openiap-conformance` using the suite version. Official matrix requirements
remain authoritative. External declarations require corresponding behaviors;
reports include `suiteVersion`, `clientProtocolVersion`, capabilities and
behavior results. The registry lives under `specs/client` and owns ids, aliases,
names, tiers, maintainers, repositories, coordinates and latest reports.
Experimental entries have no passing report; community requires a passing
current-major report; official entries live here. After a 90-day suite-major
upgrade window, an older report is marked unmaintained by CI. Promotion is a
maintainer decision.

## Ordered implementation and verification

1. Split core, retain official transitive API, compile all official flavors.
2. Add factory discovery, manifests, consumer rules and compatibility tests.
3. Extend the existing resolver and Gradle plugin; exercise legacy and external selections.
4. Change schema, regenerate all targets, populate native outputs and bridge mappings.
5. Add external selection to all six libraries, including local and deprecated paths.
6. Publishable Kotlin conformance module and capability-driven external reports.
7. Registry, generated aliases/constants/docs list and CI drift checks.
8. Separate fixture provider using only core and conformance; run it through Expo or RN and KMP.
9. Update guides/release card; run parity, layout, docs and affected package tests.

Keep each step in a local commit. Use only local Maven/included builds for
validation. Do not release, publish remotely or deploy. Record unavailable
toolchains and any necessary deviations with evidence in the final report.
