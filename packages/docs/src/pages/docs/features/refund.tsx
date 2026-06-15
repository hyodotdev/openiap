import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import TLDRBox from '../../../components/TLDRBox';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function Refund() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Refund"
        description="Handle in-app purchase refunds across iOS and Android. beginRefundRequestIOS, Android auto-refund, and server-side webhook detection."
        path="/docs/features/refund"
        keywords="refund, beginRefundRequestIOS, StoreKit refund, Google Play refund, App Store Server Notifications, Real-time Developer Notifications, refund webhook"
      />
      <h1>Refund</h1>
      <p>
        Handle refunds initiated by users or store-side actions. iOS supports
        in-app refund requests via StoreKit 2, while Android refunds are
        store-driven and require server-side detection.
      </p>

      <TLDRBox>
        <ul>
          <li>
            <strong>iOS 15+</strong>: Use{' '}
            <a href="#begin-refund-request-ios">
              <code>beginRefundRequestIOS</code>
            </a>{' '}
            to present an in-app refund sheet
          </li>
          <li>
            <strong>Android</strong>: No client-side refund API. Auto-refunded
            after 3 days if not acknowledged
          </li>
          <li>
            <strong>Server-side</strong>: Subscribe to App Store Server
            Notifications V2 (Apple) and Real-time Developer Notifications
            (Google) to react to refunds
          </li>
          <li>
            <strong>Critical</strong>: Always revoke entitlements when a refund
            is detected
          </li>
        </ul>
      </TLDRBox>

      <section>
        <AnchorLink id="platform-differences" level="h2">
          Platform Differences
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Client API</th>
              <th>Detection</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>iOS</td>
              <td>
                <code>beginRefundRequestIOS</code> (iOS 15+)
              </td>
              <td>
                App Store Server Notifications V2 (<code>REFUND</code>,{' '}
                <code>REVOKE</code>)
              </td>
            </tr>
            <tr>
              <td>Android</td>
              <td>None — store-driven</td>
              <td>
                Real-time Developer Notifications —{' '}
                <code>voidedPurchaseNotification</code> for one-time products,{' '}
                <code>subscriptionNotification.SUBSCRIPTION_REVOKED</code> for
                subscriptions — plus server-side reconciliation via the Voided
                Purchases API
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="platform-implementation" level="h2">
          Platform Implementation
        </AnchorLink>

        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="ios-overview" level="h3">
                  Overview
                </AnchorLink>
                <p>
                  iOS lets users request refunds directly from inside your app
                  using StoreKit 2's refund sheet. The system handles the refund
                  flow; your app receives the result via the returned status
                  string.
                </p>
                <ul>
                  <li>Requires iOS 15+</li>
                  <li>Not available on tvOS</li>
                  <li>
                    The actual refund decision is made by Apple — the API only
                    initiates the request
                  </li>
                  <li>
                    For detection of approved refunds, use App Store Server
                    Notifications V2
                  </li>
                </ul>

                <AnchorLink id="begin-refund-request-ios" level="h3">
                  beginRefundRequestIOS
                </AnchorLink>
                <p>
                  Present the refund request sheet for a previously purchased
                  product.
                </p>
                <LanguageTabs>
                  {{
                    typescript: (
                      <CodeBlock language="typescript">{`import { beginRefundRequestIOS } from 'expo-iap';

const status = await beginRefundRequestIOS(purchase.productId);

switch (status) {
  case 'success':
    console.log('Refund request submitted');
    break;
  case 'userCancelled':
    console.log('User cancelled refund flow');
    break;
  default:
    console.log('Refund request status:', status);
}`}</CodeBlock>
                    ),
                    swift: (
                      <CodeBlock language="swift">{`import OpenIap

let status = try await OpenIapModule.shared.beginRefundRequestIOS(sku: purchase.productId)

if let status {
    switch status {
    case "success":
        print("Refund request submitted")
    case "userCancelled":
        print("User cancelled refund flow")
    default:
        print("Refund request status: \\(status)")
    }
} else {
    print("Refund request status: nil")
}`}</CodeBlock>
                    ),
                    kotlin: (
                      <CodeBlock language="kotlin">{`// KMP iOS target
val status = openIapStore.beginRefundRequestIOS(sku = purchase.productId)

when (status) {
    "success" -> println("Refund request submitted")
    "userCancelled" -> println("User cancelled refund flow")
    else -> println("Refund request status: \$status")
}`}</CodeBlock>
                    ),
                    kmp: (
                      <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP

val kmpIAP = KmpIAP()
val status = kmpIAP.beginRefundRequestIOS(sku = purchase.productId)

when (status) {
    "success" -> println("Refund request submitted")
    "userCancelled" -> println("User cancelled refund flow")
    else -> println("Refund request status: \$status")
}`}</CodeBlock>
                    ),
                    dart: (
                      <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final status = await FlutterInappPurchase.instance
    .beginRefundRequestIOS(purchase.productId);

switch (status) {
  case 'success':
    print('Refund request submitted');
    break;
  case 'userCancelled':
    print('User cancelled refund flow');
    break;
  default:
    print('Refund request status: \$status');
}`}</CodeBlock>
                    ),
                    csharp: (
                      <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

var status = await ((MutationResolver)OpenIapClient.Instance)
    .BeginRefundRequestIOSAsync(purchase.ProductId);

switch (status)
{
    case "success":
        Console.WriteLine("Refund request submitted");
        break;
    case "userCancelled":
        Console.WriteLine("User cancelled refund flow");
        break;
    default:
        Console.WriteLine($"Refund request status: {status}");
        break;
}`}</CodeBlock>
                    ),
                    gdscript: (
                      <CodeBlock language="gdscript">{`var status = await iap.begin_refund_request_ios(purchase.product_id)

match status:
    "success":
        print("Refund request submitted")
    "userCancelled":
        print("User cancelled refund flow")
    _:
        print("Refund request status: ", status)`}</CodeBlock>
                    ),
                  }}
                </LanguageTabs>

                <AnchorLink id="ios-server-notifications" level="h3">
                  App Store Server Notifications V2
                </AnchorLink>
                <p>
                  Apple sends a server-to-server notification when a refund is
                  approved. Subscribe to handle revocation reliably — the in-app
                  status is just the request, not the final outcome.
                </p>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>notificationType</th>
                      <th>Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>REFUND</code>
                      </td>
                      <td>Apple refunded the user</td>
                    </tr>
                    <tr>
                      <td>
                        <code>REFUND_DECLINED</code>
                      </td>
                      <td>Refund was declined</td>
                    </tr>
                    <tr>
                      <td>
                        <code>REVOKE</code>
                      </td>
                      <td>
                        Family Sharing access revoked (treat like a refund)
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>CONSUMPTION_REQUEST</code>
                      </td>
                      <td>
                        Apple wants consumption data to decide on a refund —
                        respond within 12 hours
                      </td>
                    </tr>
                  </tbody>
                </table>
                <CodeBlock language="typescript">{`// Server webhook handler (Node.js).
// In App Store Server Notifications V2, signedTransactionInfo is itself a
// signed JWS string — verify and decode it to read its fields.
app.post('/webhooks/apple', async (req, res) => {
  const { signedPayload } = req.body;
  const decoded = await verifyAndDecodeJWS(signedPayload);

  if (decoded.notificationType === 'REFUND' || decoded.notificationType === 'REVOKE') {
    const transactionInfo = await verifyAndDecodeJWS(
      decoded.data.signedTransactionInfo,
    );
    await revokeEntitlement(transactionInfo.transactionId);
  }

  res.sendStatus(200);
});`}</CodeBlock>

                <AnchorLink id="ios-testing" level="h3">
                  Testing
                </AnchorLink>
                <ul>
                  <li>
                    <code>beginRefundRequestIOS</code> can be exercised in
                    sandbox but the sheet may show limited UI
                  </li>
                  <li>
                    Use StoreKit's "Refund" command in Xcode StoreKit
                    Configuration to simulate refunds
                  </li>
                  <li>
                    Configure the sandbox URL for App Store Server Notifications
                    in App Store Connect
                  </li>
                </ul>
              </>
            ),
            android: (
              <>
                <AnchorLink id="android-overview" level="h3">
                  Overview
                </AnchorLink>
                <p>
                  Google Play does not expose an in-app refund API. Refunds
                  originate from the Play Store, support requests, or
                  developer-initiated actions in the Play Console. Two paths
                  trigger an effective refund:
                </p>
                <ul>
                  <li>
                    <strong>Auto-refund after 3 days</strong> — Google
                    automatically refunds purchases that aren't acknowledged
                    within 3 days. Always call <code>finishTransaction</code>{' '}
                    immediately after server verification.
                  </li>
                  <li>
                    <strong>User or Play Console refund</strong> — initiated via
                    Play Store, Google support, or your Play Console
                  </li>
                </ul>

                <div className="alert-card alert-card--warning">
                  <p>
                    <strong>Critical:</strong> If you don't acknowledge an
                    Android purchase within 3 days, Google will auto-refund the
                    user. See <Link to="/docs/features/purchase">Purchase</Link>{' '}
                    for the acknowledgment flow.
                  </p>
                </div>

                <AnchorLink id="android-rtdn" level="h3">
                  Real-time Developer Notifications
                </AnchorLink>
                <p>
                  Subscribe to Pub/Sub-backed Real-time Developer Notifications
                  (RTDN) to receive refund events. There is no client API to
                  query refund state directly.
                </p>
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th>Notification</th>
                      <th>Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <code>voidedPurchaseNotification</code>
                      </td>
                      <td>
                        One-time product refund or chargeback. Includes{' '}
                        <code>refundType</code> (1 = full refund, 2 =
                        quantity-based partial refund).
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <code>subscriptionNotification</code> /{' '}
                        <code>SUBSCRIPTION_REVOKED</code> (notificationType 12)
                      </td>
                      <td>
                        Subscription was revoked before expiration (refund,
                        chargeback, or developer revocation).
                      </td>
                    </tr>
                  </tbody>
                </table>
                <CodeBlock language="typescript">{`// Server webhook handler (Node.js)
app.post('/webhooks/google', async (req, res) => {
  const message = JSON.parse(
    Buffer.from(req.body.message.data, 'base64').toString()
  );

  if (message.voidedPurchaseNotification) {
    const purchaseToken = message.voidedPurchaseNotification.purchaseToken;
    await revokeEntitlementByToken(purchaseToken);
  }

  if (message.subscriptionNotification?.notificationType === 12) {
    // SUBSCRIPTION_REVOKED
    const purchaseToken = message.subscriptionNotification.purchaseToken;
    await revokeEntitlementByToken(purchaseToken);
  }

  res.sendStatus(200);
});`}</CodeBlock>

                <AnchorLink id="android-voided-api" level="h3">
                  Voided Purchases API (fallback)
                </AnchorLink>
                <p>
                  If you cannot run a webhook, poll the{' '}
                  <a
                    href="https://developers.google.com/android-publisher/voided-purchases"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Play Voided Purchases API
                  </a>
                  . It returns purchases voided in the last 30 days (or 60 days
                  with extended access).
                </p>

                <AnchorLink id="android-testing" level="h3">
                  Testing
                </AnchorLink>
                <ul>
                  <li>
                    Use license testers and the "Refund" action in Play Console
                    to simulate refunds
                  </li>
                  <li>RTDN works in test tracks once Pub/Sub is wired up</li>
                  <li>
                    To test the 3-day auto-refund, intentionally skip{' '}
                    <code>finishTransaction</code> and wait
                  </li>
                </ul>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <AnchorLink id="entitlement-revocation" level="h2">
          Revoking Entitlements
        </AnchorLink>
        <p>
          When a refund is detected — through a webhook, polling, or a manual
          process — revoke the user's entitlement and clean up downstream state.
        </p>
        <CodeBlock language="typescript">{`async function revokeEntitlement(transactionId: string) {
  // 1. Mark entitlement inactive in your database
  await db.entitlements.update({
    where: { transactionId },
    data: { status: 'refunded', revokedAt: new Date() },
  });

  // 2. Restrict access in any cached/session state
  await invalidateUserSessionsForTransaction(transactionId);

  // 3. (Optional) Notify the user out-of-band
  await sendRefundConfirmationEmail(transactionId);
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="related" level="h2">
          Related
        </AnchorLink>
        <ul>
          <li>
            <Link to="/docs/apis/ios/begin-refund-request-ios">
              beginRefundRequestIOS API Reference
            </Link>
          </li>
          <li>
            <Link to="/docs/features/purchase">
              Purchase Flow & Acknowledgment
            </Link>
          </li>
          <li>
            <Link to="/docs/features/subscription">Subscription Lifecycle</Link>
          </li>
          <li>
            <Link to="/docs/features/validation">Server-side Validation</Link>
          </li>
          <li>
            <Link to="/docs/events">Events & Listeners</Link>
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="references" level="h2">
          Native References
        </AnchorLink>
        <ul>
          <li>
            Apple ·{' '}
            <a
              href="https://developer.apple.com/documentation/storekit/transaction/beginrefundrequest(in:)"
              target="_blank"
              rel="noopener noreferrer"
            >
              Transaction.beginRefundRequest(in:)
            </a>{' '}
            — StoreKit 2 in-app refund sheet
          </li>
          <li>
            Apple ·{' '}
            <a
              href="https://developer.apple.com/documentation/appstoreservernotifications"
              target="_blank"
              rel="noopener noreferrer"
            >
              App Store Server Notifications V2
            </a>{' '}
            — server-to-server REFUND / REVOKE events
          </li>
          <li>
            Google ·{' '}
            <a
              href="https://developer.android.com/google/play/billing/refunds"
              target="_blank"
              rel="noopener noreferrer"
            >
              Issue refunds
            </a>{' '}
            — Play Console refund flow
          </li>
          <li>
            Google ·{' '}
            <a
              href="https://developers.google.com/android-publisher/voided-purchases"
              target="_blank"
              rel="noopener noreferrer"
            >
              Voided Purchases API
            </a>{' '}
            — fallback polling for voided orders
          </li>
        </ul>
      </section>
    </div>
  );
}

export default Refund;
