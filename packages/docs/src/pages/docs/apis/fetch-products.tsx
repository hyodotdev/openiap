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
      <p>
        <strong>iOS:</strong> Wraps <code>Product.products(for:)</code>{' '}
        (StoreKit 2). Fetches the localized price/title for each SKU; throws if
        any SKU is invalid.{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/product/products(for:)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple docs
        </a>
        . <strong>Android:</strong> Calls{' '}
        <code>BillingClient.queryProductDetailsAsync</code> with the right{' '}
        <code>ProductType</code> (INAPP/SUBS) per request. Unknown SKUs return
        an empty list, not an error.{' '}
        <a
          href="https://developer.android.com/reference/com/android/billingclient/api/BillingClient#queryProductDetailsAsync(com.android.billingclient.api.QueryProductDetailsParams,com.android.billingclient.api.ProductDetailsResponseListener)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google docs
        </a>
        .
      </p>

      <AnchorLink id="request-apis" level="h2">
        Note about <code>request*</code> APIs
      </AnchorLink>
      <div className="alert-card alert-card--info">
        <p>
          ℹ️{' '}
          <strong>This note is about sibling APIs, not fetchProducts.</strong>{' '}
          <code>fetchProducts</code> itself is a regular promise-based call —
          its <code>Promise&lt;FetchProductsResult&gt;</code> return value{' '}
          <em>is</em> the canonical way to read the products you queried.
        </p>
        <p>
          Reader pitfall to be aware of: APIs in this library that <em>do</em>{' '}
          start with <code>request</code> (
          <Link to="/docs/apis/request-purchase">
            <code>requestPurchase</code>
          </Link>
          , <code>requestPurchaseOnPromotedProductIOS</code>) are{' '}
          <strong>event-based</strong>. Their return values are not the purchase
          result — listen via{' '}
          <Link to="/docs/events/purchase-updated-listener">
            <code>purchaseUpdatedListener</code>
          </Link>{' '}
          /{' '}
          <Link to="/docs/events/purchase-error-listener">
            <code>purchaseErrorListener</code>
          </Link>{' '}
          instead. This is because Apple's purchase system is fundamentally
          event-based; see{' '}
          <a
            href="https://github.com/hyochan/react-native-iap/issues/307#issuecomment-449208273"
            target="_blank"
            rel="noopener noreferrer"
          >
            this issue comment
          </a>
          .
        </p>
      </div>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`fetchProducts(params: ProductRequest): Promise<FetchProductsResult>

interface ProductRequest {
  skus: string[];
  type?: 'in-app' | 'subs' | 'all';  // Defaults to 'in-app'
}

// FetchProductsResult is the union returned by the canonical schema —
// the variant depends on the request \`type\`.
type FetchProductsResult =
  | Product[]
  | ProductSubscription[]
  | ProductOrSubscription[]
  | null;`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun fetchProducts(request: ProductRequest): FetchProductsResult`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun fetchProducts(request: ProductRequest): FetchProductsResult`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<FetchProductsResult> fetchProducts({
  required List<String> skus,
  ProductQueryType? type,
});`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`# Returns Array[Product] for IN_APP, Array[ProductSubscription] for SUBS,
# or a mixed Array for ALL — typed as Array because GDScript can't express
# heterogeneous element types.
func fetch_products(request: ProductRequest) -> Array`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>
        Pass a single{' '}
        <Link to="/docs/types/product-request">
          <code>ProductRequest</code>
        </Link>{' '}
        object:
      </p>
      <ul className="api-params">
        <li>
          <code>skus</code>{' '}
          <em>
            (required, <code>string[]</code>)
          </em>{' '}
          — Product identifiers to fetch.
        </li>
        <li>
          <code>type</code>{' '}
          <em>
            (optional, <code>'in-app' | 'subs' | 'all'</code>, default{' '}
            <code>'in-app'</code>)
          </em>{' '}
          — Filter by product kind. Use <code>'all'</code> to query both in one
          call.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;FetchProductsResult&gt;</code> — sealed union,
        discriminated by the request <code>type</code>:
      </p>
      <ul className="api-params">
        <li>
          <Link to="/docs/types/product">
            <code>Product[]</code>
          </Link>{' '}
          <em>
            (for <code>type: 'in-app'</code>)
          </em>{' '}
          — Array of one-time products. Empty array if none of the SKUs exist.
        </li>
        <li>
          <Link to="/docs/types/subscription-product">
            <code>ProductSubscription[]</code>
          </Link>{' '}
          <em>
            (for <code>type: 'subs'</code>)
          </em>{' '}
          — Array of subscription products with offer details.
        </li>
        <li>
          <code>(Product | ProductSubscription)[]</code>{' '}
          <em>
            (for <code>type: 'all'</code>)
          </em>{' '}
          — Mixed array; use each entry's <code>type</code> field to
          disambiguate.
        </li>
        <li>
          <code>null</code> <em>(legacy)</em> — Older schema branch retained for
          backwards compatibility.
        </li>
      </ul>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { fetchProducts } from 'expo-iap';
// Same API in react-native-iap:
// import { fetchProducts } from 'react-native-iap';

// Fetch one-time products
const products = await fetchProducts({
  skus: ['com.app.coins_100', 'com.app.premium'],
  type: 'in-app',
});

// Fetch subscriptions
const subscriptions = await fetchProducts({
  skus: ['com.app.monthly', 'com.app.yearly'],
  type: 'subs',
});

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
// The hook exposes fetchProducts plus a reactive products array that is
// populated whenever fetchProducts resolves.
import { useIAP } from 'expo-iap';

function ProductList() {
  const { products, fetchProducts } = useIAP();

  useEffect(() => {
    void fetchProducts({
      skus: ['com.app.coins_100', 'com.app.premium'],
      type: 'in-app',
    });
  }, [fetchProducts]);

  return (
    <View>
      {products.map((p) => (
        <Text key={p.id}>{p.title} — {p.displayPrice}</Text>
      ))}
    </View>
  );
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`let products = try await OpenIapModule.shared.fetchProducts(
    ProductRequest(skus: ["com.app.premium"], type: .inApp)
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
        <Link to="/docs/types/subscription-product">ProductSubscription</Link>
      </p>
    </div>
  );
}

export default FetchProducts;
