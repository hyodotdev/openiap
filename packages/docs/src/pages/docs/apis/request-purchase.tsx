import { Link } from 'react-router-dom';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
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
            <CodeBlock language="swift">{`func requestPurchase(_ props: RequestPurchaseProps) async throws -> Purchase?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun requestPurchase(props: RequestPurchaseProps): List<Purchase>`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun requestPurchase(props: RequestPurchaseProps): List<Purchase>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<Purchase?> requestPurchase(RequestPurchaseProps props);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func request_purchase(props: RequestPurchaseProps) -> Purchase`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { requestPurchase } from 'expo-iap';

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
});`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`try await OpenIapModule.shared.requestPurchase(
    RequestPurchaseProps(
        request: RequestPurchasePropsByPlatforms(
            apple: RequestPurchaseIosProps(sku: "com.app.premium")
        ),
        type: .inapp
    )
)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchasePropsByPlatforms(
            google = RequestPurchaseAndroidProps(skus = listOf("com.app.premium"))
        ),
        type = ProductQueryType.InApp
    )
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`kmpIAP.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchasePropsByPlatforms(
            google = RequestPurchaseAndroidProps(skus = listOf("com.app.premium"))
        ),
        type = ProductQueryType.InApp
    )
)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`await FlutterInappPurchase.instance.requestPurchase('com.app.premium');`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var props = RequestPurchaseProps.new()
props.request = RequestPurchasePropsByPlatforms.new()
props.request.apple = RequestPurchaseIosProps.new()
props.request.apple.sku = "com.app.premium"
props.type = ProductQueryType.IN_APP
await iap.request_purchase(props)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <div className="alert-card alert-card--warning">
        <p>
          <strong>Important:</strong> requestPurchase is event-based, not
          promise-based. Listen for the result via{' '}
          <code>purchaseUpdatedListener</code> /{' '}
          <code>purchaseErrorListener</code>.
        </p>
      </div>

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
