import { Link } from 'react-router-dom';
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
          typescript: (
            <CodeBlock language="typescript">{`acknowledgePurchaseAndroid(purchaseToken: string): Promise<boolean>`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun acknowledgePurchase(purchaseToken: String): Boolean`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`suspend fun acknowledgePurchaseAndroid(purchaseToken: String): Boolean`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Future<bool> acknowledgePurchaseAndroid(String purchaseToken);`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`func acknowledge_purchase_android(purchase_token: String) -> bool`}</CodeBlock>
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
