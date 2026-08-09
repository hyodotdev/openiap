import { Link } from 'react-router-dom';
import Callout from '../../../../components/Callout';
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
      <p>
        Registers a listener for App Store promoted product events. OpenIAP uses{' '}
        <code>PurchaseIntent.intents</code> on iOS 16.4+ and the StoreKit 1
        observer only on iOS 15–16.3, so both mechanisms never run together.
      </p>

      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import {
  fetchProducts,
  promotedProductListenerIOS,
  requestPurchase
} from 'expo-iap';

const subscription = promotedProductListenerIOS(async (product) => {
  const productId = product.id;
  console.log('Promoted product tapped:', productId);

  // Refetch as "all" because the listener's legacy Product payload does not
  // distinguish promoted subscriptions at the type level.
  const items = (await fetchProducts({ skus: [productId], type: 'all' })) ?? [];
  const item = items.find((candidate) => candidate.id === productId);
  if (!item) return;

  const confirmed = await showPurchaseConfirmation(item);

  if (confirmed) {
    if (item.type === 'subs') {
      await requestPurchase({
        request: { apple: { sku: productId } },
        type: 'subs'
      });
    } else {
      await requestPurchase({
        request: { apple: { sku: productId } },
        type: 'in-app'
      });
    }
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
                ProductRequest(skus: [productId], type: .all)
            )
            guard case let .all(items) = result,
                  let item = items?.first else { return }

            switch item {
            case let .product(product):
                guard await showPurchaseConfirmation(product) else { return }
                try await OpenIapModule.shared.requestPurchase(
                    RequestPurchaseProps(
                        request: .purchase(
                            RequestPurchasePropsByPlatforms(
                                apple: RequestPurchaseIosProps(sku: productId)
                            )
                        )
                    )
                )
            case let .productSubscription(subscription):
                guard await showPurchaseConfirmation(subscription) else { return }
                try await OpenIapModule.shared.requestPurchase(
                    RequestPurchaseProps(
                        request: .subscription(
                            RequestSubscriptionPropsByPlatforms(
                                apple: RequestSubscriptionIosProps(sku: productId)
                            )
                        )
                    )
                )
            }
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
            ProductRequest(skus = listOf(productId), type = ProductQueryType.All)
        )
        val item = (result as? FetchProductsResultAll)
            ?.value
            ?.firstOrNull()

        when (item) {
            is ProductOrSubscription.ProductItem -> {
                if (!showPurchaseConfirmation(item.value)) return@collect
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
            is ProductOrSubscription.ProductSubscriptionItem -> {
                if (!showPurchaseConfirmation(item.value)) return@collect
                iap.requestPurchase(
                    RequestPurchaseProps(
                        request = RequestPurchaseProps.Request.Subscription(
                            RequestSubscriptionPropsByPlatforms(
                                apple = RequestSubscriptionIosProps(sku = productId)
                            )
                        ),
                        type = ProductQueryType.Subs
                    )
                )
            }
            null -> Unit
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
  final products = await iap.fetchProducts<ProductCommon>(
    skus: [productId],
    type: ProductQueryType.All,
  );

  if (products.isNotEmpty) {
    // Show product info to user and confirm purchase
    final confirmed = await showPurchaseConfirmation(products.first);

    if (confirmed) {
      if (products.first.type == ProductType.Subs) {
        await iap.requestPurchase(
          RequestPurchaseProps.subs((
            apple: RequestSubscriptionIosProps(sku: productId),
            google: null,
          )),
        );
      } else {
        await iap.requestPurchase(
          RequestPurchaseProps.inApp((
            apple: RequestPurchaseIosProps(sku: productId),
            google: null,
          )),
        );
      }
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
        Type = ProductQueryType.All,
    });

    var product = (result as FetchProductsResultAll)?.Value?.FirstOrDefault();
    if (product is null || !await ShowPurchaseConfirmationAsync(product)) return;

    var props = product is ProductSubscription
        ? new RequestPurchaseProps
        {
            RequestSubscription = new RequestSubscriptionPropsByPlatforms
            {
                Apple = new RequestSubscriptionIosProps { Sku = productId },
            },
            Type = ProductQueryType.Subs,
        }
        : new RequestPurchaseProps
        {
            RequestPurchase = new RequestPurchasePropsByPlatforms
            {
                Apple = new RequestPurchaseIosProps { Sku = productId },
            },
            Type = ProductQueryType.InApp,
        };

    await mutate.RequestPurchaseAsync(props);
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
      <Callout kind="note">
        In StoreKit 2, promoted products are purchased through the standard{' '}
        <Link to="/docs/apis/request-purchase">
          <code>requestPurchase()</code>
        </Link>{' '}
        flow after the app receives or restores the promoted product. If the
        purchase intent contains an externally redeemed win-back offer, OpenIAP
        automatically carries it into the next matching purchase unless that
        request supplies an explicit win-back or promotional offer.
      </Callout>
    </div>
  );
}

export default PromotedProductListenerIOS;
