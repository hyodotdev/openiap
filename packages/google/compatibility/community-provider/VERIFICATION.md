# Common store provider verification

Apple and Android expose the same provider model: independently maintained
implementations, explicit discovery and selection, required capabilities,
canonical errors, and stable purchase identity. All six SDKs dispatch through
the selected native provider. No additional real store implementation ships
in this change.

New stores outside the fixed `IapStore` enum use `store = unknown` and their own
required `storeId`. Registration is optional. The registry
produces generated constants, aliases, CLI checks, and the public listing.
Provider selection does not add IAPKit server validation for a new store.

## Verification coverage

| Area                  | Executed coverage                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android provider      | Independent local Maven publication, required behavioral profile, negative capability/platform/token cases, discovery, manifest conflicts, and optimized host                                         |
| Apple provider        | Independent Swift package, matching behavioral profile, explicit discovery failures, and optimized factory retention                                                                                  |
| SDK dispatch          | React Native, Expo, Flutter, Godot, KMP, and MAUI selection and identity handling; public storefront overrides and canonical redemption handlers, community KMP billing operations/events, ownership/restore, and completion |
| Provider dependencies | Neutral Gradle consumer graphs and MAUI Maven runtime closure, including a separate vendor SDK and credits for existing app dependencies                                                              |
| Contracts             | Client Protocol generation and sync, frozen store enum, required store ids, legacy official identity decoding, and JavaScript/native conformance                                                      |
| Release wiring        | Registry validation, SBOM/provenance inputs, stable-release preflight, native core publication, framework packaging, and affected CI paths                                                            |
| Documentation         | Common provider authoring/selection guide, API/type consistency, affected release card, and production-site build                                                                                     |
| Devices               | All 30 hardware cells attempted: 22 sandbox purchase/verify/finish passes, seven Horizon real-payment gates, one Vega tester failure; separate Onside build-only pass; see E2E_RESULTS.md             |

See [E2E_RESULTS.md](E2E_RESULTS.md) for every device row and limitation.
Use [README.md](README.md) and the Apple compatibility fixture to reproduce
independent publication and conformance. Artifacts and raw device/backend
evidence remain in ignored build outputs or the private local run directory.

Both independent fixtures pass the 15 common provider behaviors and their
three declared capability checks, including
exactly one canonical error event before a failed purchase request returns an
empty result or throws.
Negative cases reject missing, duplicate, and contradictory events. Swift
ownership reads must retain the token from the original purchase callback;
matching later reads alone cannot pass. The reproduction commands run these fixture checks separately from the
hardware matrix.

MAUI resolves the provider's Maven runtime graph through Gradle, including
transitive dependencies, BOMs, exclusions, and version conflicts. It credits
binaries already supplied by restored NuGet packages or explicit app artifacts;
a provider requiring a newer version fails instead of linking duplicates.

Store ids follow the Commerce key grammar. The registry pins Play's
`play` → `google` mapping. Core's binary API baseline and abstract-member test
require new protocol members to provide default implementations.

## Boundaries

- Android core owns shared source compilation and publication; the source stays
  under `openiap/src/main` to preserve the generated-type sync owner.
- KMP's neutral variant has Play Billing on its compile-only classpath because
  the existing source set also contains Play code. Its community runtime graph
  excludes that SDK.
- Native provider profiles exercise the public client contracts and declared
  capabilities. They do not certify server-only commerce behavior.
- Godot invalid export settings emit an error and an unresolvable coordinate,
  because its export hook cannot cancel an export directly.
- Apple providers must be linked and retained in optimized app builds; an
  Info.plist factory name does not link a binary by itself.

## Release targets

Client Protocol **1.0.0** is set in its publishing manifest and generated
mirrors. The release card includes the following future stable publications.
Native and framework versions remain managed by their existing release
workflows; local Maven/SPM checks do not claim public publication.

| Publication                   | Release card target |
| ----------------------------- | ------------------- |
| Client Protocol / CLI         | 1.0.0 / 0.2.0       |
| Google / core / Gradle plugin | 4.0.0               |
| Android conformance           | Suite 4.0.0         |
| Apple                         | 4.0.0               |
| React Native                  | 17.0.0              |
| Expo                          | 6.0.0               |
| Flutter                       | 11.0.0              |
| Godot / KMP                   | 4.0.0 / 4.0.0       |
| MAUI                          | 3.0.0               |

Client Protocol 1.0.0 removes the scheduled redemption and Horizon verification
aliases, plus Apple `OpenIapVersion.specVersion`; see the public migration table.
Official store aliases and later-scheduled configuration paths remain supported.
Commerce Protocol has no publication change. This task adds no IAPKit
store adapter or response-contract change. Dependency/lockfile updates still
trigger the existing IAPKit deployment workflow on merge.

CI applies to its recorded head SHA. Device rows name their executed revision
in E2E_RESULTS.md; fixture checks and later report edits do not replace a device run.
