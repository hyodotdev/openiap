import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import LanguageTabs from '../../components/LanguageTabs';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function GettingStarted() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Getting Started"
        description="Five-minute walkthrough of OpenIAP — pick a framework, install the SDK, run your first purchase flow."
        path="/docs/getting-started"
        keywords="OpenIAP, getting started, in-app purchase, IAP setup, react-native, expo, flutter, kotlin multiplatform, godot"
      />
      <h1>Getting Started</h1>
      <p>
        OpenIAP is a unified spec for in-app purchases on Apple, Google, and
        Meta Horizon. One GraphQL schema generates type-safe SDKs for
        TypeScript, Swift, Kotlin, Dart, and GDScript — so the same purchase
        flow works across every framework you ship in.
      </p>

      <p>
        This page is a five-minute walkthrough. If you'd rather jump straight
        into your stack, head to{' '}
        <Link to="/docs/setup">Framework Setup</Link>.
      </p>

      <section>
        <AnchorLink id="1-pick-platform" level="h2">
          1. Configure the store
        </AnchorLink>
        <p>
          Every framework wraps the same store APIs, so the platform setup
          comes first. Finish these before installing any SDK:
        </p>
        <ul>
          <li>
            <Link to="/docs/ios-setup">iOS Setup</Link> — App Store Connect
            agreement, capability, sandbox testers
          </li>
          <li>
            <Link to="/docs/android-setup">Android Setup</Link> — Play Console
            account, license testers, billing permission
          </li>
          <li>
            <Link to="/docs/horizon-setup">Horizon OS Setup</Link> — Meta
            Horizon Store dashboard
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="2-pick-framework" level="h2">
          2. Pick a framework
        </AnchorLink>
        <p>
          OpenIAP ships official SDKs for five frameworks. Pick the one your
          app uses — the API surface is identical across all of them.
        </p>
        <ul>
          <li>
            <Link to="/docs/setup/react-native">react-native-iap</Link> — bare
            React Native CLI projects (RN 0.79+)
          </li>
          <li>
            <Link to="/docs/setup/expo">expo-iap</Link> — Expo SDK projects
          </li>
          <li>
            <Link to="/docs/setup/flutter">flutter_inapp_purchase</Link> —
            Flutter / Dart
          </li>
          <li>
            <Link to="/docs/setup/godot">godot-iap</Link> — Godot 4.x
          </li>
          <li>
            <Link to="/docs/setup/kmp">kmp-iap</Link> — Kotlin Multiplatform /
            Compose Multiplatform
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="3-first-purchase" level="h2">
          3. Your first purchase flow
        </AnchorLink>
        <p>
          The four-step flow below is the same on every framework — only the
          imports differ. Read{' '}
          <Link to="/docs/features/purchase">Features → Purchase</Link> for a
          full walkthrough with verification, error handling, and
          consumable/non-consumable nuances.
        </p>

        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  verifyPurchase,
} from 'expo-iap';

// 1. Open the store connection on app start.
await initConnection();

// 2. Fetch products by SKU.
const products = await fetchProducts({
  skus: ['com.app.premium'],
  type: 'in-app',
});

// 3. Listen for purchase results — requestPurchase is event-based.
purchaseUpdatedListener(async (purchase) => {
  const { isValid } = await verifyPurchase({
    purchase,
    serverUrl: 'https://your-server.com/api/verify',
  });
  if (!isValid) return;

  await grantEntitlement(purchase.productId);
  await finishTransaction(purchase, /* isConsumable */ false);
});

// 4. Initiate a purchase.
await requestPurchase({
  request: {
    apple: { sku: 'com.app.premium' },
    google: { skus: ['com.app.premium'] },
  },
  type: 'in-app',
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`import OpenIap

let store = OpenIapModule.shared

// 1. Open the store connection on app start.
try await store.initConnection()

// 2. Fetch products by SKU.
let products = try await store.fetchProducts(
    ProductRequest(skus: ["com.app.premium"], type: .inApp)
)

// 3. Listen for purchase results — requestPurchase is event-based.
store.onPurchaseSuccess = { purchase in
    Task {
        // Verify on your backend, grant entitlement, then finish.
        try await store.finishTransaction(purchase, isConsumable: false)
    }
}

// 4. Initiate a purchase.
try await store.requestPurchase(
    RequestPurchaseProps(
        request: RequestPurchasePropsByPlatforms(
            apple: RequestPurchaseIosProps(sku: "com.app.premium")
        ),
        type: .inApp
    )
)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.*

val store = OpenIapStore(context)

// 1. Open the store connection on app start.
store.initConnection(null)

// 2. Fetch products by SKU.
val products = store.fetchProducts(
    ProductRequest(
        skus = listOf("com.app.premium"),
        type = ProductQueryType.InApp
    )
)

// 3. Listen for purchase results.
scope.launch {
    store.purchaseFlow.collect { purchase ->
        // Verify on your backend, grant entitlement, then finish.
        store.finishTransaction(purchase, isConsumable = false)
    }
}

// 4. Initiate a purchase.
store.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchasePropsByPlatforms(
            google = RequestPurchaseAndroidProps(skus = listOf("com.app.premium"))
        ),
        type = ProductQueryType.InApp
    )
)`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.kmpIAP
import io.github.hyochan.kmpiap.types.*

// 1. Open the store connection on app start.
kmpIAP.initConnection()

// 2. Fetch products by SKU.
val products = kmpIAP.fetchProducts(
    ProductRequest(
        skus = listOf("com.app.premium"),
        type = ProductQueryType.InApp
    )
)

// 3. Listen for purchase results.
scope.launch {
    kmpIAP.purchaseUpdatedFlow.collect { purchase ->
        // Verify on your backend, grant entitlement, then finish.
        kmpIAP.finishTransaction(purchase, isConsumable = false)
    }
}

// 4. Initiate a purchase.
kmpIAP.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchasePropsByPlatforms(
            apple = RequestPurchaseIosProps(sku = "com.app.premium"),
            google = RequestPurchaseAndroidProps(skus = listOf("com.app.premium"))
        ),
        type = ProductQueryType.InApp
    )
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final iap = FlutterInappPurchase.instance;

// 1. Open the store connection on app start.
await iap.initConnection();

// 2. Fetch products by SKU.
final FetchProductsResult result = await iap.fetchProducts(
  skus: ['com.app.premium'],
  type: ProductQueryType.InApp,
);

// 3. Listen for purchase results.
FlutterInappPurchase.purchaseUpdatedStream.listen((purchase) async {
  if (purchase == null) return;
  // Verify on your backend, grant entitlement, then finish.
  await iap.finishTransaction(purchase, isConsumable: false);
});

// 4. Initiate a purchase.
await iap.requestPurchase(
  RequestPurchaseProps(
    request: RequestPurchasePropsByPlatforms(
      apple: RequestPurchaseIosProps(sku: 'com.app.premium'),
      google: RequestPurchaseAndroidProps(skus: ['com.app.premium']),
    ),
    type: ProductQueryType.inApp,
  ),
);`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# 1. Open the store connection on app start.
await iap.init_connection()

# 2. Fetch products by SKU.
var request = ProductRequest.new()
request.skus = ["com.app.premium"]
request.type = ProductQueryType.IN_APP
var products = await iap.fetch_products(request)

# 3. Listen for purchase results.
iap.purchase_updated.connect(func(purchase):
    # Verify on your backend, grant entitlement, then finish.
    await iap.finish_transaction(purchase, false)
)

# 4. Initiate a purchase.
var props = RequestPurchaseProps.new()
props.request = RequestPurchasePropsByPlatforms.new()
props.request.apple = RequestPurchaseIosProps.new()
props.request.apple.sku = "com.app.premium"
props.type = ProductQueryType.IN_APP
await iap.request_purchase(props)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="4-where-next" level="h2">
          4. Where to go next
        </AnchorLink>
        <ul>
          <li>
            <Link to="/docs/features/purchase">Purchase</Link>,{' '}
            <Link to="/docs/features/subscription">Subscription</Link>,{' '}
            <Link to="/docs/features/refund">Refund</Link> — full feature
            walkthroughs
          </li>
          <li>
            <Link to="/docs/features/validation">Validation</Link> —
            server-side verification (your own backend or IAPKit)
          </li>
          <li>
            <Link to="/docs/apis">API Reference</Link> — every function with
            cross-platform signatures
          </li>
          <li>
            <Link to="/docs/types">Types</Link> — every type with field tables
          </li>
          <li>
            <Link to="/docs/errors">Errors</Link> — unified{' '}
            <code>PurchaseError</code> codes
          </li>
        </ul>
      </section>
    </div>
  );
}

export default GettingStarted;
