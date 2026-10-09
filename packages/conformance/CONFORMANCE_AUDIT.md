# Conformance assessment

OpenIAP has shared behavioral suites alongside generated type and API parity
checks. A passing report names the executed profile, suite version, Client
Protocol version, store identity, and capabilities. A client-provider report
proves that profile; it does not certify a server's Commerce lifecycle.

The original August 12, 2026 audit and remediation journal remain in this
[file's Git history](https://github.com/hyodotdev/openiap/commits/main/packages/conformance/CONFORMANCE_AUDIT.md).
Use the executable contracts and reports below for the current state.

## Contracts and evidence

| Surface                       | Contract and verification                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript behavior inventory | `src/spec/behaviors.mjs`; `scripts/coverage-report.mjs --check` rejects MUST behaviors without a non-reference implementation                                                                                       |
| Android provider              | `android/.../ProviderConformanceSuite.kt`; public core plus provider factory, production mappers, lifecycle, identity, errors, and declared capabilities                                                            |
| Apple provider                | `apple/Sources/ProviderConformance.swift`; the public `OpenIapConformance` product and matching provider requirements                                                                                               |
| Type and API parity           | `specs/client` schema generation and `bun audit:parity`; these check the public shape and bindings rather than purchase behavior                                                                                    |
| Independent consumers         | [Android fixture](../google/compatibility/community-provider/README.md) and [Apple fixture](../apple/compatibility/community-provider/README.md), including negative capability/error cases and optimized discovery |
| Hardware                      | [Device results](../google/compatibility/community-provider/E2E_RESULTS.md), with executed revisions, sandbox evidence, and purchase limits                                                                         |
| Server lifecycle              | Commerce Protocol conformance and IAPKit tests; separate from native provider profiles                                                                                                                              |

The current source coverage report binds 37 of 43 behavior ids to non-reference
implementations. Six SHOULD-level provider/capability ids have no non-reference
implementation in that report; this is not a claim of complete runtime coverage.

The native provider profiles cover 15 common required behaviors, a separate
Android native-redemption check, and up to three declared capability checks
(19 on Android and 18 on Apple with all capabilities). They reject missing, skipped required, failed, and
contradictory results. Android mapping-only reports cannot promote a community
provider. The fixture sources are maintained in this monorepo: an independent
build proves artifact consumption, not third-party certification.

## Reproduce

Requires Java 17, an Android SDK, and Swift; first runs need network access for
dependencies. Run from the monorepo root:

```sh
bun run --cwd packages/conformance test
node packages/conformance/scripts/coverage-report.mjs --check
bun audit:parity
bash packages/google/scripts/verify-community-provider.sh
OPENIAP_PROVIDER_REPORT=/tmp/apple-provider-report.json \
  swift test --package-path packages/apple/compatibility/community-provider
swift run --package-path packages/apple/compatibility/community-provider/consumer \
  -c release FixtureConsumer
```

The [suite README](README.md) owns adapter and report instructions. Native
suite versions come from `src/spec/suite-version.mjs`; registry freshness is
computed when rendered, using the current major's publication date and the
maintenance window. A release sets that date to the actual publication date.

## Limits

- Provider runtime tests purchase one in-app item. Subscription mapper and
  capability assertions do not prove a real renewal, refund, or server webhook.
- A test double gives repeatable client CI; real vendor sandbox evidence is a
  separate requirement. App Tester is not Amazon Live App Testing.
- Horizon checkout has no observed no-charge marker, so the recorded hardware
  runs stop before payment. Vega and Onside evidence is limited as stated in
  the device report.
- Kotlin reports are written from JVM/Robolectric runs using
  `openiap.conformanceReport`; instrumentation does not receive that property.
- The JavaScript package is private and is not published to npm. Android's
  `openiap-conformance` AAR and Apple's Swift product are separate artifacts;
  local builds do not claim a public release.
