import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import DataTable, { type DataTableColumn } from '../../../components/DataTable';
import SEO from '../../../components/SEO';
import StoreProviderDiagram from './StoreProviderDiagram';
import StoreProviderExample from './StoreProviderExample';
import { examplePackage, repository } from './StoreProviderExampleData';
import { LIBRARIES } from '../../../lib/images';
import { OPENIAP_VERSIONS } from '../../../lib/versioning';
import registry from '../../../generated/store-registry.json';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

interface ProviderListing extends Omit<
  (typeof registry.stores)[number],
  'reports'
> {
  reports: { platform: string; url: string }[];
}
const STORE_LISTINGS: ProviderListing[] = registry.stores;

const SELECTION: Record<string, string> = {
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

interface SdkSelection {
  name: string;
  displayName: string;
  setupPath: string;
  configuration: string;
}

const SDK_SELECTIONS: SdkSelection[] = LIBRARIES.map((library) => ({
  ...library,
  configuration: SELECTION[library.name],
}));
const SDK_COLUMNS: DataTableColumn<SdkSelection>[] = [
  {
    header: 'SDK',
    cell: (row) => <Link to={row.setupPath}>{row.displayName}</Link>,
  },
  { header: 'Configuration', cell: (row) => row.configuration },
];
const STORE_COLUMNS: DataTableColumn<ProviderListing>[] = [
  {
    header: 'Store',
    cell: (store) => (
      <>
        <a href={store.repo}>{store.displayName}</a>
        <div className="text-sm text-gray-500">
          {store.maintainers.join(', ')}
        </div>
      </>
    ),
  },
  { header: 'Id', cell: (store) => <code>{store.id}</code> },
  {
    header: 'Status',
    cell: (store) => (
      <>
        {store.status}
        {store.reports.map((report) => (
          <div key={report.platform}>
            <a href={report.url}>{report.platform} conformance report</a>
          </div>
        ))}
      </>
    ),
  },
  { header: 'Provider', cell: (store) => <code>{store.coordinates}</code> },
];

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
        <AnchorLink id="expo-community-package" level="h2">
          Add a community package to an existing Expo app
        </AnchorLink>
        <p>
          Keep <code>expo-iap</code> and your purchase screens. Add the
          provider’s native package and configure the Android build to select
          it. This walkthrough uses the{' '}
          <a href={repository}>FireOS community example</a>; its repository name
          differs from its installation name, <code>{examplePackage.name}</code>
          . For a maintained FireOS app, use the{' '}
          <Link to="/docs/setup/store/amazon">official Amazon integration</Link>
          .
        </p>
        <ol>
          <li>
            <strong>Use a compatible Expo IAP build.</strong> This example
            requires Client Protocol 0.2 support. Released SDKs do not yet
            contain that contract; follow the README’s{' '}
            <a href={`${repository}#prepare-the-pinned-sdk-inputs`}>
              pinned public Expo and core inputs
            </a>{' '}
            first. Then, in your existing app, install the SDK tarball named in
            the prepared example’s <code>expo-iap</code> dependency:
            <CodeBlock
              language="bash"
              children={
                'bun add --exact /absolute/path/to/openiap-google-amazon-community/.local/expo-iap-HASH.tgz'
              }
            />
            Replace <code>expo-iap-HASH.tgz</code> with the actual tarball
            filename from <code>example/package.json</code>. Preparation only
            updates the example app; it does not upgrade your existing app.
            Check the{' '}
            <a
              href={`${repository}/blob/community-provider-v${examplePackage.version}/package.json`}
            >
              package’s peer dependencies
            </a>{' '}
            for compatible Expo and build-properties versions.
          </li>
          <li>
            <strong>Install from GitHub Packages.</strong> Configure an ignored{' '}
            <code>.npmrc</code> and a package-manager token with{' '}
            <code>read:packages</code>. Keep the token outside the app and Expo
            public environment variables.
            <CodeBlock
              language="properties"
              children={
                '@hyodotdev:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}'
              }
            />
            <CodeBlock
              language="bash"
              children={`bun add --exact ${examplePackage.name}@${examplePackage.version}`}
            />
            This command pins the{' '}
            <a
              href={`${repository}/blob/community-provider-v${examplePackage.version}/package.json`}
            >
              verified example distribution
            </a>
            , rather than installing from npmjs.org.
          </li>
          <li>
            <strong>Select one IAP plugin per build.</strong> Keep the{' '}
            <code>expo-iap</code> dependency and imports. Remove its existing
            plugin entry, put your current IAP options in one object, and add
            the selected entry in <code>app.config.js</code>. Keep your other
            plugins and app settings.
            <p>
              Move store selection out of the shared options: remove old{' '}
              <code>android.store</code>, <code>android.provider</code>,{' '}
              <code>modules.horizon</code>, <code>modules.amazon.fireOS</code>,{' '}
              <code>modules.amazon.vegaOS</code> and{' '}
              <code>android.amazon.vegaOS</code>. Unset the old{' '}
              <code>EXPO_IAP_FIREOS</code>, <code>EXPO_IAP_HORIZON</code> and{' '}
              <code>EXPO_IAP_VEGA</code> environment flags. Preserve unrelated
              options, including your Appstore public-key path.
            </p>
            <CodeBlock
              language="javascript"
              children={`const iapOptions = {\n  android: {\n    amazon: { appstoreKey: './keys/AppstoreAuthenticationKey.pem' },\n  },\n};\nconst community =\n  process.env.ORG_GRADLE_PROJECT_openiapStore === 'amazon-example';\n\nmodule.exports = ({ config }) => ({\n  ...config,\n  plugins: [\n    ...(config.plugins ?? []),\n    community\n      ? ['${examplePackage.name}', {\n          ...iapOptions,\n          openIapRepository: '/absolute/path/to/openiap-google-amazon-community/.local/maven',\n        }]\n      : ['expo-iap', {\n          ...iapOptions,\n          android: { ...iapOptions.android, store: 'play' },\n          enableLocalDev: true,\n          localPath: { android: '/absolute/path/to/openiap/packages/google' },\n        }],\n  ],\n});`}
            />
            Use the same store setting in your EAS profiles:
            <CodeBlock
              language="json"
              children={
                '{\n  "build": {\n    "play": {\n      "env": { "ORG_GRADLE_PROJECT_openiapStore": "google" }\n    },\n    "amazon-community": {\n      "env": { "ORG_GRADLE_PROJECT_openiapStore": "amazon-example" }\n    }\n  }\n}'
              }
            />
            Until compatible public releases exist, use EAS <code>--local</code>{' '}
            with the prepared inputs. The Play branch needs matching native
            sources; set <code>localPath.android</code> to{' '}
            <code>packages/google</code> in the same compatible OpenIAP checkout
            that prepared your Expo SDK. Once compatible SDK and native Play
            releases exist, remove <code>localPath</code> and set{' '}
            <code>enableLocalDev: false</code> to use the published packages.
            Remote workers need the prepared inputs and their own paths; local
            absolute paths are not uploaded automatically.
            <p>
              The community branch uses the installed provider and public core
              Maven artifacts, without native source includes. Its required{' '}
              <code>openIapRepository</code> points to the prepared core Maven
              artifacts; replace the placeholder with your absolute path. The
              plugin adds its bundled provider repository and uses the installed
              package’s native version. Keep the existing application id and
              registered catalog; retain <code>android.amazon.appstoreKey</code>{' '}
              for Appstore builds. See the{' '}
              <a href={`${repository}#install-this-example-package`}>
                installation guide
              </a>
              .
            </p>
          </li>
          <li>
            <strong>Rebuild the native Android app.</strong> Expo Go and a
            JavaScript reload cannot install a native provider.
            <CodeBlock
              language="bash"
              children={
                'export ORG_GRADLE_PROJECT_openiapStore=amazon-example\nbunx expo prebuild --platform android\nbunx expo run:android --device'
              }
            />
            Use <code>google</code> for a local Play build. Rerun prebuild and
            rebuild after switching the profile or updating the provider.
          </li>
          <li>
            <strong>Check the selected provider.</strong> Your existing{' '}
            <code>useIAP</code>, product, purchase, restore and finish APIs stay
            the same. Purchases from this example carry{' '}
            <code>store: 'unknown'</code> and{' '}
            <code>storeId: 'amazon-example'</code>. Configure the backend for
            Amazon receipt verification, grant entitlement only after valid
            verification, then finish. The native package does not install a
            server verification adapter. Follow the{' '}
            <a href={`${repository}#verify-before-finishing`}>
              verification flow
            </a>{' '}
            and{' '}
            <a href={`${repository}/blob/main/VERIFICATION.md`}>
              observed limits
            </a>
            .
          </li>
        </ol>
        <AnchorLink id="choose-community-package" level="h3">
          Choosing a Samsung, Huawei, or Xiaomi provider
        </AnchorLink>
        <p>
          We welcome community providers for stores such as Samsung, Huawei, and
          Xiaomi. OpenIAP does not yet supply or certify packages for these
          stores. Before installing a provider, expect its maintainer to
          publish:
        </p>
        <ul>
          <li>
            A native adapter for that store’s billing SDK, supported platforms
            and compatible OpenIAP core, Client Protocol and framework versions.
          </li>
          <li>
            A package name, fixed version, stable <code>storeId</code>, native
            Maven coordinates and repository, plus Expo plugin instructions or
            the <a href="#expo">store/provider configuration</a>.
          </li>
          <li>
            Store-specific application setup, catalog and authenticated backend
            verification instructions. A config plugin alone is not a billing
            implementation.
          </li>
          <li>
            A public conformance report and store test evidence, with supported
            capabilities and unverified purchase or subscription scenarios.
          </li>
        </ul>
        <p>
          Expect the same OpenIAP purchase APIs and events after native setup,
          with that provider’s <code>storeId</code> and capability behavior. One
          Android AAR can serve compatible framework SDKs; each app still needs
          its own configuration and rebuild. The Expo plugin configures Expo
          only, and Apple needs a separate Swift adapter.
        </p>
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
        <p>
          Reuse one Swift provider across compatible Apple framework SDKs.
          Android needs a separate native adapter; an Android AAR cannot run on
          Apple platforms. Each app must link and select its platform’s
          provider.
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
        <p>
          Implement the store SDK once in a native Android provider AAR. A
          community author can use <code>samsung</code>, <code>huawei</code>, or{' '}
          <code>xiaomi</code> as its stable <code>storeId</code>, with an
          implementation of that store&apos;s SDK. Compatible framework SDKs
          dispatch their existing purchase APIs and events through that
          contract; the provider author does not write a billing adapter for
          each framework. Each app still needs the native dependency, selection
          settings and a rebuild. An Expo config plugin does not configure the
          other frameworks.
        </p>
        <CodeBlock
          language="properties"
          children={
            'openiapStore=your-store\nopeniapProvider=com.example:openiap-your-store:1.0.0'
          }
        />
        <DataTable
          columns={SDK_COLUMNS}
          rows={SDK_SELECTIONS}
          rowKey={(row) => row.name}
        />
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
          working; an external provider requires an explicit pair. Invalid or
          incomplete selection fails the Android build, including Godot exports.
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
          <code>FeatureNotSupported</code>. Receipt verification preserves
          normalized provider error codes, including unsupported receipt
          verification. Handle that code by using the store’s supported server
          integration; a verification transport error does not invalidate the
          purchase. On failure, Godot plain verification returns null and emits{' '}
          <code>purchase_error</code>, while managed verification returns the
          code in <code>errors</code>. The deprecated product-type filtered read
          has an unsupported default; prefer <code>getAvailablePurchases</code>.
        </p>
        <p>
          An owned subscription does not establish automatic renewal. Leave{' '}
          <code>autoRenewingAndroid</code> null when the store cannot report it,
          and set the required compatibility hint <code>isAutoRenewing</code> to
          false. Use server verification for entitlement and expiry.
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
        <DataTable
          columns={STORE_COLUMNS}
          rows={STORE_LISTINGS}
          rowKey={(row) => row.id}
        />
      </section>
    </div>
  );
}
