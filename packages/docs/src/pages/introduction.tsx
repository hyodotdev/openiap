import { Link } from 'react-router-dom';
import CodeBlock from '../components/CodeBlock';
import LanguageTabs from '../components/LanguageTabs';
import SEO from '../components/SEO';

function Introduction() {
  return (
    <div className="page-container">
      <SEO
        title="Why OpenIAP"
        description="OpenIAP is a unified specification for in-app purchases across iOS, Android, and XR platforms. One GraphQL schema generates type-safe code for Swift, Kotlin, TypeScript, Dart, C#, and GDScript."
        path="/introduction"
        keywords="OpenIAP, in-app purchase specification, StoreKit 2, Google Play Billing, cross-platform IAP, type-safe IAP, GraphQL schema"
        includeAppSchema
      />
      <div className="content-wrapper">
        {/* Title */}
        <h1>Why OpenIAP</h1>
        <p className="intro-lead">
          OpenIAP is a unified specification for in-app purchases across iOS,
          Android, and XR platforms. One GraphQL schema generates type-safe
          native code for Swift, Kotlin, TypeScript, Dart, C#, and GDScript.
        </p>

        {/* The Problem */}
        <section className="intro-section">
          <h2>The Problem</h2>
          <p className="intro-text">
            In-app purchase implementations are fragmented across platforms and
            frameworks. Each library defines its own API surface, type
            definitions, and event patterns. This creates several challenges:
          </p>
          <ul className="intro-list">
            <li>
              <strong>Inconsistent APIs</strong> — Method names, parameter
              structures, and return types differ between{' '}
              <code>react-native-iap</code>, <code>flutter_inapp_purchase</code>
              , and other libraries
            </li>
            <li>
              <strong>Duplicated effort</strong> — Library maintainers
              independently solve the same problems (transaction handling, error
              codes, subscription lifecycle)
            </li>
            <li>
              <strong>Platform drift</strong> — When Apple adds StoreKit 2
              features or Google updates Play Billing, each library implements
              changes differently
            </li>
            <li>
              <strong>AI limitations</strong> — AI assistants cannot generate
              reliable IAP code because no two libraries work the same way
            </li>
          </ul>
          <p className="intro-text-secondary">
            New platforms like{' '}
            <a
              href="https://developer.apple.com/visionos/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Vision Pro
            </a>{' '}
            and <Link to="/docs/horizon-setup">Horizon OS</Link> compound this
            fragmentation.
          </p>
        </section>

        {/* The Solution */}
        <section className="intro-section">
          <h2>The Solution</h2>
          <p className="intro-text">
            OpenIAP provides a single source of truth for IAP implementations.
            The specification defines:
          </p>
          <ul className="intro-list">
            <li>
              <strong>Unified API methods</strong> —{' '}
              <Link to="/docs/apis/init-connection">
                <code>initConnection()</code>
              </Link>
              ,{' '}
              <Link to="/docs/apis/fetch-products">
                <code>fetchProducts()</code>
              </Link>
              ,{' '}
              <Link to="/docs/apis/request-purchase">
                <code>requestPurchase()</code>
              </Link>
              ,{' '}
              <Link to="/docs/apis/finish-transaction">
                <code>finishTransaction()</code>
              </Link>
            </li>
            <li>
              <strong>Shared type definitions</strong> —{' '}
              <Link to="/docs/types/product">
                <code>Product</code>
              </Link>
              ,{' '}
              <Link to="/docs/types/purchase">
                <code>Purchase</code>
              </Link>
              ,{' '}
              <Link to="/docs/types/ios/subscription-period-ios">
                <code>SubscriptionPeriod</code>
              </Link>
              ,{' '}
              <Link to="/docs/errors">
                <code>PurchaseError</code>
              </Link>
            </li>
            <li>
              <strong>Standard event patterns</strong> —{' '}
              <Link to="/docs/events/purchase-updated-listener">
                <code>purchaseUpdatedListener</code>
              </Link>
              ,{' '}
              <Link to="/docs/events/purchase-error-listener">
                <code>purchaseErrorListener</code>
              </Link>
            </li>
            <li>
              <strong>Platform-aware naming</strong> — Cross-platform types use
              no suffix, platform-specific use <code>IOS</code>/
              <code>Android</code> suffix
            </li>
          </ul>
        </section>

        {/* Architecture */}
        <section className="intro-section">
          <h2>Architecture</h2>
          <p className="intro-text">
            OpenIAP uses a schema-driven approach. A single GraphQL schema
            defines all types and operations, which are then generated into
            native code for each target platform.
          </p>

          <div className="intro-image-container">
            <Link to="/docs/ecosystem">
              <img
                src="/ecosystem.webp"
                alt="OpenIAP Architecture - GraphQL schema generates native modules"
                width={800}
                height={450}
                className="intro-image"
              />
            </Link>
            <p className="intro-image-caption">
              <Link to="/docs/ecosystem">View ecosystem documentation →</Link>
            </p>
          </div>

          <h3>Code Generation</h3>
          <p className="intro-text">
            The{' '}
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/gql"
              target="_blank"
              rel="noopener noreferrer"
            >
              <code>openiap-gql</code>
            </a>{' '}
            package contains the GraphQL schema and generators. Running{' '}
            <code>bun run generate</code> keeps these generated outputs in sync:
          </p>
          <div className="intro-code-output">
            <pre>
              {`packages/apple/Sources/Models/Types.swift    # Swift types
packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt  # Kotlin types
src/generated/types.ts                       # TypeScript types
src/generated/types.dart                     # Dart types
src/generated/types.gd                       # GDScript types
libraries/maui-iap/src/OpenIap.Maui/Types.cs # C# / MAUI types`}
            </pre>
          </div>

          <h3>Native Modules</h3>
          <p className="intro-text">
            Two native modules implement the specification on top of platform
            APIs:
          </p>
          <div className="native-module-grid">
            <div className="native-module-card">
              <strong>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/apple"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-apple
                </a>
              </strong>
              <p>
                Swift module built on{' '}
                <a
                  href="https://developer.apple.com/storekit/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  StoreKit 2
                </a>
                . Supports iOS 15+, macOS 12+, visionOS 1.0+.
              </p>
            </div>
            <div className="native-module-card">
              <strong>
                <a
                  href="https://github.com/hyodotdev/openiap/tree/main/packages/google"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap-google
                </a>
              </strong>
              <p>
                Kotlin module built on{' '}
                <a
                  href="https://developer.android.com/google/play/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Play Billing v8
                </a>
                . Supports Android 5.0+ (API 21+).
              </p>
            </div>
          </div>
        </section>

        {/* API Design */}
        <section className="intro-section">
          <h2>API Design</h2>

          <h3>Naming Conventions</h3>
          <p className="intro-text">
            OpenIAP uses consistent naming across all implementations:
          </p>
          <div className="intro-table-wrapper">
            <table className="intro-table">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Pattern</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cross-platform</td>
                  <td>
                    <code>functionName</code>
                  </td>
                  <td>
                    <Link to="/docs/apis/fetch-products">
                      <code>fetchProducts()</code>
                    </Link>
                    ,{' '}
                    <Link to="/docs/apis/request-purchase">
                      <code>requestPurchase()</code>
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td>iOS-only</td>
                  <td>
                    <code>functionNameIOS</code>
                  </td>
                  <td>
                    <Link to="/docs/apis/ios/sync-ios">
                      <code>syncIOS()</code>
                    </Link>
                    ,{' '}
                    <Link to="/docs/apis/ios/get-storefront-ios">
                      <code>getStorefrontIOS()</code>
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td>Android-only</td>
                  <td>
                    <code>functionNameAndroid</code>
                  </td>
                  <td>
                    <Link to="/docs/apis/android/acknowledge-purchase-android">
                      <code>acknowledgePurchaseAndroid()</code>
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Type Safety</h3>
          <p className="intro-text">
            Generated models preserve the same field model in every language.
            Statically typed targets get compile-time checks, and
            platform-specific fields use suffixes to prevent accidental
            cross-platform usage:
          </p>
          <LanguageTabs>
            {{
              swift: (
                <CodeBlock language="swift">{`func displayLabel(for product: Product) -> String {
    switch product {
    case let .productIos(ios):
        return ios.title + " " + ios.displayNameIOS

    case let .productAndroid(android):
        return android.title + " " + android.nameAndroid
    }
}`}</CodeBlock>
              ),
              kotlin: (
                <CodeBlock language="kotlin">{`fun displayLabel(product: Product): String = when (product) {
    is ProductIOS -> product.title + " " + product.displayNameIOS
    is ProductAndroid -> product.title + " " + product.nameAndroid
}`}</CodeBlock>
              ),
              typescript: (
                <CodeBlock language="typescript">{`function displayLabel(product: Product): string {
  if (product.platform === 'ios') {
    return product.title + ' ' + product.displayNameIOS;
  }

  return product.title + ' ' + product.nameAndroid;
}`}</CodeBlock>
              ),
              dart: (
                <CodeBlock language="dart">{`String displayLabel(Product product) {
  return switch (product) {
    ProductIOS(:final title, :final displayNameIOS) =>
      '$title $displayNameIOS',
    ProductAndroid(:final title, :final nameAndroid) =>
      '$title $nameAndroid',
  };
}`}</CodeBlock>
              ),
              csharp: (
                <CodeBlock language="csharp">{`string DisplayLabel(Product product) => product switch
{
    ProductIOS ios => $"{ios.Title} {ios.DisplayNameIOS}",
    ProductAndroid android => $"{android.Title} {android.NameAndroid}",
    _ => throw new ArgumentOutOfRangeException(nameof(product)),
};`}</CodeBlock>
              ),
              gdscript: (
                <CodeBlock language="gdscript">{`func display_label(product) -> String:
    if product is ProductIOS:
        return "%s %s" % [product.title, product.display_name_ios]

    if product is ProductAndroid:
        return "%s %s" % [product.title, product.name_android]

    return product.title`}</CodeBlock>
              ),
            }}
          </LanguageTabs>
        </section>

        {/* Purchase Flow */}
        <section className="intro-section">
          <h2>Purchase Flow</h2>
          <p className="intro-text">
            The standard purchase flow uses the same sequence across OpenIAP
            implementations:
          </p>
          <LanguageTabs>
            {{
              swift: (
                <CodeBlock language="swift">{`import OpenIap

let store = OpenIapModule.shared

try await store.initConnection()

let updates = Task {
    for await purchase in store.purchaseUpdates {
        guard await verifyPurchase(purchase) else { continue }
        await grantAccess(purchase.productId)
        try await store.finishTransaction(purchase, isConsumable: false)
    }
}

_ = try await store.fetchProducts(
    ProductRequest(skus: ["com.app.premium"], type: .inApp)
)

try await store.requestPurchase(
    RequestPurchaseProps(
        request: RequestPurchasePropsByPlatforms(
            apple: RequestPurchaseIosProps(sku: "com.app.premium")
        ),
        type: .inApp
    )
)

updates.cancel()
try await store.endConnection()`}</CodeBlock>
              ),
              kotlin: (
                <CodeBlock language="kotlin">{`import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.*

val store = OpenIapStore(context)

store.initConnection(null)

val updates = scope.launch {
    store.purchaseUpdates.collect { purchase ->
        if (verifyPurchase(purchase)) {
            grantAccess(purchase.productId)
            store.finishTransaction(purchase, isConsumable = false)
        }
    }
}

store.fetchProducts(
    ProductRequest(
        skus = listOf("com.app.premium"),
        type = ProductQueryType.InApp
    )
)

store.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchasePropsByPlatforms(
            google = RequestPurchaseAndroidProps(
                skus = listOf("com.app.premium")
            )
        ),
        type = ProductQueryType.InApp
    )
)

updates.cancel()
store.endConnection()`}</CodeBlock>
              ),
              typescript: (
                <CodeBlock language="typescript">{`import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  endConnection,
} from 'expo-iap';

await initConnection();

const subscription = purchaseUpdatedListener(async (purchase) => {
  if (await verifyPurchase(purchase)) {
    await grantAccess(purchase.productId);
    await finishTransaction({ purchase, isConsumable: false });
  }
});

await fetchProducts({
  skus: ['com.app.premium'],
  type: 'in-app',
});

await requestPurchase({
  request: {
    apple: { sku: 'com.app.premium' },
    google: { skus: ['com.app.premium'] },
  },
  type: 'in-app',
});

subscription.remove();
await endConnection();`}</CodeBlock>
              ),
              dart: (
                <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final iap = FlutterInappPurchase.instance;

await iap.initConnection();

final subscription =
    FlutterInappPurchase.purchaseUpdatedStream.listen((purchase) async {
  if (purchase == null) return;

  if (await verifyPurchase(purchase)) {
    await grantAccess(purchase.productId);
    await iap.finishTransaction(purchase, isConsumable: false);
  }
});

await iap.fetchProducts(
  skus: ['com.app.premium'],
  type: ProductQueryType.InApp,
);

await iap.requestPurchase(
  RequestPurchaseProps(
    request: RequestPurchasePropsByPlatforms(
      apple: RequestPurchaseIosProps(sku: 'com.app.premium'),
      google: RequestPurchaseAndroidProps(skus: ['com.app.premium']),
    ),
    type: ProductQueryType.InApp,
  ),
);

await subscription.cancel();
await iap.endConnection();`}</CodeBlock>
              ),
              csharp: (
                <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var iap = Iap.Instance;
var query = (QueryResolver)iap;
var mutation = (MutationResolver)iap;

await mutation.InitConnectionAsync();

var subscription = iap.PurchaseUpdated.Subscribe(async purchase =>
{
    var verified = await VerifyPurchaseAsync(purchase);
    if (!verified) return;

    if (purchase is PurchaseCommon common)
    {
        await GrantAccessAsync(common.ProductId);
    }

    await mutation.FinishTransactionAsync(
        new PurchaseInput(purchase),
        isConsumable: false);
});

await query.FetchProductsAsync(new ProductRequest
{
    Skus = new[] { "com.app.premium" },
    Type = ProductQueryType.InApp,
});

await mutation.RequestPurchaseAsync(new RequestPurchaseProps
{
    RequestPurchase = new RequestPurchasePropsByPlatforms
    {
        Apple = new RequestPurchaseIosProps { Sku = "com.app.premium" },
        Google = new RequestPurchaseAndroidProps
        {
            Skus = new[] { "com.app.premium" },
        },
    },
    Type = ProductQueryType.InApp,
});

subscription.Dispose();
await mutation.EndConnectionAsync();`}</CodeBlock>
              ),
              gdscript: (
                <CodeBlock language="gdscript">{`await iap.init_connection()

iap.purchase_updated.connect(func(purchase):
    if await verify_purchase(purchase):
        await grant_access(purchase.product_id)
        await iap.finish_transaction(purchase, false)
)

var request = ProductRequest.new()
request.skus = ["com.app.premium"]
request.type = ProductQueryType.IN_APP
await iap.fetch_products(request)

var props = RequestPurchaseProps.new()
props.request = RequestPurchasePropsByPlatforms.new()
props.request.apple = RequestPurchaseIosProps.new()
props.request.apple.sku = "com.app.premium"
props.type = ProductQueryType.IN_APP
await iap.request_purchase(props)

await iap.end_connection()`}</CodeBlock>
              ),
            }}
          </LanguageTabs>
          <p className="intro-text-note">
            See <Link to="/docs/lifecycle">Purchase Lifecycle</Link> for
            detailed flow documentation.
          </p>
        </section>

        {/* Supported Platforms */}
        <section className="intro-section">
          <h2>Supported Platforms</h2>
          <div className="intro-table-wrapper">
            <table className="intro-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Billing API</th>
                  <th>Min Version</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>iOS</td>
                  <td>
                    <a
                      href="https://developer.apple.com/storekit/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      StoreKit 2
                    </a>
                  </td>
                  <td>iOS 15.0+</td>
                </tr>
                <tr>
                  <td>macOS</td>
                  <td>StoreKit 2</td>
                  <td>macOS 12.0+</td>
                </tr>
                <tr>
                  <td>visionOS</td>
                  <td>StoreKit 2</td>
                  <td>visionOS 1.0+</td>
                </tr>
                <tr>
                  <td>Android</td>
                  <td>
                    <a
                      href="https://developer.android.com/google/play/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Play Billing v8
                    </a>
                  </td>
                  <td>API 21+ (5.0)</td>
                </tr>
                <tr>
                  <td>Meta Quest</td>
                  <td>
                    <Link to="/docs/horizon-setup">Horizon OS</Link>
                  </td>
                  <td>Quest 2+</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Framework Implementations */}
        <section className="intro-section">
          <h2>Framework Implementations</h2>
          <p className="intro-text">
            Production-ready libraries implementing the OpenIAP specification:
          </p>
          <div className="intro-table-wrapper">
            <table className="intro-table">
              <thead>
                <tr>
                  <th>Library</th>
                  <th>Framework</th>
                  <th>Bridge</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <a
                      href="https://github.com/hyodotdev/openiap/tree/main/libraries/expo-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      expo-iap
                    </a>
                  </td>
                  <td>Expo</td>
                  <td>
                    <a
                      href="https://docs.expo.dev/modules/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Expo Modules
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://github.com/hyodotdev/openiap/tree/main/libraries/react-native-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      react-native-iap
                    </a>
                  </td>
                  <td>React Native</td>
                  <td>
                    <a
                      href="https://github.com/margelo/nitro"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Nitro Modules
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://github.com/hyodotdev/openiap/tree/main/libraries/flutter_inapp_purchase"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      flutter_inapp_purchase
                    </a>
                  </td>
                  <td>Flutter</td>
                  <td>
                    <a
                      href="https://pub.dev/packages/pigeon"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Pigeon
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://github.com/hyodotdev/openiap/tree/main/libraries/kmp-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      kmp-iap
                    </a>
                  </td>
                  <td>Kotlin Multiplatform</td>
                  <td>
                    <a
                      href="https://kotlinlang.org/docs/native-objc-interop.html"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      K/N Interop
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://github.com/hyodotdev/openiap/tree/main/libraries/maui-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      maui-iap
                    </a>
                  </td>
                  <td>.NET MAUI</td>
                  <td>
                    <a
                      href="https://learn.microsoft.com/dotnet/maui/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      .NET MAUI
                    </a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://github.com/hyodotdev/openiap/tree/main/libraries/godot-iap"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      godot-iap
                    </a>
                  </td>
                  <td>Godot 4.x</td>
                  <td>
                    <a
                      href="https://docs.godotengine.org/en/stable/tutorials/plugins/editor/gdextension.html"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      GDExtension
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="intro-text-secondary">
            <Link to="/languages">View all implementations →</Link>
          </p>
        </section>

        {/* Getting Started */}
        <section className="intro-section">
          <h2>Getting Started</h2>
          <p className="intro-text">Choose your framework to get started:</p>
          <div className="getting-started-grid">
            <Link to="/docs/apis" className="getting-started-card">
              <strong>API Reference</strong>
              <p>Core methods and patterns</p>
            </Link>
            <Link to="/docs/types" className="getting-started-card">
              <strong>Type Definitions</strong>
              <p>Generated types for all languages</p>
            </Link>
            <Link to="/docs/lifecycle" className="getting-started-card">
              <strong>Purchase Lifecycle</strong>
              <p>Transaction flow diagrams</p>
            </Link>
            <Link to="/tutorials" className="getting-started-card">
              <strong>Tutorials</strong>
              <p>Step-by-step guides</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Introduction;
