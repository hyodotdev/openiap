import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function CurrentEntitlementIOS() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="currentEntitlementIOS"
        description="Get current StoreKit 2 entitlement for a product (iOS 15+, macOS 14+)."
        path="/docs/apis/ios/current-entitlement-ios"
        keywords="currentEntitlementIOS, entitlement, StoreKit 2"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        currentEntitlementIOS
      </h1>
      <p>
        Get current StoreKit 2 entitlement for a product (iOS 15+, macOS 14+).
      </p>
      <p>
        Uses <code>Product.currentEntitlements</code> where available and
        otherwise filters <code>Transaction.currentEntitlements</code> by SKU.
        This avoids StoreKit&apos;s deprecated singular{' '}
        <code>Product.currentEntitlement</code> property. Generic Advanced
        Commerce SKUs can yield multiple current transactions, so OpenIAP
        returns the latest verified entitlement by purchase date and transaction
        ID. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/product/currententitlements"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func currentEntitlementIOS(sku: String) async throws -> PurchaseIOS?`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun currentEntitlementIOS(sku: String): PurchaseIOS?`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`currentEntitlementIOS(sku: string): Promise<PurchaseIOS | null>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<PurchaseIOS?> currentEntitlementIOS(String sku);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<PurchaseIOS?> CurrentEntitlementIOSAsync(string sku);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func current_entitlement_ios(sku: String) -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <ul className="api-params">
        <li>
          <code>sku</code>{' '}
          <em>
            (required, <code>string</code>)
          </em>{' '}
          — Product identifier.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <Link to="/docs/types/purchase">
          <code>Promise&lt;PurchaseIOS | null&gt;</code>
        </Link>{' '}
        — iOS purchase shape, or <code>null</code> if the SKU has no matching
        transaction.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`let entitlement = try await OpenIapModule.shared.currentEntitlementIOS(sku: "com.app.premium")`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// kmp-iap (iOS targets only — no-op on Android)
val entitlement = kmpIAP.currentEntitlementIOS(sku = "com.app.premium")`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { currentEntitlementIOS } from 'expo-iap';

if (Platform.OS === 'ios') {
  const entitlement = await currentEntitlementIOS('com.app.premium');
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isIOS || Platform.isMacOS) {
  final entitlement = await FlutterInappPurchase.instance
      .currentEntitlementIOS('com.app.premium');
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// kmp-iap (iOS targets only — no-op on Android)
var entitlement = await ((QueryResolver)OpenIapClient.Instance).CurrentEntitlementIOSAsync(sku: "com.app.premium");`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "iOS":
    var entitlement = await iap.current_entitlement_ios("com.app.premium")`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
    </div>
  );
}

export default CurrentEntitlementIOS;
