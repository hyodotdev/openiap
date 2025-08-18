import { Link } from 'react-router-dom';
import CodeBlock from '../../components/CodeBlock';
import AnchorLink from '../../components/AnchorLink';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function Events() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Events</h1>

      <section>
        <h2>Event System Overview</h2>
        <p>
          The IAP library uses an event-driven architecture to handle purchase
          flows asynchronously. You must set up event listeners before
          initiating any purchase to properly handle the results.
        </p>

        <h3>Event Types</h3>
        <CodeBlock language="graphql">{`enum IapEvent {
  PURCHASE_UPDATED
  PURCHASE_ERROR
  PROMOTED_PRODUCT_IOS
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="purchaseupdatedevent" level="h2">
          Purchase Updated Event
        </AnchorLink>
        <p>
          Fired when a purchase is successful or when a pending purchase is
          completed.
        </p>

        <h3>Listener Setup</h3>
        <CodeBlock language="graphql">{`purchaseUpdatedListener(listener: (Purchase) => Void): Subscription`}</CodeBlock>
        <p>Registers a listener for successful purchase events.</p>

        <h3>Event Payload</h3>
        <p>
          The purchase event delivers a{' '}
          <Link to="/docs/types#purchase">Purchase</Link> object containing
          transaction details.
        </p>

        <h3>Purchase Update Flow</h3>
        <ol>
          <li>
            Receive <Link to="/docs/types#purchase">Purchase</Link> object via
            listener
          </li>
          <li>Validate receipt with backend service</li>
          <li>Deliver purchased content to user</li>
          <li>
            Acknowledge purchase with platform (iOS: finishTransaction, Android:
            acknowledgePurchase)
          </li>
          <li>Update application state</li>
        </ol>
      </section>

      <section>
        <AnchorLink id="purchaseerrorevent" level="h2">
          Purchase Error Event
        </AnchorLink>
        <p>Fired when a purchase fails or is cancelled by the user.</p>

        <h3>Listener Setup</h3>
        <CodeBlock language="graphql">{`purchaseErrorListener(listener: (PurchaseError) => Void): Subscription`}</CodeBlock>
        <p>Registers a listener for purchase error events.</p>

        <h3>Error Payload</h3>
        <p>
          The error event delivers a{' '}
          <Link to="/docs/errors">PurchaseError</Link> object with error
          details. See <Link to="/docs/errors">Error Codes</Link> for complete
          reference.
        </p>

        <h3>Error Handling Strategy</h3>
        <p>
          Handle errors based on their{' '}
          <Link to="/docs/errors">error codes</Link>:
        </p>
        <ul>
          <li>
            <code>E_USER_CANCELLED</code> - No action required
          </li>
          <li>
            <code>E_ITEM_UNAVAILABLE</code> - Check product availability
          </li>
          <li>
            <code>E_NETWORK_ERROR</code> - Retry with backoff
          </li>
          <li>
            <code>E_ALREADY_OWNED</code> - Restore purchases
          </li>
          <li>
            <code>E_RECEIPT_FAILED</code> - Retry validation
          </li>
        </ul>
      </section>

      <section>
        <h2>Promoted Product Event (iOS)</h2>
        <p>
          Fired when a user clicks on a promoted in-app purchase in the App
          Store.
        </p>

        <h3>Listener Setup</h3>
        <CodeBlock language="graphql">{`promotedProductListenerIOS(listener: (String) => Void): Subscription`}</CodeBlock>
        <p>Registers a listener for App Store promoted product events.</p>

        <h3>Handling Promoted Products</h3>
        <ol>
          <li>Receive product SKU via listener</li>
          <li>
            Fetch product details using{' '}
            <Link to="/docs/apis#getproducts">getProducts</Link>
          </li>
          <li>Display product information to user</li>
          <li>
            Call{' '}
            <Link to="/docs/apis#buypromotedproductios">
              buyPromotedProductIOS
            </Link>{' '}
            if user confirms
          </li>
        </ol>
        <p>
          Also check{' '}
          <Link to="/docs/apis#getpromotedproductios">
            getPromotedProductIOS
          </Link>{' '}
          on app launch for pending promoted products.
        </p>
      </section>

      <section>
        <h2>Event Listener Management</h2>

        <h3>Listener Lifecycle</h3>
        <ol>
          <li>Register listeners before initiating purchases</li>
          <li>Keep listeners active throughout purchase flow</li>
          <li>Remove listeners when no longer needed (cleanup)</li>
        </ol>
        <p>
          Each listener returns a Subscription object with a{' '}
          <code>remove()</code> method for cleanup.
        </p>

        <h3>Event Manager Pattern</h3>
        <p>Consider implementing a centralized event manager that:</p>
        <ul>
          <li>Initializes all IAP event listeners</li>
          <li>Routes events to appropriate handlers</li>
          <li>Integrates with analytics and logging</li>
          <li>Manages listener lifecycle</li>
          <li>Provides cleanup methods</li>
        </ul>
      </section>

      <section>
        <h2>Best Practices</h2>
        <ul>
          <li>
            <strong>Always set up listeners before making purchases</strong> -
            Events may be lost if listeners aren't registered
          </li>
          <li>
            <strong>Handle all error cases</strong> - Provide appropriate user
            feedback for each error type
          </li>
          <li>
            <strong>Clean up listeners</strong> - Remove listeners when
            components unmount to prevent memory leaks
          </li>
          <li>
            <strong>Process purchases idempotently</strong> - Same purchase may
            be delivered multiple times
          </li>
          <li>
            <strong>Validate receipts server-side</strong> - Never trust
            client-side validation alone
          </li>
          <li>
            <strong>Finish/acknowledge purchases promptly</strong> - Unfinished
            transactions may cause issues
          </li>
          <li>
            <strong>Log events for debugging</strong> - Track purchase flow for
            troubleshooting
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Events;
