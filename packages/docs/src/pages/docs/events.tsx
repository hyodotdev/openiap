import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import LanguageTabs from '../../components/LanguageTabs';
import SEO from '../../components/SEO';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function Events() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Events"
        description="OpenIAP event-driven architecture for purchase handling. Set up purchaseUpdatedListener and purchaseErrorListener to handle transactions asynchronously."
        path="/docs/events"
        keywords="IAP events, purchaseUpdatedListener, purchaseErrorListener, purchase listener, transaction events, async purchase handling"
      />
      <h1>Events</h1>
      <p>
        Complete listener reference for OpenIAP. Every event listener is listed
        below with a one-line description and a link to its full signature. The
        IAP library uses an event-driven architecture to handle purchase flows
        asynchronously — set up listeners before initiating any purchase to
        properly handle the results.
      </p>

      <section>
        <AnchorLink id="event-system-overview" level="h2">
          Event System Overview
        </AnchorLink>
        <p>
          The IAP library uses an event-driven architecture to handle purchase
          flows asynchronously. You must set up event listeners before
          initiating any purchase to properly handle the results.
        </p>

        <h3>Event Types</h3>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`enum IapEvent {
  PurchaseUpdated = 'purchaseUpdated',
  PurchaseError = 'purchaseError',
  PromotedProductIOS = 'promotedProductIOS',
  UserChoiceBillingAndroid = 'userChoiceBillingAndroid',
  DeveloperProvidedBillingAndroid = 'developerProvidedBillingAndroid', // 8.3.0+
}`}</CodeBlock>
            ),
            swift: (
              <CodeBlock language="swift">{`enum IapEvent {
    case purchaseUpdated
    case purchaseError
    case promotedProductIOS
}`}</CodeBlock>
            ),
            kotlin: (
              <CodeBlock language="kotlin">{`enum class IapEvent {
    PurchaseUpdated,
    PurchaseError,
    UserChoiceBillingAndroid,
    DeveloperProvidedBillingAndroid // 8.3.0+
}`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`enum class IapEvent {
    PurchaseUpdated,
    PurchaseError,
    UserChoiceBillingAndroid,
    DeveloperProvidedBillingAndroid // 8.3.0+
}`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`enum IapEvent {
  purchaseUpdated,
  purchaseError,
  promotedProductIOS,
  userChoiceBillingAndroid,
  developerProvidedBillingAndroid, // 8.3.0+
}`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`enum IapEvent {
    PURCHASE_UPDATED = 0,
    PURCHASE_ERROR = 1,
    PROMOTED_PRODUCT_IOS = 2,
    USER_CHOICE_BILLING_ANDROID = 3,
    DEVELOPER_PROVIDED_BILLING_ANDROID = 4, # 8.3.0+
}`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="listeners" level="h2">
          Listeners
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Listener</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/events/purchase-updated-listener">
                  <code>purchaseUpdatedListener</code>
                </Link>
              </td>
              <td>
                Fires when a purchase is successful or a pending purchase is
                completed.
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/events/purchase-error-listener">
                  <code>purchaseErrorListener</code>
                </Link>
              </td>
              <td>Fires when a purchase fails or is cancelled by the user.</td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/events/subscription-billing-issue-listener">
                  <code>subscriptionBillingIssueListener</code>
                </Link>
              </td>
              <td>
                Fires when an active subscription enters a billing issue state
                (iOS 18+ / Play Billing 8.1+).
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="ios-listeners" level="h2">
          iOS Listeners
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Listener</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/events/ios/promoted-product-listener-ios">
                  <code>promotedProductListenerIOS</code>
                </Link>
              </td>
              <td>
                Fires when a user clicks on a promoted in-app purchase in the
                App Store.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="android-listeners" level="h2">
          Android Listeners
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Listener</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <Link to="/docs/events/android/user-choice-billing-listener-android">
                  <code>userChoiceBillingListenerAndroid</code>
                </Link>
              </td>
              <td>
                Fires when a user selects alternative billing in the User Choice
                Billing dialog.
              </td>
            </tr>
            <tr>
              <td>
                <Link to="/docs/events/android/developer-provided-billing-listener-android">
                  <code>developerProvidedBillingListenerAndroid</code>
                </Link>
              </td>
              <td>
                Fires when a user selects developer-provided billing in the
                External Payments flow (8.3.0+, Japan only).
              </td>
            </tr>
          </tbody>
        </table>
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
