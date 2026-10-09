# Independent Android provider fixture

`community.fixture:provider:1.0.0` is an in-memory store in the
`community.fixture` namespace. It compiles against Maven artifacts only:
`openiap-core` and its separately published `vendor-sdk` for implementation,
and `openiap-conformance` for tests.
It has no official billing SDK, composite build, or official provider source
dependency. It is deliberately absent from the store registry.

Run from the monorepo root with Java 17 and an Android SDK:

```sh
bash packages/google/scripts/verify-community-provider.sh
```

The script publishes into a temporary local Maven repository and checks:

- The provider passes the Android provider profile, including all three
  declared capabilities. Reports include suite and Client Protocol versions.
- A provider that declares but omits a billing-issue event fails conformance.
- The minified host selects the provider with the two Gradle properties, keeps
  its manifest factory, and contains no official billing SDK.
- Two different provider manifests fail merging.
- Product loading calls the separate vendor SDK, its Kotlin Multiplatform JVM
  runtime, and the core's Compose context. Missing runtime dependencies fail
  before the store can serve products.
- The Gradle plugin resolves core plus provider for plain and flavored apps;
  a provider flavor without coordinates fails.

Reports remain in `provider/build/reports/openiap/`; the negative report must
have `conformant: false`. The host APK is
`host/build/outputs/apk/release/host-release.apk`.

## Use it in the SDK examples

The fixture publishes its vendor SDK and provider to a local Maven repository.
Its core and conformance dependencies use the 4.0.0 contract. To test local
source changes, publish both artifacts to that same repository:

```sh
packages/google/gradlew -p packages/google \
  :openiap-core:publishToMavenLocal :openiap-conformance:publishToMavenLocal \
  -Dmaven.repo.local=/tmp/openiap-provider-maven -PopenIapVersion=4.0.0

packages/google/gradlew -p packages/google/compatibility/community-provider \
  :provider:negativeConformance :vendor-sdk:publishVendorPublicationToMavenLocal :provider:publishFixturePublicationToMavenLocal \
  -Dmaven.repo.local=/tmp/openiap-provider-maven \
  -PopenIapRepository=/tmp/openiap-provider-maven \
  -PopenIapVersion=4.0.0 -PconformanceVersion=4.0.0
```

For a published RC, replace the first command with the
[core RC suite command](../../core/README.md#test-a-published-rc), which leaves
core resolution on Maven Central. In the second command, use the exact RC as
`openIapVersion` and `/tmp/openiap-provider-rc-maven` for both `maven.repo.local`
and `openIapRepository`. Keep `conformanceVersion` at the suite version. Use
that RC repository in the consuming app too. The factory embeds the Client
Protocol version from the core it compiles against.

Add `/tmp/openiap-provider-maven` as a Maven repository in the consuming app,
then build with both properties:

```properties
openiapStore=community_fixture
openiapProvider=community.fixture:provider:1.0.0
```

Expo uses its usual Android debug task and Metro. KMP's example uses
`:composeApp:assembleProviderDebug`; its settings already include `mavenLocal`,
so pass `-Dmaven.repo.local=/tmp/openiap-provider-maven`. Give each test app a
distinct application id suffix before installing it. Choose **None (Skip)**
verification, request a fixture product, and finish it. This fixture has no
receipt-validation service. Both examples display `community_fixture` on the
purchase result or detail screen.

To verify consumption of KMP's Maven metadata as well as its local example,
publish only its root and neutral Android publications locally:

```sh
libraries/kmp-iap/gradlew -p libraries/kmp-iap \
  :library:publishKotlinMultiplatformPublicationToMavenLocal \
  :library:publishAndroidProviderReleasePublicationToMavenLocal \
  -Dmaven.repo.local=/tmp/openiap-provider-maven

packages/google/gradlew -p packages/google/compatibility/store-plugin \
  :app:printDebugStores \
  -PfixtureCommunityRepository=/tmp/openiap-provider-maven \
  -PfixtureKmpVersion=<kmp-version> -PfixtureStrategy=provider \
  -PopeniapStore=community_fixture \
  -PopeniapProvider=community.fixture:provider:1.0.0
```

The graph must contain `kmp-iap-android-provider`, `openiap-core`, and `provider`
without an official store artifact. See [VERIFICATION.md](VERIFICATION.md) for
the recorded checks, limitations, and release follow-ups.
