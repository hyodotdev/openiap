import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import Accordion from '../../../components/Accordion';
import PlatformTabs from '../../../components/PlatformTabs';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function Subscription() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Subscription</h1>
      <p>
        Understanding how subscriptions work on each platform is crucial for
        proper implementation. iOS and Android handle subscription data very
        differently, especially when it comes to renewal information.
      </p>

      <section>
        <AnchorLink id="platform-comparison" level="h2">
          Platform Comparison
        </AnchorLink>
        <p>
          The key difference is <strong>where</strong> subscription information
          is available. iOS provides rich data client-side, while Android
          requires server-side calls for detailed information.
        </p>

        <div
          style={{
            overflowX: 'auto',
            margin: '1.5rem 0',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderBottom: '2px solid var(--border-color)',
                }}
              >
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>
                  Information
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>
                  iOS Client
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>
                  Android Client
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }}>
                  Server (Both)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Auto-renew status</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  ✅ <code>willAutoRenew</code>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  ✅ <code>isAutoRenewing</code>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>✅</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Next renewal product</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  ✅ <code>autoRenewPreference</code>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>❌</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>✅</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Pending upgrade/downgrade</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  ✅ <code>pendingUpgradeProductId</code>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>❌</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>✅</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Expiration reason</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  ✅ <code>expirationReason</code>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>❌</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>✅</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Grace period status</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  ✅ <code>gracePeriodExpirationDate</code>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>❌</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>✅</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Billing retry status</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  ✅ <code>isInBillingRetry</code>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>❌</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>✅</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Renewal date</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  ✅ <code>renewalDate</code>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>❌</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>✅</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  Detailed subscription state
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>✅</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>❌</td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>✅</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Accordion title={<>💡 Key Takeaway</>} variant="tip">
          <p>
            <strong>iOS</strong>: Rich client-side data via{' '}
            <Link to="/docs/types#renewal-info-ios">
              <code>RenewalInfoIOS</code>
            </Link>
            , but server validation is still
            recommended for production apps.
          </p>
          <p>
            <strong>Android</strong>: Only <code>isAutoRenewing</code> available
            client-side. Server-side validation is <strong>required</strong> for
            complete subscription management.
          </p>
          <p>
            <strong>Both platforms</strong>: Use{' '}
            <Link to="/docs/apis#get-active-subscriptions">
              getActiveSubscriptions
            </Link>{' '}
            or{' '}
            <Link to="/docs/apis#get-available-purchases">
              getAvailablePurchases
            </Link>{' '}
            to verify purchases client-side, and implement server-side
            validation for authoritative subscription status.
          </p>
        </Accordion>
      </section>

      <section>
        <AnchorLink id="purchase-verification" level="h2">
          Purchase Verification
        </AnchorLink>
        <p>
          Regardless of platform, you should verify purchases using OpenIAP's
          APIs. These APIs retrieve the latest subscription data from the store
          and provide a unified interface.
        </p>

        <AnchorLink id="client-verification" level="h3">
          Client-Side Verification
        </AnchorLink>
        <p>Use these APIs to check subscription status in your app:</p>
        <ul>
          <li>
            <strong>
              <Link to="/docs/apis#get-active-subscriptions">
                getActiveSubscriptions
              </Link>
            </strong>
            : Returns only currently active subscriptions. Best for checking
            entitlements.
          </li>
          <li>
            <strong>
              <Link to="/docs/apis#get-available-purchases">
                getAvailablePurchases
              </Link>
            </strong>
            : Returns all purchases including expired subscriptions. Useful for
            showing purchase history.
          </li>
        </ul>
        <p>
          These APIs query the store directly and return the latest data,
          including renewal information on iOS.
        </p>

        <AnchorLink id="server-verification" level="h3">
          Server-Side Verification (Recommended)
        </AnchorLink>
        <p>
          For production apps, implement server-side validation for
          authoritative subscription status:
        </p>
        <ul>
          <li>
            <strong>iOS</strong>: App Store Server API +{' '}
            App Store Server Notifications V2
          </li>
          <li>
            <strong>Android</strong>: Google Play Developer API + RTDN
            (Real-time Developer Notifications)
          </li>
        </ul>

        <Accordion title={<>⚠️ Why server-side validation?</>} variant="warning">
          <ul>
            <li>
              <strong>Authoritative source</strong>: Client data can be
              manipulated; server data is trusted
            </li>
            <li>
              <strong>Cross-platform sync</strong>: If users access your service
              from web or other platforms
            </li>
            <li>
              <strong>Background updates</strong>: Subscriptions can renew,
              cancel, or expire when app isn't running
            </li>
            <li>
              <strong>Fraud prevention</strong>: Detect and prevent receipt
              manipulation
            </li>
            <li>
              <strong>Analytics</strong>: Track subscription metrics and
              revenue server-side
            </li>
          </ul>
        </Accordion>
      </section>

      <section>
        <AnchorLink id="subscription-lifecycle" level="h2">
          Subscription Lifecycle
        </AnchorLink>
        <p>
          This section shows how to handle subscription states throughout the
          app lifecycle. The flows apply to both iOS and Android unless noted.
        </p>

        <AnchorLink id="lifecycle-app-launch" level="h3">
          On App Launch
        </AnchorLink>
        <p>
          Check for existing subscriptions when the app starts. This handles
          purchases made while the app was closed.
        </p>
        <PlatformTabs>
          {{
            ios: (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '1rem 1.5rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                }}
              >
                <div>1. initConnection()</div>
                <div>2. getAvailablePurchases() → [PurchaseIOS]</div>
                <div>3. For each purchase:</div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → check transactionState
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → validate with server
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → update local entitlements
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → finishTransaction() for unfinished transactions
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  Note: iOS transaction queue persists unfinished transactions
                </div>
              </div>
            ),
            android: (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '1rem 1.5rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                }}
              >
                <div>1. initConnection()</div>
                <div>2. getAvailablePurchases() → [PurchaseAndroid]</div>
                <div>3. For each purchase:</div>
                <div style={{ paddingLeft: '1.5rem' }}>→ check purchaseState</div>
                <div style={{ paddingLeft: '1.5rem' }}>→ check isAcknowledged</div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → validate with server
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → update local entitlements
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → finishTransaction() if not acknowledged
                </div>
                <div style={{ marginTop: '0.5rem', color: 'var(--text-warning)' }}>
                  ⚠️ Unacknowledged purchases auto-refund after 3 days
                </div>
              </div>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="lifecycle-new-purchase" level="h3">
          New Purchase Flow
        </AnchorLink>
        <p>
          When a user initiates a new subscription purchase. Purchase states
          differ between platforms:
        </p>
        <PlatformTabs>
          {{
            ios: (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '1rem 1.5rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                }}
              >
                <div>1. requestPurchase(sku) → StoreKit payment sheet</div>
                <div>2. purchaseUpdatedListener receives PurchaseIOS</div>
                <div>3. Check transactionState:</div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • <strong>purchased</strong> → validate → deliver →
                  finishTransaction()
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • <strong>pending</strong> → payment processing, wait for
                  update
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • <strong>failed</strong> → show error, check
                  purchaseErrorListener
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • <strong>deferred</strong> → Ask to Buy (parental approval
                  needed)
                </div>
              </div>
            ),
            android: (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '1rem 1.5rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                }}
              >
                <div>1. requestPurchase(sku) → Google Play payment sheet</div>
                <div>2. purchaseUpdatedListener receives PurchaseAndroid</div>
                <div>3. Check purchaseState:</div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • <strong>PURCHASED (1)</strong> → validate → deliver →
                  finishTransaction()
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • <strong>PENDING (2)</strong> → awaiting payment (slow payment
                  methods)
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • <strong>UNSPECIFIED (0)</strong> → unknown state, handle as
                  error
                </div>
                <div style={{ marginTop: '0.5rem', color: 'var(--text-warning)' }}>
                  ⚠️ Must acknowledge within 3 days or auto-refund
                </div>
              </div>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="lifecycle-check-status" level="h3">
          Checking Subscription Status
        </AnchorLink>
        <p>
          Periodically verify subscription status, especially for subscription
          state changes:
        </p>
        <PlatformTabs>
          {{
            ios: (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '1rem 1.5rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                }}
              >
                <div>1. getActiveSubscriptions() → [ActiveSubscriptionIOS]</div>
                <div>2. For each subscription:</div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • isActive = true → grant access
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • check renewalInfoIOS for details:
                </div>
                <div style={{ paddingLeft: '3rem' }}>
                  - willAutoRenew = false → show renewal prompt
                </div>
                <div style={{ paddingLeft: '3rem' }}>
                  - isInBillingRetry = true → show payment issue
                </div>
                <div style={{ paddingLeft: '3rem' }}>
                  - pendingUpgradeProductId → show pending change
                </div>
                <div style={{ paddingLeft: '3rem' }}>
                  - expirationDate → show expiry info
                </div>
                <div>3. No active subscriptions → revoke access</div>
              </div>
            ),
            android: (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '1rem 1.5rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                }}
              >
                <div>
                  1. getActiveSubscriptions() → [ActiveSubscriptionAndroid]
                </div>
                <div>2. For each subscription:</div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • isActive = true → grant access
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • check isAutoRenewing only (limited client data)
                </div>
                <div>3. No active subscriptions → revoke access</div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  Note: For detailed status (expiry, grace period, etc.), use
                  server-side Play Developer API
                </div>
              </div>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="lifecycle-cancellation" level="h3">
          Detecting Cancellations
        </AnchorLink>
        <p>
          Users can cancel subscriptions at any time. The subscription remains
          active until expiration.
        </p>
        <PlatformTabs>
          {{
            ios: (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '1rem 1.5rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                }}
              >
                <div>
                  <strong>Detection:</strong> willAutoRenew = false
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <strong>User still has access:</strong>
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • Until expirationDate (available in renewalInfoIOS)
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <strong>Actions:</strong>
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → Show "subscription ends on [expirationDate]"
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → Offer re-subscribe option
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → Keep access until expiration
                </div>
              </div>
            ),
            android: (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '1rem 1.5rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                }}
              >
                <div>
                  <strong>Detection:</strong> isAutoRenewing = false
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <strong>User still has access:</strong>
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  • Until server-side expiryTime (not available client-side)
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <strong>Actions:</strong>
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → Query server for exact expiry date
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → Offer re-subscribe option
                </div>
                <div style={{ paddingLeft: '1.5rem' }}>
                  → Keep access until server confirms expiry
                </div>
              </div>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="lifecycle-expiration" level="h3">
          Handling Expiration
        </AnchorLink>
        <p>
          When a subscription expires (cancelled + period ended), revoke access:
        </p>
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            lineHeight: '1.6',
            margin: '1rem 0',
          }}
        >
          <div>
            1. getActiveSubscriptions() returns empty or no matching product
          </div>
          <div>2. Verify with server (recommended)</div>
          <div>3. Revoke premium access</div>
          <div>4. Show re-subscribe prompt</div>
        </div>

        <AnchorLink id="lifecycle-restoration" level="h3">
          Restoring Purchases
        </AnchorLink>
        <p>
          Users may need to restore subscriptions on new devices or after
          reinstalling:
        </p>
        <PlatformTabs>
          {{
            ios: (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '1rem 1.5rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                }}
              >
                <div>1. User taps "Restore Purchases"</div>
                <div>2. getAvailablePurchases() → [PurchaseIOS]</div>
                <div>3. StoreKit fetches from Apple ID's purchase history</div>
                <div>4. Validate each purchase with server</div>
                <div>5. Grant access for valid subscriptions</div>
                <div>6. finishTransaction() for each restored purchase</div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  Note: iOS requires "Restore Purchases" button per App Store
                  guidelines
                </div>
              </div>
            ),
            android: (
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '1rem 1.5rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                }}
              >
                <div>1. User taps "Restore Purchases"</div>
                <div>2. getAvailablePurchases() → [PurchaseAndroid]</div>
                <div>
                  3. Play Billing returns purchases for current Google account
                </div>
                <div>4. Validate each purchaseToken with server</div>
                <div>
                  5. Server checks subscription status via Play Developer API
                </div>
                <div>6. Grant access for active subscriptions</div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  Note: Android ties purchases to Google account, auto-restored
                  on same account
                </div>
              </div>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="lifecycle-example" level="h3">
          Example Scenario
        </AnchorLink>
        <p>
          Understanding how subscription states change over time helps implement
          correct handling:
        </p>

        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            padding: '1.5rem',
            borderRadius: '8px',
            margin: '1rem 0',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <strong>Timeline: Cancelled Subscription</strong>
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              lineHeight: '1.8',
            }}
          >
            <div>
              <strong>Day 1:</strong> User cancels subscription
            </div>
            <div style={{ paddingLeft: '1rem', fontSize: '0.85rem' }}>
              • Subscription still valid until Day 30 (billing period end)
            </div>
            <div style={{ paddingLeft: '1rem', fontSize: '0.85rem' }}>
              • iOS: willAutoRenew = false
            </div>
            <div style={{ paddingLeft: '1rem', fontSize: '0.85rem' }}>
              • Android: isAutoRenewing = false
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <strong>Day 15:</strong> User restores purchases
            </div>
            <div style={{ paddingLeft: '1rem', fontSize: '0.85rem' }}>
              • getAvailablePurchases() returns the purchase (not expired)
            </div>
            <div style={{ paddingLeft: '1rem', fontSize: '0.85rem' }}>
              • ✅ Grant access (still valid until Day 30)
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <strong>Day 35:</strong> User restores purchases
            </div>
            <div style={{ paddingLeft: '1rem', fontSize: '0.85rem' }}>
              • iOS: currentEntitlements returns empty (expired)
            </div>
            <div style={{ paddingLeft: '1rem', fontSize: '0.85rem' }}>
              • Android: queryPurchases returns empty (expired)
            </div>
            <div style={{ paddingLeft: '1rem', fontSize: '0.85rem' }}>
              • ✅ No access (correctly expired)
            </div>
          </div>
        </div>

        <Accordion title={<>⚠️ The Refund Edge Case</>} variant="warning">
          <p>This is why server validation is critical:</p>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              lineHeight: '1.8',
              marginTop: '0.5rem',
            }}
          >
            <div>1. User purchases subscription</div>
            <div>2. User requests refund from Apple/Google</div>
            <div>3. Refund is approved</div>
            <div style={{ marginTop: '0.5rem' }}>
              <strong>Without server validation:</strong>
            </div>
            <div style={{ paddingLeft: '1rem' }}>
              • getAvailablePurchases() may still return the purchase temporarily
            </div>
            <div style={{ paddingLeft: '1rem' }}>
              • ❌ App grants access (incorrect - refunded!)
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <strong>With server validation:</strong>
            </div>
            <div style={{ paddingLeft: '1rem' }}>
              • Server detects refund via RTDN/App Store Notifications
            </div>
            <div style={{ paddingLeft: '1rem' }}>
              • ✅ Server denies access (correct)
            </div>
          </div>
        </Accordion>

        <AnchorLink id="when-to-validate" level="h3">
          When to Validate
        </AnchorLink>
        <p>Server validation is needed at these key points:</p>
        <ul>
          <li>
            <strong>After purchase</strong> — Verify the purchase is legitimate
          </li>
          <li>
            <strong>On restore</strong> — Check current status
            (active/cancelled/refunded/expired)
          </li>
          <li>
            <strong>Periodically for active subscriptions</strong> — Detect
            refunds and cancellations
          </li>
          <li>
            <strong>On app launch</strong> — Sync subscription state with server
          </li>
        </ul>

        <Accordion title={<>📝 iOS vs Android: Data Availability</>}>
          <p>
            <strong>iOS</strong>: You can get purchase data from{' '}
            <code>Transaction.all</code> (including expired ones), but there may
            be synchronization delays between devices. The client can check
            expiry/renewal info, but server validation is still recommended for
            security.
          </p>
          <p>
            <strong>Android</strong>: Server-side validation is{' '}
            <strong>mandatory</strong> for subscription management. The client
            can't access expiry time — you must use Google Play Developer API to
            get subscription status, renewal dates, grace periods, etc. This is
            why server-side purchase history management is essential.
          </p>
        </Accordion>

        <Accordion title={<>⚠️ Important Notes</>} variant="warning">
          <ul>
            <li>
              <strong>Always finish transactions</strong>: Unfinished
              transactions will keep appearing on app launch. Call{' '}
              <code>finishTransaction()</code> after validation and content
              delivery.
            </li>
            <li>
              <strong>Android 3-day window</strong>: Android purchases must be
              acknowledged within 3 days or they're automatically refunded.
            </li>
            <li>
              <strong>Server validation</strong>: Client-side checks can be
              bypassed. Always validate with your server for authoritative
              subscription status.
            </li>
            <li>
              <strong>Background renewals</strong>: Subscriptions renew when app
              isn't running. Use server notifications (RTDN for Android, App
              Store Server Notifications for iOS) to track real-time changes.
            </li>
          </ul>
        </Accordion>
      </section>

      <PlatformTabs>
        {{
          ios: (
            <>
              <section>
                <AnchorLink id="ios-overview" level="h2">
                  iOS Subscription Overview
                </AnchorLink>
                <p>
                  iOS provides rich subscription data client-side through
                  StoreKit 2. The{' '}
                  <Link to="/docs/types#renewal-info-ios">
                    <code>RenewalInfoIOS</code>
                  </Link>{' '}
                  type contains
                  detailed renewal information that lets you build subscription
                  management UI without server calls. However, server validation
                  is still recommended for production apps.
                </p>

                <AnchorLink id="ios-renewal-info" level="h3">
                  <Link to="/docs/types#renewal-info-ios">RenewalInfoIOS</Link>
                  &nbsp;Fields
                </AnchorLink>
                <p>
                  This type is available on <code>PurchaseIOS</code> and{' '}
                  <code>ActiveSubscriptionIOS</code> via the{' '}
                  <code>renewalInfoIOS</code> property:
                </p>

                <ul>
                  <li>
                    <strong>willAutoRenew</strong>: Whether the subscription
                    will automatically renew. If <code>false</code>, the user
                    has cancelled but still has access until expiry.
                  </li>
                  <li>
                    <strong>autoRenewPreference</strong>: The product ID that
                    will be used at the next renewal. If different from the
                    current product, the user has scheduled a tier change.
                  </li>
                  <li>
                    <strong>pendingUpgradeProductId</strong>: Convenience field
                    showing the pending tier change target. Calculated by
                    comparing <code>productId</code> and{' '}
                    <code>autoRenewPreference</code>.
                  </li>
                  <li>
                    <strong>renewalDate</strong>: Next renewal date (timestamp
                    in milliseconds).
                  </li>
                  <li>
                    <strong>expirationReason</strong>: Why the subscription
                    expired (autoRenewDisabled, billingError,
                    didNotConsentToPriceIncrease, etc.).
                  </li>
                  <li>
                    <strong>gracePeriodExpirationDate</strong>: Grace period end
                    date if in grace period due to billing issues.
                  </li>
                  <li>
                    <strong>isInBillingRetry</strong>: Whether Apple is
                    currently retrying a failed payment.
                  </li>
                  <li>
                    <strong>offerType / offerIdentifier</strong>: Information
                    about any active promotional offer.
                  </li>
                </ul>
              </section>

              <section>
                <AnchorLink id="ios-upgrade-detection" level="h2">
                  Detecting Tier Changes (Upgrade/Downgrade)
                </AnchorLink>
                <p>
                  Understanding how tier changes work on iOS is crucial for
                  proper subscription management. The behavior differs between
                  upgrades and downgrades.
                </p>

                <AnchorLink id="ios-upgrade-flow" level="h3">
                  Upgrade Flow
                </AnchorLink>
                <p>
                  When a user upgrades (e.g., monthly → yearly), Apple processes
                  the change immediately with a prorated refund for the
                  remaining time on the old plan. However, the purchase data
                  updates in stages:
                </p>
                <ol>
                  <li>
                    <strong>Immediately after upgrade</strong>: The{' '}
                    <code>productId</code> may still show the old tier (monthly),
                    but <code>autoRenewPreference</code> shows the new tier
                    (yearly). The <code>pendingUpgradeProductId</code> is set to
                    the new tier.
                  </li>
                  <li>
                    <strong>After processing (few minutes)</strong>: The{' '}
                    <code>productId</code> updates to the new tier (yearly), and{' '}
                    <code>pendingUpgradeProductId</code> becomes{' '}
                    <code>null</code> since there's no longer a pending change.
                  </li>
                </ol>

                <Accordion
                  title={<>📌 How to detect pending upgrades</>}
                  variant="info"
                >
                  <p>
                    Check <code>pendingUpgradeProductId</code>. If it has a
                    value different from <code>productId</code>, there's a
                    pending tier change:
                  </p>
                  <ul>
                    <li>
                      <strong>pendingUpgradeProductId exists</strong>: Show UI
                      indicating "Your subscription will change to [new tier]"
                    </li>
                    <li>
                      <strong>pendingUpgradeProductId is null</strong>: No
                      pending change; the current <code>productId</code> is the
                      active subscription
                    </li>
                  </ul>
                  <p>
                    This logic is already calculated in{' '}
                    <code>pendingUpgradeProductId</code> by comparing{' '}
                    <code>productId</code> with <code>autoRenewPreference</code>.
                  </p>
                </Accordion>

                <AnchorLink id="ios-downgrade-flow" level="h3">
                  Downgrade Flow
                </AnchorLink>
                <p>
                  Downgrades (e.g., yearly → monthly) are scheduled to take
                  effect at the end of the current billing period:
                </p>
                <ul>
                  <li>
                    <strong>productId</strong>: Shows current tier (yearly) -
                    user keeps premium access
                  </li>
                  <li>
                    <strong>autoRenewPreference</strong>: Shows future tier
                    (monthly)
                  </li>
                  <li>
                    <strong>pendingUpgradeProductId</strong>: Shows monthly
                    (pending downgrade)
                  </li>
                </ul>
                <p>
                  The user retains their current tier until expiry, then
                  switches to the lower tier.
                </p>

                <AnchorLink id="ios-subscription-states" level="h3">
                  Other Subscription States
                </AnchorLink>
                <ul>
                  <li>
                    <strong>Cancellation</strong>: <code>isActive</code> is true
                    but <code>willAutoRenew</code> is false. User has access
                    until expiration.
                  </li>
                  <li>
                    <strong>Grace Period</strong>:{' '}
                    <code>gracePeriodExpirationDate</code> has a value. Billing
                    failed but user still has access temporarily.
                  </li>
                  <li>
                    <strong>Billing Retry</strong>:{' '}
                    <code>isInBillingRetry</code> is true. Apple is retrying the
                    payment.
                  </li>
                </ul>
              </section>

              <section>
                <AnchorLink id="ios-server-validation" level="h2">
                  Server-Side Validation
                </AnchorLink>
                <p>
                  While iOS provides rich client-side data, server validation is
                  still recommended:
                </p>
                <ul>
                  <li>
                    <strong>App Store Server API</strong>: Verify subscription
                    status and get transaction history
                  </li>
                  <li>
                    <strong>App Store Server Notifications V2</strong>: Receive
                    real-time webhook events (renewals, cancellations, refunds,
                    Family Sharing changes)
                  </li>
                </ul>
                <p>
                  Server validation is especially important for cross-platform
                  apps, fraud prevention, and accurate analytics.
                </p>
              </section>

              <section>
                <AnchorLink id="ios-related-apis" level="h2">
                  Related APIs
                </AnchorLink>
                <ul>
                  <li>
                    <Link to="/docs/apis#get-active-subscriptions">
                      getActiveSubscriptions
                    </Link>{' '}
                    - Get active subscriptions with renewal info
                  </li>
                  <li>
                    <Link to="/docs/apis#get-available-purchases">
                      getAvailablePurchases
                    </Link>{' '}
                    - Get all purchases including expired
                  </li>
                  <li>
                    <Link to="/docs/apis#subscription-status-ios">
                      subscriptionStatusIOS
                    </Link>{' '}
                    - Get detailed subscription status
                  </li>
                  <li>
                    <Link to="/docs/types#renewal-info-ios">RenewalInfoIOS</Link>{' '}
                    - Type reference
                  </li>
                </ul>
              </section>
            </>
          ),
          android: (
            <>
              <section>
                <AnchorLink id="android-overview" level="h2">
                  Android Subscription Overview
                </AnchorLink>
                <p>
                  Android's Play Billing Library takes a server-centric
                  approach. Client-side data is intentionally limited, and
                  detailed subscription information must be fetched from Google
                  Play Developer API via your backend.
                </p>

                <AnchorLink id="android-client-data" level="h3">
                  What's Available Client-Side
                </AnchorLink>
                <p>
                  The{' '}
                  <Link to="/docs/types#purchase-android">
                    <code>PurchaseAndroid</code>
                  </Link>{' '}
                  object provides only basic information:
                </p>
                <ul>
                  <li>
                    <strong>productId</strong>: The purchased product ID
                  </li>
                  <li>
                    <strong>purchaseToken</strong>: Token for server-side
                    validation (key for all server API calls)
                  </li>
                  <li>
                    <strong>isAutoRenewing</strong>: Whether the subscription
                    will auto-renew (the only renewal-related field)
                  </li>
                  <li>
                    <strong>purchaseTime</strong>: Original purchase timestamp
                  </li>
                  <li>
                    <strong>purchaseState</strong>: PURCHASED, PENDING, etc.
                  </li>
                </ul>

                <AnchorLink id="android-missing-data" level="h3">
                  What Requires Server API
                </AnchorLink>
                <p>
                  Unlike iOS where{' '}
                  <Link to="/docs/types#renewal-info-ios">
                    <code>RenewalInfoIOS</code>
                  </Link>{' '}
                  provides rich client-side data, the following information on
                  Android is only available via Google Play Developer API:
                </p>
                <ul>
                  <li>Next renewal date / Expiration date</li>
                  <li>Pending upgrade/downgrade information</li>
                  <li>Expiration reason</li>
                  <li>Grace period status</li>
                  <li>Billing retry status</li>
                  <li>
                    Detailed subscription state (ACTIVE, CANCELED, PAUSED,
                    ON_HOLD, IN_GRACE_PERIOD, EXPIRED)
                  </li>
                </ul>
              </section>

              <section>
                <AnchorLink id="android-server-requirements" level="h2">
                  Server-Side Requirements
                </AnchorLink>
                <p>
                  To build complete subscription management on Android, you need
                  a backend that communicates with Google Play:
                </p>

                <AnchorLink id="android-developer-api" level="h3">
                  1. Google Play Developer API
                </AnchorLink>
                <p>
                  Use <code>purchases.subscriptionsv2.get</code> with the
                  purchase token to get:
                </p>
                <ul>
                  <li>
                    <strong>subscriptionState</strong>: Current state (ACTIVE,
                    CANCELED, IN_GRACE_PERIOD, ON_HOLD, PAUSED, EXPIRED)
                  </li>
                  <li>
                    <strong>expiryTime</strong>: When the subscription expires
                  </li>
                  <li>
                    <strong>autoRenewEnabled</strong>: Whether auto-renewal is
                    enabled
                  </li>
                  <li>
                    <strong>linkedPurchaseToken</strong>: Previous token if this
                    is an upgrade/downgrade (links subscription history)
                  </li>
                  <li>
                    <strong>canceledStateContext</strong>: Cancellation details
                    (user-initiated, system-initiated, developer-initiated)
                  </li>
                </ul>

                <AnchorLink id="android-rtdn" level="h3">
                  2. Real-time Developer Notifications (RTDN)
                </AnchorLink>
                <p>
                  RTDN pushes subscription events to your server via Google
                  Cloud Pub/Sub. Essential because subscription state can change
                  without app interaction.
                </p>
                <p>Key notification types:</p>
                <ul>
                  <li>
                    <strong>SUBSCRIPTION_PURCHASED</strong> (4): New
                    subscription or deferred change took effect
                  </li>
                  <li>
                    <strong>SUBSCRIPTION_RENEWED</strong> (2): Successful
                    renewal
                  </li>
                  <li>
                    <strong>SUBSCRIPTION_CANCELED</strong> (3): User cancelled
                    (still active until expiry)
                  </li>
                  <li>
                    <strong>SUBSCRIPTION_EXPIRED</strong> (13): Subscription
                    expired
                  </li>
                  <li>
                    <strong>SUBSCRIPTION_IN_GRACE_PERIOD</strong> (6): Billing
                    failed, grace period started
                  </li>
                  <li>
                    <strong>SUBSCRIPTION_ON_HOLD</strong> (5): Paused due to
                    billing issues
                  </li>
                  <li>
                    <strong>SUBSCRIPTION_RECOVERED</strong> (1): Billing retry
                    succeeded
                  </li>
                  <li>
                    <strong>SUBSCRIPTION_REVOKED</strong> (12): Access revoked
                    (refund, etc.)
                  </li>
                </ul>

                <Accordion title={<>📝 Setting up RTDN</>}>
                  <ol>
                    <li>Create Cloud Pub/Sub topic in Google Cloud Console</li>
                    <li>
                      Configure in Google Play Console (Monetization setup →
                      Real-time developer notifications)
                    </li>
                    <li>Create subscription to the topic (push or pull)</li>
                    <li>Implement webhook to handle notifications</li>
                  </ol>
                  <p>
                    See{' '}
                    <a
                      href="https://developer.android.com/google/play/billing/rtdn-reference"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      RTDN Reference
                    </a>{' '}
                    for detailed setup.
                  </p>
                </Accordion>
              </section>

              <section>
                <AnchorLink id="android-architecture" level="h2">
                  Recommended Architecture
                </AnchorLink>
                <p>The typical flow for Android subscription management:</p>
                <ol>
                  <li>
                    <strong>App completes purchase</strong>: Receives{' '}
                    <code>purchaseToken</code> from Play Billing
                  </li>
                  <li>
                    <strong>App sends token to your server</strong>: Backend
                    validates the purchase
                  </li>
                  <li>
                    <strong>Server calls Play Developer API</strong>: Fetches
                    detailed subscription status
                  </li>
                  <li>
                    <strong>Server returns status to app</strong>: App displays
                    subscription info
                  </li>
                  <li>
                    <strong>RTDN updates server</strong>: When subscription
                    state changes, server is notified
                  </li>
                  <li>
                    <strong>App refreshes from server</strong>: Periodically or
                    on app launch
                  </li>
                </ol>

                <Accordion
                  title={<>⚠️ Why this architecture?</>}
                  variant="warning"
                >
                  <p>
                    Google designed Play Billing server-centric for several
                    reasons:
                  </p>
                  <ul>
                    <li>
                      Client-side data can be manipulated; server-side is
                      authoritative
                    </li>
                    <li>
                      Subscription state can change without app interaction
                      (renewals, cancellations via Play Store)
                    </li>
                    <li>
                      RTDN ensures real-time updates even when app isn't running
                    </li>
                  </ul>
                  <p>
                    For an iOS-like client experience on Android, build a
                    backend that syncs with Google Play and caches subscription
                    status.
                  </p>
                </Accordion>
              </section>

              <section>
                <AnchorLink id="android-tier-changes" level="h2">
                  Handling Tier Changes
                </AnchorLink>

                <AnchorLink id="android-upgrade-downgrade" level="h3">
                  Upgrades/Downgrades
                </AnchorLink>
                <p>
                  Since Android doesn't expose pending tier changes client-side,
                  track them via server:
                </p>
                <ul>
                  <li>
                    <strong>DEFERRED mode</strong>: Change is scheduled but not
                    reflected in client data. Track in your backend.
                  </li>
                  <li>
                    <strong>linkedPurchaseToken</strong>: Server API returns
                    this to link old and new subscriptions.
                  </li>
                  <li>
                    <strong>RTDN</strong>: Receives{' '}
                    <code>SUBSCRIPTION_PURCHASED</code> when deferred change
                    takes effect.
                  </li>
                </ul>
                <p>
                  See{' '}
                  <Link to="/docs/features/subscription-upgrade-downgrade">
                    Subscription Upgrade/Downgrade
                  </Link>{' '}
                  for implementation details.
                </p>

                <AnchorLink id="android-cancellation" level="h3">
                  Cancellations
                </AnchorLink>
                <p>
                  Client-side, only <code>isAutoRenewing === false</code> is
                  available. For accurate cancellation details (when, why, by
                  whom), use the server API which provides{' '}
                  <code>canceledStateContext</code>.
                </p>
              </section>

              <section>
                <AnchorLink id="android-related-apis" level="h2">
                  Related APIs
                </AnchorLink>
                <ul>
                  <li>
                    <Link to="/docs/apis#get-active-subscriptions">
                      getActiveSubscriptions
                    </Link>{' '}
                    - Get active subscriptions (limited data)
                  </li>
                  <li>
                    <Link to="/docs/apis#get-available-purchases">
                      getAvailablePurchases
                    </Link>{' '}
                    - Get all purchases including subscriptions
                  </li>
                  <li>
                    <a
                      href="https://developer.android.com/google/play/billing/rtdn-reference"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Google RTDN Reference
                    </a>{' '}
                    - Real-time developer notifications
                  </li>
                  <li>
                    <a
                      href="https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Google Play Developer API
                    </a>{' '}
                    - Server-side subscription validation
                  </li>
                </ul>
              </section>
            </>
          ),
        }}
      </PlatformTabs>

      <section>
        <AnchorLink id="summary" level="h2">
          Summary
        </AnchorLink>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginTop: '1.5rem',
          }}
        >
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3 style={{ marginTop: 0 }}>iOS</h3>
            <ul style={{ marginBottom: 0 }}>
              <li>
                Rich client-side data via{' '}
                <Link to="/docs/types#renewal-info-ios">
                  <code>RenewalInfoIOS</code>
                </Link>
              </li>
              <li>
                Use <code>pendingUpgradeProductId</code> for tier change
                detection
              </li>
              <li>Server-side recommended for production apps</li>
              <li>App Store Server Notifications V2 for webhooks</li>
            </ul>
          </div>

          <div
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Android</h3>
            <ul style={{ marginBottom: 0 }}>
              <li>
                Only <code>isAutoRenewing</code> available client-side
              </li>
              <li>Server-side required for detailed subscription info</li>
              <li>Use Google Play Developer API for authoritative data</li>
              <li>RTDN for real-time subscription updates</li>
            </ul>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <Accordion title={<>🔗 Related Documentation</>} variant="info">
            <ul>
              <li>
                <Link to="/docs/lifecycle">Life Cycle</Link> - Overall purchase
                lifecycle
              </li>
              <li>
                <Link to="/docs/features/subscription-upgrade-downgrade">
                  Subscription Upgrade/Downgrade
                </Link>{' '}
                - Tier change implementation
              </li>
              <li>
                <Link to="/docs/types#renewal-info-ios">
                  Types: RenewalInfoIOS
                </Link>{' '}
                - Type reference
              </li>
              <li>
                <Link to="/docs/apis#get-active-subscriptions">
                  APIs: getActiveSubscriptions
                </Link>{' '}
                - API reference
              </li>
            </ul>
          </Accordion>
        </div>
      </section>
    </div>
  );
}

export default Subscription;
