import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import StoreConnectionCallout from '../../../components/StoreConnectionCallout';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function RequestPurchase() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="requestPurchase"
        description="Initiate a purchase flow. The result is delivered through purchaseUpdatedListener, not the return value."
        path="/docs/apis/request-purchase"
        keywords="requestPurchase, purchase flow, RequestPurchaseProps"
      />
      <h1>requestPurchase</h1>
      <p>
        Initiate a purchase flow. The result is delivered through
        purchaseUpdatedListener, not the return value.
      </p>
      <p>
        <strong>iOS:</strong> Calls <code>Product.purchase(options:)</code> and
        emits the result on the <code>Transaction.updates</code> listener — the
        return value is just the dispatch ack.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/product/purchase(options:)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple docs
        </a>
        . <strong>Android:</strong> Calls{' '}
        <code>BillingClient.launchBillingFlow</code> and emits the result on{' '}
        <code>PurchasesUpdatedListener</code>. Subscription offers require an{' '}
        <code>offerToken</code>.{' '}
        <a
          href="https://developer.android.com/reference/com/android/billingclient/api/BillingClient#launchBillingFlow(android.app.Activity,com.android.billingclient.api.BillingFlowParams)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google docs
        </a>
        .
      </p>

      <Callout kind="important">
        <p>
          APIs starting with <code>request</code> are event-based operations,
          not promise-based.
        </p>
        <p>
          While these APIs return values for various purposes, you should{' '}
          <strong>
            not rely on their return values for actual purchase results
          </strong>
          . Instead, listen for events through{' '}
          <Link to="/docs/events/purchase-updated-listener">
            <code>purchaseUpdatedListener</code>
          </Link>{' '}
          or{' '}
          <Link to="/docs/events/purchase-error-listener">
            <code>purchaseErrorListener</code>
          </Link>
          .
        </p>
        <p>
          This is because Apple's purchase system is fundamentally event-based,
          not promise-based. For more details, see{' '}
          <a
            href="https://github.com/hyochan/react-native-iap/issues/307#issuecomment-449208273"
            target="_blank"
            rel="noopener noreferrer"
          >
            this issue comment
          </a>
          .
        </p>
        <p>
          The <code>request</code> prefix indicates that these are event
          requests — use the appropriate listeners to handle the actual results.
        </p>
      </Callout>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`requestPurchase(props: RequestPurchaseProps): Promise<Purchase | void>

type RequestPurchaseProps =
  | { request: RequestPurchasePropsByPlatforms; type: 'in-app' }
  | { request: RequestSubscriptionPropsByPlatforms; type: 'subs' }`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func requestPurchase(_ params: RequestPurchaseProps) async throws -> RequestPurchaseResult?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun requestPurchase(params: RequestPurchaseProps): RequestPurchaseResult?`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun requestPurchase(params: RequestPurchaseProps): RequestPurchaseResult?`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<RequestPurchaseResult?> requestPurchase(RequestPurchaseProps params);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func request_purchase(props: RequestPurchaseProps) -> Purchase`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<RequestPurchaseResult?> RequestPurchaseAsync(RequestPurchaseProps @params);

// Result is event-based — listen via OpenIapClient.Instance.PurchaseUpdated /
// PurchaseError. The return value describes the request dispatch result.`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <StoreConnectionCallout purchaseErrorEvent />

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>
        Pass a single{' '}
        <Link to="/docs/types/request-purchase-props">
          <code>RequestPurchaseProps</code>
        </Link>
        , discriminated by <code>type</code>:
      </p>
      <ul className="api-params">
        <li>
          <code>type</code>{' '}
          <em>
            (required, <code>'in-app' | 'subs'</code>)
          </em>{' '}
          — Selects the request shape. Use <code>'in-app'</code> for one-time
          products and <code>'subs'</code> for subscriptions.
        </li>
        <li>
          <code>request.apple.sku</code>{' '}
          <em>
            (iOS only, <code>string</code>)
          </em>{' '}
          — <strong>iOS.</strong> Single SKU for the iOS purchase.
        </li>
        <li>
          <code>request.apple.appAccountToken</code>{' '}
          <em>
            (optional, <code>string</code>)
          </em>{' '}
          — <strong>iOS.</strong> UUID-format account token forwarded to Apple.
          Non-UUID values land as <code>null</code> on the resulting{' '}
          <code>Purchase</code>.
        </li>
        <li>
          <code>request.apple.quantity</code>{' '}
          <em>
            (optional, <code>number</code>)
          </em>{' '}
          — <strong>iOS.</strong> Quantity for consumable bulk purchases.
        </li>
        <li>
          <code>request.apple.billingPlanType</code>{' '}
          <em>
            (subscriptions only, optional,{' '}
            <code>&apos;monthly&apos; | &apos;up-front&apos;</code>)
          </em>{' '}
          — <strong>iOS 26.4+.</strong> Selects the StoreKit subscription
          billing plan, such as monthly billing with a 12-month commitment. See{' '}
          <Link to="/docs/features/subscription#ios-commitment-billing-plans">
            iOS commitment billing plans
          </Link>
          .
        </li>
        <li>
          <code>request.google.skus</code>{' '}
          <em>
            (Android only, <code>string[]</code>)
          </em>{' '}
          — <strong>Android.</strong> Product SKUs to launch the Play purchase
          flow for.
        </li>
        <li>
          <code>request.google.subscriptionOffers</code>{' '}
          <em>
            (required for <code>'subs'</code>,{' '}
            <code>{`{ sku: string; offerToken: string }[]`}</code>)
          </em>{' '}
          — <strong>Android.</strong> Required for subscription requests; pair
          each SKU with its offerToken from <code>fetchProducts</code>.
        </li>
        <li>
          <code>request.google.obfuscatedAccountIdAndroid</code>{' '}
          <em>
            (optional, <code>string</code>)
          </em>{' '}
          — <strong>Android.</strong> Optional account identifier passed to
          Play.
        </li>
        <li>
          <code>request.google.obfuscatedProfileIdAndroid</code>{' '}
          <em>
            (optional, <code>string</code>)
          </em>{' '}
          — <strong>Android.</strong> Optional profile identifier passed to
          Play.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;Purchase | void&gt;</code> — dispatched purchase
        payload. <strong>Do not rely on this for the actual outcome</strong> —
        listen via{' '}
        <Link to="/docs/events/purchase-updated-listener">
          <code>purchaseUpdatedListener</code>
        </Link>{' '}
        /{' '}
        <Link to="/docs/events/purchase-error-listener">
          <code>purchaseErrorListener</code>
        </Link>{' '}
        instead.
      </p>

      <AnchorLink id="throws" level="h2">
        Throws
      </AnchorLink>
      <p>
        Invalid arguments or failures that prevent dispatch can reject the
        promise. Store outcomes are event-based in React Native; Android{' '}
        <code>not-prepared</code> arrives through{' '}
        <code>purchaseErrorListener</code> or the hook&apos;s{' '}
        <code>onPurchaseError</code> callback.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { initConnection, requestPurchase } from 'expo-iap';
// Same API in react-native-iap:
// import { initConnection, requestPurchase } from 'react-native-iap';

const connected = await initConnection();
if (!connected) throw new Error('Store connection failed');

// One-time product
await requestPurchase({
  request: {
    apple: { sku: 'com.app.premium' },
    google: { skus: ['com.app.premium'] },
  },
  type: 'in-app',
});

// Subscription
await requestPurchase({
  request: {
    apple: { sku: 'com.app.monthly' },
    google: {
      skus: ['com.app.monthly'],
      subscriptionOffers: [{ sku: 'com.app.monthly', offerToken: 'offer-token' }],
    },
  },
  type: 'subs',
});

// iOS subscription with monthly billing and a 12-month commitment
await requestPurchase({
  request: {
    apple: {
      sku: 'com.app.annual',
      billingPlanType: 'monthly',
    },
  },
  type: 'subs',
});

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// useIAP wires the purchase listeners for you and exposes the same
// requestPurchase function — handle the result inside onPurchaseSuccess.
import { useIAP } from 'expo-iap';

function BuyButton({ sku }: { sku: string }) {
  const { connected, requestPurchase } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      // verify + finishTransaction here
    },
    onPurchaseError: (error) => {
      console.warn('Purchase failed', error);
    },
  });

  return (
    <Button
      title="Buy"
      disabled={!connected}
      onPress={() => {
        void requestPurchase({
          request: { apple: { sku }, google: { skus: [sku] } },
          type: 'in-app',
        });
      }}
    />
  );
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`guard try await OpenIapModule.shared.initConnection() else { return }
try await OpenIapModule.shared.requestPurchase(
    RequestPurchaseProps(
        request: .purchase(RequestPurchasePropsByPlatforms(
            apple: RequestPurchaseIosProps(sku: "com.app.premium")
        )),
        type: .inApp
    )
)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`check(openIapStore.initConnection()) { "Store connection failed" }
openIapStore.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Purchase(
            RequestPurchasePropsByPlatforms(
                google = RequestPurchaseAndroidProps(skus = listOf("com.app.premium"))
            )
        ),
        type = ProductQueryType.InApp
    )
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`check(kmpIAP.initConnection()) { "Store connection failed" }
kmpIAP.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Purchase(
            RequestPurchasePropsByPlatforms(
                google = RequestPurchaseAndroidProps(skus = listOf("com.app.premium"))
            )
        ),
        type = ProductQueryType.InApp
    )
)

// --- Or via the DSL API ---
// Platform-specific options are configured inside apple { } / google { }
// blocks; you can include either or both depending on which stores you ship.
val purchase = kmpIAP.requestPurchase {
    apple {
        sku = "com.app.premium"
        quantity = 1
    }
    google {
        skus = listOf("com.app.premium")
    }
}

// Single-platform DSL (Android only)
kmpIAP.requestPurchase {
    google {
        skus = listOf("com.app.premium")
    }
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final connected = await FlutterInappPurchase.instance.initConnection();
if (!connected) throw StateError('Store connection failed');
await FlutterInappPurchase.instance.requestPurchase(
  RequestPurchaseProps.inApp((
    apple: RequestPurchaseIosProps(sku: 'com.app.premium'),
    google: RequestPurchaseAndroidProps(skus: ['com.app.premium']),
  )),
);

// --- Or via the builder DSL ---
// requestPurchaseWithBuilder mirrors the props above but lets you assign
// platform-specific fields fluently inside the build closure.
final iap = FlutterInappPurchase.instance;
await iap.requestPurchaseWithBuilder(
  build: (builder) {
    builder
      ..type = ProductQueryType.InApp
      ..android.skus = ['com.app.premium']
      ..ios.sku = 'com.app.premium';
  },
);

// Single-platform builder DSL (Android only)
await iap.requestPurchaseWithBuilder(
  build: (builder) {
    builder
      ..type = ProductQueryType.InApp
      ..android.skus = ['com.app.premium'];
  },
);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if not await iap.init_connection():
    push_error("Store connection failed")
    return

var props = RequestPurchaseProps.new()
props.request = RequestPurchasePropsByPlatforms.new()
props.request.apple = RequestPurchaseIosProps.new()
props.request.apple.sku = "com.app.premium"
props.type = ProductQueryType.IN_APP
await iap.request_purchase(props)`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Subscribe to results FIRST — requestPurchase is event-based.
OpenIapClient.Instance.PurchaseUpdated.Subscribe(async purchase => {
    // 1. Validate on your server, 2. Grant entitlement,
    // 3. Finish transaction (Android auto-refunds after 3 days otherwise!)
    await ((MutationResolver)OpenIapClient.Instance).FinishTransactionAsync(
        purchase: new PurchaseInput(purchase),
        isConsumable: true);
});

OpenIapClient.Instance.PurchaseError.Subscribe(error => {
    Console.WriteLine($"{error.Code}: {error.Message}");
});

if (!await ((MutationResolver)OpenIapClient.Instance).InitConnectionAsync())
    return;

// Then request the purchase
await ((MutationResolver)OpenIapClient.Instance).RequestPurchaseAsync(new RequestPurchaseProps {
    RequestPurchase = new RequestPurchasePropsByPlatforms {
        Apple = new RequestPurchaseIosProps { Sku = "com.app.premium" },
        Google = new RequestPurchaseAndroidProps { Skus = new[] { "com.app.premium" } },
    },
    Type = ProductQueryType.InApp,
});`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <Callout kind="important">
        requestPurchase is event-based, not promise-based. Listen for the result
        via{' '}
        <Link to="/docs/events/purchase-updated-listener">
          <code>purchaseUpdatedListener</code>
        </Link>{' '}
        /{' '}
        <Link to="/docs/events/purchase-error-listener">
          <code>purchaseErrorListener</code>
        </Link>
        .
      </Callout>

      <p className="type-link">
        See:{' '}
        <Link to="/docs/types/request-purchase-props">
          RequestPurchaseProps
        </Link>
      </p>
    </div>
  );
}

export default RequestPurchase;
