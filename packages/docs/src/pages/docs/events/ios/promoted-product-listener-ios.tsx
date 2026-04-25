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
  listener: (productId: string) => void
): Subscription`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`// AsyncSequence approach
var promotedProducts: AsyncStream<String>

// Combine approach
var promotedProductPublisher: AnyPublisher<String, Never>`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// iOS only - not available on Android`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// iOS only - not available on Android`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Stream<String> get promotedProductStream; // iOS only`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>Registers a listener for App Store promoted product events.</p>

      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`import {
  promotedProductListenerIOS,
  fetchProducts,
  requestPurchase
} from 'expo-iap';

const subscription = promotedProductListenerIOS(async (productId) => {
  console.log('Promoted product tapped:', productId);

  // Fetch product details
  const products = await fetchProducts({
    skus: [productId],
    type: 'in-app'
  });

  if (products.length > 0) {
    // Show product info to user and confirm purchase
    const confirmed = await showPurchaseConfirmation(products[0]);

    if (confirmed) {
      // Purchase directly using requestPurchase with the received SKU
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

// Using async/await
Task {
    for await productId in OpenIapModule.shared.promotedProducts {
        print("Promoted product tapped: \\(productId)")

        // Fetch product details
        let products = try await OpenIapModule.shared.fetchProducts(
            ProductRequest(skus: [productId], type: .inApp)
        )

        if let product = products.first {
            // Show product info to user and confirm purchase
            if await showPurchaseConfirmation(product) {
                // Purchase directly using requestPurchase with the received SKU
                try await OpenIapModule.shared.requestPurchase(
                    RequestPurchaseProps(
                        request: .purchase(RequestPurchasePropsByPlatforms(
                            apple: RequestPurchaseIosProps(sku: productId)
                        )),
                        type: .inApp
                    )
                )
            }
        }
    }
}

// Or using Combine
OpenIapModule.shared.promotedProductPublisher
    .sink { productId in
        print("Promoted product: \\(productId)")
    }
    .store(in: &cancellables)`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// iOS only - will not fire on Android
final subscription = FlutterInappPurchase.promotedProductIOS.listen((productId) async {
  print('Promoted product tapped: $productId');

  // Fetch product details
  final products = await FlutterInappPurchase.instance.fetchProducts(
    ProductRequest(skus: [productId!], type: ProductQueryType.inApp),
  );

  if (products.isNotEmpty) {
    // Show product info to user and confirm purchase
    final confirmed = await showPurchaseConfirmation(products.first);

    if (confirmed) {
      // Purchase directly using requestPurchase with the received SKU
      await FlutterInappPurchase.instance.requestPurchase(
        RequestPurchaseProps(
          request: RequestPurchasePropsByPlatforms(
            apple: RequestPurchaseIosProps(sku: productId!),
          ),
          type: ProductQueryType.inApp,
        ),
      );
    }
  }
});

// Cleanup when done
subscription.cancel();`}</CodeBlock>
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
