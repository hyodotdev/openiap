import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import SEO from '../../../components/SEO';
import StoreProviderDiagram from './StoreProviderDiagram';
import StoreProviderExample from './StoreProviderExample';
import { LIBRARIES } from '../../../lib/images';
import { OPENIAP_VERSIONS } from '../../../lib/versioning';
import registry from '../../../generated/store-registry.json';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

type ProviderListing = Omit<(typeof registry.stores)[number], 'reports'> & {
  reports: { platform: string; url: string }[];
};
const storeListings: ProviderListing[] = registry.stores;

const selection: Record<string, string> = {
  'react-native-iap': 'Set both properties in android/gradle.properties.',
  'expo-iap':
    'Set android.store and android.provider in the expo-iap config plugin, then prebuild.',
  flutter_inapp_purchase:
    'Set both properties in android/gradle.properties. Keep openiapPlatform unset.',
  'kmp-iap':
    'Apply the OpenIAP Gradle plugin and select the provider platform variant.',
  'godot-iap':
    'Set openiap/android_store and openiap/android_provider in the Android export preset, then export Android.',
  'maui-iap': 'Set OpenIapStore and OpenIapProvider in the app project.',
};

export default function StoreProviders() {
  useScrollToHash();
  return (
    <div className="doc-page">
      <SEO
        title="Community store providers"
        description="Build, verify, register, and select an independent Apple or Android store provider across all six OpenIAP SDKs."
        path="/docs/guides/store-providers"
      />
      <h1>Community store providers</h1>
      <p>
        Use an independently maintained Apple or Android store with any OpenIAP
        SDK. Both platform bindings follow the same provider contract.
        Registration is optional. Purchase APIs stay the same.
      </p>
      <p>
        A provider must already implement the store’s billing SDK. OpenIAP ships
        official Apple App Store, Play, Horizon, and Amazon providers.
      </p>
      <section>
        <AnchorLink id="architecture" level="h2">
          How providers fit together
        </AnchorLink>
        <StoreProviderDiagram />
      </section>
      <section>
        <AnchorLink id="amazon-example" level="h2">
          Try a real Amazon SDK binding
        </AnchorLink>
        <StoreProviderExample />
      </section>
      <section>
        <AnchorLink id="apple-selection" level="h2">
          Select an Apple provider
        </AnchorLink>
        <p>
          Link the provider’s Swift package, CocoaPod, or framework in your app
          and set this Info.plist key to its Objective-C factory class name.
          This applies to native apps and all six framework SDKs; their purchase
          APIs stay the same.
        </p>
        <CodeBlock
          language="xml"
          children={
            '<key>dev.hyo.openiap.PROVIDER</key>\n<string>YourStoreProviderFactory</string>'
          }
        />
        <p>
          Keep the provider class linked in Release builds. For a static
          provider, use the maintainer’s linker settings and retain a direct
          class reference in app startup, for example{' '}
          <code>NSStringFromClass(YourStoreProviderFactory.self)</code>. Verify
          discovery in an optimized app. An Info.plist string alone does not
          link a binary.
        </p>
        <p>
          Without this key, OpenIAP uses Apple App Store. An invalid explicit
          selection fails at connection; it never falls back to StoreKit. In
          Expo, explicit provider configuration takes precedence over automatic
          Onside detection. Existing Onside configuration remains supported.
        </p>
      </section>
      <section>
        <AnchorLink id="select" level="h2">
          Select an Android provider
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
          MAUI resolves the provider’s Maven runtime dependencies using the
          included Gradle wrapper and your Android Java SDK. NuGet owns its
          existing runtimes; a provider requiring newer versions reports a
          conflict so you can update those NuGet packages.
        </p>
        <p>For a provider outside Maven Central, add its repository:</p>
        <CodeBlock
          language="xml"
          children={`<ItemGroup>
  <OpenIapProviderRepository Include="https://your-store.example/maven" />
</ItemGroup>`}
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
          Registered ids have generated <code>StoreIds</code> constants. Include{' '}
          <code>storeId</code> when creating purchase or verification result
          objects manually. Previously saved official purchases without this
          field decode to their official id; community purchases require a valid
          explicit id.
        </p>
        <p>
          <Link to="/docs/types/purchase">Purchase fields</Link> ·{' '}
          <Link to="/docs/types/verify-purchase-with-provider-result">
            Verification result fields
          </Link>
          . Use the provider&apos;s authenticated server integration for receipt
          verification.
        </p>
      </section>
      <section>
        <AnchorLink id="apple-authoring" level="h2">
          Build an Apple provider
        </AnchorLink>
        <p>
          Implement <code>OpenIapModuleProtocol</code> in your own repository
          and publish a factory with a public no-argument initializer. Depend on
          the public <code>OpenIAP</code> product and your store SDK. Return
          your backend from <code>create()</code>; the app’s{' '}
          <code>OpenIapModule</code> facade owns selection.
        </p>
        <CodeBlock
          language="swift"
          children={`import Foundation
import OpenIAP

@objc(YourStoreProviderFactory)
public final class YourStoreProviderFactory: NSObject, OpenIapProviderFactory {
  public required override init() { super.init() }
  public var storeId: String { "your-store" }
  public var coreVersion: String { "${OPENIAP_VERSIONS.apple}" }
  public var clientProtocolVersion: String { "${OPENIAP_VERSIONS.clientProtocol}" }
  public var capabilities: Set<String> { ["pendingPurchases"] }
  public func create() throws -> any OpenIapModuleProtocol { YourStoreModule() }
}`}
        />
        <p>
          Return <code>PurchaseIOS</code> with <code>store = .unknown</code> and
          your concrete <code>storeId</code>. Use <code>request.apple</code> for
          Apple-platform purchase arguments, including community stores.
          Preserve opaque transaction IDs and receipts through listeners,
          ownership reads, and completion. Optional StoreKit-only methods
          default to
          <code>feature-not-supported</code>.
        </p>
        <p>
          On either platform, a failed <code>requestPurchase</code> emits one
          canonical purchase-error event before returning an empty result or
          throwing, and delivers no purchase. Event-based SDK callers depend on
          this behavior; conformance rejects missing or duplicate errors and
          contradictory purchase events.
        </p>
        <p>
          Both factories expose the generated{' '}
          <code>StoreProviderDescriptor</code>: store identity, platform, native
          core version, Client Protocol version, and capability ids. Native
          builds require the same stable core major and a runtime at least as
          new as the declared build. Prerelease versions require an exact match.
          Before Client Protocol 1.0, providers must also match its minor
          version. Declare the versions used to build the provider.
        </p>
        <p>
          Consume the <code>OpenIapConformance</code> Swift product in your test
          target. Implement <code>ProviderConformanceAdapter</code> with your
          real error and entitlement mappers and sandbox capability triggers.
          Run
          <code>ProviderConformanceSuite(adapter: adapter).run()</code>, assert
          <code>report.conformant</code>, and write the Codable report. The
          <code>apple-provider</code> and <code>android-provider</code> profiles
          share lifecycle, identity, error, ownership and capability
          requirements. Apple App Store advertises only capabilities supported
          by the current platform and OS version.
        </p>
        <p>
          Start from the{' '}
          <a href="https://github.com/hyodotdev/openiap/tree/main/packages/apple/compatibility/community-provider">
            independent Swift fixture
          </a>
          . It covers public imports, full completion payloads, listener
          cleanup, failing capability assertions, and metadata discovery in a
          Release consumer.
        </p>
      </section>
      <section>
        <AnchorLink id="build" level="h2">
          Build an Android provider
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
  override val coreVersion = "${OPENIAP_VERSIONS.google}"
  override val clientProtocolVersion = "${OPENIAP_VERSIONS.clientProtocol}"
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
          to drive each declared capability after the suite attaches listeners.{' '}
          For offer-code redemption, supply <code>redemptionActivity</code> from
          your host or Robolectric.
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
          with id, platform, display name, tier, maintainers, repository, fixed
          coordinates, capabilities, and the latest report’s public URL and
          JSON. Apple coordinates specify a Swift package URL, product, and
          exact version. A store supporting both platforms uses one id and a
          bindings object; each binding owns its coordinates, capabilities, and
          report.
        </p>
        <CodeBlock
          language="bash"
          children="bun run stores:generate\n(cd specs/client && bun run generate)\nbun run audit:stores\nbun audit:parity"
        />
        <p>
          <strong>Experimental</strong> entries have an unverified or failing
          platform binding. <strong>Community</strong> entries carry passing
          reports for every platform binding and the current suite major.{' '}
          <strong>Official</strong> stores live in this monorepo and keep the
          existing capability matrix. Promotion to official requires a
          maintainer decision, vendor and maintenance review, and SDK parity
          verification.
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
            {storeListings.map((store) => (
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
                  {store.reports.map((report) => (
                    <div key={report.platform}>
                      <a href={report.url}>
                        {report.platform} conformance report
                      </a>
                    </div>
                  ))}
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
