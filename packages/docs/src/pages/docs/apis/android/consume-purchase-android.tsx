import { Link } from 'react-router-dom';
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

      <h2>Signature</h2>
      <LanguageTabs>
        {{
          kotlin: (
            <CodeBlock language="kotlin">{`suspend fun consumePurchase(purchaseToken: String): Boolean`}</CodeBlock>
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
