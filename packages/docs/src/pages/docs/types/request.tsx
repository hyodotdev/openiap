import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function TypesRequest() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Request Types"
        description="OpenIAP Request type definitions - ProductRequest, RequestPurchaseProps, platform-specific purchase parameters for TypeScript, Swift, Kotlin, Dart."
        path="/docs/types/request"
        keywords="IAP types, ProductRequest, RequestPurchaseProps, TypeScript, Swift, Kotlin"
      />
      <h1>Request Types</h1>
      <p>
        Type definitions for requesting products and initiating purchases.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <a href="#product-request"><code>ProductRequest</code></a> - Parameters for fetchProducts()
          </li>
          <li>
            <a href="#request-purchase-props"><code>RequestPurchaseProps</code></a> - Top-level arguments for
            requestPurchase()
          </li>
          <li>
            <a href="#platform-specific-request-props">Platform-specific props</a> for Apple (iOS) and Google (Android)
          </li>
          <li>
            <a href="#subscription-request-props">Subscription-specific props</a> with upgrade/downgrade support
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="product-request" level="h2">
          ProductRequest
        </AnchorLink>
        <p>
          Parameters for fetching products from the store via{' '}
          <code>fetchProducts()</code>.
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

      <section>
        <AnchorLink id="request-types" level="h2">
          Request Types
        </AnchorLink>
        <p>
          Types used when initiating purchases via{' '}
          <code>requestPurchase()</code>.
        </p>

        <AnchorLink id="request-purchase-props" level="h3">
          RequestPurchaseProps
        </AnchorLink>
        <p>
          Top-level arguments for <code>requestPurchase()</code>. Wraps
          platform-specific props with a type discriminator.
        </p>
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
                <code>params</code>
              </td>
              <td>Platform-specific purchase parameters (see below)</td>
            </tr>
            <tr>
              <td>
                <code>type</code>
              </td>
              <td>
                Purchase type: <code>"in-app"</code> or <code>"subs"</code>
              </td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="request-purchase-example" level="h4">
          Usage Example
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// Standard in-app purchase
await requestPurchase({
  params: {
    apple: { sku: 'premium' },
    google: { skus: ['premium'] }
  },
  type: 'in-app'
});

// Subscription purchase
await requestPurchase({
  params: {
    apple: { sku: 'monthly_sub' },
    google: { skus: ['monthly_sub'] }
  },
  type: 'subs'
});`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`// Standard in-app purchase
try await OpenIapModule.shared.requestPurchase(
    RequestPurchaseProps(
        request: RequestPurchasePropsByPlatforms(
            apple: RequestPurchaseIosProps(sku: "premium")
        ),
        type: .inApp
    )
)

// Subscription purchase
try await OpenIapModule.shared.requestPurchase(
    RequestPurchaseProps(
        request: RequestPurchasePropsByPlatforms(
            apple: RequestPurchaseIosProps(sku: "monthly_sub")
        ),
        type: .subs
    )
)`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`// Standard in-app purchase
openIapStore.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchasePropsByPlatforms(
            google = RequestPurchaseAndroidProps(skus = listOf("premium"))
        ),
        type = ProductQueryType.InApp
    )
)

// Subscription purchase
openIapStore.requestPurchase(
    RequestPurchaseProps(
        request = RequestPurchasePropsByPlatforms(
            google = RequestPurchaseAndroidProps(skus = listOf("monthly_sub"))
        ),
        type = ProductQueryType.Subs
    )
)`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`// Standard in-app purchase
await FlutterInappPurchase.instance.requestPurchase(
  RequestPurchaseProps(
    request: RequestPurchasePropsByPlatforms(
      apple: RequestPurchaseIosProps(sku: 'premium'),
      google: RequestPurchaseAndroidProps(skus: ['premium']),
    ),
    type: ProductQueryType.inApp,
  ),
);

// Subscription purchase
await FlutterInappPurchase.instance.requestPurchase(
  RequestPurchaseProps(
    request: RequestPurchasePropsByPlatforms(
      apple: RequestPurchaseIosProps(sku: 'monthly_sub'),
      google: RequestPurchaseAndroidProps(skus: ['monthly_sub']),
    ),
    type: ProductQueryType.subs,
  ),
);`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# Standard in-app purchase
var props = RequestPurchaseProps.new()
props.request = RequestPurchasePropsByPlatforms.new()
props.request.apple = RequestPurchaseIosProps.new()
props.request.apple.sku = "premium"
props.request.google = RequestPurchaseAndroidProps.new()
props.request.google.skus = ["premium"]
props.type = ProductQueryType.IN_APP
await iap.request_purchase(props)

# Subscription purchase
var subs_props = RequestPurchaseProps.new()
subs_props.request = RequestSubscriptionPropsByPlatforms.new()
subs_props.request.apple = RequestSubscriptionIosProps.new()
subs_props.request.apple.sku = "monthly_sub"
subs_props.request.google = RequestSubscriptionAndroidProps.new()
subs_props.request.google.skus = ["monthly_sub"]
subs_props.type = ProductType.SUBS
await iap.request_purchase(subs_props)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>

        <AnchorLink id="request-purchase-props-by-platforms" level="h3">
          RequestPurchasePropsByPlatforms
        </AnchorLink>
        <p>
          Platform-specific request structure for regular purchases (in-app).
        </p>
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
                <code>apple</code>
              </td>
              <td>Apple purchase parameters (RequestPurchaseIosProps)</td>
            </tr>
            <tr>
              <td>
                <code>google</code>
              </td>
              <td>Google purchase parameters (RequestPurchaseAndroidProps)</td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>ios</code>{' '}
                <span style={{ color: 'var(--text-warning)', fontSize: '0.8em' }}>
                  (deprecated)
                </span>
              </td>
              <td>Use <code>apple</code> instead</td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>android</code>{' '}
                <span style={{ color: 'var(--text-warning)', fontSize: '0.8em' }}>
                  (deprecated)
                </span>
              </td>
              <td>Use <code>google</code> instead</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="request-subscription-props-by-platforms" level="h3">
          RequestSubscriptionPropsByPlatforms
        </AnchorLink>
        <p>Platform-specific request structure for subscriptions.</p>
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
                <code>apple</code>
              </td>
              <td>Apple subscription parameters (RequestSubscriptionIosProps)</td>
            </tr>
            <tr>
              <td>
                <code>google</code>
              </td>
              <td>
                Google subscription parameters
                (RequestSubscriptionAndroidProps)
              </td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>ios</code>{' '}
                <span style={{ color: 'var(--text-warning)', fontSize: '0.8em' }}>
                  (deprecated)
                </span>
              </td>
              <td>Use <code>apple</code> instead</td>
            </tr>
            <tr>
              <td>
                <code style={{ textDecoration: 'line-through' }}>android</code>{' '}
                <span style={{ color: 'var(--text-warning)', fontSize: '0.8em' }}>
                  (deprecated)
                </span>
              </td>
              <td>Use <code>google</code> instead</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="platform-specific-request-props" level="h3">
          Platform-Specific Request Props
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="request-purchase-ios-props" level="h4">
                  RequestPurchaseIosProps
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
                        <code>sku</code>
                      </td>
                      <td>Product identifier to purchase (required)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>
                          andDangerouslyFinishTransactionAutomatically
                        </code>
                      </td>
                      <td>
                        Auto-finish transaction without validation (use with
                        caution)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>appAccountToken</code>
                      </td>
                      <td>UUID linking purchase to your server's user</td>
                    </tr>
                    <tr>
                      <td>
                        <code>quantity</code>
                      </td>
                      <td>Number of items to purchase</td>
                    </tr>
                    <tr>
                      <td>
                        <code>withOffer</code>
                      </td>
                      <td>
                        Promotional/discount offer to apply (see DiscountOffer)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>advancedCommerceData</code>
                      </td>
                      <td>
                        Attribution data token for StoreKit 2's{' '}
                        <a
                          href="https://developer.apple.com/documentation/storekit/product/purchaseoption/custom(key:value:)"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Product.PurchaseOption.custom
                        </a>{' '}
                        API. Used for campaign tokens, affiliate IDs, or other
                        attribution data. (iOS 15+)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>externalPurchaseUrlOnIOS</code>
                      </td>
                      <td>
                        External payment URL (requires alternative billing)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
            android: (
              <>
                <AnchorLink id="request-purchase-android-props" level="h4">
                  RequestPurchaseAndroidProps
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
                      <td>Array of product identifiers (required)</td>
                    </tr>
                    <tr>
                      <td>
                        <code>offerTokenAndroid</code>
                      </td>
                      <td>
                        Offer token for one-time purchase discounts (Android 7.0+).
                        Pass the <code>offerToken</code> from{' '}
                        <code>oneTimePurchaseOfferDetailsAndroid</code> or{' '}
                        <code>discountOffers</code> to apply a discount.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>obfuscatedAccountIdAndroid</code>
                      </td>
                      <td>Obfuscated user account ID</td>
                    </tr>
                    <tr>
                      <td>
                        <code>obfuscatedProfileIdAndroid</code>
                      </td>
                      <td>Obfuscated user profile ID</td>
                    </tr>
                    <tr>
                      <td>
                        <code>isOfferPersonalizedAndroid</code>
                      </td>
                      <td>True if offer is personalized (EU compliance)</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="subscription-request-props" level="h3">
          Subscription Request Props
        </AnchorLink>
        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="request-subscription-ios-props" level="h4">
                  RequestSubscriptionIosProps
                </AnchorLink>
                <p>
                  iOS subscriptions use the same props as regular purchases
                  (RequestPurchaseIosProps).
                </p>
              </>
            ),
            android: (
              <>
                <AnchorLink id="request-subscription-android-props" level="h4">
                  RequestSubscriptionAndroidProps
                </AnchorLink>
                <p>
                  Extends RequestPurchaseAndroidProps with subscription-specific
                  fields:
                </p>
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
                        <code>purchaseTokenAndroid</code>
                      </td>
                      <td>Existing subscription token for upgrade/downgrade</td>
                    </tr>
                    <tr>
                      <td>
                        <code>replacementModeAndroid</code>
                      </td>
                      <td>
                        How to handle subscription change (proration mode)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionOffers</code>
                      </td>
                      <td>
                        Array of offers to apply. Each contains:{' '}
                        <code>sku</code>, <code>offerToken</code>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            ),
          }}
        </PlatformTabs>
      </section>
    </div>
  );
}

export default TypesRequest;
