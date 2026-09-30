import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import { LIBRARIES } from '../../../lib/images';
import { OPENIAP_VERSIONS } from '../../../lib/versioning';
import registry from '../../../generated/store-registry.json';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

const selection: Record<string, string> = {
  'react-native-iap': 'Set both properties in android/gradle.properties.',
  'expo-iap':
    'Set android.store and android.provider in the expo-iap config plugin, then prebuild.',
  flutter_inapp_purchase:
    'Set both properties in android/gradle.properties. Keep openiapPlatform unset.',
  'kmp-iap':
    'Apply the OpenIAP Gradle plugin and select the provider platform variant.',
  'godot-iap':
    'Set Project Settings → OpenIAP → Android Store and Android Provider, then export Android.',
  'maui-iap': 'Set OpenIapStore and OpenIapProvider in the app project.',
};

export default function AndroidProviders() {
  useScrollToHash();
  return (
    <div className="doc-page">
      <SEO
        title="Community Android store providers"
        description="Build, verify, register, and select an independent Android store provider across all six OpenIAP SDKs."
        path="/docs/guides/android-providers"
      />
      <h1>Community Android store providers</h1>
      <p>
        Use an independently maintained Android store with any OpenIAP SDK by
        selecting its stable store id and Maven coordinates. Registration is
        optional. Purchase APIs stay the same.
      </p>
      <p>
        A provider must already implement the store’s billing SDK. OpenIAP ships
        official Play, Horizon, and Amazon providers; the compatibility fixture
        below is an in-memory test store.
      </p>
      <section>
        <AnchorLink id="select" level="h2">
          Select a provider
        </AnchorLink>
        <p>
          Use the id and fixed version supplied by the provider maintainer. Add
          its Maven repository to your app if it is hosted outside Maven
          Central. Select one provider per Android build.
        </p>
        <CodeBlock
          language="properties"
          children={
            'openiapStore=your-store\nopeniapProvider=com.example:openiap-your-store:1.0.0'
          }
        />
        <table>
          <thead>
            <tr>
              <th>SDK</th>
              <th>Configuration</th>
            </tr>
          </thead>
          <tbody>
            {LIBRARIES.map((library) => (
              <tr key={library.name}>
                <td>
                  <Link to={library.setupPath}>{library.displayName}</Link>
                </td>
                <td>{selection[library.name]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <AnchorLink id="expo" level="h3">
          Expo
        </AnchorLink>
        <CodeBlock
          language="typescript"
          children={`plugins: [
  ['expo-iap', {android: {
    store: 'your-store',
    provider: 'com.example:openiap-your-store:1.0.0',
  }}],
]`}
        />
        <CodeBlock
          language="bash"
          children="npx expo prebuild --platform android"
        />
        <AnchorLink id="kmp" level="h3">
          Kotlin Multiplatform
        </AnchorLink>
        <p>
          The neutral <code>provider</code> variant links core and your
          provider. Apply the resolver plugin in the consuming Android app so it
          adds the provider dependency; a published library’s build script does
          not run in its consumer.
        </p>
        <CodeBlock
          language="kotlin"
          children={`plugins { id("io.github.hyochan.openiap") version "${OPENIAP_VERSIONS.google}" }
android { defaultConfig { missingDimensionStrategy("platform", "provider") } }`}
        />
        <p>
          Set the two Gradle properties above. If your app declares a{' '}
          <code>platform</code> flavor dimension, add a <code>provider</code>{' '}
          flavor instead of a missing-dimension strategy.
        </p>
        <AnchorLink id="maui" level="h3">
          .NET MAUI
        </AnchorLink>
        <CodeBlock
          language="xml"
          children={`<PropertyGroup>
  <OpenIapStore>your-store</OpenIapStore>
  <OpenIapProvider>com.example:openiap-your-store:1.0.0</OpenIapProvider>
</PropertyGroup>`}
        />
        <p>
          Store-specific app ids, keys, and resources belong to the provider’s
          manifest or resources. Follow its setup instructions. Existing
          official aliases, legacy flags, and automatic device selection keep
          working; an external provider requires an explicit pair.
        </p>
      </section>
      <section>
        <AnchorLink id="identity" level="h2">
          Preserve store identity
        </AnchorLink>
        <p>
          <code>IapStore</code> has a fixed set of values. Community purchases
          use <code>store = 'unknown'</code> and their own nonempty{' '}
          <code>storeId</code>. Official ids are <code>apple</code>,{' '}
          <code>play</code>, <code>horizon</code>, and <code>amazon</code>;
          Play’s existing enum wire value remains <code>'google'</code>.
        </p>
        <p>
          Use <code>purchase.storeId</code> when routing a purchase to your
          backend, and preserve it when finishing or verifying a purchase.
          Registered ids have generated <code>StoreIds</code> constants.
          Creating purchase or verification result objects manually now requires{' '}
          <code>storeId</code>.
        </p>
        <p>
          <Link to="/docs/types/purchase">Purchase fields</Link> ·{' '}
          <Link to="/docs/types/verify-purchase-with-provider-result">
            Verification result fields
          </Link>
          . Selecting an Android provider does not add server verification
          support to IAPKit; use the provider’s authenticated server
          integration.
        </p>
      </section>
      <section>
        <AnchorLink id="build" level="h2">
          Build a provider
        </AnchorLink>
        <p>
          Create an Android library in your own repository. Depend only on the
          public core contract and your store SDK.
        </p>
        <CodeBlock
          language="kotlin"
          children={`dependencies {
  api("io.github.hyochan.openiap:openiap-core:${OPENIAP_VERSIONS.google}")
}`}
        />
        <CodeBlock
          language="kotlin"
          children={`package com.example.billing

class YourStoreFactory : OpenIapProviderFactory {
  override val storeId = "your-store"
  override val coreVersion = "${OPENIAP_VERSIONS.google}" // Version used to compile this provider.
  override val capabilities = setOf("pendingPurchases")
  override fun create(context: Context): OpenIapProtocol = YourStore(context)
}`}
        />
        <CodeBlock
          language="xml"
          children={`<application>
  <meta-data android:name="dev.hyo.openiap.PROVIDER"
    android:value="com.example.billing.YourStoreFactory" />
</application>`}
        />
        <p>
          The factory needs a public no-argument constructor. Core supplies the
          R8 consumer keep rule and discovers classes in any namespace.
          Conflicting factory metadata fails manifest merging; do not override
          it with <code>tools:replace</code>.
        </p>
        <p>
          Choose a stable lowercase id containing letters, digits, and single
          dot, underscore, or hyphen separators. Reserved ids include{' '}
          <code>apple</code>, <code>auto</code>, <code>none</code>,{' '}
          <code>unknown</code>, and official Android ids. Avoid registry alias
          collisions.
        </p>
        <p>
          <code>OpenIapProtocol</code> and its referenced types are public API
          under SemVer. Future protocol members require default implementations.
          A stable provider can run on an equal or newer core within its major;
          prerelease cores require an exact match. Invalid factories and
          incompatible versions produce a typed{' '}
          <code>OpenIapError.ProviderConfiguration</code> developer error.
        </p>
        <p>
          Implement the generated handlers and listeners, emit normalized
          errors, and stamp both identity fields on every purchase and
          verification result. Declare only capabilities you implement:{' '}
          <code>pendingPurchases</code>, <code>subscriptionBillingIssue</code>,
          and <code>offerCodeRedemption</code>. Unsupported operations must
          return a documented unsupported result or{' '}
          <code>FeatureNotSupported</code>. The deprecated product-type filtered
          read has an unsupported default; prefer{' '}
          <code>getAvailablePurchases</code>.
        </p>
      </section>
      <section>
        <AnchorLink id="verify" level="h2">
          Run conformance in your CI
        </AnchorLink>
        <CodeBlock
          language="kotlin"
          children={`testImplementation("io.github.hyochan.openiap:openiap-conformance:${registry.suiteVersion}")`}
        />
        <p>
          Extend <code>ProviderConformanceSuite</code> with your factory, a
          fresh provider, and a <code>StoreConformanceAdapter</code> bound to
          your production error and entitlement mappers. Supply a sandbox SKU
          and an isolated test account. Implement <code>triggerCapability</code>{' '}
          to drive each declared capability after the suite attaches listeners.
        </p>
        <CodeBlock
          language="kotlin"
          children={`tasks.withType<Test>().configureEach {
  systemProperty("openiap.conformanceReport",
    layout.buildDirectory.file("reports/openiap/{storeId}.json").get().asFile.path)
}`}
        />
        <p>
          The report records executed results, <code>suiteVersion</code>,{' '}
          <code>clientProtocolVersion</code>, capabilities, and the required
          behavior scope. Missing, skipped required, or failed behaviors cannot
          pass. Declared capabilities add runtime checks for pending purchases,
          suspended subscriptions, and redemption events.
        </p>
        <p>
          The <code>android-provider</code> profile covers Android product,
          purchase, ownership, completion, identity, errors, and declared
          capabilities. It is narrower than the full server-lifecycle suite. An{' '}
          <code>android-mapping</code> report alone cannot promote a community
          provider.
        </p>
        <p>
          Start from the{' '}
          <a href="https://github.com/hyodotdev/openiap/tree/main/packages/google/compatibility/community-provider">
            independent fixture
          </a>
          . It consumes local Maven artifacts and includes a failing-capability
          check, a minified host, and a duplicate-provider build check.
        </p>
      </section>
      <section>
        <AnchorLink id="registry" level="h2">
          Register and maintain a provider
        </AnchorLink>
        <p>
          Optional registration adds aliases, generated constants, and a
          listing. Submit an entry in{' '}
          <a href="https://github.com/hyodotdev/openiap/blob/main/specs/client/src/store-registry.json">
            store-registry.json
          </a>{' '}
          with id, Android platform, display name, tier, maintainers,
          repository, fixed Maven coordinates, capabilities, and the latest
          report’s public URL and JSON.
        </p>
        <CodeBlock
          language="bash"
          children="bun run stores:generate\n(cd specs/client && bun run generate)\nbun run audit:stores\nbun audit:parity"
        />
        <p>
          <strong>Experimental</strong> entries have no passing report.{' '}
          <strong>Community</strong> entries carry a passing provider report for
          the current suite major. <strong>Official</strong> stores live in this
          monorepo and keep the existing capability matrix. Promotion to
          official requires a maintainer decision, vendor and maintenance
          review, and SDK parity verification.
        </p>
        <p>
          After adoption of a new suite major, an older passing report is marked
          outdated. CI marks it unmaintained after{' '}
          {registry.maintenanceWindowDays} days. The current major adoption date
          is {registry.suiteMajorAdoptionDate}; update the report to restore
          current community status.
        </p>
        <table>
          <thead>
            <tr>
              <th>Store</th>
              <th>Id</th>
              <th>Status</th>
              <th>Provider</th>
            </tr>
          </thead>
          <tbody>
            {registry.stores.map((store) => (
              <tr key={store.id}>
                <td>
                  <a href={store.repo}>{store.displayName}</a>
                  <div className="text-sm text-gray-500">
                    {store.maintainers.join(', ')}
                  </div>
                </td>
                <td>
                  <code>{store.id}</code>
                </td>
                <td>
                  {store.status}
                  {store.latestReport && (
                    <div>
                      <a href={store.latestReport}>Conformance report</a>
                    </div>
                  )}
                </td>
                <td>
                  <code>{store.coordinates}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
