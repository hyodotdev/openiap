import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function AcknowledgePurchaseAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="acknowledgePurchaseAndroid"
        description="Acknowledge a non-consumable purchase or subscription. Required within 3 days or the purchase will be refunded."
        path="/docs/apis/android/acknowledge-purchase-android"
        keywords="acknowledgePurchaseAndroid, acknowledge, Google Play, auto-refund"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        acknowledgePurchaseAndroid
      </h1>
      <p>
        Acknowledge a non-consumable purchase or subscription. Required within 3
        days or the purchase will be refunded.
      </p>
      <p>
        Wraps{' '}
        <code>
          BillingClient.acknowledgePurchase(AcknowledgePurchaseParams)
        </code>{' '}
        — required for non-consumables and subscriptions within 3 days,
        otherwise Google auto-refunds. See the{' '}
        <a
          href="https://developer.android.com/reference/com/android/billingclient/api/BillingClient#acknowledgePurchase(com.android.billingclient.api.AcknowledgePurchaseParams,com.android.billingclient.api.AcknowledgePurchaseResponseListener)"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Play Billing reference
        </a>
        .
      </p>

      <div className="alert-card alert-card--warning">
        <p>
          ⚠️ <strong>Deprecated in Google Play Billing Library 8.2.0+.</strong>{' '}
          Direct acknowledge / consume calls are being phased out — use the
          cross-platform{' '}
          <Link to="/docs/apis/finish-transaction">
            <code>finishTransaction</code>
          </Link>{' '}
          API instead, which handles acknowledgment automatically and is the
          recommended path for new code.
        </p>
      </div>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun acknowledgePurchase(purchaseToken: String): Boolean`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun acknowledgePurchaseAndroid(purchaseToken: String): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`acknowledgePurchaseAndroid(purchaseToken: string): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> acknowledgePurchaseAndroid(String purchaseToken);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<Boolean> AcknowledgePurchaseAsync(String PurchaseToken)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func acknowledge_purchase_android(purchase_token: String) -> bool`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <ul className="api-params">
        <li>
          <code>purchaseToken</code>{' '}
          <em>
            (required, <code>string</code>)
          </em>{' '}
          — Purchase token from the Play Billing transaction.
        </li>
      </ul>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> once the
        purchase has been acknowledged.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.acknowledgePurchase(purchase.purchaseToken)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// kmp-iap (Android targets only — no-op on iOS)
kmpIAP.acknowledgePurchaseAndroid(purchase.purchaseToken)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { acknowledgePurchaseAndroid } from 'expo-iap';

if (Platform.OS === 'android') {
  await acknowledgePurchaseAndroid(purchase.purchaseToken);
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  await FlutterInappPurchase.instance.acknowledgePurchaseAndroid(
    purchase.purchaseToken,
  );
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

await ((QueryResolver)OpenIap.Instance).AcknowledgePurchaseAsync(purchase.purchaseToken)`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    await iap.acknowledge_purchase_android(purchase.purchase_token)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p>
        <strong>Note:</strong> Called automatically by{' '}
        <Link to="/docs/apis/finish-transaction">finishTransaction()</Link> when{' '}
        <code>isConsumable</code> is <code>false</code>.
      </p>

      <p className="type-link">
        See: <Link to="/docs/apis/finish-transaction">finishTransaction</Link>
      </p>
    </div>
  );
}

export default AcknowledgePurchaseAndroid;
