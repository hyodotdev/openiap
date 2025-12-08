import SwiftUI
import OpenIAP

@available(iOS 15.0, *)
struct SubscriptionFlowScreen: View {
    @StateObject private var iapStore = OpenIapStore()

    // UI State
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var recentPurchase: OpenIapPurchase?
    @State private var selectedPurchase: OpenIapPurchase?
    @State private var isInitialLoading = true
    @State private var isRefreshing = false
    @State private var verificationMethod: VerificationMethod = .none
    @State private var isVerifying = false
    @State private var verificationResultMessage: String?
    @State private var processedPurchaseKey: String?

    // IAPKit API Key from environment (set in scheme or Info.plist)
    private var iapkitApiKey: String? {
        ProcessInfo.processInfo.environment["IAPKIT_API_KEY"] ??
        Bundle.main.object(forInfoDictionaryKey: "IAPKIT_API_KEY") as? String
    }

    // Product IDs for subscription testing
    // Ordered from lowest to highest tier for upgrade scenarios
    private let subscriptionIds: [String] = [
        "dev.hyo.martie.premium",       // Monthly subscription (lower tier)
        "dev.hyo.martie.premium_year"    // Yearly subscription (higher tier)
    ]
    
    var body: some View {
        ScrollView(.vertical, showsIndicators: true) {
            VStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Image(systemName: "repeat.circle.fill")
                            .font(.largeTitle)
                            .foregroundColor(AppColors.secondary)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Subscription Management")
                                .font(.headline)
                            
                            Text("iOS")
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(AppColors.secondary.opacity(0.2))
                                .cornerRadius(4)
                        }
                        
                        Spacer()
                    }
                    
                    Text("Manage your premium subscriptions and auto-renewable purchases.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(AppColors.cardBackground)
                .cornerRadius(12)
                .shadow(radius: 2)
                .padding(.horizontal)

                VerificationMethodCard()

                if isInitialLoading {
                    LoadingCard(text: "Loading subscriptions...")
                } else if isRefreshing {
                    LoadingCard(text: "Refreshing activeSubscriptions...")
                } else {
                    if let purchase = recentPurchase {
                        purchaseResultCard(for: purchase)
                    }

                    let productIds = subscriptionProductIds
                    
                    if productIds.isEmpty {
                        EmptyStateCard(
                            icon: "repeat.circle",
                            title: "No subscriptions available",
                            subtitle: "Configure subscription products in App Store Connect"
                        )
                    } else {
                        ForEach(productIds, id: \.self) { productId in
                            let product = product(for: productId)
                            let currentSubscription = getCurrentSubscription()
                            let upgradeInfo = getUpgradeInfo(from: currentSubscription, to: productId)

                            SubscriptionCard(
                                productId: productId,
                                product: product,
                                purchase: purchase(for: productId),
                                isSubscribed: isSubscribed(productId: productId),
                                isCancelled: isCancelled(productId: productId),
                                isLoading: iapStore.status.isPurchasing(productId),
                                upgradeInfo: upgradeInfo,
                                onSubscribe: {
                                    let subscribed = isSubscribed(productId: productId)

                                    if subscribed {
                                        Task {
                                            await manageSubscriptions()
                                        }
                                    } else if upgradeInfo.canUpgrade || upgradeInfo.isDowngrade {
                                        // Both upgrades and downgrades can be done via product.purchase()
                                        // StoreKit 2 automatically handles subscription tier changes within same group
                                        if let product = product {
                                            Task {
                                                await upgradeSubscription(from: currentSubscription, to: product)
                                            }
                                        }
                                    } else {
                                        if let product = product {
                                            purchaseProduct(product)
                                        }
                                    }
                                },
                                onManage: {
                                    Task {
                                        await manageSubscriptions()
                                    }
                                }
                            )
                        }
                    }
                }
                
                VStack(alignment: .leading, spacing: 12) {
                    Text("Notes")
                        .font(.headline)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("• Subscriptions may take a moment to reflect")
                        Text("• Use Sandbox account for testing")
                        Text("• Restore purchases to sync status")
                    }
                    .font(.caption)
                }
                .padding()
                .background(AppColors.secondary.opacity(0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(AppColors.secondary.opacity(0.3), lineWidth: 1)
                )
                .cornerRadius(8)
                .padding(.horizontal)
                
                Button(action: {
                    Task {
                        await restorePurchases()
                    }
                }) {
                    HStack {
                        Image(systemName: "arrow.clockwise.circle")
                        Text("Restore Purchases")
                        Spacer()
                        Image(systemName: "arrow.up.forward.app")
                    }
                    .padding()
                    .background(AppColors.secondary)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                .padding(.horizontal)
                
                Spacer(minLength: 20)
            }
            .padding(.vertical)
        }
        .background(AppColors.background)
        .navigationTitle("Subscriptions")
        .navigationBarTitleDisplayMode(.large)
        .navigationBarItems(trailing:
            Button {
                Task { await restorePurchases() }
            } label: {
                Image(systemName: isRefreshing ? "arrow.clockwise.circle.fill" : "arrow.clockwise")
                    .rotationEffect(.degrees(isRefreshing ? 360 : 0))
                    .animation(isRefreshing ? .linear(duration: 1).repeatForever(autoreverses: false) : .default, value: isRefreshing)
            }
        )
        .sheet(isPresented: Binding(
            get: { selectedPurchase != nil },
            set: { if !$0 { selectedPurchase = nil } }
        )) {
            if let purchase = selectedPurchase {
                PurchaseDetailSheet(purchase: purchase)
            }
        }
        .alert("Error", isPresented: $showError) {
            Button("OK") {}
        } message: {
            Text(errorMessage)
        }
        .onAppear {
            isInitialLoading = true
            setupIapProvider()
        }
        .onDisappear {
            iapStore.resetEphemeralState()
            teardownConnection()
            recentPurchase = nil
            selectedPurchase = nil
        }
    }
    
    // MARK: - OpenIapStore Setup
    
    private func setupIapProvider() {
        print("🔷 [SubscriptionFlow] Setting up OpenIapStore...")
        
        // Setup callbacks
        iapStore.onPurchaseSuccess = { purchase in
            if let iosPurchase = purchase.asIOS() {
                Task { @MainActor in
                    self.handlePurchaseSuccess(iosPurchase)
                }
            }
        }
        
        iapStore.onPurchaseError = { error in
            Task { @MainActor in
                self.handlePurchaseError(error)
            }
        }
        
        Task {
            do {
                try await iapStore.initConnection()
                print("✅ [SubscriptionFlow] Connection initialized")
                await loadProducts()
                await MainActor.run { isInitialLoading = false }
                await loadPurchases()
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to initialize connection: \(error.localizedDescription)"
                    showError = true
                    isInitialLoading = false
                }
            }
        }
    }
    
    private func teardownConnection() {
        print("🔷 [SubscriptionFlow] Tearing down connection...")
        Task {
            try await iapStore.endConnection()
            print("✅ [SubscriptionFlow] Connection ended")
        }
    }
    
    // MARK: - Product and Purchase Loading
    
    private func loadProducts() async {
        do {
            try await iapStore.fetchProducts(skus: subscriptionIds, type: .all)
            await MainActor.run {
                let ids = subscriptionProductIds
                if ids.isEmpty {
                    errorMessage = "No subscription products found. Please check your App Store Connect configuration."
                    showError = true
                }
                print("✅ [SubscriptionFlow] Loaded subscriptions: \(ids.joined(separator: ", "))")

                // 🔍 LOG discountsIOS DATA
                print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
                print("🔍 [SubscriptionFlow] DISCOUNT DATA CHECK:")

                // Use iosSubscriptionProducts which returns [ProductSubscriptionIOS]
                for subscription in iapStore.iosSubscriptionProducts {
                    print("   📦 Subscription: \(subscription.id)")
                    print("      • Type: \(subscription.type)")
                    print("      • Price: \(subscription.displayPrice)")

                    if let introPrice = subscription.introductoryPriceIOS {
                        print("      • introductoryPriceIOS: \(introPrice)")
                    }

                    print("      • introductoryPricePaymentModeIOS: \(subscription.introductoryPricePaymentModeIOS)")

                    if let discounts = subscription.discountsIOS, !discounts.isEmpty {
                        print("      • discountsIOS: \(discounts.count) discount(s)")
                        for (idx, discount) in discounts.enumerated() {
                            print("         [\(idx)] id: \(discount.identifier), type: \(discount.type), paymentMode: \(discount.paymentMode), price: \(discount.price)")
                        }
                    } else {
                        print("      • discountsIOS: nil or empty ⚠️")
                    }

                    print("")
                }
                print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            }
        } catch {
            await MainActor.run {
                errorMessage = "Failed to load products: \(error.localizedDescription)"
                showError = true
            }
        }
    }
    
    private func loadPurchases() async {
        do {
            // Only use activeSubscriptions - demonstrates it contains all necessary info
            try await iapStore.getActiveSubscriptions()

            // Debug: Log active subscriptions and their renewal status
            await MainActor.run {
                print("🔍 [SubscriptionFlow] Active subscriptions loaded: \(iapStore.activeSubscriptions.count)")
                for sub in iapStore.activeSubscriptions {
                    print("   📋 \(sub.productId):")
                    print("      • isActive: \(sub.isActive)")
                    if let renewalInfo = sub.renewalInfoIOS {
                        print("      • willAutoRenew: \(renewalInfo.willAutoRenew)")
                        print("      • autoRenewPreference: \(renewalInfo.autoRenewPreference ?? "nil")")
                        print("      • pendingUpgradeProductId: \(renewalInfo.pendingUpgradeProductId ?? "nil")")

                        // Check cancellation status
                        let isCancelled = sub.isActive && !renewalInfo.willAutoRenew
                        print("      • Status: \(isCancelled ? "❌ CANCELLED (active until expiry)" : "✅ Active & Renewing")")
                    } else {
                        print("      ⚠️ renewalInfoIOS is nil!")
                    }
                }
            }
        } catch {
            await MainActor.run {
                errorMessage = "Failed to load purchases: \(error.localizedDescription)"
                showError = true
            }
        }
    }
    
    // MARK: - Purchase Flow

    private func purchaseProduct(_ product: OpenIapProduct) {
        print("🔄 [SubscriptionFlow] Starting subscription purchase for: \(product.id)")
        Task {
            do {
                // Ignore return value - purchase events are emitted via onPurchaseSuccess listener
                _ = try await iapStore.requestPurchase(sku: product.id, type: .subs, autoFinish: true)

                print("✅ [SubscriptionFlow] Purchase request completed")
                print("📦 [SubscriptionFlow] onPurchaseSuccess callback will fire")
            } catch {
                // Error is already handled by OpenIapStore internally
                print("❌ [SubscriptionFlow] Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Subscription Upgrade Flow

    private func upgradeSubscription(from currentSubscription: ActiveSubscription?, to product: OpenIapProduct) async {
        let isUpgrade = getSubscriptionTier(product.id) > getSubscriptionTier(currentSubscription?.productId ?? "")
        let changeType = isUpgrade ? "upgrade" : "downgrade"

        print("🔄 [SubscriptionFlow] Starting subscription \(changeType)")
        print("  From: \(currentSubscription?.productId ?? "none")")
        print("  To: \(product.id)")
        print("  Type: \(changeType.uppercased())")
        if isUpgrade {
            print("  Note: Upgrade applies immediately with pro-rated refund")
        } else {
            print("  Note: Downgrade applies at next renewal date")
        }

        do {
            // Ignore return value - purchase events are emitted via onPurchaseSuccess listener
            // For upgrades/downgrades, we reload subscriptions to ensure correct state
            _ = try await iapStore.requestPurchase(
                sku: product.id,
                type: .subs,
                autoFinish: true
            )

            print("✅ [SubscriptionFlow] \(changeType.capitalized) request completed for: \(product.id)")

            // Reload subscription state after upgrade/downgrade
            // (onPurchaseSuccess may fire with old subscription for upgrades)
            print("🔄 [SubscriptionFlow] Reloading subscriptions to get updated state...")
            await loadPurchases()

        } catch {
            print("❌ [SubscriptionFlow] Upgrade failed: \(error.localizedDescription)")
            await MainActor.run {
                errorMessage = "Failed to upgrade subscription: \(error.localizedDescription)"
                showError = true
            }
        }
    }

    // Get current active subscription
    private func getCurrentSubscription() -> ActiveSubscription? {
        // Use activeSubscriptions from store (includes renewalInfo)
        // Include ALL active subscriptions, even cancelled ones (active until expiry)
        let activeSubs = iapStore.activeSubscriptions.filter { $0.isActive }

        // Return the subscription with the highest tier (yearly over monthly)
        return activeSubs.first { $0.productId.contains("year") } ?? activeSubs.first
    }

    // Determine upgrade possibilities
    private func getUpgradeInfo(from currentSubscription: ActiveSubscription?, to targetProductId: String) -> UpgradeInfo {
        guard let current = currentSubscription else {
            // No active subscription = no upgrade
            return UpgradeInfo(canUpgrade: false, isDowngrade: false, currentTier: nil)
        }

        // Check if current subscription is cancelled
        let isCancelled = current.renewalInfoIOS?.willAutoRenew == false

        // If trying to subscribe to the same product that's cancelled, it's a reactivation
        if current.productId == targetProductId {
            if isCancelled {
                // Same product, cancelled = show reactivate option
                return UpgradeInfo(canUpgrade: false, isDowngrade: false, currentTier: current.productId)
            } else {
                // Same product, active = already subscribed
                return UpgradeInfo(canUpgrade: false, isDowngrade: false, currentTier: current.productId)
            }
        }

        // Check renewalInfo for pending upgrade (only for active, non-cancelled subscriptions)
        if !isCancelled,
           let renewalInfo = current.renewalInfoIOS,
           let pendingUpgrade = renewalInfo.pendingUpgradeProductId,
           pendingUpgrade == targetProductId {
            return UpgradeInfo(
                canUpgrade: false,
                isDowngrade: false,
                currentTier: current.productId,
                message: "This upgrade will activate on your next renewal date",
                isPending: true
            )
        }

        // Different product = upgrade or downgrade
        let currentTier = getSubscriptionTier(current.productId)
        let targetTier = getSubscriptionTier(targetProductId)

        // If cancelled, don't allow tier changes (user should reactivate or wait for expiry)
        if isCancelled {
            print("🔍 [getUpgradeInfo] Cancelled subscription - blocking tier change from \(current.productId) to \(targetProductId)")
            return UpgradeInfo(
                canUpgrade: false,
                isDowngrade: false,
                currentTier: current.productId,
                message: "Reactivate current subscription or wait until it expires"
            )
        }

        // Active subscription: allow upgrades and downgrades
        let canUpgrade = targetTier > currentTier
        let isDowngrade = targetTier < currentTier

        return UpgradeInfo(
            canUpgrade: canUpgrade,
            isDowngrade: isDowngrade,
            currentTier: current.productId,
            message: canUpgrade ? "Upgrade available" : (isDowngrade ? "Downgrade option" : nil)
        )
    }

    // Get subscription tier level (higher number = higher tier)
    private func getSubscriptionTier(_ productId: String) -> Int {
        if productId.contains("year") || productId.contains("annual") {
            return 2  // Yearly is higher tier
        } else if productId.contains("month") || productId.contains("premium") {
            return 1  // Monthly is lower tier
        }
        return 0  // Unknown tier
    }

    // MARK: - Verification Method UI

    @ViewBuilder
    private func VerificationMethodCard() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "checkmark.shield.fill")
                    .foregroundColor(AppColors.secondary)
                Text("Purchase Verification")
                    .font(.headline)
                Spacer()
            }

            Menu {
                ForEach(VerificationMethod.allCases, id: \.self) { method in
                    Button(method.displayName) {
                        verificationMethod = method
                    }
                }
            } label: {
                HStack {
                    Text(verificationMethod.displayName)
                        .foregroundColor(.primary)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(8)
            }

            if verificationMethod == .iapkit {
                VStack(alignment: .leading, spacing: 8) {
                    if iapkitApiKey != nil {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(AppColors.success)
                            Text("API Key configured")
                                .font(.caption)
                                .foregroundColor(AppColors.success)
                        }
                    } else {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("API Key not configured")
                                    .font(.caption)
                                    .foregroundColor(.orange)
                                    .fontWeight(.semibold)
                                Text("Set IAPKIT_API_KEY in:")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                Text("• Xcode Scheme → Environment Variables")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                Text("• Or Info.plist → IAPKIT_API_KEY")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                        }
                        .frame(maxWidth: .infinity)
                        .padding(8)
                        .background(Color.orange.opacity(0.1))
                        .cornerRadius(6)
                    }
                }
            }

            if let resultMessage = verificationResultMessage {
                Text(resultMessage)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(8)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(6)
            }
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
        .padding(.horizontal)
    }

    // MARK: - Verification Logic

    private func verifyAndFinishPurchase(_ purchase: OpenIapPurchase) async {
        switch verificationMethod {
        case .none:
            await MainActor.run {
                verificationResultMessage = "✅ No verification (skipped)"
            }
            // Transaction already finished via autoFinish: true

        case .local:
            await MainActor.run {
                isVerifying = true
                verificationResultMessage = "🔍 Verifying locally..."
            }

            do {
                let result = try await iapStore.verifyPurchase(sku: purchase.productId)
                await MainActor.run {
                    isVerifying = false
                    verificationResultMessage = "✅ Local verification: Valid=\(result.isValid)"
                }
            } catch {
                await MainActor.run {
                    isVerifying = false
                    verificationResultMessage = "❌ Local verification failed: \(error.localizedDescription)"
                    errorMessage = error.localizedDescription
                    showError = true
                }
            }

        case .iapkit:
            guard let apiKey = iapkitApiKey else {
                await MainActor.run {
                    verificationResultMessage = "❌ IAPKit API Key not configured"
                    errorMessage = "Set IAPKIT_API_KEY in Xcode Scheme or Info.plist"
                    showError = true
                }
                return
            }

            await MainActor.run {
                isVerifying = true
                verificationResultMessage = "☁️ Verifying with IAPKit..."
            }

            do {
                guard let jws = purchase.purchaseToken, !jws.isEmpty else {
                    await MainActor.run {
                        isVerifying = false
                        verificationResultMessage = "❌ Missing JWS token"
                        errorMessage = "Missing JWS token"
                        showError = true
                    }
                    return
                }

                let props = VerifyPurchaseWithProviderProps(
                    iapkit: RequestVerifyPurchaseWithIapkitProps(
                        apiKey: apiKey,
                        apple: RequestVerifyPurchaseWithIapkitAppleProps(
                            jws: jws
                        ),
                        google: nil
                    ),
                    provider: .iapkit
                )

                let result = try await iapStore.verifyPurchaseWithProvider(props)
                let isValid = result?.isValid ?? false
                let state = result?.state.rawValue ?? "unknown"

                print("📱 [SubscriptionFlow] IAPKit verification result:")
                print("  - Product: \(purchase.productId)")
                print("  - isValid: \(isValid)")
                print("  - state: \(state)")

                await MainActor.run {
                    isVerifying = false
                    verificationResultMessage = "\(isValid ? "✅" : "❌") IAPKit: isValid=\(isValid), state=\(state)"
                }
            } catch {
                await MainActor.run {
                    isVerifying = false
                    verificationResultMessage = "❌ IAPKit failed: \(error.localizedDescription)"
                    errorMessage = error.localizedDescription
                    showError = true
                }
            }
        }
    }

    private func restorePurchases() async {
        await MainActor.run {
            isRefreshing = true
        }

        do {
            // Just refresh active subscriptions without full sync
            // (syncIOS can take a very long time)
            try await iapStore.getActiveSubscriptions()
            await MainActor.run {
                isRefreshing = false
                print("✅ [SubscriptionFlow] Refreshed \(iapStore.activeSubscriptions.count) active subscriptions")
            }
        } catch {
            await MainActor.run {
                isRefreshing = false
                errorMessage = "Failed to refresh subscriptions: \(error.localizedDescription)"
                showError = true
            }
        }
    }

    private func manageSubscriptions() async {
        do {
            print("🔧 [SubscriptionFlow] Opening subscription management...")
            _ = try await iapStore.showManageSubscriptionsIOS()
            print("✅ [SubscriptionFlow] Returned from subscription management")
        } catch {
            await MainActor.run {
                errorMessage = "Failed to open subscription management: \(error.localizedDescription)"
                showError = true
            }
        }
    }
    
    // MARK: - Event Handlers

    private func handlePurchaseSuccess(_ purchase: OpenIapPurchase) {
        print("✅ [SubscriptionFlow] Subscription successful: \(purchase.productId)")

        // Create unique key for this purchase to prevent duplicate processing
        let purchaseKey = "\(purchase.id)_\(purchase.transactionDate)"

        // Skip if we've already processed this exact purchase
        if purchaseKey == processedPurchaseKey {
            print("🔄 [SubscriptionFlow] Skipping already processed purchase: \(purchaseKey)")
            return
        }

        // Mark as processed
        processedPurchaseKey = purchaseKey

        print("📦 [SubscriptionFlow] Purchase fired immediately - no need to call getActiveSubscriptions()")

        // Log detailed purchase info
        print("   📋 Purchase Details:")
        print("      • Transaction ID: \(purchase.id)")
        print("      • Product ID: \(purchase.productId)")
        print("      • Platform: \(purchase.platform)")
        print("      • Purchase State: \(purchase.purchaseState)")
        print("      • Is Auto-Renewing: \(purchase.isAutoRenewing)")

        // Log iOS-specific info (purchase is already PurchaseIOS type)
        print("   📱 iOS-specific Details:")
        print("      • Subscription Group ID: \(purchase.subscriptionGroupIdIOS ?? "nil")")
        print("      • Environment: \(purchase.environmentIOS ?? "nil")")
        print("      • Transaction Reason: \(purchase.transactionReasonIOS ?? "nil")")
        print("      • Is Upgraded: \(purchase.isUpgradedIOS ?? false)")

        if let expirationDate = purchase.expirationDateIOS {
            let date = Date(timeIntervalSince1970: expirationDate / 1000)
            print("      • Expiration Date: \(date)")
        }

        // Log renewalInfo details (KEY INFO FOR UPGRADES!)
        if let renewalInfo = purchase.renewalInfoIOS {
            print("   🔄 RenewalInfo (CRITICAL FOR UPGRADE DETECTION):")
            print("      • willAutoRenew: \(renewalInfo.willAutoRenew)")
            print("      • autoRenewPreference: \(renewalInfo.autoRenewPreference ?? "nil")")

            if let pendingUpgrade = renewalInfo.pendingUpgradeProductId {
                print("      • pendingUpgradeProductId: \(pendingUpgrade)")

                // Detect upgrade vs current subscription
                if pendingUpgrade != purchase.productId {
                    print("      ⚠️ UPGRADE SCHEDULED: \(purchase.productId) → \(pendingUpgrade)")
                } else {
                    print("      ✅ Current subscription (no upgrade)")
                }
            } else {
                print("      • pendingUpgradeProductId: nil")
            }

            if let renewalDate = renewalInfo.renewalDate {
                let date = Date(timeIntervalSince1970: renewalDate / 1000)
                print("      • renewalDate: \(date)")
            }

            if let expirationReason = renewalInfo.expirationReason {
                print("      • expirationReason: \(expirationReason)")
            }

            if let gracePeriod = renewalInfo.gracePeriodExpirationDate {
                let date = Date(timeIntervalSince1970: gracePeriod / 1000)
                print("      • gracePeriodExpirationDate: \(date)")
            }

            if let isInBillingRetry = renewalInfo.isInBillingRetry {
                print("      • isInBillingRetry: \(isInBillingRetry)")
            }

            if let priceIncreaseStatus = renewalInfo.priceIncreaseStatus {
                print("      • priceIncreaseStatus: \(priceIncreaseStatus)")
            }
        } else {
            print("   ⚠️ RenewalInfo: nil (not a subscription or not available)")
        }

        print("   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        // Show the recent purchase
        recentPurchase = purchase

        // Perform verification if method is selected
        Task {
            await verifyAndFinishPurchase(purchase)
        }

        // DO NOT call getActiveSubscriptions() here - it causes infinite rendering
        // The store's handlePurchaseUpdate already updates activeSubscriptions directly from purchase data
    }
    
    private func handlePurchaseError(_ error: OpenIapError) {
        print("❌ [SubscriptionFlow] Subscription error: \(error.message)")
        // Error status is already handled internally by OpenIapStore
    }
}

@available(iOS 15.0, *)
@MainActor
private extension SubscriptionFlowScreen {
    var subscriptionProductIds: [String] {
        var orderedIds: [String] = []
        func appendIfNeeded(_ id: String) {
            guard orderedIds.contains(id) == false else { return }
            orderedIds.append(id)
        }

        subscriptionIds.forEach { appendIfNeeded($0) }
        iapStore.iosProducts.filter { $0.type == .subs }.forEach { appendIfNeeded($0.id) }
        iapStore.activeSubscriptions.forEach { appendIfNeeded($0.productId) }
        return orderedIds
    }

    func product(for id: String) -> OpenIapProduct? {
        iapStore.iosProducts.first { $0.id == id }
    }

    func purchase(for productId: String) -> OpenIapPurchase? {
        iapStore.iosAvailablePurchases.first { $0.productId == productId }
    }

    func isSubscribed(productId: String) -> Bool {
        // Check activeSubscriptions first (more accurate)
        if let subscription = iapStore.activeSubscriptions.first(where: { $0.productId == productId }) {
            return subscription.isActive
        }
        return false
    }

    func isCancelled(productId: String) -> Bool {
        // Check if subscription is active but won't auto-renew (cancelled)
        if let subscription = iapStore.activeSubscriptions.first(where: { $0.productId == productId }),
           let renewalInfo = subscription.renewalInfoIOS {
            return subscription.isActive && !renewalInfo.willAutoRenew
        }
        return false
    }
}

// MARK: - Upgrade Info Model
struct UpgradeInfo {
    let canUpgrade: Bool
    let isDowngrade: Bool
    let currentTier: String?
    let message: String?
    let isPending: Bool  // True if upgrade is pending (already scheduled)

    init(canUpgrade: Bool = false, isDowngrade: Bool = false, currentTier: String? = nil, message: String? = nil, isPending: Bool = false) {
        self.canUpgrade = canUpgrade
        self.isDowngrade = isDowngrade
        self.currentTier = currentTier
        self.message = message
        self.isPending = isPending
    }
}

@available(iOS 15.0, *)
@MainActor
private extension SubscriptionFlowScreen {
    func purchaseResultCard(for purchase: OpenIapPurchase) -> some View {
        let transactionDate = Date(timeIntervalSince1970: purchase.transactionDate / 1000)
        let formattedDate = DateFormatter.localizedString(from: transactionDate, dateStyle: .short, timeStyle: .short)

        // Check if this is an upgrade by looking at renewalInfo
        let isUpgrade = purchase.renewalInfoIOS?.pendingUpgradeProductId != nil &&
                       purchase.renewalInfoIOS?.pendingUpgradeProductId != purchase.productId

        let message = """
        ✅ \(isUpgrade ? "Upgrade" : "Subscription") successful
        Product: \(purchase.productId)
        Transaction ID: \(purchase.id)
        Date: \(formattedDate)

        🔥 Fired immediately via onPurchaseSuccess
        (No getActiveSubscriptions() call needed)
        """

        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: isUpgrade ? "arrow.up.circle.fill" : "checkmark.circle.fill")
                    .foregroundColor(AppColors.success)
                Text(isUpgrade ? "Upgrade Completed" : "Purchase Completed")
                    .font(.headline)

                Spacer()

                Button("Dismiss") {
                    recentPurchase = nil
                }
                .font(.caption)
                .foregroundColor(AppColors.primary)
            }

            Button {
                selectedPurchase = purchase
            } label: {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "chevron.right.circle.fill")
                        .foregroundColor(AppColors.primary)
                    Text(message)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.primary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(8)
            }
            .buttonStyle(.plain)
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
        .padding(.horizontal)
    }
}