import AnchorLink from '../../../components/AnchorLink';
import Accordion from '../../../components/Accordion';
import CodeBlock from '../../../components/CodeBlock';
import LanguageTabs from '../../../components/LanguageTabs';
import PlatformTabs from '../../../components/PlatformTabs';
import SEO from '../../../components/SEO';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function SubscriptionUpgradeDowngrade() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Subscription Upgrade & Downgrade"
        description="Handle subscription tier changes on iOS and Android - upgrade, downgrade, proration, and replacement modes."
        path="/docs/features/subscription-upgrade-downgrade"
        keywords="subscription upgrade, downgrade, proration, tier change"
      />
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
            <strong>Upgrades</strong>: Moving to a higher-tier or
            longer-duration subscription
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
                  <LanguageTabs>
                    {{
                      typescript: (
                        <CodeBlock language="typescript">{`// Detecting upgrades with pendingUpgradeProductId
const subscriptions = await getActiveSubscriptions();

for (const sub of subscriptions) {
  const renewalInfo = sub.renewalInfoIOS;
  const pendingUpgrade = renewalInfo?.pendingUpgradeProductId;

  if (pendingUpgrade && pendingUpgrade !== sub.productId) {
    console.log('⚠️ UPGRADE IN PROGRESS');
    console.log(\`  Current: \${sub.productId}\`);
    console.log(\`  Upgrading to: \${pendingUpgrade}\`);

    // Show UI: "Upgrade processing..."
  }
}`}</CodeBlock>
                      ),
                      swift: (
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
                      ),
                      kotlin: (
                        <CodeBlock language="kotlin">{`// Detecting upgrades with pendingUpgradeProductId (KMP)
val subscriptions = kmpIapInstance.getActiveSubscriptions()

for (sub in subscriptions) {
    val renewalInfo = sub.renewalInfoIOS
    val pendingUpgrade = renewalInfo?.pendingUpgradeProductId

    if (pendingUpgrade != null && pendingUpgrade != sub.productId) {
        println("⚠️ UPGRADE IN PROGRESS")
        println("  Current: \${sub.productId}")
        println("  Upgrading to: $pendingUpgrade")

        // Show UI: "Upgrade processing..."
    }
}`}</CodeBlock>
                      ),
                      dart: (
                        <CodeBlock language="dart">{`// Detecting upgrades with pendingUpgradeProductId
final subscriptions = await FlutterInappPurchase.instance.getActiveSubscriptions();

for (final sub in subscriptions) {
  final renewalInfo = sub.renewalInfoIOS;
  final pendingUpgrade = renewalInfo?.pendingUpgradeProductId;

  if (pendingUpgrade != null && pendingUpgrade != sub.productId) {
    print('⚠️ UPGRADE IN PROGRESS');
    print('  Current: \${sub.productId}');
    print('  Upgrading to: $pendingUpgrade');

    // Show UI: "Upgrade processing..."
  }
}`}</CodeBlock>
                      ),
                      gdscript: (
                        <CodeBlock language="gdscript">{`# Detecting upgrades with pending_upgrade_product_id
var subscriptions = await iap.get_active_subscriptions()

for sub in subscriptions:
    var renewal_info = sub.renewal_info_ios
    var pending_upgrade = renewal_info.pending_upgrade_product_id if renewal_info else ""

    if pending_upgrade != "" and pending_upgrade != sub.product_id:
        print("UPGRADE IN PROGRESS")
        print("  Current: %s" % sub.product_id)
        print("  Upgrading to: %s" % pending_upgrade)

        # Show UI: "Upgrade processing..."`}</CodeBlock>
                      ),
                    }}
                  </LanguageTabs>
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
                  <LanguageTabs>
                    {{
                      typescript: (
                        <CodeBlock language="typescript">{`// Detecting downgrades
const subscriptions = await getActiveSubscriptions();

for (const sub of subscriptions) {
  const renewalInfo = sub.renewalInfoIOS;
  const autoRenewPref = renewalInfo?.autoRenewPreference;

  if (autoRenewPref && autoRenewPref !== sub.productId && renewalInfo?.willAutoRenew) {
    console.log('⚠️ DOWNGRADE SCHEDULED');
    console.log(\`  Current (until \${sub.expirationDateIOS}): \${sub.productId}\`);
    console.log(\`  Next: \${autoRenewPref}\`);

    // Show UI: "Your plan will change to [tier] on [date]"
  }
}`}</CodeBlock>
                      ),
                      swift: (
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
                      ),
                      kotlin: (
                        <CodeBlock language="kotlin">{`// Detecting downgrades (KMP)
val subscriptions = kmpIapInstance.getActiveSubscriptions()

for (sub in subscriptions) {
    val renewalInfo = sub.renewalInfoIOS
    val autoRenewPref = renewalInfo?.autoRenewPreference

    if (autoRenewPref != null && autoRenewPref != sub.productId && renewalInfo?.willAutoRenew == true) {
        println("⚠️ DOWNGRADE SCHEDULED")
        println("  Current (until \${sub.expirationDateIOS}): \${sub.productId}")
        println("  Next: $autoRenewPref")

        // Show UI: "Your plan will change to [tier] on [date]"
    }
}`}</CodeBlock>
                      ),
                      dart: (
                        <CodeBlock language="dart">{`// Detecting downgrades
final subscriptions = await FlutterInappPurchase.instance.getActiveSubscriptions();

for (final sub in subscriptions) {
  final renewalInfo = sub.renewalInfoIOS;
  final autoRenewPref = renewalInfo?.autoRenewPreference;

  if (autoRenewPref != null && autoRenewPref != sub.productId && renewalInfo?.willAutoRenew == true) {
    print('⚠️ DOWNGRADE SCHEDULED');
    print('  Current (until \${sub.expirationDateIOS}): \${sub.productId}');
    print('  Next: $autoRenewPref');

    // Show UI: "Your plan will change to [tier] on [date]"
  }
}`}</CodeBlock>
                      ),
                      gdscript: (
                        <CodeBlock language="gdscript">{`# Detecting downgrades
var subscriptions = await iap.get_active_subscriptions()

for sub in subscriptions:
    var renewal_info = sub.renewal_info_ios
    var auto_renew_pref = renewal_info.auto_renew_preference if renewal_info else ""

    if auto_renew_pref != "" and auto_renew_pref != sub.product_id and renewal_info.will_auto_renew:
        print("DOWNGRADE SCHEDULED")
        print("  Current (until %s): %s" % [sub.expiration_date_ios, sub.product_id])
        print("  Next: %s" % auto_renew_pref)

        # Show UI: "Your plan will change to [tier] on [date]"`}</CodeBlock>
                      ),
                    }}
                  </LanguageTabs>
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
                  <LanguageTabs>
                    {{
                      typescript: (
                        <CodeBlock language="typescript">{`import { getActiveSubscriptions } from 'expo-iap';

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
                      ),
                      swift: (
                        <CodeBlock language="swift">{`import OpenIap

let subscriptions = try await OpenIapModule.shared.getActiveSubscriptions()

for sub in subscriptions {
    if let pending = sub.renewalInfoIOS?.pendingUpgradeProductId {
        let current = sub.productId

        print("Upgrading from \\(current) to \\(pending)")

        // Show upgrade-in-progress UI
        showUpgradeInProgressUI(current: current, pending: pending)
    }
}`}</CodeBlock>
                      ),
                      kotlin: (
                        <CodeBlock language="kotlin">{`import io.github.hyochan.kmpiap.kmpIapInstance

val subscriptions = kmpIapInstance.getActiveSubscriptions()

for (sub in subscriptions) {
    sub.renewalInfoIOS?.pendingUpgradeProductId?.let { pending ->
        val current = sub.productId

        println("Upgrading from $current to $pending")

        // Show upgrade-in-progress UI
        showUpgradeInProgressUI(current, pending)
    }
}`}</CodeBlock>
                      ),
                      dart: (
                        <CodeBlock language="dart">{`import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final subscriptions = await FlutterInappPurchase.instance.getActiveSubscriptions();

for (final sub in subscriptions) {
  final pending = sub.renewalInfoIOS?.pendingUpgradeProductId;
  if (pending != null) {
    final current = sub.productId;

    print('Upgrading from $current to $pending');

    // Show upgrade-in-progress UI
    showUpgradeInProgressUI(current, pending);
  }
}`}</CodeBlock>
                      ),
                      gdscript: (
                        <CodeBlock language="gdscript">{`var subscriptions = await iap.get_active_subscriptions()

for sub in subscriptions:
    var pending = ""
    if sub.renewal_info_ios:
        pending = sub.renewal_info_ios.pending_upgrade_product_id

    if pending != "":
        var current = sub.product_id

        print("Upgrading from %s to %s" % [current, pending])

        # Show upgrade-in-progress UI
        show_upgrade_in_progress_ui(current, pending)`}</CodeBlock>
                      ),
                    }}
                  </LanguageTabs>
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

                  <LanguageTabs>
                    {{
                      typescript: (
                        <CodeBlock language="typescript">{`// ✅ Correct approach
const effectiveTier = renewalInfo?.pendingUpgradeProductId ?? subscription.productId;

// ❌ Wrong - may show outdated tier immediately after upgrade
const currentTier = subscription.productId;`}</CodeBlock>
                      ),
                      swift: (
                        <CodeBlock language="swift">{`// ✅ Correct approach
let effectiveTier = renewalInfo.pendingUpgradeProductId ?? subscription.productId

// ❌ Wrong - may show outdated tier immediately after upgrade
let currentTier = subscription.productId`}</CodeBlock>
                      ),
                      kotlin: (
                        <CodeBlock language="kotlin">{`// ✅ Correct approach
val effectiveTier = renewalInfo?.pendingUpgradeProductId ?: subscription.productId

// ❌ Wrong - may show outdated tier immediately after upgrade
val currentTier = subscription.productId`}</CodeBlock>
                      ),
                      dart: (
                        <CodeBlock language="dart">{`// ✅ Correct approach
final effectiveTier = renewalInfo?.pendingUpgradeProductId ?? subscription.productId;

// ❌ Wrong - may show outdated tier immediately after upgrade
final currentTier = subscription.productId;`}</CodeBlock>
                      ),
                      gdscript: (
                        <CodeBlock language="gdscript">{`# Correct approach
var effective_tier = ""
if renewal_info and renewal_info.pending_upgrade_product_id != "":
    effective_tier = renewal_info.pending_upgrade_product_id
else:
    effective_tier = subscription.product_id

# Wrong - may show outdated tier immediately after upgrade
var current_tier = subscription.product_id`}</CodeBlock>
                      ),
                    }}
                  </LanguageTabs>
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
                  title={
                    <>📝 Complete Example: Subscription Status Component</>
                  }
                >
                  <LanguageTabs>
                    {{
                      typescript: (
                        <CodeBlock language="typescript">{`// Complete example: Subscription status component (React)
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
      <View>
        <Text>⏳ Upgrading to {pending}...</Text>
        <Text>Current: {subscription.productId}</Text>
      </View>
    );
  }

  // Downgrade scheduled
  if (renewalInfo?.autoRenewPreference !== subscription.productId &&
      renewalInfo?.willAutoRenew) {
    return (
      <View>
        <Text>Current: {subscription.productId}</Text>
        <Text>
          Will change to {renewalInfo.autoRenewPreference} on{' '}
          {new Date(subscription.expirationDateIOS).toLocaleDateString()}
        </Text>
      </View>
    );
  }

  // Normal active subscription
  return (
    <View>
      <Text>Active: {subscription.productId}</Text>
      <Text>Renews: {new Date(renewalInfo?.renewalDate).toLocaleDateString()}</Text>
    </View>
  );
}`}</CodeBlock>
                      ),
                      swift: (
                        <CodeBlock language="swift">{`// Complete example: Subscription status view (SwiftUI)
struct SubscriptionStatusView: View {
    @State private var subscription: ActiveSubscription?

    var body: some View {
        Group {
            if let sub = subscription {
                subscriptionContent(sub)
            } else {
                Text("Loading...")
            }
        }
        .task {
            await loadSubscription()
        }
    }

    @ViewBuilder
    func subscriptionContent(_ sub: ActiveSubscription) -> some View {
        let renewalInfo = sub.renewalInfoIOS
        let pending = renewalInfo?.pendingUpgradeProductId

        if let pending = pending, pending != sub.productId {
            // Upgrade in progress
            VStack {
                Text("⏳ Upgrading to \\(pending)...")
                Text("Current: \\(sub.productId)")
            }
        } else if let autoRenewPref = renewalInfo?.autoRenewPreference,
                  autoRenewPref != sub.productId,
                  renewalInfo?.willAutoRenew == true {
            // Downgrade scheduled
            VStack {
                Text("Current: \\(sub.productId)")
                Text("Will change to \\(autoRenewPref) on \\(formattedDate(sub.expirationDateIOS))")
            }
        } else {
            // Normal active subscription
            VStack {
                Text("Active: \\(sub.productId)")
                Text("Renews: \\(formattedDate(renewalInfo?.renewalDate))")
            }
        }
    }

    func loadSubscription() async {
        let subs = try? await OpenIapModule.shared.getActiveSubscriptions()
        subscription = subs?.first
    }
}`}</CodeBlock>
                      ),
                      kotlin: (
                        <CodeBlock language="kotlin">{`// Complete example: Subscription status (Compose Multiplatform)
@Composable
fun SubscriptionStatus() {
    var subscription by remember { mutableStateOf<ActiveSubscription?>(null) }

    LaunchedEffect(Unit) {
        val subs = kmpIapInstance.getActiveSubscriptions()
        subscription = subs.firstOrNull()
    }

    subscription?.let { sub ->
        val renewalInfo = sub.renewalInfoIOS
        val pending = renewalInfo?.pendingUpgradeProductId

        when {
            pending != null && pending != sub.productId -> {
                // Upgrade in progress
                Column {
                    Text("⏳ Upgrading to $pending...")
                    Text("Current: \${sub.productId}")
                }
            }
            renewalInfo?.autoRenewPreference != sub.productId &&
            renewalInfo?.willAutoRenew == true -> {
                // Downgrade scheduled
                Column {
                    Text("Current: \${sub.productId}")
                    Text("Will change to \${renewalInfo.autoRenewPreference} on \${formatDate(sub.expirationDateIOS)}")
                }
            }
            else -> {
                // Normal active subscription
                Column {
                    Text("Active: \${sub.productId}")
                    Text("Renews: \${formatDate(renewalInfo?.renewalDate)}")
                }
            }
        }
    } ?: Text("Loading...")
}`}</CodeBlock>
                      ),
                      dart: (
                        <CodeBlock language="dart">{`// Complete example: Subscription status widget (Flutter)
class SubscriptionStatus extends StatefulWidget {
  @override
  State<SubscriptionStatus> createState() => _SubscriptionStatusState();
}

class _SubscriptionStatusState extends State<SubscriptionStatus> {
  ActiveSubscription? subscription;

  @override
  void initState() {
    super.initState();
    _loadSubscription();
  }

  Future<void> _loadSubscription() async {
    final subs = await FlutterInappPurchase.instance.getActiveSubscriptions();
    setState(() => subscription = subs.firstOrNull);
  }

  @override
  Widget build(BuildContext context) {
    final sub = subscription;
    if (sub == null) return Text('Loading...');

    final renewalInfo = sub.renewalInfoIOS;
    final pending = renewalInfo?.pendingUpgradeProductId;

    // Upgrade in progress
    if (pending != null && pending != sub.productId) {
      return Column(children: [
        Text('⏳ Upgrading to $pending...'),
        Text('Current: \${sub.productId}'),
      ]);
    }

    // Downgrade scheduled
    if (renewalInfo?.autoRenewPreference != sub.productId &&
        renewalInfo?.willAutoRenew == true) {
      return Column(children: [
        Text('Current: \${sub.productId}'),
        Text('Will change to \${renewalInfo!.autoRenewPreference} on \${_formatDate(sub.expirationDateIOS)}'),
      ]);
    }

    // Normal active subscription
    return Column(children: [
      Text('Active: \${sub.productId}'),
      Text('Renews: \${_formatDate(renewalInfo?.renewalDate)}'),
    ]);
  }

  String _formatDate(int? timestamp) => timestamp != null
      ? DateTime.fromMillisecondsSinceEpoch(timestamp).toLocal().toString()
      : 'N/A';
}`}</CodeBlock>
                      ),
                      gdscript: (
                        <CodeBlock language="gdscript">{`# Complete example: Subscription status (Godot)
extends Control

var subscription: ActiveSubscription = null

func _ready() -> void:
    load_subscription()

func load_subscription() -> void:
    var subs = await iap.get_active_subscriptions()
    if subs.size() > 0:
        subscription = subs[0]
    update_ui()

func update_ui() -> void:
    if not subscription:
        $Label.text = "Loading..."
        return

    var renewal_info = subscription.renewal_info_ios
    var pending = renewal_info.pending_upgrade_product_id if renewal_info else ""

    # Upgrade in progress
    if pending != "" and pending != subscription.product_id:
        $Label.text = "Upgrading to %s...\nCurrent: %s" % [pending, subscription.product_id]
        return

    # Downgrade scheduled
    if renewal_info:
        var auto_renew_pref = renewal_info.auto_renew_preference
        if auto_renew_pref != subscription.product_id and renewal_info.will_auto_renew:
            $Label.text = "Current: %s\nWill change to %s on %s" % [
                subscription.product_id,
                auto_renew_pref,
                format_date(subscription.expiration_date_ios)
            ]
            return

    # Normal active subscription
    var renewal_date = renewal_info.renewal_date if renewal_info else 0
    $Label.text = "Active: %s\nRenews: %s" % [
        subscription.product_id,
        format_date(renewal_date)
    ]

func format_date(timestamp: int) -> String:
    if timestamp == 0:
        return "N/A"
    var datetime = Time.get_datetime_dict_from_unix_time(timestamp / 1000)
    return "%04d-%02d-%02d" % [datetime.year, datetime.month, datetime.day]`}</CodeBlock>
                      ),
                    }}
                  </LanguageTabs>
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
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Mode</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem' }}>Legacy API</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem' }}>8.1.0+ API</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.25rem 0.5rem' }}><code>WITH_TIME_PRORATION</code></td>
                        <td style={{ textAlign: 'center' }}>1</td>
                        <td style={{ textAlign: 'center' }}>1</td>
                        <td style={{ padding: '0.25rem 0.5rem' }}>Immediate change with prorated credit</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.25rem 0.5rem' }}><code>CHARGE_PRORATED_PRICE</code></td>
                        <td style={{ textAlign: 'center' }}>2</td>
                        <td style={{ textAlign: 'center' }}>2</td>
                        <td style={{ padding: '0.25rem 0.5rem' }}>Immediate change, charge difference (upgrade only)</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.25rem 0.5rem' }}><code>WITHOUT_PRORATION</code></td>
                        <td style={{ textAlign: 'center' }}>3</td>
                        <td style={{ textAlign: 'center' }}>3</td>
                        <td style={{ padding: '0.25rem 0.5rem' }}>Immediate change, no proration</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.25rem 0.5rem' }}><code>CHARGE_FULL_PRICE</code></td>
                        <td style={{ textAlign: 'center' }}>5</td>
                        <td style={{ textAlign: 'center' }}>4</td>
                        <td style={{ padding: '0.25rem 0.5rem' }}>Immediate change, charge full price</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.25rem 0.5rem' }}><code>DEFERRED</code></td>
                        <td style={{ textAlign: 'center' }}>6</td>
                        <td style={{ textAlign: 'center' }}>5</td>
                        <td style={{ padding: '0.25rem 0.5rem' }}>Change at next billing cycle</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0.25rem 0.5rem' }}><code>KEEP_EXISTING</code></td>
                        <td style={{ textAlign: 'center' }}>—</td>
                        <td style={{ textAlign: 'center' }}>6</td>
                        <td style={{ padding: '0.25rem 0.5rem' }}>Keep existing payment schedule (8.1.0+ only)</td>
                      </tr>
                    </tbody>
                  </table>

                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    <strong>Note:</strong> Legacy API refers to <code>SubscriptionUpdateParams.ReplacementMode</code>,
                    8.1.0+ API refers to <code>SubscriptionProductReplacementParams.ReplacementMode</code>.
                    The integer values differ for CHARGE_FULL_PRICE and DEFERRED between APIs.
                  </p>

                  <p>
                    <strong>Note:</strong> If you don't specify a replacement
                    mode, the system uses the default configured in your Google
                    Play Console subscription settings.
                  </p>
                </Accordion>

                <Accordion
                  title={<>🆕 Billing Library 8.1.0+: Per-Product Replacement Params</>}
                  variant="tip"
                >
                  <p>
                    Starting with Google Play Billing Library 8.1.0, you can use{' '}
                    <code>subscriptionProductReplacementParams</code> for more granular
                    control over subscription replacements at the product level:
                  </p>

                  <ul>
                    <li>
                      <strong>
                        <code>oldProductId</code>
                      </strong>
                      : The product ID being replaced
                    </li>
                    <li>
                      <strong>
                        <code>replacementMode</code>
                      </strong>
                      : The replacement mode enum value
                    </li>
                  </ul>

                  <p>
                    This API is useful when you need different replacement behaviors
                    for different products in a multi-product purchase scenario.
                    The new <code>KEEP_EXISTING</code> mode is only available through
                    this API.
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

                <Accordion title={<>📝 Code Example: Upgrading Subscription</>}>
                  <LanguageTabs>
                    {{
                      typescript: (
                        <CodeBlock language="typescript">{`// Android upgrade with proration
import { requestPurchase, getAvailablePurchases } from 'expo-iap';

// Get current subscription
const purchases = await getAvailablePurchases();
const currentSub = purchases.find(p => p.productId === 'basic_monthly');

if (currentSub) {
  // Upgrade to premium with time proration
  await requestPurchase({
    sku: 'premium_monthly',
    purchaseToken: currentSub.purchaseToken,
    replacementMode: 1, // WITH_TIME_PRORATION
  });

  console.log('✅ Upgrade initiated');
}`}</CodeBlock>
                      ),
                      kotlin: (
                        <CodeBlock language="kotlin">{`// Android upgrade with proration
import io.github.hyochan.kmpiap.kmpIapInstance

// Get current subscription
val purchases = kmpIapInstance.getAvailablePurchases()
val currentSub = purchases.find { it.productId == "basic_monthly" }

currentSub?.let { sub ->
    // Upgrade to premium with time proration
    kmpIapInstance.requestPurchase {
        android {
            skus = listOf("premium_monthly")
            purchaseToken = sub.purchaseToken
            replacementMode = 1 // WITH_TIME_PRORATION
        }
    }

    println("✅ Upgrade initiated")
}`}</CodeBlock>
                      ),
                      dart: (
                        <CodeBlock language="dart">{`// Android upgrade with proration
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Get current subscription
final purchases = await FlutterInappPurchase.instance.getAvailablePurchases();
final currentSub = purchases.firstWhere((p) => p.productId == 'basic_monthly');

if (currentSub != null) {
  // Upgrade to premium with time proration
  await FlutterInappPurchase.instance.requestPurchase(
    RequestPurchaseProps(
      request: RequestPurchasePropsByPlatforms(
        google: RequestPurchaseAndroidProps(
          skus: ['premium_monthly'],
          purchaseToken: currentSub.purchaseToken,
          replacementMode: 1, // WITH_TIME_PRORATION
        ),
      ),
    ),
  );

  print('✅ Upgrade initiated');
}`}</CodeBlock>
                      ),
                      gdscript: (
                        <CodeBlock language="gdscript">{`# Android upgrade with proration

# Get current subscription
var purchases = await iap.get_available_purchases()
var current_sub = null
for p in purchases:
    if p.product_id == "basic_monthly":
        current_sub = p
        break

if current_sub:
    # Upgrade to premium with time proration
    var props = RequestPurchaseProps.new()
    props.request = RequestPurchasePropsByPlatforms.new()
    props.request.google = RequestPurchaseAndroidProps.new()
    props.request.google.skus = ["premium_monthly"]
    props.request.google.purchase_token = current_sub.purchase_token
    props.request.google.replacement_mode = 1  # WITH_TIME_PRORATION
    props.type = ProductType.SUBS

    await iap.request_purchase(props)

    print("Upgrade initiated")`}</CodeBlock>
                      ),
                    }}
                  </LanguageTabs>
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
                    <strong>Use DEFERRED replacement mode</strong> (Legacy API: 6, 8.1.0+ API: 5)
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
                      When using DEFERRED replacement mode, the purchase
                      callback completes successfully with an empty purchase
                      list.
                    </strong>{' '}
                    This is expected behavior, not an error:
                  </p>

                  <ul>
                    <li>
                      The subscription change request succeeds immediately
                      (status: OK)
                    </li>
                    <li>
                      But <code>onPurchaseUpdated</code> receives an empty/null
                      purchases list
                    </li>
                    <li>
                      The actual subscription change won't take effect until the
                      next renewal period
                    </li>
                    <li>
                      Your app should treat this as a successful operation, not
                      an error
                    </li>
                  </ul>

                  <p>
                    <strong>Why this happens:</strong> Since the subscription
                    change is deferred to the future, Google Play Billing
                    doesn't create a new purchase transaction immediately. The
                    change will be reflected when the subscription renews.
                  </p>
                </Accordion>

                <Accordion
                  title={<>📝 Code Example: Downgrading Subscription</>}
                >
                  <LanguageTabs>
                    {{
                      typescript: (
                        <CodeBlock language="typescript">{`// Android downgrade with deferred replacement
import { requestPurchase, getAvailablePurchases } from 'expo-iap';

// Get current subscription
const purchases = await getAvailablePurchases();
const premiumPurchase = purchases.find(p => p.productId === 'premium_monthly');

if (premiumPurchase) {
  // Downgrade - takes effect at next billing cycle
  await requestPurchase({
    sku: 'basic_monthly',
    purchaseToken: premiumPurchase.purchaseToken,
    replacementMode: 6, // DEFERRED - Change at renewal
  });

  console.log('✅ Downgrade scheduled for next billing cycle');
  // Note: Purchase callback will complete with empty list - this is expected!
}`}</CodeBlock>
                      ),
                      kotlin: (
                        <CodeBlock language="kotlin">{`// Android downgrade with deferred replacement
import io.github.hyochan.kmpiap.kmpIapInstance

// Get current subscription
val purchases = kmpIapInstance.getAvailablePurchases()
val premiumPurchase = purchases.find { it.productId == "premium_monthly" }

premiumPurchase?.let { purchase ->
    // Downgrade - takes effect at next billing cycle
    kmpIapInstance.requestPurchase {
        android {
            skus = listOf("basic_monthly")
            purchaseToken = purchase.purchaseToken
            replacementMode = 6 // DEFERRED - Change at renewal
        }
    }

    println("✅ Downgrade scheduled for next billing cycle")
    // Note: Purchase callback will complete with empty list - this is expected!
}`}</CodeBlock>
                      ),
                      dart: (
                        <CodeBlock language="dart">{`// Android downgrade with deferred replacement
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Get current subscription
final purchases = await FlutterInappPurchase.instance.getAvailablePurchases();
final premiumPurchase = purchases.firstWhere((p) => p.productId == 'premium_monthly');

if (premiumPurchase != null) {
  // Downgrade - takes effect at next billing cycle
  await FlutterInappPurchase.instance.requestPurchase(
    RequestPurchaseProps(
      request: RequestPurchasePropsByPlatforms(
        google: RequestPurchaseAndroidProps(
          skus: ['basic_monthly'],
          purchaseToken: premiumPurchase.purchaseToken,
          replacementMode: 6, // DEFERRED - Change at renewal
        ),
      ),
    ),
  );

  print('✅ Downgrade scheduled for next billing cycle');
  // Note: Purchase callback will complete with empty list - this is expected!
}`}</CodeBlock>
                      ),
                      gdscript: (
                        <CodeBlock language="gdscript">{`# Android downgrade with deferred replacement

# Get current subscription
var purchases = await iap.get_available_purchases()
var premium_purchase = null
for p in purchases:
    if p.product_id == "premium_monthly":
        premium_purchase = p
        break

if premium_purchase:
    # Downgrade - takes effect at next billing cycle
    var props = RequestPurchaseProps.new()
    props.request = RequestPurchasePropsByPlatforms.new()
    props.request.google = RequestPurchaseAndroidProps.new()
    props.request.google.skus = ["basic_monthly"]
    props.request.google.purchase_token = premium_purchase.purchase_token
    props.request.google.replacement_mode = 6  # DEFERRED - Change at renewal
    props.type = ProductType.SUBS

    await iap.request_purchase(props)

    print("Downgrade scheduled for next billing cycle")
    # Note: Purchase callback will complete with empty list - this is expected!`}</CodeBlock>
                      ),
                    }}
                  </LanguageTabs>
                </Accordion>

                <Accordion
                  title={<>📝 Code Example: Using subscriptionProductReplacementParams (8.1.0+)</>}
                >
                  <p>
                    For more granular control, use the new per-product replacement params API:
                  </p>
                  <LanguageTabs>
                    {{
                      typescript: (
                        <CodeBlock language="typescript">{`// Android subscription replacement with 8.1.0+ API
import { requestSubscription, getAvailablePurchases } from 'expo-iap';

// Get current subscription
const purchases = await getAvailablePurchases();
const currentSub = purchases.find(p => p.productId === 'premium_monthly');

if (currentSub) {
  // Upgrade using the new per-product replacement params
  await requestSubscription({
    skus: ['premium_yearly'],
    subscriptionProductReplacementParams: {
      oldProductId: currentSub.productId,
      replacementMode: 'WITH_TIME_PRORATION', // or 'KEEP_EXISTING' (8.1.0+ only)
    },
    // subscriptionOffers if needed for base plan selection
  });

  console.log('✅ Upgrade initiated with per-product replacement');
}`}</CodeBlock>
                      ),
                      kotlin: (
                        <CodeBlock language="kotlin">{`// Android subscription replacement with 8.1.0+ API
import dev.hyo.openiap.OpenIapModule
import dev.hyo.openiap.SubscriptionReplacementModeAndroid

// Get current subscription
val purchases = openIapModule.getAvailablePurchases()
val currentSub = purchases.find { it.productId == "premium_monthly" }

currentSub?.let { sub ->
    // Upgrade using the new per-product replacement params
    openIapModule.requestSubscription(
        RequestPurchaseProps(
            type = ProductQueryType.Subs,
            request = RequestPurchaseProps.Request.Subscription(
                RequestSubscriptionProps(
                    android = RequestSubscriptionAndroidProps(
                        skus = listOf("premium_yearly"),
                        subscriptionProductReplacementParams = SubscriptionProductReplacementParamsAndroid(
                            oldProductId = sub.productId,
                            replacementMode = SubscriptionReplacementModeAndroid.WithTimeProration
                            // or SubscriptionReplacementModeAndroid.KeepExisting (8.1.0+ only)
                        )
                    )
                )
            )
        )
    )

    println("✅ Upgrade initiated with per-product replacement")
}`}</CodeBlock>
                      ),
                      dart: (
                        <CodeBlock language="dart">{`// Android subscription replacement with 8.1.0+ API
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

// Get current subscription
final purchases = await FlutterInappPurchase.instance.getAvailablePurchases();
final currentSub = purchases.firstWhere((p) => p.productId == 'premium_monthly');

if (currentSub != null) {
  // Upgrade using the new per-product replacement params
  await FlutterInappPurchase.instance.requestSubscription(
    RequestPurchaseProps(
      request: RequestPurchasePropsByPlatforms(
        google: RequestSubscriptionAndroidProps(
          skus: ['premium_yearly'],
          subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid(
            oldProductId: currentSub.productId,
            replacementMode: SubscriptionReplacementModeAndroid.withTimeProration,
            // or SubscriptionReplacementModeAndroid.keepExisting (8.1.0+ only)
          ),
        ),
      ),
    ),
  );

  print('✅ Upgrade initiated with per-product replacement');
}`}</CodeBlock>
                      ),
                      gdscript: (
                        <CodeBlock language="gdscript">{`# Android subscription replacement with 8.1.0+ API

# Get current subscription
var purchases = await iap.get_available_purchases()
var current_sub = null
for p in purchases:
    if p.product_id == "premium_monthly":
        current_sub = p
        break

if current_sub:
    # Upgrade using the new per-product replacement params
    var props = RequestPurchaseProps.new()
    props.request = RequestSubscriptionPropsByPlatforms.new()
    props.request.google = RequestSubscriptionAndroidProps.new()
    props.request.google.skus = ["premium_yearly"]
    props.request.google.subscription_product_replacement_params = SubscriptionProductReplacementParamsAndroid.new()
    props.request.google.subscription_product_replacement_params.old_product_id = current_sub.product_id
    props.request.google.subscription_product_replacement_params.replacement_mode = SubscriptionReplacementModeAndroid.WITH_TIME_PRORATION
    # or SubscriptionReplacementModeAndroid.KEEP_EXISTING (8.1.0+ only)
    props.type = ProductType.SUBS

    await iap.request_purchase(props)

    print("Upgrade initiated with per-product replacement")`}</CodeBlock>
                      ),
                    }}
                  </LanguageTabs>
                </Accordion>
              </section>

              <section>
                <AnchorLink id="tracking-changes" level="h2">
                  Tracking Subscription Changes
                </AnchorLink>

                <p>
                  On Android, detecting subscription changes is more
                  straightforward since the Play Billing API immediately
                  reflects the current active subscription.
                </p>

                <h3>Checking for pending changes</h3>

                <Accordion
                  title={<>📝 Code Example: Checking Active Subscription</>}
                >
                  <LanguageTabs>
                    {{
                      typescript: (
                        <CodeBlock language="typescript">{`// Android - check if subscription will change
import { getAvailablePurchases } from 'expo-iap';

const purchases = await getAvailablePurchases();

for (const purchase of purchases) {
  // On Android, the current purchase reflects the active subscription
  console.log('Active subscription:', purchase.productId);

  // If using DEFERRED mode, the change is scheduled but not yet reflected
  // You'll need to track this in your backend or check purchase history
}`}</CodeBlock>
                      ),
                      kotlin: (
                        <CodeBlock language="kotlin">{`// Android - check if subscription will change
import io.github.hyochan.kmpiap.kmpIapInstance

val purchases = kmpIapInstance.getAvailablePurchases()

for (purchase in purchases) {
    // On Android, the current purchase reflects the active subscription
    println("Active subscription: \${purchase.productId}")

    // If using DEFERRED mode, the change is scheduled but not yet reflected
    // You'll need to track this in your backend or check purchase history
}`}</CodeBlock>
                      ),
                      dart: (
                        <CodeBlock language="dart">{`// Android - check if subscription will change
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';

final purchases = await FlutterInappPurchase.instance.getAvailablePurchases();

for (final purchase in purchases) {
  // On Android, the current purchase reflects the active subscription
  print('Active subscription: \${purchase.productId}');

  // If using DEFERRED mode, the change is scheduled but not yet reflected
  // You'll need to track this in your backend or check purchase history
}`}</CodeBlock>
                      ),
                      gdscript: (
                        <CodeBlock language="gdscript">{`# Android - check if subscription will change
var purchases = await iap.get_available_purchases()

for purchase in purchases:
    # On Android, the current purchase reflects the active subscription
    print("Active subscription: %s" % purchase.product_id)

    # If using DEFERRED mode, the change is scheduled but not yet reflected
    # You'll need to track this in your backend or check purchase history`}</CodeBlock>
                      ),
                    }}
                  </LanguageTabs>
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
                    <code>replacementMode</code> when you want to
                    override the default configured in Google Play Console
                  </li>
                  <li>
                    <strong>Use WITH_TIME_PRORATION for upgrades</strong> to
                    give users credit for unused time
                  </li>
                  <li>
                    <strong>Use DEFERRED for downgrades</strong> to let
                    users keep premium features until period ends
                  </li>
                  <li>
                    <strong>Handle DEFERRED mode correctly</strong>: When using
                    DEFERRED, expect an empty purchase list - this is success,
                    not an error
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
                  <LanguageTabs>
                    {{
                      typescript: (
                        <CodeBlock language="typescript">{`// Complete Android example: Subscription change
import { requestPurchase, getAvailablePurchases } from 'expo-iap';

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
      purchaseToken: currentSub.purchaseToken,
      replacementMode: replacementMode,
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
                      ),
                      kotlin: (
                        <CodeBlock language="kotlin">{`// Complete Android example: Subscription change
import io.github.hyochan.kmpiap.kmpIapInstance
import io.github.hyochan.kmpiap.PurchaseException

suspend fun changeSubscription(
    newSku: String,
    isUpgrade: Boolean
) {
    // Get current subscription
    val purchases = kmpIapInstance.getAvailablePurchases()
    val currentSub = purchases.find { it.productId.contains("subscription") }

    if (currentSub == null) {
        println("No active subscription found")
        return
    }

    // Choose appropriate replacement mode
    val replacementMode = if (isUpgrade) {
        1  // WITH_TIME_PRORATION - Upgrade: give credit
    } else {
        6  // DEFERRED - Downgrade: change at renewal
    }

    try {
        kmpIapInstance.requestPurchase {
            android {
                skus = listOf(newSku)
                purchaseToken = currentSub.purchaseToken
                this.replacementMode = replacementMode
            }
        }

        // If DEFERRED, store pending change in your backend
        if (!isUpgrade) {
            sendPendingChangeToBackend(
                userId = "user123",
                currentSku = currentSub.productId,
                newSku = newSku,
                effectiveDate = currentSub.expirationDate
            )
        }
    } catch (e: PurchaseException) {
        println("Subscription change failed: \${e.message}")
    }
}`}</CodeBlock>
                      ),
                      dart: (
                        <CodeBlock language="dart">{`// Complete Android example: Subscription change
import 'package:flutter_inapp_purchase/flutter_inapp_purchase.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<void> changeSubscription(
  String newSku,
  bool isUpgrade,
) async {
  // Get current subscription
  final purchases = await FlutterInappPurchase.instance.getAvailablePurchases();
  final currentSub = purchases.firstWhere(
    (p) => p.productId.contains('subscription'),
    orElse: () => null,
  );

  if (currentSub == null) {
    print('No active subscription found');
    return;
  }

  // Choose appropriate replacement mode
  final replacementMode = isUpgrade
      ? 1  // WITH_TIME_PRORATION - Upgrade: give credit
      : 6; // DEFERRED - Downgrade: change at renewal

  try {
    await FlutterInappPurchase.instance.requestPurchase(
      RequestPurchaseProps(
        request: RequestPurchasePropsByPlatforms(
          google: RequestPurchaseAndroidProps(
            skus: [newSku],
            purchaseToken: currentSub.purchaseToken,
            replacementMode: replacementMode,
          ),
        ),
      ),
    );

    // If DEFERRED, store pending change in your backend
    if (!isUpgrade) {
      await http.post(
        Uri.parse('/api/subscriptions/pending-change'),
        body: jsonEncode({
          'userId': 'user123',
          'currentSku': currentSub.productId,
          'newSku': newSku,
          'effectiveDate': currentSub.expirationDate,
        }),
      );
    }
  } catch (e) {
    print('Subscription change failed: $e');
  }
}`}</CodeBlock>
                      ),
                      gdscript: (
                        <CodeBlock language="gdscript">{`# Complete Android example: Subscription change
func change_subscription(new_sku: String, is_upgrade: bool) -> void:
    # Get current subscription
    var purchases = await iap.get_available_purchases()
    var current_sub = null
    for p in purchases:
        if "subscription" in p.product_id:
            current_sub = p
            break

    if not current_sub:
        print("No active subscription found")
        return

    # Choose appropriate replacement mode
    var replacement_mode = 1 if is_upgrade else 6
    # 1 = WITH_TIME_PRORATION - Upgrade: give credit
    # 6 = DEFERRED - Downgrade: change at renewal

    var props = RequestPurchaseProps.new()
    props.request = RequestPurchasePropsByPlatforms.new()
    props.request.google = RequestPurchaseAndroidProps.new()
    props.request.google.skus = [new_sku]
    props.request.google.purchase_token = current_sub.purchase_token
    props.request.google.replacement_mode = replacement_mode
    props.type = ProductType.SUBS

    await iap.request_purchase(props)

    # If DEFERRED, store pending change in your backend
    if not is_upgrade:
        var http_request = HTTPRequest.new()
        add_child(http_request)
        http_request.request(
            "/api/subscriptions/pending-change",
            ["Content-Type: application/json"],
            HTTPClient.METHOD_POST,
            JSON.stringify({
                "userId": "user123",
                "currentSku": current_sub.product_id,
                "newSku": new_sku,
                "effectiveDate": current_sub.expiration_date
            })
        )`}</CodeBlock>
                      ),
                    }}
                  </LanguageTabs>
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
