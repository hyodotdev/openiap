import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function RequestPurchaseOnPromotedProductIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="requestPurchaseOnPromotedProductIOS"
        description="Deprecated. Use promotedProductListenerIOS plus requestPurchase instead."
        path="/docs/apis/ios/request-purchase-on-promoted-product-ios"
        keywords="requestPurchaseOnPromotedProductIOS, deprecated, promoted product"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        requestPurchaseOnPromotedProductIOS
      </h1>
      <p>
        Deprecated. Use promotedProductListenerIOS plus requestPurchase instead.
      </p>
      <p>
        Triggers the promoted product's purchase. <strong>Deprecated</strong> —
        prefer <code>promotedProductListenerIOS</code> +{' '}
        <code>requestPurchase</code> for StoreKit 2. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/in-app-purchase/promoting-in-app-purchases"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

      <div className="alert-card alert-card--warning">
        <p>
          <strong>Deprecated.</strong> In StoreKit 2, promoted products fire
          promotedProductListenerIOS with the productId — call requestPurchase
          with that SKU. Use{' '}
          <Link to="/docs/apis/request-purchase">requestPurchase</Link> instead.
        </p>
      </div>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <p>
        None. <strong>Deprecated</strong> — use{' '}
        <code>promotedProductListenerIOS</code> + <code>requestPurchase</code>.
      </p>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> if the request
        was dispatched.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`@available(*, deprecated, message: "Use promotedProductListenerIOS + requestPurchase instead")
func requestPurchaseOnPromotedProductIOS() async throws -> Bool`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`@Deprecated("Use promotedProductListenerIOS + requestPurchase instead")
suspend fun requestPurchaseOnPromotedProductIOS(): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`requestPurchaseOnPromotedProductIOS(): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`@Deprecated('Use promotedProductListenerIOS + requestPurchase instead')
Future<bool> requestPurchaseOnPromotedProductIOS();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func request_purchase_on_promoted_product_ios() -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`// Deprecated — prefer promotedProductListenerIOS + requestPurchase.
try await OpenIapModule.shared.requestPurchaseOnPromotedProductIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
// Deprecated — prefer promotedProductListenerIOS + requestPurchase.
kmpIAP.requestPurchaseOnPromotedProductIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
// Deprecated — prefer promotedProductListenerIOS + requestPurchase.
import { requestPurchaseOnPromotedProductIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  await requestPurchaseOnPromotedProductIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`// Deprecated — prefer promotedProductListenerIOS + requestPurchase.
if (Platform.isIOS) {
  await FlutterInappPurchase.instance.requestPurchaseOnPromotedProductIOS();
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var ok = await iap.request_purchase_on_promoted_product_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default RequestPurchaseOnPromotedProductIOS;
