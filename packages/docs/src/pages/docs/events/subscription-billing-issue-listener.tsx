import { Link } from 'react-router-dom';
import AnchorLink from '../../../components/AnchorLink';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function SubscriptionBillingIssueListener() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="subscriptionBillingIssueListener"
        description="Listener fired when a subscription enters a billing issue state on iOS/iPadOS/Mac Catalyst 16.4+, visionOS 1.0+, or Play Billing 8.1+."
        path="/docs/events/subscription-billing-issue-listener"
        keywords="subscriptionBillingIssueListener, billing issue, subscription, payment problem, grace period"
      />
      <h1>subscriptionBillingIssueListener</h1>
      <p>
        Fired when a subscription enters a state that needs user attention
        because of a payment problem — card declined, expired payment method,
        billing retry, or grace period. Unifies StoreKit 2{' '}
        <code>Message.billingIssue</code> (iOS/iPadOS/Mac Catalyst 16.4+ and
        visionOS 1.0+) and Play Billing <code>Purchase.isSuspended</code> (Play
        Billing Library 8.1+) under a single cross-platform stream. Silent no-op
        on platforms that cannot emit (tvOS, watchOS, macOS, Meta Horizon,
        Amazon Appstore).
      </p>

      <AnchorLink id="listener-setup" level="h2">
        Listener Setup
      </AnchorLink>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`subscriptionBillingIssueListener(
  listener: (purchase: Purchase) => void
): Subscription`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`// iOS/iPadOS/Mac Catalyst 16.4+; visionOS 1.0+
func subscriptionBillingIssueListener(
    _ listener: @escaping @Sendable (Purchase) -> Void
) -> Subscription`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`// Callback approach (Play Billing 8.1+)
fun addSubscriptionBillingIssueListener(
    listener: OpenIapSubscriptionBillingIssueListener
)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`// Flow approach
val subscriptionBillingIssueListener: Flow<Purchase>`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`Stream<Purchase> get subscriptionBillingIssueListener;`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Apple 16.4+ (visionOS 1.0+) / Play Billing 8.1+.
IDisposable subscription = OpenIapClient.Instance.SubscriptionBillingIssue.Subscribe(purchase =>
{
    Console.WriteLine("Subscription billing issue received");
});`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`signal subscription_billing_issue(purchase: Purchase)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>
      <p>
        The emitted{' '}
        <Link to="/docs/types/purchase">
          <code>Purchase</code>
        </Link>{' '}
        is a regular subscription payload — use <code>productId</code>,{' '}
        <code>purchaseToken</code>, and platform fields to prompt the user to
        update payment. Play deduplicates by <code>purchaseToken</code> per
        session; iOS fires per Message delivery.
      </p>
      <p>
        On Apple platforms, StoreKit&apos;s system billing message is still
        presented through <code>Message.display(in:)</code>. This listener is an
        additional notification for your app; it does not replace or suppress
        the default StoreKit UI.
      </p>

      <AnchorLink id="example" level="h2">
        Example
      </AnchorLink>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`// expo-iap
import { subscriptionBillingIssueListener } from 'expo-iap';
// Same API in react-native-iap:
// import { subscriptionBillingIssueListener } from 'react-native-iap';

const subscription = subscriptionBillingIssueListener((purchase) => {
  console.log('Billing issue on', purchase.productId);
  // Surface a "Update payment method" prompt and link the user to
  // the platform's subscription management UI.
  showBillingIssueBanner(purchase);
});

// Cleanup when the screen unmounts
subscription.remove();

// --- Or via the useIAP() hook (also exported from react-native-iap) ---
import { useIAP } from 'expo-iap';

function BillingIssueGate() {
  useIAP({
    onSubscriptionBillingIssue: (purchase) => {
      showBillingIssueBanner(purchase);
    },
  });
  return null;
}`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`import OpenIap

// iOS/iPadOS/Mac Catalyst 16.4+; visionOS 1.0+
let subscription = OpenIapModule.shared.subscriptionBillingIssueListener { purchase in
    print("Billing issue on \\(purchase.productId)")
    Task { await showBillingIssueBanner(purchase) }
}

// Cleanup when the view disappears
OpenIapModule.shared.removeListener(subscription)`}</CodeBlock>
          ),
          kotlin: (
            <CodeBlock language="kotlin">{`import dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener
import dev.hyo.openiap.store.OpenIapStore

val openIapStore = OpenIapStore(context)

// Play Billing Library 8.1+
val listener = OpenIapSubscriptionBillingIssueListener { purchase ->
    println("Billing issue on \${purchase.productId}")
    showBillingIssueBanner(purchase)
}
openIapStore.addSubscriptionBillingIssueListener(listener)

// Cleanup when the view disappears
openIapStore.removeSubscriptionBillingIssueListener(listener)`}</CodeBlock>
          ),
          kmp: (
            <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.KmpIAP

val kmpIAP = KmpIAP()

// Play Billing 8.1+ on Android; Apple 16.4+ (visionOS 1.0+)
lifecycleScope.launch {
    kmpIAP.subscriptionBillingIssueListener.collect { purchase ->
        println("Billing issue on \${purchase.productId}")
        showBillingIssueBanner(purchase)
    }
}`}</CodeBlock>
          ),
          dart: (
            <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final subscription = FlutterInappPurchase.instance
  .subscriptionBillingIssueListener.listen((purchase) {
    debugPrint('Billing issue on \${purchase.productId}');
    showBillingIssueBanner(purchase);
  });

// Cleanup when the widget disposes
subscription.cancel();`}</CodeBlock>
          ),
          csharp: (
            <CodeBlock language="csharp">{`using OpenIap;
using OpenIap.Maui;

// Apple 16.4+ (visionOS 1.0+) / Play Billing Library 8.1+
var subscription = OpenIapClient.Instance.SubscriptionBillingIssue.Subscribe(purchase =>
{
    if (purchase is PurchaseCommon purchaseInfo)
    {
        Console.WriteLine($"Billing issue on {purchaseInfo.ProductId}");
    }

    ShowBillingIssueBanner(purchase);
});

// Cleanup when the view disappears.
subscription.Dispose();`}</CodeBlock>
          ),
          gdscript: (
            <CodeBlock language="gdscript">{`iap.subscription_billing_issue.connect(_on_billing_issue)

func _on_billing_issue(purchase: Purchase):
    print("Billing issue on %s" % purchase.product_id)
    show_billing_issue_banner(purchase)

# Cleanup when leaving the scene
func _exit_tree():
    iap.subscription_billing_issue.disconnect(_on_billing_issue)`}</CodeBlock>
          ),
        }}
      </LanguageTabs>

      <p>
        See{' '}
        <Link to="/docs/features/subscription-billing-issue">
          Subscription Billing Issue feature guide
        </Link>{' '}
        for platform coverage, signal sources, and UX recommendations.
      </p>
    </div>
  );
}

export default SubscriptionBillingIssueListener;
