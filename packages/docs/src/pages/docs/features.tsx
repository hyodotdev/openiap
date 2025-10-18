import { Link } from 'react-router-dom';
import AnchorLink from '../../components/AnchorLink';
import CodeBlock from '../../components/CodeBlock';
import PlatformTabs from '../../components/PlatformTabs';
import Accordion from '../../components/Accordion';
import { useScrollToHash } from '../../hooks/useScrollToHash';

function Features() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <h1>Subscription Upgrade/Downgrade</h1>

      <section>
        <p>
          Handle subscription tier changes within the same subscription group.
          Both platforms support upgrading and downgrading subscriptions, but
          the implementation differs significantly.
        </p>

        <AnchorLink id="overview" level="h2">
          Overview
        </AnchorLink>
        <p>
          The complete subscription upgrade/downgrade flow consists of several
          steps:
        </p>
        <ol>
          <li>
            <strong>Initialize Connection:</strong> Connect to the store service
          </li>
          <li>
            <strong>Fetch Products:</strong> Load available subscription plans
          </li>
          <li>
            <strong>Get Active Subscriptions:</strong> Check current
            subscription status
          </li>
          <li>
            <strong>Determine Upgrade/Downgrade:</strong> Compare current and
            target tiers
          </li>
          <li>
            <strong>Execute Change:</strong> Purchase the new subscription tier
          </li>
          <li>
            <strong>Handle Result:</strong> Update UI and verify the change
          </li>
        </ol>

        <AnchorLink id="step-1-initialize-connection" level="h2">
          Step 1: Initialize Connection
        </AnchorLink>
        <p>
          Before fetching products, you must establish a connection to the store
          service.
        </p>

        <PlatformTabs>
          {{
            ios: (
              <CodeBlock language="swift">{`// Initialize connection on app launch or screen appearance
do {
    let connected = try await iapStore.initConnection()
    if connected {
        print("✅ Store connection established")
    }
} catch {
    print("❌ Failed to connect: \\(error.localizedDescription)")
}`}</CodeBlock>
            ),
            android: (
              <CodeBlock language="kotlin">{`// Initialize connection on app launch or screen entry
try {
    val connected = iapStore.initConnection()
    if (connected) {
        println("✅ Store connection established")
    }
} catch (e: Exception) {
    println("❌ Failed to connect: \${e.message}")
}`}</CodeBlock>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="step-2-fetch-products" level="h2">
          Step 2: Fetch Subscription Products
        </AnchorLink>
        <p>
          Load your subscription products from the store. You must configure
          these products in App Store Connect (iOS) or Google Play Console
          (Android) first.
        </p>

        <PlatformTabs>
          {{
            ios: (
              <>
                <CodeBlock language="swift">{`// Define your subscription product IDs
// Order them from lowest to highest tier for easy comparison
private let subscriptionIds: [String] = [
    "dev.hyo.martie.premium",       // Monthly subscription (lower tier)
    "dev.hyo.martie.premium_year"   // Yearly subscription (higher tier)
]

// Fetch subscription products
private func loadProducts() async {
    do {
        try await iapStore.fetchProducts(skus: subscriptionIds, type: .all)

        // Verify products were loaded
        let products = iapStore.iosProducts.filter { $0.type == .subs }
        print("✅ Loaded \\(products.count) subscription products")

        for product in products {
            print("  - \\(product.id): \\(product.localizedTitle)")
            print("    Price: \\(product.price) \\(product.currencyCode ?? "")")
        }
    } catch {
        print("❌ Failed to load products: \\(error.localizedDescription)")
    }
}`}</CodeBlock>
                <p>
                  <strong>Product Configuration (App Store Connect):</strong>
                </p>
                <ul>
                  <li>
                    Create subscription products in the same{' '}
                    <strong>Subscription Group</strong>
                  </li>
                  <li>
                    Set different subscription levels (e.g., Level 1 for
                    monthly, Level 2 for yearly)
                  </li>
                  <li>Configure pricing for each product</li>
                  <li>Enable introductory offers if needed</li>
                </ul>
              </>
            ),
            android: (
              <>
                <CodeBlock language="kotlin">{`// Define your subscription product IDs
object IapConstants {
    val SUBS_SKUS = listOf(
        "dev.hyo.martie.premium",       // Monthly subscription (lower tier)
        "dev.hyo.martie.premium_year"   // Yearly subscription (higher tier)
    )

    // Base plan IDs for Google Play Billing
    const val PREMIUM_MONTHLY_BASE_PLAN = "premium"
    const val PREMIUM_YEARLY_BASE_PLAN = "premium-year"
}

// Fetch subscription products
private suspend fun loadProducts() {
    try {
        val request = ProductRequest(
            skus = IapConstants.SUBS_SKUS,
            type = ProductQueryType.Subs
        )

        iapStore.fetchProducts(request)

        // Access products from state
        val products = iapStore.products.value.filterIsInstance<ProductAndroid>()
        println("✅ Loaded \${products.size} subscription products")

        for (product in products) {
            println("  - \${product.id}: \${product.title}")
            println("    Price: \${product.price} \${product.currency}")
        }

        // Access subscription-specific details
        val subscriptions = iapStore.subscriptions.value.filterIsInstance<ProductSubscriptionAndroid>()
        for (sub in subscriptions) {
            println("  Subscription: \${sub.id}")
            sub.subscriptionOfferDetailsAndroid.forEach { offer ->
                println("    Offer: \${offer.basePlanId}")
                offer.pricingPhases.pricingPhaseList.forEach { phase ->
                    println("      Phase: \${phase.formattedPrice}")
                }
            }
        }
    } catch (e: Exception) {
        println("❌ Failed to load products: \${e.message}")
    }
}`}</CodeBlock>
                <p>
                  <strong>Product Configuration (Google Play Console):</strong>
                </p>
                <ul>
                  <li>
                    Create subscription products in the same{' '}
                    <strong>Subscription Group</strong>
                  </li>
                  <li>
                    Create base plans for each tier (e.g., "premium" for
                    monthly, "premium-year" for yearly)
                  </li>
                  <li>Configure pricing and billing periods</li>
                  <li>
                    Add offers (free trials, introductory pricing) if needed
                  </li>
                  <li>
                    Note: Products must be in the same subscription group to
                    allow upgrades/downgrades
                  </li>
                </ul>
              </>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="step-3-get-active-subscriptions" level="h2">
          Step 3: Get Active Subscriptions (Initial Load Only)
        </AnchorLink>
        <p>
          Check if the user has any active subscriptions to determine the
          current tier.{' '}
          <strong>
            Call this ONLY on initial screen load, NOT after purchase.
          </strong>
        </p>

        <PlatformTabs>
          {{
            ios: (
              <>
                <CodeBlock language="swift">{`// Get active subscriptions
private func loadPurchases() async {
    do {
        try await iapStore.getActiveSubscriptions()

        // Check active subscriptions
        let activeSubs = iapStore.activeSubscriptions.filter { $0.isActive }

        if activeSubs.isEmpty {
            print("No active subscriptions")
        } else {
            for sub in activeSubs {
                print("Active subscription: \\(sub.productId)")
                print("  isActive: \\(sub.isActive)")

                if let renewalInfo = sub.renewalInfoIOS {
                    print("  willAutoRenew: \\(renewalInfo.willAutoRenew)")
                    print("  autoRenewPreference: \\(renewalInfo.autoRenewPreference ?? "nil")")

                    // Check if subscription is cancelled
                    let isCancelled = sub.isActive && !renewalInfo.willAutoRenew
                    print("  Status: \\(isCancelled ? "Cancelled" : "Active")")

                    // IMPORTANT: Check for pending upgrades
                    if let pendingUpgrade = renewalInfo.pendingUpgradeProductId {
                        print("⚠️ PENDING UPGRADE DETECTED!")
                        print("  Current tier: \\(sub.productId)")
                        print("  Will upgrade to: \\(pendingUpgrade)")
                        print("  Note: Upgrade applies immediately, but productId may take time to update")
                    }
                }
            }
        }
    } catch {
        print("❌ Failed to load subscriptions: \\(error.localizedDescription)")
    }
}

// Helper to get current subscription
func getCurrentSubscription() -> ActiveSubscription? {
    let activeSubs = iapStore.activeSubscriptions.filter { $0.isActive }

    // Return the subscription with the highest tier
    // (yearly over monthly, for example)
    return activeSubs.first { $0.productId.contains("year") } ?? activeSubs.first
}`}</CodeBlock>

                <Accordion
                  title={<>💡 Understanding pendingUpgradeProductId</>}
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
                  <p>
                    <strong>Key takeaway:</strong> Use{' '}
                    <code>pendingUpgradeProductId</code> to detect tier changes
                    in progress. Don't rely on <code>productId</code> alone
                    immediately after upgrade.
                  </p>
                </Accordion>
              </>
            ),
            android: (
              <>
                <CodeBlock language="kotlin">{`// Get active subscriptions (ONLY on initial load)
private suspend fun loadSubscriptions() {
    try {
        iapStore.getActiveSubscriptions()

        // Access active subscriptions from state
        val activeSubscriptions = iapStore.activeSubscriptions.value
            .filterIsInstance<ActiveSubscriptionAndroid>()
            .filter { it.productId in IapConstants.SUBS_SKUS }

        if (activeSubscriptions.isEmpty()) {
            println("No active subscriptions")
        } else {
            for (subscription in activeSubscriptions) {
                println("Active subscription: \${subscription.productId}")
                println("  Is active: \${subscription.isActive}")
                println("  Auto-renewing: \${subscription.autoRenewing}")
                println("  Expiry time: \${subscription.expiryTimeMillis}")

                // Check subscription status
                val now = System.currentTimeMillis()
                if (subscription.expiryTimeMillis > now && subscription.autoRenewing) {
                    println("  Status: Active & Renewing")
                } else if (subscription.expiryTimeMillis > now && !subscription.autoRenewing) {
                    println("  Status: Active but Cancelled (expires soon)")
                } else {
                    println("  Status: Expired")
                }
            }
        }
    } catch (e: Exception) {
        println("❌ Failed to load subscriptions: \${e.message}")
    }
}

// Helper to get current subscription
fun getCurrentSubscription(): ActiveSubscriptionAndroid? {
    val activeSubscriptions = iapStore.activeSubscriptions.value
        .filterIsInstance<ActiveSubscriptionAndroid>()
        .filter { it.productId in IapConstants.SUBS_SKUS && it.isActive }

    // Return the subscription with the highest tier
    return activeSubscriptions.firstOrNull { it.productId.contains("year") }
        ?: activeSubscriptions.firstOrNull()
}`}</CodeBlock>

                <Accordion
                  title={
                    <>💡 getActiveSubscriptions vs getAvailablePurchases</>
                  }
                  variant="tip"
                >
                  <ul>
                    <li>
                      <strong>getActiveSubscriptions():</strong> Returns only
                      currently active subscriptions with refined data (expiry
                      time, auto-renew status, etc.)
                    </li>
                    <li>
                      <strong>getAvailablePurchases():</strong> Returns all
                      purchase history including expired subscriptions and
                      one-time purchases
                    </li>
                    <li>
                      <strong>Recommendation:</strong> Use{' '}
                      <code>getActiveSubscriptions()</code> for subscription
                      management. Use <code>getAvailablePurchases()</code> only
                      when you need detailed purchase history.
                    </li>
                  </ul>
                </Accordion>
              </>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="setup-purchase-listener" level="h3">
          Setup Purchase Success Listener
        </AnchorLink>
        <p>
          After implementing the initial load above, you also need to handle
          purchase events. When a purchase/upgrade completes, use the{' '}
          <code>onPurchaseSuccess</code> listener to get updated subscription
          data automatically.
        </p>
        <blockquote
          style={{
            borderLeft: '3px solid var(--primary-color)',
            paddingLeft: '1rem',
            margin: '1rem 0',
            fontStyle: 'italic',
            color: 'var(--text-secondary)',
          }}
        >
          <strong>Important:</strong> Do NOT call{' '}
          <code>getActiveSubscriptions()</code> after purchase - the purchase
          data is already provided in the callback.
        </blockquote>

        <PlatformTabs>
          {{
            ios: (
              <>
                <CodeBlock language="swift">{`// Setup purchase listener (in setupIapProvider or onAppear)
private func setupIapProvider() {
    // Setup purchase success callback
    iapStore.onPurchaseSuccess = { purchase in
        if let iosPurchase = purchase.asIOS() {
            Task { @MainActor in
                self.handlePurchaseSuccess(iosPurchase)
            }
        }
    }

    // Setup error callback
    iapStore.onPurchaseError = { error in
        Task { @MainActor in
            self.handlePurchaseError(error)
        }
    }

    // Initialize connection and load products
    Task {
        try await iapStore.initConnection()
        await loadProducts()
        await loadPurchases()  // Only on initial load
    }
}

// Handle purchase success - this fires AUTOMATICALLY after purchase
private func handlePurchaseSuccess(_ purchase: OpenIapPurchase) {
    print("✅ Purchase successful: \\(purchase.productId)")
    print("📦 Purchase data available immediately - NO need to call getActiveSubscriptions()")

    // Check if this is an upgrade by looking at renewalInfo
    if let renewalInfo = purchase.renewalInfoIOS {
        print("🔄 RenewalInfo (CRITICAL FOR UPGRADE DETECTION):")
        print("  willAutoRenew: \\(renewalInfo.willAutoRenew)")
        print("  autoRenewPreference: \\(renewalInfo.autoRenewPreference ?? "nil")")

        if let pendingUpgrade = renewalInfo.pendingUpgradeProductId {
            // Detect if this is an upgrade or current subscription
            if pendingUpgrade != purchase.productId {
                print("⚠️ UPGRADE SCHEDULED: \\(purchase.productId) → \\(pendingUpgrade)")
                print("   Current: \\(purchase.productId) (active now)")
                print("   Next: \\(pendingUpgrade) (will activate soon)")

                // Show UI: "Upgrading to [tier]..."
                showUpgradeInProgressUI(from: purchase.productId, to: pendingUpgrade)
            } else {
                print("✅ Subscription active (no upgrade)")
            }
        } else {
            print("✅ Current subscription (no pending changes)")
        }
    }

    // Update UI with the purchase data
    // The store's internal state is ALREADY updated - just refresh your UI
    self.recentPurchase = purchase

    // DO NOT call getActiveSubscriptions() here!
    // The purchase data is fresher than what getActiveSubscriptions() returns
}

// Optional: Show upgrade in progress UI
private func showUpgradeInProgressUI(from currentTier: String, to targetTier: String) {
    // Show user-friendly message
    let message = """
    Upgrade in progress!
    Current: \\(currentTier)
    Upgrading to: \\(targetTier)
    This will complete in a few minutes.
    """
    print(message)
    // Update your UI accordingly
}`}</CodeBlock>

                <Accordion
                  title={<>💡 Why NOT call getActiveSubscriptions() here?</>}
                  variant="info"
                >
                  <ul>
                    <li>
                      <code>onPurchaseSuccess</code> fires immediately with
                      fresh purchase data
                    </li>
                    <li>
                      The store's internal <code>activeSubscriptions</code> is
                      already updated from the purchase
                    </li>
                    <li>
                      Calling <code>getActiveSubscriptions()</code> again can
                      cause infinite rendering loops
                    </li>
                    <li>
                      The purchase object contains all the info you need,
                      including <code>renewalInfoIOS</code>
                    </li>
                  </ul>
                </Accordion>
              </>
            ),
            android: (
              <>
                <CodeBlock language="kotlin">{`// Setup purchase listener using LaunchedEffect
val lastPurchase by iapStore.currentPurchase.collectAsState(initial = null)
val lastPurchaseAndroid: PurchaseAndroid? = remember(lastPurchase) {
    when (val purchase = lastPurchase) {
        is PurchaseAndroid -> purchase
        else -> null
    }
}

// Auto-handle purchase when it completes
LaunchedEffect(lastPurchaseAndroid?.id) {
    val purchase = lastPurchaseAndroid ?: return@LaunchedEffect

    println("✅ Purchase successful: \${purchase.productId}")
    println("📦 Purchase data available - processing...")

    try {
        // 1) Server-side validation (REQUIRED for production)
        val valid = validateReceiptOnServer(purchase)
        if (!valid) {
            iapStore.postStatusMessage(
                message = "Receipt validation failed",
                status = PurchaseResultStatus.Error,
                productId = purchase.productId
            )
            return@LaunchedEffect
        }

        // 2) Determine if consumable
        val product = products.find { it.id == purchase.productId }
        val isConsumable = product?.let {
            it.type == ProductType.InApp &&
            (it.id.contains("consumable", true) || it.id.contains("bulb", true))
        } == true

        // 3) Finish transaction
        try {
            iapStore.finishTransaction(purchase, isConsumable)

            // 4) Refresh active subscriptions to get updated state
            // This is needed for Android to update subscription status
            if (purchase.productId in IapConstants.SUBS_SKUS) {
                delay(500)  // Give Google Play time to process
                iapStore.getActiveSubscriptions()

                // Also refresh products to get updated offer details
                val request = ProductRequest(
                    skus = IapConstants.SUBS_SKUS,
                    type = ProductQueryType.Subs
                )
                iapStore.fetchProducts(request)
            }

            iapStore.postStatusMessage(
                message = "Purchase completed successfully",
                status = PurchaseResultStatus.Success,
                productId = purchase.productId
            )
        } catch (e: Exception) {
            iapStore.postStatusMessage(
                message = "Failed to finish transaction: \${e.message}",
                status = PurchaseResultStatus.Error,
                productId = purchase.productId
            )
        }
    } catch (e: Exception) {
        println("❌ Error processing purchase: \${e.message}")
    }
}

// Server-side validation function (implement with your backend)
suspend fun validateReceiptOnServer(purchase: PurchaseAndroid): Boolean {
    // TODO: Replace with your real backend API call
    // POST purchase.purchaseToken to your server
    // Server calls Google Play Developer API to verify
    return true  // Placeholder
}`}</CodeBlock>

                <Accordion
                  title={
                    <>
                      💡 Android: Why call getActiveSubscriptions() after
                      purchase?
                    </>
                  }
                  variant="info"
                >
                  <ul>
                    <li>
                      Unlike iOS, Android needs explicit refresh after finishing
                      transaction
                    </li>
                    <li>
                      Google Play Billing updates subscription state
                      asynchronously
                    </li>
                    <li>
                      <code>getActiveSubscriptions()</code> ensures UI shows the
                      latest subscription status with refined data
                    </li>
                    <li>
                      For upgrades/downgrades, also refresh products to get
                      updated offer details
                    </li>
                    <li>
                      Small delay (500ms) gives Google Play time to process the
                      transaction
                    </li>
                  </ul>
                </Accordion>
              </>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="step-4-determine-upgrade-downgrade" level="h2">
          Step 4: Determine Upgrade/Downgrade Possibility
        </AnchorLink>
        <p>
          Compare the current subscription tier with the target tier to
          determine if it's an upgrade, downgrade, or not allowed.
        </p>

        <PlatformTabs>
          {{
            ios: (
              <>
                <CodeBlock language="swift">{`// Upgrade info model
struct UpgradeInfo {
    let canUpgrade: Bool
    let isDowngrade: Bool
    let currentTier: String?
    let message: String?
    let isPending: Bool  // True if upgrade is already scheduled
}

// Get subscription tier level (higher number = higher tier)
func getSubscriptionTier(_ productId: String) -> Int {
    if productId.contains("year") || productId.contains("annual") {
        return 2  // Yearly is higher tier
    } else if productId.contains("month") || productId.contains("premium") {
        return 1  // Monthly is lower tier
    }
    return 0  // Unknown tier
}

// Determine if upgrade/downgrade is possible
func getUpgradeInfo(
    from currentSubscription: ActiveSubscription?,
    to targetProductId: String
) -> UpgradeInfo {
    guard let current = currentSubscription else {
        // No active subscription = new purchase
        return UpgradeInfo(
            canUpgrade: false,
            isDowngrade: false,
            currentTier: nil,
            message: nil,
            isPending: false
        )
    }

    // Check if subscription is cancelled
    let isCancelled = current.renewalInfoIOS?.willAutoRenew == false

    // Same product check
    if current.productId == targetProductId {
        if isCancelled {
            return UpgradeInfo(
                canUpgrade: false,
                isDowngrade: false,
                currentTier: current.productId,
                message: "Reactivate subscription",
                isPending: false
            )
        } else {
            return UpgradeInfo(
                canUpgrade: false,
                isDowngrade: false,
                currentTier: current.productId,
                message: "Already subscribed",
                isPending: false
            )
        }
    }

    // Check for pending upgrade
    if !isCancelled,
       let renewalInfo = current.renewalInfoIOS,
       let pendingUpgrade = renewalInfo.pendingUpgradeProductId,
       pendingUpgrade == targetProductId {
        return UpgradeInfo(
            canUpgrade: false,
            isDowngrade: false,
            currentTier: current.productId,
            message: "Upgrade will activate on next renewal",
            isPending: true
        )
    }

    // Compare tiers
    let currentTier = getSubscriptionTier(current.productId)
    let targetTier = getSubscriptionTier(targetProductId)

    // Don't allow tier changes for cancelled subscriptions
    if isCancelled {
        return UpgradeInfo(
            canUpgrade: false,
            isDowngrade: false,
            currentTier: current.productId,
            message: "Reactivate or wait until expiry",
            isPending: false
        )
    }

    // Determine upgrade/downgrade
    let canUpgrade = targetTier > currentTier
    let isDowngrade = targetTier < currentTier

    return UpgradeInfo(
        canUpgrade: canUpgrade,
        isDowngrade: isDowngrade,
        currentTier: current.productId,
        message: canUpgrade ? "Upgrade available" :
                 (isDowngrade ? "Downgrade option" : nil),
        isPending: false
    )
}

// Example usage
let currentSub = getCurrentSubscription()
let upgradeInfo = getUpgradeInfo(from: currentSub, to: "dev.hyo.martie.premium_year")

if upgradeInfo.canUpgrade {
    print("✅ Can upgrade to yearly plan")
} else if upgradeInfo.isDowngrade {
    print("⬇️ Can downgrade to monthly plan")
} else if upgradeInfo.isPending {
    print("⏳ Upgrade is pending")
} else {
    print("❌ Cannot change: \\(upgradeInfo.message ?? "Unknown reason")")
}`}</CodeBlock>
              </>
            ),
            android: (
              <>
                <CodeBlock language="kotlin">{`// Upgrade info data class
data class UpgradeInfo(
    val canUpgrade: Boolean = false,
    val isDowngrade: Boolean = false,
    val currentTier: String? = null,
    val message: String? = null
)

// Get subscription tier level (higher number = higher tier)
fun getSubscriptionTier(productId: String): Int {
    return when {
        productId.contains("year") || productId.contains("annual") -> 2
        productId.contains("month") || productId.contains("premium") -> 1
        else -> 0
    }
}

// Determine if upgrade/downgrade is possible
fun getUpgradeInfo(
    currentSubscription: PurchaseAndroid?,
    targetProductId: String
): UpgradeInfo {
    if (currentSubscription == null) {
        // No active subscription = new purchase
        return UpgradeInfo()
    }

    // Same product check
    if (currentSubscription.productId == targetProductId) {
        return UpgradeInfo(
            currentTier = currentSubscription.productId,
            message = "Already subscribed"
        )
    }

    // Compare tiers
    val currentTier = getSubscriptionTier(currentSubscription.productId)
    val targetTier = getSubscriptionTier(targetProductId)

    val canUpgrade = targetTier > currentTier
    val isDowngrade = targetTier < currentTier

    return UpgradeInfo(
        canUpgrade = canUpgrade,
        isDowngrade = isDowngrade,
        currentTier = currentSubscription.productId,
        message = when {
            canUpgrade -> "Upgrade available"
            isDowngrade -> "Downgrade option"
            else -> null
        }
    )
}

// Example usage
val currentSub = getCurrentSubscription(purchases)
val upgradeInfo = getUpgradeInfo(currentSub, "dev.hyo.martie.premium_year")

when {
    upgradeInfo.canUpgrade -> println("✅ Can upgrade to yearly plan")
    upgradeInfo.isDowngrade -> println("⬇️ Can downgrade to monthly plan")
    else -> println("❌ Cannot change: \${upgradeInfo.message ?: "Unknown reason"}")
}`}</CodeBlock>
              </>
            ),
          }}
        </PlatformTabs>
      </section>

      <section>
        <PlatformTabs>
          {{
            ios: (
              <>
                <AnchorLink id="ios-subscription-changes" level="h3">
                  iOS Subscription Changes
                </AnchorLink>
                <p>
                  On iOS, StoreKit 2 automatically handles subscription upgrades
                  and downgrades within the same subscription group. Simply call{' '}
                  <code>requestPurchase</code> with the new product ID.
                </p>

                <AnchorLink id="ios-how-it-works" level="h4">
                  How It Works
                </AnchorLink>
                <ul>
                  <li>
                    <strong>Upgrade (Higher Tier):</strong> Applied immediately
                    with prorated refund for unused time
                  </li>
                  <li>
                    <strong>Downgrade (Lower Tier):</strong> Applied at next
                    renewal date
                  </li>
                  <li>
                    <strong>Detection:</strong> Use{' '}
                    <code>renewalInfoIOS.pendingUpgradeProductId</code> to
                    detect pending tier changes
                  </li>
                  <li>
                    <strong>Cancellation:</strong> Check{' '}
                    <code>renewalInfoIOS.willAutoRenew</code> to detect
                    cancelled subscriptions
                  </li>
                </ul>

                <AnchorLink id="ios-implementation" level="h4">
                  Implementation
                </AnchorLink>
                <CodeBlock language="swift">{`// 1. Get current active subscription
let activeSubs = activeSubscriptions.filter { $0.isActive }
let currentSubscription = activeSubs.first {
  $0.productId.contains("year")
} ?? activeSubs.first

// 2. Check if upgrade/downgrade is possible
func getUpgradeInfo(
  from current: ActiveSubscription?,
  to targetProductId: String
) -> UpgradeInfo {
  guard let current = current else {
    return UpgradeInfo(canUpgrade: false, isDowngrade: false)
  }

  // Check if subscription is cancelled
  let isCancelled = current.renewalInfoIOS?.willAutoRenew == false

  // Check for pending upgrade
  if let pendingUpgrade = current.renewalInfoIOS?.pendingUpgradeProductId,
     pendingUpgrade == targetProductId {
    return UpgradeInfo(
      canUpgrade: false,
      isDowngrade: false,
      message: "Upgrade will activate on next renewal",
      isPending: true
    )
  }

  // Compare tiers
  let currentTier = getSubscriptionTier(current.productId)
  let targetTier = getSubscriptionTier(targetProductId)

  return UpgradeInfo(
    canUpgrade: targetTier > currentTier,
    isDowngrade: targetTier < currentTier,
    currentTier: current.productId
  )
}

// 3. Execute upgrade/downgrade
func upgradeSubscription(
  from currentSubscription: ActiveSubscription?,
  to product: OpenIapProduct
) async {
  let isUpgrade = getSubscriptionTier(product.id) >
                  getSubscriptionTier(currentSubscription?.productId ?? "")

  print("Starting \\(isUpgrade ? "upgrade" : "downgrade")")
  print("From: \\(currentSubscription?.productId ?? "none")")
  print("To: \\(product.id)")

  do {
    // StoreKit 2 automatically handles tier changes
    _ = try await iapStore.requestPurchase(
      sku: product.id,
      type: .subs,
      autoFinish: true
    )

    // Reload subscriptions to get updated state
    await loadPurchases()
  } catch {
    print("Upgrade failed: \\(error.localizedDescription)")
  }
}

// 4. Detect tier level
func getSubscriptionTier(_ productId: String) -> Int {
  if productId.contains("year") || productId.contains("annual") {
    return 2  // Yearly is higher tier
  } else if productId.contains("month") || productId.contains("premium") {
    return 1  // Monthly is lower tier
  }
  return 0
}`}</CodeBlock>

                <AnchorLink id="ios-renewal-info" level="h4">
                  Understanding RenewalInfo
                </AnchorLink>
                <p>
                  The <code>renewalInfoIOS</code> field contains critical
                  information for subscription management:
                </p>
                <CodeBlock language="swift">{`if let renewalInfo = purchase.renewalInfoIOS {
  // Auto-renewal status
  print("willAutoRenew: \\(renewalInfo.willAutoRenew)")

  // Pending upgrade detection
  if let pendingUpgrade = renewalInfo.pendingUpgradeProductId {
    if pendingUpgrade != purchase.productId {
      print("⚠️ UPGRADE SCHEDULED: \\(purchase.productId) → \\(pendingUpgrade)")
    }
  }

  // Renewal date
  if let renewalDate = renewalInfo.renewalDate {
    let date = Date(timeIntervalSince1970: renewalDate / 1000)
    print("Next renewal: \\(date)")
  }

  // Cancellation check
  let isCancelled = purchase.isActive && !renewalInfo.willAutoRenew
  if isCancelled {
    print("❌ Subscription cancelled (active until expiry)")
  }
}`}</CodeBlock>

                <AnchorLink id="ios-best-practices" level="h4">
                  Best Practices
                </AnchorLink>
                <ul>
                  <li>
                    Always use <code>activeSubscriptions</code> to get the most
                    up-to-date subscription status
                  </li>
                  <li>
                    Check <code>renewalInfoIOS</code> for pending upgrades
                    before allowing new tier changes
                  </li>
                  <li>
                    Don't allow tier changes if subscription is cancelled (user
                    should reactivate or wait for expiry)
                  </li>
                  <li>
                    Reload subscriptions after upgrade/downgrade to ensure UI
                    reflects the latest state
                  </li>
                  <li>
                    Use <code>showManageSubscriptionsIOS()</code> to let users
                    manage subscriptions in App Store
                  </li>
                </ul>

                <AnchorLink id="ios-example" level="h4">
                  Full Example
                </AnchorLink>
                <p>
                  See{' '}
                  <a
                    href="https://github.com/hyodotdev/openiap/blob/main/packages/apple/Example/OpenIapExample/Screens/SubscriptionFlowScreen.swift"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <code>
                      packages/apple/Example/OpenIapExample/Screens/SubscriptionFlowScreen.swift
                    </code>
                  </a>{' '}
                  for a complete working implementation.
                </p>
              </>
            ),
            android: (
              <>
                <AnchorLink id="android-subscription-changes" level="h3">
                  Android Subscription Changes
                </AnchorLink>
                <p>
                  On Android, subscription upgrades and downgrades require
                  specifying the <code>purchaseToken</code> of the existing
                  subscription and a <code>replacementMode</code> that controls
                  the billing behavior.
                </p>

                <AnchorLink id="android-replacement-modes" level="h4">
                  Replacement Modes
                </AnchorLink>
                <p>Google Play Billing supports several replacement modes:</p>
                <ul>
                  <li>
                    <code>WITHOUT_PRORATION (1)</code>: No proration, change
                    takes effect immediately
                  </li>
                  <li>
                    <code>CHARGE_PRORATED_PRICE (2)</code>: Charge prorated
                    amount immediately (for upgrades)
                  </li>
                  <li>
                    <code>DEFERRED (3)</code>: Change takes effect at next
                    billing cycle
                  </li>
                  <li>
                    <code>WITH_TIME_PRORATION (4)</code>: Time-based proration
                  </li>
                  <li>
                    <code>CHARGE_FULL_PRICE (5)</code>: Charge full price
                    immediately (often used for offer changes)
                  </li>
                </ul>

                <AnchorLink id="android-how-it-works" level="h4">
                  How It Works
                </AnchorLink>
                <ul>
                  <li>
                    <strong>Upgrade:</strong> Typically use{' '}
                    <code>CHARGE_PRORATED_PRICE</code> to charge the difference
                    immediately
                  </li>
                  <li>
                    <strong>Downgrade:</strong> Typically use{' '}
                    <code>DEFERRED</code> to apply at next billing cycle
                  </li>
                  <li>
                    <strong>Offer Change:</strong> Use{' '}
                    <code>CHARGE_FULL_PRICE</code> when changing between offers
                    of the same product
                  </li>
                  <li>
                    <strong>Detection:</strong> Track current offer in{' '}
                    <code>SharedPreferences</code> since Google doesn't provide
                    offer info in purchases
                  </li>
                </ul>

                <AnchorLink id="android-implementation" level="h4">
                  Implementation
                </AnchorLink>
                <CodeBlock language="kotlin">{`// 1. Define replacement modes
object ReplacementMode {
  const val WITHOUT_PRORATION = 1
  const val CHARGE_PRORATED_PRICE = 2
  const val DEFERRED = 3
  const val WITH_TIME_PRORATION = 4
  const val CHARGE_FULL_PRICE = 5
}

// 2. Get current subscription and purchase token
val activeSubscriptions = purchases.filter {
  it.productId in SUBSCRIPTION_SKUS
}
val currentSubscription = activeSubscriptions.firstOrNull()
val purchaseToken = currentSubscription?.purchaseToken

// 3. Determine target offer and replacement mode
val targetOffer = when (currentOfferBasePlanId) {
  PREMIUM_MONTHLY_BASE_PLAN -> yearlyOffer
  PREMIUM_YEARLY_BASE_PLAN -> monthlyOffer
  else -> null
}

// For same product with different offers
val replacementMode = ReplacementMode.CHARGE_FULL_PRICE

// 4. Execute subscription change
if (purchaseToken != null && targetOffer != null) {
  try {
    iapStore.setActivity(activity)

    val offerInputs = listOf(
      AndroidSubscriptionOfferInput(
        sku = PREMIUM_SUBSCRIPTION_PRODUCT_ID,
        offerToken = targetOffer.offerToken
      )
    )

    val props = RequestPurchaseProps(
      request = RequestPurchaseProps.Request.Subscription(
        RequestSubscriptionPropsByPlatforms(
          android = RequestSubscriptionAndroidProps(
            purchaseTokenAndroid = purchaseToken,
            replacementModeAndroid = replacementMode,
            skus = listOf(PREMIUM_SUBSCRIPTION_PRODUCT_ID),
            subscriptionOffers = offerInputs
          )
        )
      ),
      type = ProductQueryType.Subs
    )

    val result = iapStore.requestPurchase(props)

    // Save new offer to SharedPreferences
    val newOfferBasePlanId = targetOffer.basePlanId
    prefs.savePremiumOffer(PREMIUM_SUBSCRIPTION_PRODUCT_ID, newOfferBasePlanId)

    // Refresh purchases
    iapStore.getAvailablePurchases(null)
  } catch (e: Exception) {
    println("Subscription change failed: \${e.message}")
  }
}`}</CodeBlock>

                <AnchorLink id="android-tracking-offers" level="h4">
                  Tracking Current Offer
                </AnchorLink>
                <p>
                  Since Google Play doesn't provide base plan or offer
                  information in purchase receipts, you must track the current
                  offer client-side:
                </p>
                <CodeBlock language="kotlin">{`// SharedPreferences helper
const val SUBSCRIPTION_PREFS_NAME = "openiap_subscriptions"

fun SharedPreferences.savePremiumOffer(productId: String, basePlanId: String) {
  edit().putString("offer_\${productId}", basePlanId).apply()
}

fun SharedPreferences.getPremiumOffer(productId: String): String? {
  return getString("offer_\${productId}", null)
}

// Resolve current offer from purchase
fun resolvePremiumOfferInfo(
  prefs: SharedPreferences,
  purchase: PurchaseAndroid
): OfferInfo? {
  val savedBasePlanId = prefs.getPremiumOffer(purchase.productId)

  return when (savedBasePlanId) {
    PREMIUM_MONTHLY_BASE_PLAN -> OfferInfo(
      basePlanId = PREMIUM_MONTHLY_BASE_PLAN,
      displayName = "Monthly Plan"
    )
    PREMIUM_YEARLY_BASE_PLAN -> OfferInfo(
      basePlanId = PREMIUM_YEARLY_BASE_PLAN,
      displayName = "Yearly Plan"
    )
    else -> OfferInfo(
      basePlanId = PREMIUM_MONTHLY_BASE_PLAN,
      displayName = "Monthly Plan (default)"
    )
  }
}`}</CodeBlock>

                <AnchorLink id="android-server-validation" level="h4">
                  Server-Side Validation
                </AnchorLink>
                <p>
                  For production apps, always validate subscription status
                  server-side using the Google Play Developer API:
                </p>
                <CodeBlock language="kotlin">{`// Expected server response structure
data class SubscriptionUiInfo(
  val renewalDate: Long? = null,        // expiryTimeMillis
  val autoRenewing: Boolean = true,
  val gracePeriodEndDate: Long? = null,
  val freeTrialEndDate: Long? = null
)

suspend fun fetchSubStatusFromServer(
  productId: String,
  purchaseToken: String
): SubscriptionUiInfo? {
  // POST purchase token to your backend
  // Backend calls Google Play Developer API
  // Returns validated subscription status
  return yourBackendApi.validateSubscription(productId, purchaseToken)
}`}</CodeBlock>

                <AnchorLink id="android-best-practices" level="h4">
                  Best Practices
                </AnchorLink>
                <ul>
                  <li>
                    Always validate subscriptions server-side using Google Play
                    Developer API
                  </li>
                  <li>
                    Track current offer in <code>SharedPreferences</code> since
                    purchase receipts don't include offer details
                  </li>
                  <li>
                    Use <code>CHARGE_PRORATED_PRICE</code> for upgrades to give
                    immediate access
                  </li>
                  <li>
                    Use <code>DEFERRED</code> for downgrades to avoid
                    mid-billing-cycle changes
                  </li>
                  <li>
                    Use <code>CHARGE_FULL_PRICE</code> for offer changes within
                    the same product
                  </li>
                  <li>
                    Always refresh purchases after subscription changes with{' '}
                    <code>getAvailablePurchases(null)</code>
                  </li>
                  <li>
                    Handle errors gracefully - replacement modes may not work if
                    subscriptions aren't in the same group
                  </li>
                </ul>

                <AnchorLink id="android-example" level="h4">
                  Full Example
                </AnchorLink>
                <p>
                  See{' '}
                  <a
                    href="https://github.com/hyodotdev/openiap/blob/main/packages/google/Example/src/main/java/dev/hyo/martie/screens/SubscriptionFlowScreen.kt"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <code>
                      packages/google/Example/src/main/java/dev/hyo/martie/screens/SubscriptionFlowScreen.kt
                    </code>
                  </a>{' '}
                  for a complete working implementation including offer tracking
                  and UI state management.
                </p>
              </>
            ),
          }}
        </PlatformTabs>

        <AnchorLink id="common-considerations" level="h3">
          Common Considerations
        </AnchorLink>
        <ul>
          <li>
            <strong>Subscription Groups:</strong> Both platforms require
            subscriptions to be in the same subscription group to allow tier
            changes
          </li>
          <li>
            <strong>Server Validation:</strong> Always validate subscription
            status server-side for production apps
          </li>
          <li>
            <strong>UI Feedback:</strong> Clearly show users when upgrades apply
            immediately vs. at next renewal
          </li>
          <li>
            <strong>Grace Periods:</strong> Handle billing retry and grace
            period states appropriately
          </li>
          <li>
            <strong>Cancellation:</strong> Detect cancelled subscriptions and
            show appropriate UI (e.g., "Reactivate" instead of "Upgrade")
          </li>
        </ul>

        <Accordion
          title={<>💡 iOS Tip: Subscription Group Order</>}
          variant="tip"
        >
          <p>
            In App Store Connect, when you create subscriptions in a
            Subscription Group, the <strong>order matters</strong>. Apple
            recognizes the{' '}
            <strong>
              first subscription in the order (top position) as the highest tier
            </strong>
            . This affects:
          </p>
          <ul>
            <li>How StoreKit determines upgrade vs downgrade automatically</li>
            <li>
              Whether the change applies immediately (upgrade) or at next
              renewal (downgrade)
            </li>
            <li>Prorated refund calculations</li>
          </ul>
          <p>
            <strong>Best practice:</strong> Order your subscriptions from
            highest to lowest tier (e.g., Yearly at top, Monthly at bottom) in
            the Subscription Group settings.
          </p>
        </Accordion>
      </section>
    </div>
  );
}

export default Features;
