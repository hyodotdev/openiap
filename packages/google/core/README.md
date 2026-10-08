# OpenIAP Android core

`io.github.hyochan.openiap:openiap-core` lets an independently maintained
Android store provider implement OpenIAP without linking Play Billing, Meta
Horizon, or Amazon Appstore SDKs. The official store artifacts depend on the
same core; Maven apps keep their existing dependency coordinates.

Core owns `OpenIapProtocol`, generated models and handlers, normalized errors,
listeners, provider discovery, and the `OpenIapStore` facade. Shared sources
remain in `../openiap/src/main` so the Client Protocol generation pipeline has
one sync target. Core has Android, coroutine, lifecycle, Gson, and Compose
dependencies; store vendors' billing SDKs belong to their providers.

## Provider boundary

Implement `OpenIapProtocol` and expose an `OpenIapProviderFactory` with a public
no-argument constructor. Register its class in the library manifest under
`dev.hyo.openiap.PROVIDER`. The host selects one provider per build with
`openiapStore` and `openiapProvider`; conflicting factories fail manifest
merging. All framework SDKs call the selected provider through the facade.

The factory declares its store id, core and Client Protocol build versions,
and supported capabilities. Runtime discovery rejects incompatible versions
and malformed factories with `OpenIapError.ProviderConfiguration`.
`OpenIapProtocol` and its referenced types are public API under SemVer. New
members require default implementations; `:openiap-core:apiCheck` guards the
binary surface and `OpenIapProtocolSurfaceTest` freezes the abstract members.

New stores return `store = unknown` and their own `storeId`, matching the
Commerce Protocol store key (`[a-z][a-z0-9_]*`). An adapter for an existing
store retains its canonical purchase identity. Play uses `play` on the client
and `google` in Commerce; the registry records that mapping. Provider selection
alone does not add server receipt validation for a store.

The contract supplies the current Activity through `setActivity`; it has no
Activity-result callback or generic store-configuration map. A provider owns
its vendor configuration and any proxy Activity needed for result/deeplink
handling, and releases listeners and Activity references in `endConnection`.

## Build against the branch

Before the 4.0.0 release, publish the core and Android conformance AAR to
Maven Local from this checkout:

```sh
packages/google/gradlew -p packages/google \
  :openiap-core:publishToMavenLocal :openiap-conformance:publishToMavenLocal \
  -PopenIapVersion=4.0.0
```

Run that command from the repository root. Add `mavenLocal()` before
`mavenCentral()` in the provider and host repositories, and build against
`openiap-core:4.0.0`. Set the factory's `coreVersion` to `4.0.0` and
`clientProtocolVersion` to `clientProtocol` from this checkout's
`openiap-versions.json`; the protocol can still be an RC. Rebuild and retest
against the published 4.0.0 artifacts when they are available; a local
publication is not a released contract.

## Test a published RC

Use the exact RC in the core dependency and the factory's `coreVersion`, for
example `4.0.0-rc.1`. Set `clientProtocolVersion` to `clientProtocol` from
`openiap-versions.json` at that RC tag, not to the native RC version.
Prerelease compatibility requires an exact match. Rebuild the provider
for each RC and again for stable 4.0.0.

The Google release workflow publishes core, official store artifacts, and the
Gradle plugin for RCs. It publishes the Android conformance AAR only for stable
releases. Until then, check out the RC's `google-<version>` tag and publish the
suite locally. Run from the repository root; for the first 4.0.0 RC:

```sh
packages/google/gradlew -p packages/google \
  :openiap-conformance:publishToMavenLocal \
  -PopenIapVersion=4.0.0-rc.1 \
  -Dmaven.repo.local=/tmp/openiap-provider-rc-maven
```

Add that local repository to your test build before Maven Central. The suite
artifact keeps its independent suite version, `4.0.0`, and its POM depends on
the selected RC core. Use a separate local repository so this test artifact
cannot shadow the stable suite later. The RC core itself comes from Maven
Central.

```kotlin
repositories {
  maven { url = uri("/tmp/openiap-provider-rc-maven") }
  google()
  mavenCentral()
}
```

Follow the [provider guide](https://openiap.dev/docs/guides/store-providers)
for authoring, selection, CI reports, and registration. The
[independent fixture](../compatibility/community-provider/README.md) proves
Maven-only consumption, conformance failures, optimized discovery, and
dependency isolation. The [migration guide](https://openiap.dev/docs/updates/migration#provider-contract-store-id)
covers the major-version upgrade, including required purchase `storeId`.
