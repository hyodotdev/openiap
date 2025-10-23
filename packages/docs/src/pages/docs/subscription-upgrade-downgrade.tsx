import CodeBlock from '../../components/CodeBlock';
import AnchorLink from '../../components/AnchorLink';
import Accordion from '../../components/Accordion';
import PlatformTabs from '../../components/PlatformTabs';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function SubscriptionUpgradeDowngrade() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Subscription Upgrade & Downgrade</h1>
      <p>
        Understanding how each platform handles subscription tier changes is
        crucial for correctly detecting and displaying upgrade/downgrade states
        in your app. Both iOS and Android support subscription changes, but they
        handle them differently.
      </p>

      <section>
        <AnchorLink id="overview" level="h2">
          Overview
        </AnchorLink>
        <p>
          When users change their subscription tier (e.g., from monthly to
          yearly, or from basic to premium), both platforms support upgrades and
          downgrades:
        </p>

        <ul>
          <li>
            <strong>Upgrades</strong>: Moving to a higher-tier or longer-duration
            subscription
          </li>
          <li>
            <strong>Downgrades</strong>: Moving to a lower-tier or
            shorter-duration subscription
          </li>
        </ul>

        <Accordion
          title={<>⚠️ Important: Same Subscription Group Required</>}
          variant="warning"
        >
          <p>
            <strong>
              Subscription upgrades and downgrades only work within the same
              subscription group.
            </strong>{' '}
            You cannot upgrade or downgrade between subscriptions in different
            groups.
          </p>

          <p>
            <strong>Platform-specific setup:</strong>
          </p>

          <ul>
            <li>
              <strong>iOS (App Store Connect)</strong>: All tiers (e.g., Basic,
              Premium, Ultimate) must be in the same Subscription Group
            </li>
            <li>
              <strong>Android (Google Play Console)</strong>: All tiers must be
              in the same Subscription Product with different Base Plans
            </li>
          </ul>

          <Accordion title={<>💡 iOS Tip: Row Order Matters</>} variant="tip">
            <p>
              In App Store Connect, the <strong>row order</strong> in your
              Subscription Group determines the tier hierarchy:
            </p>

            <ul>
              <li>
                <strong>Position 1 (Top)</strong>: Automatically recognized as
                the highest tier
              </li>
              <li>
                <strong>Position 2, 3, ...</strong>: Lower tiers in descending
                order
              </li>
            </ul>

            <p>
              <strong>Example order:</strong>
            </p>
            <ol>
              <li>Ultimate (yearly) - Highest tier</li>
              <li>Premium (yearly)</li>
              <li>Ultimate (monthly)</li>
              <li>Premium (monthly)</li>
              <li>Basic (yearly)</li>
              <li>Basic (monthly) - Lowest tier</li>
            </ol>

            <p>
              StoreKit uses this order to automatically determine whether a
              subscription change is an upgrade or downgrade.
            </p>
          </Accordion>
        </Accordion>

        <p>
          The key difference is in <em>how</em> and <em>when</em> these changes
          take effect. Select your platform below to see specific implementation
          details:
        </p>
      </section>

      <PlatformTabs>
        {{
          ios: (
            <>
              <section>
                <AnchorLink id="key-fields" level="h2">
                  Key Fields to Understand
                </AnchorLink>

                <Accordion
                  title={<>📚 transaction.productID vs autoRenewPreference</>}
                  variant="info"
                >
                  <p>
                    <strong>
                      This is not a bug — it's intentional StoreKit behavior.
                    </strong>{' '}
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
                    "If the <code>autoRenewPreference</code> value is different
                    from the <code>productID</code> from{' '}
                    <code>currentEntitlements</code>, then you know that the
                    user already changed the subscription plan."
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
                  When a user upgrades to a higher-tier subscription (e.g.,
                  monthly → yearly, basic → premium):
                </p>

                <ol>
                  <li>
                    User is charged immediately for the new subscription tier
                  </li>
                  <li>
                    A new transaction is created (though{' '}
                    <code>Transaction.updates</code> may initially show the old
                    product -{' '}
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
                    <code>autoRenewPreference</code> immediately reflects the
                    new product
                  </li>
                  <li>
                    <code>transaction.productID</code> updates within a few
                    minutes
                  </li>
                </ol>

                <Accordion
                  title={<>💡 iOS Tip: Subscription Group Order</>}
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
                          <code>productId</code>: still "monthly" (takes time to
                          update)
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
                          <code>pendingUpgradeProductId</code>: <code>nil</code>{' '}
                          (no pending change)
                        </li>
                      </ul>
                    </li>
                  </ol>
                </Accordion>

                <p>
                  Use <code>pendingUpgradeProductId</code> to detect when an
                  upgrade is in progress, especially during the brief period
                  when <code>productId</code> hasn't updated yet.
                </p>

                <Accordion title={<>📝 Code Example: Detecting Upgrades</>}>
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
                </Accordion>
              </section>

              <section>
                <AnchorLink id="downgrade-behavior" level="h2">
                  Downgrade Behavior (Applied at Next Renewal)
                </AnchorLink>

                <p>
                  When a user downgrades to a lower-tier subscription (e.g.,
                  yearly → monthly, premium → basic):
                </p>

                <ol>
                  <li>
                    <strong>No new transaction is created</strong>
                  </li>
                  <li>
                    Change is reflected in the <code>renewalInfo</code> object
                    only
                  </li>
                  <li>
                    <code>autoRenewPreference</code> indicates the new
                    (downgraded) product (
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
                    <code>transaction.productID</code> remains unchanged until
                    the renewal date
                  </li>
                  <li>User retains access to current tier until expiration</li>
                </ol>

                <p>
                  Check <code>autoRenewPreference</code> against{' '}
                  <code>productId</code> to detect scheduled downgrades and
                  inform users when the change will take effect.
                </p>

                <Accordion title={<>📝 Code Example: Detecting Downgrades</>}>
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
                </Accordion>
              </section>

              <section>
                <AnchorLink id="pending-upgrade-product-id" level="h2">
                  Using pendingUpgradeProductId
                </AnchorLink>

                <p>
                  The <code>pendingUpgradeProductId</code> field is specifically
                  designed to detect subscription tier changes. It is
                  automatically calculated by comparing <code>productID</code>{' '}
                  and <code>autoRenewPreference</code>.
                </p>

                <h3>How it works</h3>
                <p>
                  The field is automatically calculated by comparing{' '}
                  <code>autoRenewPreference</code> and <code>productId</code>:
                </p>

                <Accordion title={<>📝 Internal Logic</>}>
                  <CodeBlock language="typescript">{`// Internal logic (for reference - this is done automatically)
const pendingUpgradeProductId =
  (autoRenewPreference !== productId && willAutoRenew)
    ? autoRenewPreference
    : null;`}</CodeBlock>
                </Accordion>

                <h3>Usage in your app</h3>
                <p>
                  Simply check if <code>pendingUpgradeProductId</code> exists to
                  detect tier changes in progress:
                </p>

                <Accordion
                  title={<>📝 Code Example: Using pendingUpgradeProductId</>}
                >
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
                </Accordion>

                <Accordion
                  title={<>⚠️ Important: Don't rely on productId alone</>}
                  variant="warning"
                >
                  <p>
                    <strong>
                      After an upgrade, don't rely on <code>productId</code> to
                      be immediately updated.
                    </strong>{' '}
                    There can be a delay of several minutes. Instead:
                  </p>

                  <ol>
                    <li>
                      Use <code>pendingUpgradeProductId</code> to detect ongoing
                      tier changes
                    </li>
                    <li>
                      Check <code>autoRenewPreference</code> to see what the
                      next renewal will be
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
                    <strong>For downgrades</strong>, inform users when the
                    change will take effect (at renewal)
                  </li>
                  <li>
                    <strong>Listen to purchase events</strong> to update UI when{' '}
                    <code>productId</code> finally updates
                  </li>
                  <li>
                    <strong>Test both scenarios</strong> in sandbox environment
                    to understand the timing
                  </li>
                </ol>

                <p>
                  Here's a complete React component that demonstrates all best
                  practices for handling subscription tier changes:
                </p>

                <Accordion
                  title={<>📝 Complete Example: Subscription Status Component</>}
                >
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
                </Accordion>
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
                      Explains why Transaction.updates may show old product
                      after upgrade
                    </small>
                  </li>
                  <li>
                    <a
                      href="https://developer.apple.com/forums/thread/723300"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Apple Developer Forums: How to know when user
                      upgrades/downgrades
                    </a>
                    <br />
                    <small>
                      Official guidance on using autoRenewPreference vs
                      productID
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
                      Community discussion on upgrade vs downgrade transaction
                      behavior
                    </small>
                  </li>
                </ul>
              </section>
            </>
          ),
          android: (
            <>
              <section>
                <AnchorLink id="key-fields" level="h2">
                  Key Fields to Understand
                </AnchorLink>

                <Accordion
                  title={<>📚 Replacement Modes & Proration</>}
                  variant="info"
                >
                  <p>
                    Android uses <strong>replacement modes</strong> to control
                    how subscription changes are handled:
                  </p>

                  <ul>
                    <li>
                      <strong>
                        <code>prorationMode</code>
                      </strong>
                      : Determines when the change takes effect and how billing
                      is handled
                    </li>
                    <li>
                      <strong>
                        <code>purchaseToken</code>
                      </strong>
                      : Required to identify which subscription to replace
                    </li>
                  </ul>

                  <p>
                    <strong>Available replacement modes:</strong>
                  </p>
                  <ul>
                    <li>
                      <code>1 (WITH_TIME_PRORATION)</code> - Immediate change with
                      prorated credit
                    </li>
                    <li>
                      <code>2 (CHARGE_PRORATED_PRICE)</code> - Immediate change,
                      charge difference (upgrade only)
                    </li>
                    <li>
                      <code>3 (WITHOUT_PRORATION)</code> - Immediate change, no
                      proration
                    </li>
                    <li>
                      <code>5 (CHARGE_FULL_PRICE)</code> - Immediate change, charge full price
                    </li>
                    <li>
                      <code>6 (DEFERRED)</code> - Change at next billing cycle
                    </li>
                  </ul>

                  <p>
                    <strong>Note:</strong> If you don't specify a replacement mode, the system uses
                    the default configured in your Google Play Console subscription settings.
                  </p>
                </Accordion>
              </section>

              <section>
                <AnchorLink id="upgrade-behavior" level="h2">
                  Upgrade Behavior (Immediate with Proration)
                </AnchorLink>

                <p>
                  When a user upgrades to a higher-tier subscription on Android
                  (e.g., basic → premium):
                </p>

                <ol>
                  <li>
                    User is charged based on the replacement mode (prorated or
                    full amount)
                  </li>
                  <li>New subscription becomes active immediately</li>
                  <li>
                    Old subscription is replaced in{' '}
                    <code>getAvailablePurchases()</code>
                  </li>
                </ol>

                <Accordion
                  title={<>💡 Android Tip: Choose the Right Proration Mode</>}
                  variant="tip"
                >
                  <p>Select the appropriate mode for your upgrade scenario:</p>
                  <ul>
                    <li>
                      <strong>WITH_TIME_PRORATION</strong> (Recommended): User
                      gets credit for unused time from old subscription
                    </li>
                    <li>
                      <strong>CHARGE_PRORATED_PRICE</strong>: Charge the price
                      difference immediately
                    </li>
                    <li>
                      <strong>WITHOUT_PRORATION</strong>: User pays full price
                      for new subscription
                    </li>
                  </ul>
                </Accordion>

                <p>
                  Specify the <code>prorationModeAndroid</code> parameter when
                  calling <code>requestPurchase()</code> to control upgrade
                  behavior.
                </p>

                <Accordion
                  title={<>📝 Code Example: Upgrading Subscription</>}
                >
                  <CodeBlock language="typescript">{`// Android upgrade with proration
import { requestPurchase, getAvailablePurchases } from 'openiap';

// Get current subscription
const purchases = await getAvailablePurchases();
const currentSub = purchases.find(p => p.productId === 'basic_monthly');

if (currentSub) {
  // Upgrade to premium with time proration
  await requestPurchase({
    sku: 'premium_monthly',
    purchaseTokenAndroid: currentSub.purchaseToken,
    replacementModeAndroid: 1, // WITH_TIME_PRORATION
  });

  console.log('✅ Upgrade initiated');
}`}</CodeBlock>
                </Accordion>
              </section>

              <section>
                <AnchorLink id="downgrade-behavior" level="h2">
                  Downgrade Behavior (Deferred to Next Billing)
                </AnchorLink>

                <p>
                  When a user downgrades to a lower-tier subscription on Android
                  (e.g., premium → basic):
                </p>

                <ol>
                  <li>
                    <strong>Use DEFERRED replacement mode (value: 6)</strong>
                  </li>
                  <li>No immediate charge to the user</li>
                  <li>User keeps premium access until current period ends</li>
                  <li>Basic subscription starts at next billing date</li>
                </ol>

                <p>
                  The DEFERRED mode ensures users retain their premium features
                  until the end of their paid period.
                </p>

                <Accordion
                  title={<>⚠️ Important: DEFERRED Mode Behavior</>}
                  variant="warning"
                >
                  <p>
                    <strong>
                      When using DEFERRED replacement mode (6), the purchase callback
                      completes successfully with an empty purchase list.
                    </strong>{' '}
                    This is expected behavior, not an error:
                  </p>

                  <ul>
                    <li>
                      The subscription change request succeeds immediately (status: OK)
                    </li>
                    <li>
                      But <code>onPurchaseUpdated</code> receives an empty/null purchases list
                    </li>
                    <li>
                      The actual subscription change won't take effect until the next renewal period
                    </li>
                    <li>
                      Your app should treat this as a successful operation, not an error
                    </li>
                  </ul>

                  <p>
                    <strong>Why this happens:</strong> Since the subscription change is deferred to the future,
                    Google Play Billing doesn't create a new purchase transaction immediately. The change will
                    be reflected when the subscription renews.
                  </p>
                </Accordion>

                <Accordion
                  title={<>📝 Code Example: Downgrading Subscription</>}
                >
                  <CodeBlock language="typescript">{`// Android downgrade with deferred replacement
import { requestPurchase, getAvailablePurchases } from 'openiap';

// Get current subscription
const purchases = await getAvailablePurchases();
const premiumPurchase = purchases.find(p => p.productId === 'premium_monthly');

if (premiumPurchase) {
  // Downgrade - takes effect at next billing cycle
  await requestPurchase({
    sku: 'basic_monthly',
    purchaseTokenAndroid: premiumPurchase.purchaseToken,
    replacementModeAndroid: 6, // DEFERRED - Change at renewal
  });

  console.log('✅ Downgrade scheduled for next billing cycle');
  // Note: Purchase callback will complete with empty list - this is expected!
}`}</CodeBlock>
                </Accordion>
              </section>

              <section>
                <AnchorLink id="tracking-changes" level="h2">
                  Tracking Subscription Changes
                </AnchorLink>

                <p>
                  On Android, detecting subscription changes is more
                  straightforward since the Play Billing API immediately reflects
                  the current active subscription.
                </p>

                <h3>Checking for pending changes</h3>

                <Accordion title={<>📝 Code Example: Checking Active Subscription</>}>
                  <CodeBlock language="typescript">{`// Android - check if subscription will change
import { getAvailablePurchases } from 'openiap';

const purchases = await getAvailablePurchases();

for (const purchase of purchases) {
  // On Android, the current purchase reflects the active subscription
  console.log('Active subscription:', purchase.productId);

  // If using DEFERRED mode, the change is scheduled but not yet reflected
  // You'll need to track this in your backend or check purchase history
}`}</CodeBlock>
                </Accordion>

                <Accordion
                  title={
                    <>⚠️ Android: Track deferred changes in your backend</>
                  }
                  variant="warning"
                >
                  <p>
                    Unlike iOS, Android's Play Billing API doesn't provide a
                    built-in field for pending subscription changes. If you use
                    DEFERRED mode for downgrades, you should:
                  </p>

                  <ol>
                    <li>
                      Store the pending change information in your backend when
                      the user initiates the downgrade
                    </li>
                    <li>
                      Use{' '}
                      <a
                        href="https://developer.android.com/google/play/billing/rtdn-reference"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Real-time Developer Notifications (RTDN)
                      </a>{' '}
                      to detect when the change takes effect
                    </li>
                    <li>
                      Update your app's UI based on backend data about pending
                      changes
                    </li>
                  </ol>
                </Accordion>
              </section>

              <section>
                <AnchorLink id="best-practices" level="h2">
                  Best Practices
                </AnchorLink>

                <ol>
                  <li>
                    <strong>Specify replacement mode when needed</strong>: Pass{' '}
                    <code>replacementModeAndroid</code> when you want to override
                    the default configured in Google Play Console
                  </li>
                  <li>
                    <strong>Use WITH_TIME_PRORATION (1) for upgrades</strong> to
                    give users credit for unused time
                  </li>
                  <li>
                    <strong>Use DEFERRED (6) for downgrades</strong> to let users
                    keep premium features until period ends
                  </li>
                  <li>
                    <strong>Handle DEFERRED mode correctly</strong>: When using
                    DEFERRED, expect an empty purchase list - this is success, not an error
                  </li>
                  <li>
                    <strong>Track pending changes in your backend</strong> since
                    Android doesn't expose deferred changes in the API
                  </li>
                  <li>
                    <strong>Implement RTDN webhooks</strong> to receive
                    real-time updates about subscription changes
                  </li>
                </ol>

                <p>
                  Here's a complete example showing how to handle subscription
                  changes with backend tracking:
                </p>

                <Accordion
                  title={<>📝 Complete Example: Subscription Change Handler</>}
                >
                  <CodeBlock language="typescript">{`// Complete Android example: Subscription change
import { requestPurchase, getAvailablePurchases } from 'openiap';

async function changeSubscription(
  newSku: string,
  isUpgrade: boolean
) {
  // Get current subscription
  const purchases = await getAvailablePurchases();
  const currentSub = purchases.find(p => p.productId.includes('subscription'));

  if (!currentSub) {
    console.error('No active subscription found');
    return;
  }

  // Choose appropriate replacement mode
  const replacementMode = isUpgrade
    ? 1  // WITH_TIME_PRORATION - Upgrade: give credit
    : 6; // DEFERRED - Downgrade: change at renewal

  try {
    await requestPurchase({
      sku: newSku,
      purchaseTokenAndroid: currentSub.purchaseToken,
      replacementModeAndroid: replacementMode,
    });

    // If DEFERRED, store pending change in your backend
    if (!isUpgrade) {
      await fetch('/api/subscriptions/pending-change', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'user123',
          currentSku: currentSub.productId,
          newSku,
          effectiveDate: currentSub.expirationDate,
        }),
      });
    }
  } catch (error) {
    console.error('Subscription change failed:', error);
  }
}`}</CodeBlock>
                </Accordion>
              </section>

              <section>
                <AnchorLink id="references" level="h2">
                  Official References
                </AnchorLink>

                <ul>
                  <li>
                    <a
                      href="https://developer.android.com/google/play/billing/subscriptions#replacement-modes"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Google Play Billing: Replace a subscription
                    </a>
                    <br />
                    <small>
                      Official documentation on subscription replacement modes
                      and proration
                    </small>
                  </li>
                  <li>
                    <a
                      href="https://developer.android.com/google/play/billing/rtdn-reference"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Real-time Developer Notifications (RTDN)
                    </a>
                    <br />
                    <small>
                      Set up webhooks to receive subscription change events
                    </small>
                  </li>
                  <li>
                    <a
                      href="https://developer.android.com/google/play/billing/subscriptions#lifecycle"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Subscription lifecycle
                    </a>
                    <br />
                    <small>
                      Understanding how subscriptions work on Google Play
                    </small>
                  </li>
                </ul>
              </section>
            </>
          ),
        }}
      </PlatformTabs>
    </div>
  );
}

export default SubscriptionUpgradeDowngrade;
