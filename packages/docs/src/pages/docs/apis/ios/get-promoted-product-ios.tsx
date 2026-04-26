import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function GetPromotedProductIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="getPromotedProductIOS"
        description="Get the currently promoted product from App Store (iOS 11+)."
        path="/docs/apis/ios/get-promoted-product-ios"
        keywords="getPromotedProductIOS, promoted product, App Store"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        getPromotedProductIOS
      </h1>
      <p>Get the currently promoted product from App Store (iOS 11+).</p>
      <p>
        Reads the product surfaced via App Store promoted IAP campaigns (
        <code>SKPaymentTransactionObserver.shouldAddStorePayment</code>). iOS
        11+. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/in-app-purchase/promoting-in-app-purchases"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/product">
          <code>Promise&lt;ProductIOS | null&gt;</code>
        </Link>{' '}
        — the App Store-promoted product, or <code>null</code> if no campaign is
        currently queued.
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func getPromotedProductIOS() async throws -> Product?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun getPromotedProductIOS(): ProductIOS?`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`getPromotedProductIOS(): Promise<ProductIOS | null>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<ProductIOS?> getPromotedProductIOS();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func get_promoted_product_ios() -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let product = try await OpenIapModule.shared.getPromotedProductIOS()`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val product = kmpIAP.getPromotedProductIOS()`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { getPromotedProductIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const product = await getPromotedProductIOS();
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final product = await FlutterInappPurchase.instance.getPromotedProductIOS();
}`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var product = await iap.get_promoted_product_ios()`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default GetPromotedProductIOS;
