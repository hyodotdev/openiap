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
                
                if isInitialLoading {
                    LoadingCard(text: "Loading subscriptions...")
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
                                    } else if upgradeInfo.canUpgrade {
                                        // Handle upgrade scenario
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
                Task { await loadProducts() }
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .disabled(isInitialLoading || iapStore.status.isLoading)
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
                _ = try await iapStore.requestPurchase(sku: product.id, type: .subs, autoFinish: true)
            } catch {
                // Error is already handled by OpenIapStore internally
                print("❌ [SubscriptionFlow] Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Subscription Upgrade Flow

    private func upgradeSubscription(from currentSubscription: ActiveSubscription?, to product: OpenIapProduct) async {
        print("⬆️ [SubscriptionFlow] Starting subscription upgrade")
        print("  From: \(currentSubscription?.productId ?? "none")")
        print("  To: \(product.id)")
        print("  iOS will automatically prorate the subscription")

        do {
            // Request the upgrade purchase
            // iOS handles proration automatically when upgrading within the same subscription group
            _ = try await iapStore.requestPurchase(
                sku: product.id,
                type: .subs,
                autoFinish: true
            )

            print("✅ [SubscriptionFlow] Upgrade successful to: \(product.id)")

            // Reload purchases to update UI
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
        let activeSubs = iapStore.activeSubscriptions.filter { $0.isActive }

        // Return the subscription with the highest tier (yearly over monthly)
        return activeSubs.first { $0.productId.contains("year") } ?? activeSubs.first
    }

    // Determine upgrade possibilities
    private func getUpgradeInfo(from currentSubscription: ActiveSubscription?, to targetProductId: String) -> UpgradeInfo {
        guard let current = currentSubscription else {
            return UpgradeInfo(canUpgrade: false, isDowngrade: false, currentTier: nil)
        }

        // Check renewalInfo for pending upgrade
        if let renewalInfo = current.renewalInfoIOS,
           let pendingUpgrade = renewalInfo.pendingUpgradeProductId {
            if pendingUpgrade == targetProductId {
                return UpgradeInfo(
                    canUpgrade: false,
                    isDowngrade: false,
                    currentTier: current.productId,
                    message: "This upgrade will activate on your next renewal date",
                    isPending: true
                )
            }
        }

        // Don't show upgrade for the same product
        if current.productId == targetProductId {
            return UpgradeInfo(canUpgrade: false, isDowngrade: false, currentTier: current.productId)
        }

        // Determine tier based on product ID
        let currentTier = getSubscriptionTier(current.productId)
        let targetTier = getSubscriptionTier(targetProductId)

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
    
    private func restorePurchases() async {
        do {
            try await iapStore.refreshPurchases(forceSync: true)
            try await iapStore.getActiveSubscriptions()
            await MainActor.run {
                print("✅ [SubscriptionFlow] Restored \(iapStore.activeSubscriptions.count) active subscriptions")
            }
        } catch {
            await MainActor.run {
                errorMessage = "Failed to restore purchases: \(error.localizedDescription)"
                showError = true
            }
        }
    }
    
    private func manageSubscriptions() async {
        do {
            _ = try await iapStore.showManageSubscriptionsIOS()
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
        
        // Reload purchases to update UI
        Task {
            await loadPurchases()
        }
        recentPurchase = purchase
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
        if let subscription = iapStore.activeSubscriptions.first(where: { $0.productId == productId }) {
            return subscription.isActive && subscription.renewalInfoIOS?.willAutoRenew == false
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
        let message = """
        ✅ Subscription successful
        Product: \(purchase.productId)
        Transaction ID: \(purchase.id)
        Date: \(formattedDate)
        """

        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(AppColors.success)
                Text("Latest Subscription")
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
