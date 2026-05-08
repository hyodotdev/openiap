import { Link } from 'react-router-dom';
import AnchorLink from '../../../../components/AnchorLink';
import CodeBlock from '../../../../components/CodeBlock';
import LanguageTabs from '../../../../components/LanguageTabs';
import SEO from '../../../../components/SEO';
import { useScrollToHash } from '../../../../hooks/useScrollToHash';

function ConsumePurchaseAndroid() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="consumePurchaseAndroid"
        description="Consume a consumable purchase, allowing repurchase. Automatically acknowledges the purchase."
        path="/docs/apis/android/consume-purchase-android"
        keywords="consumePurchaseAndroid, consume, Google Play"
      />
      <h1>
        <span className="platform-badge platform-badge--android">Android</span>{' '}
        consumePurchaseAndroid
      </h1>
      <p>
        Consume a consumable purchase, allowing repurchase. Automatically
        acknowledges the purchase.
      </p>
      <p>
        Wraps <code>BillingClient.consumeAsync(ConsumeParams)</code> — for
        consumables (re-buyable like coins). Same 3-day deadline as acknowledge.
        See the{' '}
        <a
          href="https://developer.android.com/reference/com/android/billingclient/api/BillingClient#consumeAsync(com.android.billingclient.api.ConsumeParams,com.android.billingclient.api.ConsumeResponseListener)"
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
          Use{' '}
          <Link to="/docs/apis/finish-transaction">
            <code>finishTransaction</code>
          </Link>{' '}
          with <code>isConsumable: true</code> instead — the unified path
          consumes (or acknowledges) the purchase automatically and stays
          forward-compatible with the new Billing Programs API.
        </p>
      </div>

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun consumePurchase(purchaseToken: String): Boolean`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun consumePurchaseAndroid(purchaseToken: String): Boolean`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`consumePurchaseAndroid(purchaseToken: string): Promise<boolean>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> consumePurchaseAndroid(String purchaseToken);`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`Task<bool> ConsumePurchaseAndroidAsync(string purchaseToken);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func consume_purchase_android(purchase_token: String) -> bool`}</CodeBlock>
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
        purchase has been consumed.
      </p>

      <h2>Example</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`openIapStore.consumePurchase(purchase.purchaseToken)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// kmp-iap (Android targets only — no-op on iOS)
kmpIAP.consumePurchaseAndroid(purchase.purchaseToken)`}</CodeBlock>
          ),
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap (also exported from react-native-iap)
import { consumePurchaseAndroid } from 'expo-iap';

if (Platform.OS === 'android') {
  await consumePurchaseAndroid(purchase.purchaseToken);
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`if (Platform.isAndroid) {
  await FlutterInappPurchase.instance.consumePurchaseAndroid(
    purchase.purchaseToken,
  );
}`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

await ((MutationResolver)Iap.Instance).ConsumePurchaseAndroidAsync(purchase.PurchaseToken);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`if iap.get_platform() == "Android":
    await iap.consume_purchase_android(purchase.purchase_token)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p>
        <strong>Note:</strong> Called automatically by{' '}
        <Link to="/docs/apis/finish-transaction">finishTransaction()</Link> when{' '}
        <code>isConsumable</code> is <code>true</code>.
      </p>

      <p className="type-link">
        See: <Link to="/docs/apis/finish-transaction">finishTransaction</Link>
      </p>
    </div>
  );
}

export default ConsumePurchaseAndroid;
