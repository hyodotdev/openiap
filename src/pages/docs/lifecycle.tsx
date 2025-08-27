import { Link } from 'react-router-dom';
import CodeBlock from '../../components/CodeBlock';
import AnchorLink from '../../components/AnchorLink';
import { useScrollToHash } from '../../hooks/useScrollToHash';
function LifeCycle() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Life Cycle</h1>
      <p>
        Understanding the complete lifecycle of in-app purchases is essential
        for proper implementation.
      </p>

      <section>
        <img
          src="/purchase-flow.png"
          alt="IAP Lifecycle"
          style={{ width: '100%', maxWidth: '900px', margin: '2rem 0' }}
        />
      </section>

      <section>
        <AnchorLink id="lifecycle-phases" level="h2">
          Lifecycle Phases
        </AnchorLink>

        <AnchorLink id="initialization" level="h3">
          1. Initialization
        </AnchorLink>
        <p>
          Establish connection to the store service using{' '}
          <Link to="/docs/apis#init-connection">initConnection</Link>. This must
          be done before any other IAP operations.
        </p>

        <AnchorLink id="product-discovery" level="h3">
          2. Product Discovery
        </AnchorLink>
        <p>
          Fetch available products from the store using{' '}
          <Link to="/docs/apis#request-products">requestProducts</Link>.
          Products must be configured in App Store Connect or Google Play
          Console.
        </p>

        <AnchorLink id="purchase-request" level="h3">
          3. Purchase Request
        </AnchorLink>
        <p>
          User initiates purchase via{' '}
          <Link to="/docs/apis#request-purchase">requestPurchase</Link>. The
          platform payment UI is displayed.
        </p>

        <AnchorLink id="purchase-processing" level="h3">
          4. Purchase Processing
        </AnchorLink>
        <p>
          The store processes payment. Your app receives updates via{' '}
          <code>purchaseUpdatedListener</code> or{' '}
          <code>purchaseErrorListener</code>.
        </p>

        <AnchorLink id="receipt-validation" level="h3">
          5. Receipt Validation
        </AnchorLink>
        <p>
          <strong>Critical:</strong> Always validate receipts server-side for
          security. Never trust client-side validation alone in production. This
          applies to ALL purchase types: consumables, non-consumables, and
          subscriptions.
        </p>

        <AnchorLink id="content-delivery" level="h3">
          6. Content Delivery
        </AnchorLink>
        <p>
          After successful validation, deliver the purchased content or enable
          premium features.
        </p>

        <AnchorLink id="transaction-completion" level="h3">
          7. Transaction Completion
        </AnchorLink>
        <p>
          Call <Link to="/docs/apis#finish-transaction">finishTransaction</Link>{' '}
          to complete the purchase. Unfinished transactions remain in queue and
          may cause issues. Set <code>isConsumable=true</code> only for
          consumable products, and <code>false</code> or omit for
          non-consumables and subscriptions.
        </p>

        <AnchorLink id="connection-cleanup" level="h3">
          8. Connection Cleanup
        </AnchorLink>
        <p>
          When IAP is no longer needed, call{' '}
          <Link to="/docs/apis#end-connection">endConnection</Link> to free
          resources.
        </p>
      </section>

      <section>
        <AnchorLink id="state-management" level="h2">
          State Management
        </AnchorLink>

        <AnchorLink id="connection-states" level="h3">
          Connection States
        </AnchorLink>
        <ul>
          <li>
            <strong>Disconnected</strong>: Initial state, no store connection
          </li>
          <li>
            <strong>Connecting</strong>: Establishing connection to store
            service
          </li>
          <li>
            <strong>Connected</strong>: Ready for IAP operations
          </li>
          <li>
            <strong>Error</strong>: Connection failed, check error details
          </li>
        </ul>

        <AnchorLink id="purchase-states" level="h3">
          Purchase States
        </AnchorLink>
        <ul>
          <li>
            <strong>Pending</strong>: Purchase initiated, awaiting payment
          </li>
          <li>
            <strong>Processing</strong>: Payment being processed by store
          </li>
          <li>
            <strong>Purchased</strong>: Payment successful, needs validation
          </li>
          <li>
            <strong>Failed</strong>: Purchase failed or cancelled
          </li>
          <li>
            <strong>Restored</strong>: Previous purchase restored
          </li>
          <li>
            <strong>Deferred</strong>: Awaiting approval (e.g., parental
            consent)
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="critical-considerations" level="h2">
          Critical Considerations
        </AnchorLink>

        <AnchorLink id="pending-purchases" level="h3">
          Always Handle Pending Purchases
        </AnchorLink>
        <p>
          Check for pending purchases on app launch. Purchases may complete
          while app is closed:
        </p>
        <CodeBlock language={undefined}>{`On app launch:
1. getAvailablePurchases() → [Purchase]
2. For each purchase:
   → validate purchase
   → deliver content
   → finishTransaction()`}</CodeBlock>

        <AnchorLink id="transaction-queue" level="h3">
          Transaction Queue Management
        </AnchorLink>
        <p>
          iOS maintains a persistent transaction queue. Unfinished transactions
          will be delivered on every app launch until finished.
        </p>

        <AnchorLink id="android-acknowledgment" level="h3">
          Android Acknowledgment Window
        </AnchorLink>
        <p>
          Android purchases must be acknowledged within 3 days or they will be
          automatically refunded. Always call <code>finishTransaction</code>{' '}
          promptly.
        </p>

        <AnchorLink id="subscription-lifecycle" level="h3">
          Subscription Lifecycle
        </AnchorLink>
        <p>Subscriptions have additional states:</p>
        <ul>
          <li>
            <strong>Active</strong>: Subscription is current and valid
          </li>
          <li>
            <strong>Expired</strong>: Subscription period ended
          </li>
          <li>
            <strong>In Grace Period</strong>: Payment issue, but access
            maintained temporarily
          </li>
          <li>
            <strong>In Billing Retry</strong>: Payment failed, retrying
          </li>
          <li>
            <strong>Paused</strong>: Subscription paused by user (Android only)
          </li>
          <li>
            <strong>On Hold</strong>: Subscription on hold due to payment issue
          </li>
        </ul>
      </section>
    </div>
  );
}

export default LifeCycle;
