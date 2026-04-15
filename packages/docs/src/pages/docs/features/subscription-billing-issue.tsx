import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function SubscriptionBillingIssue() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Subscription Billing Issue Event"
        description="Cross-platform event that fires when an active subscription needs user attention for a billing problem. Unifies StoreKit 2 Message.billingIssue (iOS 18+) and Play Billing isSuspended (Android 8.1+)."
        path="/docs/features/subscription-billing-issue"
        keywords="subscription, billing issue, isSuspended, StoreKit Message, billingIssue, payment failure, retry"
      />
      <h1>Subscription Billing Issue Event</h1>
      <p>
        A single cross-platform event that fires when a user&apos;s active
        subscription enters a state that needs attention due to a payment
        problem (card declined, expired payment method, billing retry, grace
        period, etc.).
      </p>

      <section>
        <AnchorLink id="platform-behavior" level="h2">
          Platform behavior
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Signal Source</th>
              <th>Delivery</th>
              <th>Minimum Version</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>iOS / iPadOS</td>
              <td>
                <code>StoreKit.Message.Reason.billingIssue</code>
              </td>
              <td>Push, while app is active</td>
              <td>iOS 18.0+</td>
            </tr>
            <tr>
              <td>Mac Catalyst</td>
              <td>
                <code>StoreKit.Message.Reason.billingIssue</code>
              </td>
              <td>Push, while app is active</td>
              <td>Mac Catalyst 18.0+</td>
            </tr>
            <tr>
              <td>Android (Play)</td>
              <td>
                <code>Purchase.isSuspended</code>
              </td>
              <td>
                Poll via <code>getAvailablePurchases</code> or on{' '}
                <code>onPurchasesUpdated</code>
              </td>
              <td>Play Billing Library 8.1+</td>
            </tr>
            <tr>
              <td>Android (Meta Horizon)</td>
              <td>Not available</td>
              <td>Never fires (silent no-op)</td>
              <td>N/A — Billing 7.0 compat SDK</td>
            </tr>
            <tr>
              <td>macOS / tvOS / watchOS / visionOS</td>
              <td>
                <code>StoreKit.Message</code> not available
              </td>
              <td>Never fires</td>
              <td>N/A</td>
            </tr>
          </tbody>
        </table>
        <p>
          Apple references:{' '}
          <a
            href="https://developer.apple.com/documentation/storekit/message"
            target="_blank"
            rel="noopener noreferrer"
          >
            StoreKit.Message
          </a>
          {' · '}
          <a
            href="https://developer.apple.com/documentation/storekit/message/reason-swift.struct/billingissue"
            target="_blank"
            rel="noopener noreferrer"
          >
            Reason.billingIssue
          </a>
          . Google reference:{' '}
          <a
            href="https://developer.android.com/google/play/billing/subscriptions#suspended"
            target="_blank"
            rel="noopener noreferrer"
          >
            Suspended subscriptions
          </a>
          .
        </p>
      </section>

      <section>
        <AnchorLink id="recommended-ux" level="h2">
          Recommended UX
        </AnchorLink>
        <p>
          When this event fires, route the user to the platform subscription
          center via <code>deepLinkToSubscriptions()</code> so they can update
          their payment method. Do <strong>not</strong> re-grant entitlements on
          the assumption the subscription is still active — Play suspends
          entitlement for these purchases, and iOS will re-emit the message
          until the billing issue is resolved.
        </p>
      </section>

      <section>
        <AnchorLink id="usage" level="h2">
          Usage
        </AnchorLink>
        <LanguageTabs>
          {{
            typescript: (
              <CodeBlock language="typescript">{`// react-native-iap OR expo-iap
import {
  subscriptionBillingIssueListener,
  deepLinkToSubscriptions,
} from 'react-native-iap';

const subscription = subscriptionBillingIssueListener((purchase) => {
  console.warn('Subscription needs attention:', purchase.productId);
  deepLinkToSubscriptions({
    skuAndroid: purchase.productId,
    packageNameAndroid: 'com.example.app',
  });
});

// Cleanup
subscription.remove();`}</CodeBlock>
            ),
            dart: (
              <CodeBlock language="dart">{`final iap = FlutterInappPurchase.instance;

final sub = iap.subscriptionBillingIssueListener.listen((purchase) {
  debugPrint('Needs attention: \${purchase.productId}');
  iap.deepLinkToSubscriptions(options: DeepLinkOptions(
    skuAndroid: purchase.productId,
    packageNameAndroid: 'com.example.app',
  ));
});

await sub.cancel();`}</CodeBlock>
            ),
            gdscript: (
              <CodeBlock language="gdscript">{`# godot-iap signal
var godot_iap := preload("res://addons/godot-iap/godot_iap.gd").new()
godot_iap.subscription_billing_issue.connect(func(purchase: Dictionary) -> void:
    print("Needs attention: ", purchase["productId"])
    godot_iap.deep_link_to_subscriptions({
        "skuAndroid": purchase["productId"],
        "packageNameAndroid": "com.example.app",
    })
)`}</CodeBlock>
            ),
            kmp: (
              <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.kmpIapInstance
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

kmpIapInstance.subscriptionBillingIssueListener
    .onEach { purchase ->
        println("Needs attention: \${purchase.productId}")
        kmpIapInstance.deepLinkToSubscriptions(
            DeepLinkOptions(
                skuAndroid = purchase.productId,
                packageNameAndroid = "com.example.app",
            ),
        )
    }
    .launchIn(scope)`}</CodeBlock>
            ),
          }}
        </LanguageTabs>
      </section>

      <section>
        <AnchorLink id="deduping" level="h2">
          Deduping
        </AnchorLink>
        <p>
          On Android, the native SDK tracks emitted purchase tokens per session
          so the event fires <em>once per affected purchase</em> even if the app
          polls <code>getAvailablePurchases</code> repeatedly. A new app
          process, or a cleared billing issue that re-enters suspension, will
          re-emit.
        </p>
        <p>
          On iOS the StoreKit Message may be re-delivered by the system until
          the user resolves the underlying issue; for a given message the SDK
          scans current entitlements and fires one event per subscription in{' '}
          <code>.inBillingRetryPeriod</code> or <code>.inGracePeriod</code>.
        </p>
      </section>
    </div>
  );
}

export default SubscriptionBillingIssue;
