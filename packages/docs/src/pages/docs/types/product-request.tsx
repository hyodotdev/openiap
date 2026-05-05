import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function ProductRequest() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="ProductRequest"
        description="ProductRequest type definition and field reference."
        path="/docs/types/product-request"
        keywords="ProductRequest, OpenIAP types, Product Request"
      />
      <h1>ProductRequest</h1>
      <section>
        <AnchorLink id="product-request" level="h2">
          ProductRequest
        </AnchorLink>
        <p>
          Parameters for fetching products from the store via{' '}
          <Link to="/docs/apis/fetch-products">
            <code>fetchProducts()</code>
          </Link>
          .
        </p>
        <p>
          Input to <code>fetchProducts</code>. <strong>iOS:</strong> passed to{' '}
          <code>Product.products(for:)</code> (
          <a
            href="https://developer.apple.com/documentation/storekit/product/products(for:)"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple docs
          </a>
          ). <strong>Android:</strong> passed to{' '}
          <code>BillingClient.queryProductDetailsAsync</code> (
          <a
            href="https://developer.android.com/reference/com/android/billingclient/api/BillingClient#queryProductDetailsAsync(com.android.billingclient.api.QueryProductDetailsParams,com.android.billingclient.api.ProductDetailsResponseListener)"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google docs
          </a>
          ).
        </p>
        <p className="type-link">
          <strong>Native references:</strong>{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/product/products(for:)"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple · Product.products(for:)
          </a>
          {' · '}
          <a
            href="https://developer.android.com/reference/com/android/billingclient/api/QueryProductDetailsParams"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google · QueryProductDetailsParams
          </a>
        </p>

        <AnchorLink id="product-request-fields" level="h3">
          Fields
        </AnchorLink>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>skus</code>
              </td>
              <td>Array of product identifiers to fetch</td>
            </tr>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>
                Product type filter (optional): <code>"in-app"</code> (default),{' '}
                <code>"subs"</code>, or <code>"all"</code>
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="product-request-example" level="h3">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Fetch in-app purchases (default)
const inappProducts = await fetchProducts({ skus: ["product1", "product2"] });

// Fetch only subscriptions
const subscriptions = await fetchProducts({
  skus: ["sub1", "sub2"],
  type: "subs"
});

// Fetch all products (both in-app and subscriptions)
const allProducts = await fetchProducts({
  skus: ["product1", "sub1"],
  type: "all"
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Fetch in-app purchases (default)
let inappProducts = try await OpenIapModule.shared.fetchProducts(
    ProductRequest(skus: ["product1", "product2"])
)

// Fetch only subscriptions
let subscriptions = try await OpenIapModule.shared.fetchProducts(
    ProductRequest(skus: ["sub1", "sub2"], type: .subs)
)

// Fetch all products (both in-app and subscriptions)
let allProducts = try await OpenIapModule.shared.fetchProducts(
    ProductRequest(skus: ["product1", "sub1"], type: .all)
)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Fetch in-app purchases (default)
val inappProducts = openIapStore.fetchProducts(
    ProductRequest(skus = listOf("product1", "product2"))
)

// Fetch only subscriptions
val subscriptions = openIapStore.fetchProducts(
    ProductRequest(skus = listOf("sub1", "sub2"), type = ProductQueryType.Subs)
)

// Fetch all products (both in-app and subscriptions)
val allProducts = openIapStore.fetchProducts(
    ProductRequest(skus = listOf("product1", "sub1"), type = ProductQueryType.All)
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Fetch in-app purchases (default)
final inappProducts = await FlutterInappPurchase.instance.fetchProducts(
  skus: ['product1', 'product2'],
);

// Fetch only subscriptions
final subscriptions = await FlutterInappPurchase.instance.fetchProducts(
  skus: ['sub1', 'sub2'],
  type: ProductQueryType.subs,
);

// Fetch all products (both in-app and subscriptions)
final allProducts = await FlutterInappPurchase.instance.fetchProducts(
  skus: ['product1', 'sub1'],
  type: ProductQueryType.all,
);`}</CodeBlock>
            ),
            csharp: (
              <CodeBlock language="csharp">{`using Hyo.OpenIap;
using Hyo.OpenIap.Maui;

// Fetch in-app purchases (default)
var inappProducts = await ((QueryResolver)OpenIap.Instance).FetchProductsAsync(
    ProductRequest(skus = new[] { "product1", "product2" })
)

// Fetch only subscriptions
var subscriptions = await ((QueryResolver)OpenIap.Instance).FetchProductsAsync(
    ProductRequest(skus = new[] { "sub1", "sub2" }, type = ProductQueryType.Subs)
)

// Fetch all products (both in-app and subscriptions)
var allProducts = await ((QueryResolver)OpenIap.Instance).FetchProductsAsync(
    ProductRequest(skus = new[] { "product1", "sub1" }, type = ProductQueryType.All)
)`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Fetch in-app purchases (default)
var request = ProductRequest.new()
request.skus = ["product1", "product2"]
var inapp_products = await iap.fetch_products(request)

# Fetch only subscriptions
var subs_request = ProductRequest.new()
subs_request.skus = ["sub1", "sub2"]
subs_request.type = ProductQueryType.SUBS
var subscriptions = await iap.fetch_products(subs_request)

# Fetch all products (both in-app and subscriptions)
var all_request = ProductRequest.new()
all_request.skus = ["product1", "sub1"]
all_request.type = ProductQueryType.ALL
var all_products = await iap.fetch_products(all_request)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>
    </div>
  );
}

export default ProductRequest;
