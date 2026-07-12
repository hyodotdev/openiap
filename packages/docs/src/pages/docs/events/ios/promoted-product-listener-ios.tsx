import { Link } from 'react-router-dom';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function PromotedProductListenerIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="promotedProductListenerIOS"
        description="Listener fired when a user clicks on a promoted in-app purchase in the App Store."
        path="/docs/events/ios/promoted-product-listener-ios"
        keywords="promotedProductListenerIOS, promoted product, App Store promotion, iOS"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        promotedProductListenerIOS
      </h1>
      <p>
        Fired when a user clicks on a promoted in-app purchase in the App Store.
      </p>

      <h3>Listener Setup</h3>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`promotedProductListenerIOS(
  listener: (product: Product) => void
): EventSubscription`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`func promotedProductListenerIOS(
    _ listener: @escaping (String) -> Void
) -> Subscription`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// iOS only - not available on Android`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// Emits on iOS targets; it stays silent on Android.
val promotedProductListener: Flow<String?>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`// iOS only
Stream<String?> get purchasePromoted;`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Emits on iOS; it stays silent on Android.
IObservable<string> promotedProducts = OpenIapClient.Instance.PromotedProductIOS;`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>Registers a listener for App Store promoted product events.</p>

      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import {
  promotedProductListenerIOS,
  requestPurchase
} from 'expo-iap';

const subscription = promotedProductListenerIOS(async (product) => {
  const productId = product.id;
  console.log('Promoted product tapped:', productId);

  // expo-iap and react-native-iap deliver the fetched Product object.
  const confirmed = await showPurchaseConfirmation(product);

  if (confirmed) {
    await requestPurchase({
      request: { apple: { sku: productId } },
      type: 'in-app'
    });
  }
});

// Cleanup when done
subscription.remove();`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`import OpenIap

let subscription = OpenIapModule.shared.promotedProductListenerIOS { productId in
    Task {
        print("Promoted product tapped: \\(productId)")

        do {
            let result = try await OpenIapModule.shared.fetchProducts(
                ProductRequest(skus: [productId], type: .inApp)
            )
            guard case let .products(products) = result,
                  let product = products?.first,
                  await showPurchaseConfirmation(product) else { return }

            try await OpenIapModule.shared.requestPurchase(
                RequestPurchaseProps(
                    request: .purchase(
                        RequestPurchasePropsByPlatforms(
                            apple: RequestPurchaseIosProps(sku: productId)
                        )
                    )
                )
            )
        } catch {
            print("Promoted purchase failed: \\(error.localizedDescription)")
        }
    }
}

// Keep the token in the owning object, then call this on teardown.
func stopListeningForPromotedProducts() {
    OpenIapModule.shared.removeListener(subscription)
}`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.openiap.*

val iap = KmpIAP()

scope.launch {
    iap.promotedProductListener.collect { productId ->
        productId ?: return@collect

        val result = iap.fetchProducts(
            ProductRequest(skus = listOf(productId), type = ProductQueryType.InApp)
        )
        val product = (result as? FetchProductsResultProducts)
            ?.value
            ?.firstOrNull()

        if (product != null && showPurchaseConfirmation(product)) {
            iap.requestPurchase(
                RequestPurchaseProps(
                    request = RequestPurchaseProps.Request.Purchase(
                        RequestPurchasePropsByPlatforms(
                            apple = RequestPurchaseIosProps(sku = productId)
                        )
                    ),
                    type = ProductQueryType.InApp
                )
            )
        }
    }
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// iOS only - will not fire on Android
final iap = FlutterInappPurchase.instance;
final subscription = iap.purchasePromoted.listen((productId) async {
  if (productId == null) return;
  print('Promoted product tapped: $productId');

  // Fetch product details
  final products = await iap.fetchProducts<Product>(
    skus: [productId],
    type: ProductQueryType.InApp,
  );

  if (products.isNotEmpty) {
    // Show product info to user and confirm purchase
    final confirmed = await showPurchaseConfirmation(products.first);

    if (confirmed) {
      // Purchase directly using requestPurchase with the received SKU
      await iap.requestPurchase(
        RequestPurchaseProps.inApp((
          apple: RequestPurchaseIosProps(sku: productId),
          google: null,
          useAlternativeBilling: null,
        )),
      );
    }
  }
});

// Cleanup when done
subscription.cancel();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var iap = OpenIapClient.Instance;
var query = (QueryResolver)iap;
var mutate = (MutationResolver)iap;

using var subscription = iap.PromotedProductIOS.Subscribe(async productId =>
{
    var result = await query.FetchProductsAsync(new ProductRequest
    {
        Skus = new[] { productId },
        Type = ProductQueryType.InApp,
    });

    var product = (result as FetchProductsResultProducts)?.Value?.FirstOrDefault();
    if (product is null || !await ShowPurchaseConfirmationAsync(product)) return;

    await mutate.RequestPurchaseAsync(new RequestPurchaseProps
    {
        RequestPurchase = new RequestPurchasePropsByPlatforms
        {
            Apple = new RequestPurchaseIosProps { Sku = productId },
        },
        Type = ProductQueryType.InApp,
    });
});`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h3>Handling Promoted Products</h3>
      <ol>
        <li>Receive product SKU via listener</li>
        <li>
          Fetch product details using{' '}
          <Link to="/docs/apis/fetch-products">fetchProducts</Link>
        </li>
        <li>Display product information to user</li>
        <li>
          Call <Link to="/docs/apis/request-purchase">requestPurchase</Link>{' '}
          with the received SKU if user confirms
        </li>
      </ol>
      <p>
        Also check{' '}
        <Link to="/docs/apis/ios/get-promoted-product-ios">
          getPromotedProductIOS
        </Link>{' '}
        on app launch for pending promoted products.
      </p>
      <div className="alert-card alert-card--info">
        <p>
          <strong>Note:</strong> In StoreKit 2, promoted products can be
          purchased directly via the standard{' '}
          <Link to="/docs/apis/request-purchase">
            <code>requestPurchase()</code>
          </Link>{' '}
          flow. The deprecated{' '}
          <code style={{ textDecoration: 'line-through' }}>
            requestPurchaseOnPromotedProductIOS()
          </code>{' '}
          API is no longer needed.
        </p>
      </div>
    </div>
  );
}

export default PromotedProductListenerIOS;
