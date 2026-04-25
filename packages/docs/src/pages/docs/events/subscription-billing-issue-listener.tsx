import { Link } from 'react-router-dom';
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
        description="Listener fired when an active subscription enters a billing issue state on iOS 18+ or Play Billing 8.1+."
        path="/docs/events/subscription-billing-issue-listener"
        keywords="subscriptionBillingIssueListener, billing issue, subscription, payment problem, grace period"
      />
      <h1>subscriptionBillingIssueListener</h1>
      <p>
        Fired when an active subscription enters a state that needs user
        attention because of a payment problem — card declined, expired payment
        method, billing retry, or grace period. Unifies StoreKit 2{' '}
        <code>Message.billingIssue</code> (iOS 18+) and Play Billing{' '}
        <code>Purchase.isSuspended</code> (Play Billing Library 8.1+) under a
        single cross-platform stream. Silent no-op on platforms that cannot emit
        (tvOS, watchOS, visionOS, macOS, Meta Horizon).
      </p>

      <h3>Listener Setup</h3>
      <LanguageTabs>
        {{
          typescript: (
            <CodeBlock language="typescript">{`subscriptionBillingIssueListener(
  listener: (purchase: Purchase) => void
): Subscription`}</CodeBlock>
          ),
          swift: (
            <CodeBlock language="swift">{`// Callback + Subscription handle (iOS 18+ only)
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
