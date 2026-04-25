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

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun acknowledgePurchase(purchaseToken: String): Boolean`}</CodeBlock>
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
