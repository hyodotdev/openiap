import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function ProductsAPIs() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Product APIs"
        description="OpenIAP product management APIs - fetchProducts and getAvailablePurchases for retrieving product information and user purchases."
        path="/docs/apis/products"
        keywords="fetchProducts, getAvailablePurchases, product info, SKU"
      />
      <h1>Product APIs</h1>
      <p>
        Retrieve product information and user's available purchases from the
        store.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <code>fetchProducts</code>: Get product details (price, title,
            description)
          </li>
          <li>
            <code>getAvailablePurchases</code>: Get user's unfinished purchases
          </li>
          <li>
            Use <code>type: 'subs'</code> for subscriptions,{' '}
            <code>'inapp'</code> for one-time purchases
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="fetch-products" level="h2">
          fetchProducts
        </AnchorLink>
        <p>Retrieve products or subscriptions from the store by SKU.</p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`fetchProducts(params: ProductRequest): Promise<Product[]>

interface ProductRequest {
  skus: string[];
  type?: 'inapp' | 'subs' | 'all';  // Defaults to 'inapp'
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func fetchProducts(_ request: ProductRequest) async throws -> [Product]`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun fetchProducts(request: ProductRequest): List<Product>`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<List<Product>> fetchProducts(ProductRequest request);`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { fetchProducts } from 'expo-iap';

// Fetch one-time products
const products = await fetchProducts({
  skus: ['com.app.coins_100', 'com.app.premium'],
  type: 'inapp',
});

// Fetch subscriptions
const subscriptions = await fetchProducts({
  skus: ['com.app.monthly', 'com.app.yearly'],
  type: 'subs',
});

// Display to user
products.forEach(product => {
  console.log(\`\${product.title}: \${product.localizedPrice}\`);
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
            dart: (
              <CodeBlock language="dart">{`final products = await FlutterInappPurchase.instance.getProducts(
  ['com.app.premium'],
);`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <p className="type-link">
          See: <Link to="/docs/types#product">Product</Link>,{' '}
          <Link to="/docs/types#subscription-product">SubscriptionProduct</Link>
        </p>
      </section>

      <section>
        <AnchorLink id="get-available-purchases" level="h2">
          getAvailablePurchases
        </AnchorLink>
        <p>
          Get all available (unfinished) purchases for the current user. Use
          this to restore purchases or check for pending transactions.
        </p>

        <h4>Signature</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`getAvailablePurchases(options?: PurchaseOptions): Promise<Purchase[]>

interface PurchaseOptions {
  alsoPublishToEventListenerIOS?: boolean;  // iOS only
  onlyIncludeActiveItemsIOS?: boolean;      // iOS only
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`func getAvailablePurchases(options: PurchaseOptions? = nil) async throws -> [Purchase]`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`suspend fun getAvailablePurchases(): List<Purchase>`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`Future<List<Purchase>> getAvailablePurchases({PurchaseOptions? options});`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <h4>What it returns</h4>
        <ul>
          <li>
            <strong>Consumables:</strong> Products not yet consumed
          </li>
          <li>
            <strong>Non-consumables:</strong> Products not yet finished
          </li>
          <li>
            <strong>Subscriptions:</strong> Currently active subscriptions
          </li>
        </ul>

        <h4>Example</h4>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`import { getAvailablePurchases, finishTransaction } from 'expo-iap';

// Check for pending purchases on app launch
const purchases = await getAvailablePurchases();

for (const purchase of purchases) {
  // Verify and finish each pending purchase
  const verified = await verifyOnServer(purchase);
  if (verified) {
    await finishTransaction(purchase, false);
  }
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`let purchases = try await OpenIapModule.shared.getAvailablePurchases()`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`val purchases = openIapStore.getAvailablePurchases()`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final purchases = await FlutterInappPurchase.instance.getAvailablePurchases();`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <div className="alert-card alert-card--warning">
          <p>
            <strong>Android limitation:</strong> For subscriptions with multiple
            base plans, the <code>currentPlanId</code> field may be inaccurate.
            See{' '}
            <Link to="/docs/apis/debugging#android-baseplanid-limitation">
              basePlanId limitation
            </Link>
            .
          </p>
        </div>

        <p className="type-link">
          See: <Link to="/docs/types#purchase">Purchase</Link>
        </p>
      </section>
    </div>
  );
}

export default ProductsAPIs;
