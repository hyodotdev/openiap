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
        description="Get current StoreKit 2 entitlement for a product (iOS 15+)."
        path="/docs/apis/ios/current-entitlement-ios"
        keywords="currentEntitlementIOS, entitlement, StoreKit 2"
      />
      <h1>
        <span className="platform-badge platform-badge--ios">iOS</span>{' '}
        currentEntitlementIOS
      </h1>
      <p>Get current StoreKit 2 entitlement for a product (iOS 15+).</p>
      <p>
        Wraps <code>Transaction.currentEntitlement(for:)</code> — single-product
        convenience over <code>currentEntitlements</code>. See the{' '}
        <a
          href="https://developer.apple.com/documentation/storekit/transaction/currententitlement(for:)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Apple StoreKit reference
        </a>
        .
      </p>

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

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          swift: (
            <CodeBlock language="swift">{`func currentEntitlementIOS(sku: String) async throws -> Purchase?`}</CodeBlock>
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
          gdscript: (
            <CodeBlock language="gdscript">{`func current_entitlement_ios(sku: String) -> Variant`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

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
            <CodeBlock language="dart">{`if (Platform.isIOS) {
  final entitlement = await FlutterInappPurchase.instance
      .currentEntitlementIOS('com.app.premium');
}`}</CodeBlock>
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
