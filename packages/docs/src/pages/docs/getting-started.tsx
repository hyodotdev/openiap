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
        into your stack, head to <Link to="/docs/setup">Framework Setup</Link>.
      </p>

      <section>
        <AnchorLink id="1-pick-platform" level="h2">
          1. Configure the store
        </AnchorLink>
        <p>
          Every framework wraps the same store APIs, so the platform setup comes
          first. Finish these before installing any SDK:
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
          OpenIAP ships official SDKs for five frameworks. Pick the one your app
          uses — the API surface is identical across all of them.
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
        <AnchorLink id="4-key-concepts" level="h2">
          4. Key concepts
        </AnchorLink>
        <p>
          Two background reads make every framework guide easier to follow —
          skim them before you wire anything into production.
        </p>
        <ul>
          <li>
            <Link to="/docs/ecosystem">Ecosystem</Link> — how OpenIAP, the
            native packages (Apple / Google), and each framework SDK fit
            together. Read this first if you're choosing a stack.
          </li>
          <li>
            <Link to="/docs/lifecycle">Life Cycle</Link> — when to call{' '}
            <code>initConnection</code>, where to mount listeners, and when to
            call <code>finishTransaction</code>. Getting this wrong is the #1
            cause of "purchase succeeded but the user didn't get the
            entitlement" reports, so read it once even if you skip everything
            else.
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="5-how-the-docs-are-organized" level="h2">
          5. How the docs are organized
        </AnchorLink>
        <p>
          The sidebar groups content by intent. Once you know which group fits
          the question you're answering, navigation becomes muscle memory.
        </p>
        <ul>
          <li>
            <strong>
              <Link to="/docs/apis">APIs</Link>
            </strong>{' '}
            — flat reference, one page per function (<code>initConnection</code>
            , <code>fetchProducts</code>, <code>requestPurchase</code>, …).
            Cross-platform symbols live at the root; iOS- and Android-only
            symbols are grouped under{' '}
            <Link to="/docs/apis#ios-specific">iOS Specific</Link> /{' '}
            <Link to="/docs/apis#android-specific">Android Specific</Link>. Open
            a function page when you need its exact signature, params, and a
            copy-pasteable example.
          </li>
          <li>
            <strong>
              <Link to="/docs/types">Types</Link>
            </strong>{' '}
            — flat reference, one page per type (<code>Product</code>,{' '}
            <code>Purchase</code>, <code>RequestPurchaseProps</code>, …). Same
            iOS / Android grouping as APIs. Field tables auto-link to related
            types so you can chase a shape without leaving the docs.
          </li>
          <li>
            <strong>
              <Link to="/docs/features/purchase">Features</Link>
            </strong>{' '}
            — task-oriented walkthroughs, not reference. Each page covers a real
            flow end-to-end (<Link to="/docs/features/purchase">Purchase</Link>,{' '}
            <Link to="/docs/features/subscription">Subscription</Link>,{' '}
            <Link to="/docs/features/refund">Refund</Link>,{' '}
            <Link to="/docs/features/validation">Validation</Link>,{' '}
            <Link to="/docs/features/offer-code-redemption">
              Offer Code Redemption
            </Link>
            , …) with verification, edge cases, and platform notes. Open a
            Features page when you're shipping a flow, not just calling a
            function.
          </li>
          <li>
            <strong>
              <Link to="/docs/setup">Setup Guide</Link>
            </strong>{' '}
            — install + native config per framework (
            <Link to="/docs/setup/react-native">React Native</Link>,{' '}
            <Link to="/docs/setup/expo">Expo</Link>,{' '}
            <Link to="/docs/setup/flutter">Flutter</Link>,{' '}
            <Link to="/docs/setup/godot">Godot</Link>,{' '}
            <Link to="/docs/setup/kmp">Kotlin Multiplatform</Link>) plus the
            store-side configuration (<Link to="/docs/ios-setup">iOS</Link>,{' '}
            <Link to="/docs/android-setup">Android</Link>,{' '}
            <Link to="/docs/horizon-setup">Horizon OS</Link>).
          </li>
          <li>
            <strong>
              <Link to="/docs/events">Events</Link> &{' '}
              <Link to="/docs/errors">Errors</Link>
            </strong>{' '}
            — listener patterns and the unified <code>PurchaseError</code> codes
            that every SDK normalizes to.
          </li>
        </ul>
        <p>
          <strong>Rule of thumb:</strong> "How does this function work?" → APIs.
          "What does this object look like?" → Types. "How do I ship
          subscription upgrades?" → Features.
        </p>
      </section>

      <section>
        <AnchorLink id="6-where-next" level="h2">
          6. Where to go next
        </AnchorLink>
        <ul>
          <li>
            <Link to="/docs/features/purchase">Purchase</Link>,{' '}
            <Link to="/docs/features/subscription">Subscription</Link>,{' '}
            <Link to="/docs/features/refund">Refund</Link> — full feature
            walkthroughs
          </li>
          <li>
            <Link to="/docs/features/validation">Validation</Link> — server-side
            verification (your own backend or IAPKit)
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
