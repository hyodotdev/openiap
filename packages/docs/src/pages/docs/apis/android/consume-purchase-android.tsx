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

      <AnchorLink id="parameters" level="h2">
        Parameters
      </AnchorLink>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>purchaseToken</code>
            </td>
            <td>
              <code>string</code>
            </td>
            <td>Yes</td>
            <td>Purchase token from the Play Billing transaction.</td>
          </tr>
        </tbody>
      </table>

      <AnchorLink id="returns" level="h2">
        Returns
      </AnchorLink>
      <p>
        <code>Promise&lt;boolean&gt;</code> — <code>true</code> once the
        purchase has been consumed.
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
