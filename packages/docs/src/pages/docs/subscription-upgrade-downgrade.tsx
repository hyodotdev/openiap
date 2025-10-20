import CodeBlock from '../../components/CodeBlock';
import AnchorLink from '../../components/AnchorLink';
import Accordion from '../../components/Accordion';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function SubscriptionUpgradeDowngrade() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Subscription Upgrade & Downgrade</h1>
      <p>
        Understanding how StoreKit handles subscription tier changes is crucial
        for correctly detecting and displaying upgrade/downgrade states in your
        app.
      </p>

      <section>
        <AnchorLink id="overview" level="h2">
          Overview
        </AnchorLink>
        <p>
          When users change their subscription tier (e.g., from monthly to
          yearly, or from basic to premium), StoreKit behaves differently
          depending on whether it's an upgrade or downgrade:
        </p>

        <ul>
          <li>
            <strong>Upgrades</strong>: Charged immediately, new transaction
            created
          </li>
          <li>
            <strong>Downgrades</strong>: Applied at next renewal, no new
            transaction
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="key-fields" level="h2">
          Key Fields to Understand
        </AnchorLink>

        <Accordion
          title={<>📚 transaction.productID vs autoRenewPreference</>}
          variant="info"
        >
          <p>
            <strong>This is not a bug — it's intentional StoreKit behavior.</strong>{' '}
            According to Apple's official documentation and forums:
          </p>

          <ul>
            <li>
              <strong>
                <code>transaction.productID</code>
              </strong>
              : The <em>currently active</em> subscription product ID
            </li>
            <li>
              <strong>
                <code>autoRenewPreference</code>
              </strong>
              : The product ID that will be used on the{' '}
              <em>next renewal</em>
            </li>
          </ul>

          <p>
            <strong>Key insight from Apple Developer Forums:</strong>
          </p>
          <blockquote
            style={{
              borderLeft: '4px solid #007AFF',
              paddingLeft: '1rem',
              marginLeft: 0,
              fontStyle: 'italic',
              color: '#666',
            }}
          >
            "If the <code>autoRenewPreference</code> value is different from the{' '}
            <code>productID</code> from <code>currentEntitlements</code>, then
            you know that the user already changed the subscription plan."
            <br />
            <br />— Apple Developer Forums:{' '}
            <a
              href="https://developer.apple.com/forums/thread/723300"
              target="_blank"
              rel="noopener noreferrer"
            >
              How to know when user upgrades/downgrades
            </a>
          </blockquote>
        </Accordion>
      </section>

      <section>
        <AnchorLink id="upgrade-behavior" level="h2">
          Upgrade Behavior (Charged Immediately)
        </AnchorLink>

        <p>
          When a user upgrades to a higher-tier subscription (e.g., monthly →
          yearly, basic → premium):
        </p>

        <ol>
          <li>User is charged immediately for the new subscription tier</li>
          <li>
            A new transaction is created (though{' '}
            <code>Transaction.updates</code> may initially show the old product
            -{' '}
            <a
              href="https://developer.apple.com/forums/thread/758315"
              target="_blank"
              rel="noopener noreferrer"
            >
              this is a known StoreKit issue
            </a>
            )
          </li>
          <li>
            <code>autoRenewPreference</code> immediately reflects the new
            product
          </li>
          <li>
            <code>transaction.productID</code> updates within a few minutes
          </li>
        </ol>

        <Accordion
          title={<>💡 Example: Monthly → Yearly Upgrade</>}
          variant="tip"
        >
          <p>
            When a user upgrades from monthly to yearly subscription:
          </p>
          <ol>
            <li>
              <strong>Immediately after upgrade:</strong>
              <ul>
                <li>
                  <code>productId</code>: still "monthly" (takes time to update)
                </li>
                <li>
                  <code>autoRenewPreference</code>: "yearly"
                </li>
                <li>
                  <code>pendingUpgradeProductId</code>: "yearly" ✅
                </li>
              </ul>
            </li>
            <li>
              <strong>A few minutes later:</strong>
              <ul>
                <li>
                  <code>productId</code>: "yearly" (now updated)
                </li>
                <li>
                  <code>autoRenewPreference</code>: "yearly"
                </li>
                <li>
                  <code>pendingUpgradeProductId</code>: <code>nil</code> (no
                  pending change)
                </li>
              </ul>
            </li>
          </ol>
        </Accordion>

        <CodeBlock language="swift">{`// Detecting upgrades with pendingUpgradeProductId
let subscriptions = try await getActiveSubscriptions()

for sub in subscriptions {
    if let renewalInfo = sub.renewalInfoIOS,
       let pendingUpgrade = renewalInfo.pendingUpgradeProductId,
       pendingUpgrade != sub.productId {
        print("⚠️ UPGRADE IN PROGRESS")
        print("  Current: \\(sub.productId)")
        print("  Upgrading to: \\(pendingUpgrade)")

        // Show UI: "Upgrade processing..."
    }
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="downgrade-behavior" level="h2">
          Downgrade Behavior (Applied at Next Renewal)
        </AnchorLink>

        <p>
          When a user downgrades to a lower-tier subscription (e.g., yearly →
          monthly, premium → basic):
        </p>

        <ol>
          <li>
            <strong>No new transaction is created</strong>
          </li>
          <li>
            Change is reflected in the <code>renewalInfo</code> object only
          </li>
          <li>
            <code>autoRenewPreference</code> indicates the new (downgraded)
            product (
            <a
              href="https://stackoverflow.com/questions/79107726/autorenewalpreference-usage-in-storekit-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Stack Overflow - autoRenewalPreference usage
            </a>
            )
          </li>
          <li>
            <code>transaction.productID</code> remains unchanged until the
            renewal date
          </li>
          <li>User retains access to current tier until expiration</li>
        </ol>

        <CodeBlock language="swift">{`// Detecting downgrades
let subscriptions = try await getActiveSubscriptions()

for sub in subscriptions {
    if let renewalInfo = sub.renewalInfoIOS,
       let autoRenewPref = renewalInfo.autoRenewPreference,
       autoRenewPref != sub.productId,
       renewalInfo.willAutoRenew {
        print("⚠️ DOWNGRADE SCHEDULED")
        print("  Current (until \\(sub.expirationDateIOS ?? 0)): \\(sub.productId)")
        print("  Next: \\(autoRenewPref)")

        // Show UI: "Your plan will change to [tier] on [date]"
    }
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="pending-upgrade-product-id" level="h2">
          Using pendingUpgradeProductId
        </AnchorLink>

        <p>
          The <code>pendingUpgradeProductId</code> field is specifically
          designed to detect subscription tier changes. It is automatically
          calculated by comparing <code>productID</code> and{' '}
          <code>autoRenewPreference</code>.
        </p>

        <h3>How it works</h3>

        <CodeBlock language="typescript">{`// Internal logic (for reference - this is done automatically)
const pendingUpgradeProductId =
  (autoRenewPreference !== productId && willAutoRenew)
    ? autoRenewPreference
    : null;`}</CodeBlock>

        <h3>Usage in your app</h3>

        <CodeBlock language="typescript">{`// TypeScript example
import { getActiveSubscriptions } from 'openiap';

const subscriptions = await getActiveSubscriptions();

for (const sub of subscriptions) {
  if (sub.renewalInfoIOS?.pendingUpgradeProductId) {
    const current = sub.productId;
    const pending = sub.renewalInfoIOS.pendingUpgradeProductId;

    console.log(\`Upgrading from \${current} to \${pending}\`);

    // Show upgrade-in-progress UI
    showUpgradeInProgressUI(current, pending);
  }
}`}</CodeBlock>

        <Accordion title={<>⚠️ Important: Don't rely on productId alone</>} variant="warning">
          <p>
            <strong>
              After an upgrade, don't rely on <code>productId</code> to be
              immediately updated.
            </strong>{' '}
            There can be a delay of several minutes. Instead:
          </p>

          <ol>
            <li>
              Use <code>pendingUpgradeProductId</code> to detect ongoing tier
              changes
            </li>
            <li>
              Check <code>autoRenewPreference</code> to see what the next
              renewal will be
            </li>
            <li>
              Only use <code>productId</code> for the current active
              subscription
            </li>
          </ol>

          <CodeBlock language="swift">{`// ✅ Correct approach
let effectiveTier = renewalInfo.pendingUpgradeProductId ?? subscription.productId

// ❌ Wrong - may show outdated tier immediately after upgrade
let currentTier = subscription.productId`}</CodeBlock>
        </Accordion>
      </section>

      <section>
        <AnchorLink id="best-practices" level="h2">
          Best Practices
        </AnchorLink>

        <ol>
          <li>
            <strong>Always check pendingUpgradeProductId</strong> when
            displaying subscription status
          </li>
          <li>
            <strong>Show upgrade-in-progress UI</strong> when{' '}
            <code>pendingUpgradeProductId</code> is present
          </li>
          <li>
            <strong>For downgrades</strong>, inform users when the change will
            take effect (at renewal)
          </li>
          <li>
            <strong>Listen to purchase events</strong> to update UI when{' '}
            <code>productId</code> finally updates
          </li>
          <li>
            <strong>Test both scenarios</strong> in sandbox environment to
            understand the timing
          </li>
        </ol>

        <CodeBlock language="typescript">{`// Complete example: Subscription status component
function SubscriptionStatus() {
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    async function loadSubscription() {
      const subs = await getActiveSubscriptions();
      setSubscription(subs[0]);
    }

    loadSubscription();

    // Listen for updates
    const unsubscribe = addPurchaseListener((purchase) => {
      loadSubscription(); // Refresh when productId updates
    });

    return unsubscribe;
  }, []);

  if (!subscription) return null;

  const renewalInfo = subscription.renewalInfoIOS;
  const pending = renewalInfo?.pendingUpgradeProductId;

  // Upgrade in progress
  if (pending && pending !== subscription.productId) {
    return (
      <div className="upgrade-in-progress">
        <p>⏳ Upgrading to {pending}...</p>
        <p>Current: {subscription.productId}</p>
      </div>
    );
  }

  // Downgrade scheduled
  if (renewalInfo?.autoRenewPreference !== subscription.productId &&
      renewalInfo?.willAutoRenew) {
    return (
      <div className="downgrade-scheduled">
        <p>Current: {subscription.productId}</p>
        <p>
          Will change to {renewalInfo.autoRenewPreference} on{' '}
          {new Date(subscription.expirationDateIOS).toLocaleDateString()}
        </p>
      </div>
    );
  }

  // Normal active subscription
  return (
    <div className="active-subscription">
      <p>Active: {subscription.productId}</p>
      <p>Renews: {new Date(renewalInfo?.renewalDate).toLocaleDateString()}</p>
    </div>
  );
}`}</CodeBlock>
      </section>

      <section>
        <AnchorLink id="references" level="h2">
          Official References
        </AnchorLink>

        <ul>
          <li>
            <a
              href="https://developer.apple.com/forums/thread/758315"
              target="_blank"
              rel="noopener noreferrer"
            >
              Apple Developer Forums: Auto-renewing Subscription Updates
            </a>
            <br />
            <small>
              Explains why Transaction.updates may show old product after
              upgrade
            </small>
          </li>
          <li>
            <a
              href="https://developer.apple.com/forums/thread/723300"
              target="_blank"
              rel="noopener noreferrer"
            >
              Apple Developer Forums: How to know when user upgrades/downgrades
            </a>
            <br />
            <small>
              Official guidance on using autoRenewPreference vs productID
            </small>
          </li>
          <li>
            <a
              href="https://stackoverflow.com/questions/79107726/autorenewalpreference-usage-in-storekit-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Stack Overflow: autoRenewalPreference usage in StoreKit 2
            </a>
            <br />
            <small>
              Community discussion on upgrade vs downgrade transaction behavior
            </small>
          </li>
        </ul>
      </section>
    </div>
  );
}

export default SubscriptionUpgradeDowngrade;
