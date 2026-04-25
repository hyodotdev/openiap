import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function FetchProducts() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="fetchProducts"
        description="Retrieve products or subscriptions from the store by SKU."
        path="/docs/apis/fetch-products"
        keywords="fetchProducts, product info, SKU, ProductRequest"
      />
      <h1>fetchProducts</h1>
      <p>Retrieve products or subscriptions from the store by SKU.</p>

      <AnchorLink id="request-apis" level="h2">
        Request APIs
      </AnchorLink>
      <div className="alert-card alert-card--warning">
        <p>
          ⚠️ <strong>Important:</strong> APIs starting with{' '}
          <code>request</code> are event-based operations, not promise-based.
        </p>
        <p>
          While these APIs return values for various purposes, you should{' '}
          <strong>
            not rely on their return values for actual purchase results
          </strong>
          . Instead, listen for events through{' '}
          <Link to="/docs/events#purchase-updated-listener">
            <code>purchaseUpdatedListener</code>
          </Link>{' '}
          or{' '}
          <Link to="/docs/events#purchase-error-listener">
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
          requests — use the appropriate listeners to handle the actual
          results.
        </p>
      </div>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`fetchProducts(params: ProductRequest): Promise<Product[]>

interface ProductRequest {
  skus: string[];
  type?: 'in-app' | 'subs' | 'all';  // Defaults to 'in-app'
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func fetchProducts(_ request: ProductRequest) async throws -> [Product]`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun fetchProducts(request: ProductRequest): List<Product>`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun fetchProducts(request: ProductRequest): List<Product>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<FetchProductsResult> fetchProducts({
  required List<String> skus,
  ProductQueryType? type,
});`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func fetch_products(request: ProductRequest) -> Array[Product]`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import { fetchProducts } from 'expo-iap';

// Fetch one-time products
const products = await fetchProducts({
  skus: ['com.app.coins_100', 'com.app.premium'],
  type: 'in-app',
});

// Fetch subscriptions
const subscriptions = await fetchProducts({
  skus: ['com.app.monthly', 'com.app.yearly'],
  type: 'subs',
});`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let products = try await OpenIapModule.shared.fetchProducts(
    ProductRequest(skus: ["com.app.premium"], type: .inapp)
)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`val products = openIapStore.fetchProducts(
    ProductRequest(skus = listOf("com.app.premium"), type = ProductQueryType.InApp)
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP

val kmpIAP = KmpIAP()

val products = kmpIAP.fetchProducts(
    ProductRequest(skus = listOf("com.app.premium"), type = ProductQueryType.InApp)
)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`final FetchProductsResult result = await FlutterInappPurchase.instance.fetchProducts(
  skus: ['com.app.premium'],
  type: ProductQueryType.InApp,
);

// fetchProducts returns a sealed FetchProductsResult — unwrap by variant.
final List<Product> products = switch (result) {
  FetchProductsResultProducts(value: final list) => list ?? <Product>[],
  _ => <Product>[],
};`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`var request = ProductRequest.new()
request.skus = ["com.app.coins_100", "com.app.premium"]
request.type = ProductQueryType.IN_APP
var products = await iap.fetch_products(request)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p className="type-link">
        See: <Link to="/docs/types/product">Product</Link>,{' '}
        <Link to="/docs/types/subscription-product">SubscriptionProduct</Link>
      </p>
    </div>
  );
}

export default FetchProducts;
