import SwiftUI
import OpenIAP

enum VerificationMethod: String, CaseIterable {
    case none = "None"
    case local = "Local"
    case iapkit = "IAPKit"

    var displayName: String {
        switch self {
        case .none: return "❌ None (Retain receipt)"
        case .local: return "📱 Local (Device)"
        case .iapkit: return "☁️ IAPKit (Server)"
        }
    }
}

@available(iOS 15.0, *)
struct PurchaseFlowScreen: View {
    @StateObject private var iapStore = OpenIapStore()

    // UI State
    @State private var showPurchaseResult = false
    @State private var purchaseResultMessage = ""
    @State private var latestPurchase: OpenIapPurchase?
    @State private var selectedPurchase: OpenIapPurchase?
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var isInitialLoading = true
    @State private var verificationMethod: VerificationMethod = .none
    @State private var isVerifying = false
    @State private var processedPurchaseIds: Set<String> = []
    @State private var pendingPurchases: [String: OpenIapPurchase] = [:]

    // IAPKit API Key from environment (set in scheme or Info.plist)
    private var iapkitApiKey: String? {
        ProcessInfo.processInfo.environment["IAPKIT_API_KEY"] ??
        Bundle.main.object(forInfoDictionaryKey: "IAPKIT_API_KEY") as? String
    }

    // Local IAPKit origin (set in scheme or Info.plist); nil uses the hosted server.
    private var iapkitBaseUrl: String? {
        ProcessInfo.processInfo.environment["IAPKIT_BASE_URL"] ??
        Bundle.main.object(forInfoDictionaryKey: "IAPKIT_BASE_URL") as? String
    }

    // Product IDs configured in App Store Connect
    private let productIds: [String] = [
        "dev.hyo.martie.10bulbs",
        "dev.hyo.martie.30bulbs",
        "dev.hyo.martie.certified"
    ]
    
    var body: some View {
        ScrollView(.vertical, showsIndicators: true) {
            VStack(spacing: 20) {
                HeaderCardView()

                VerificationMethodCard()

                if isInitialLoading {
                    LoadingCard(text: "Loading products...")
                } else {
                    ProductsSection()

                    if showPurchaseResult {
                        PurchaseResultSection()
                    }
                }

                InstructionsCard()

                Spacer(minLength: 20)
            }
            .padding(.vertical)
        }
        .background(AppColors.background)
        .navigationTitle("Purchase Flow")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    Task { await loadProducts() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(isInitialLoading || iapStore.status.isLoading)
            }
        }
        .onAppear {
            isInitialLoading = true
            setupIapProvider()
        }
        .onDisappear {
            iapStore.resetEphemeralState()
            teardownConnection()
            selectedPurchase = nil
            latestPurchase = nil
            pendingPurchases.removeAll()
            showPurchaseResult = false
        }
        .alert("Error", isPresented: $showError) {
            Button("OK") { }
        } message: {
            Text(errorMessage)
        }
        .sheet(isPresented: Binding(
            get: { selectedPurchase != nil },
            set: { if !$0 { selectedPurchase = nil } }
        )) {
            if let purchase = selectedPurchase {
                PurchaseDetailSheet(purchase: purchase)
            }
        }
    }
    
    @ViewBuilder
    private func HeaderCardView() -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "cart.fill")
                    .font(.largeTitle)
                    .foregroundColor(AppColors.primary)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Purchase Flow")
                        .font(.headline)
                    
                    Text("Test product purchases")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            
            Text("Purchase consumable and non-consumable iapStore.products. Events are handled through OpenIapStore callbacks.")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
        .padding(.horizontal)
    }
    
    @ViewBuilder
    private func ProductsSection() -> some View {
        LazyVStack(spacing: 16) {
            ForEach(iapStore.iosProducts, id: \.id) { product in
                ProductCard(
                    product: product,
                    isPurchasing: iapStore.status.isPurchasing(product.id)
                ) {
                    purchaseProduct(product)
                }
                .disabled(isVerifying)
            }
        }
        .padding(.horizontal)
    }
    
    // moved ProductCard to Screens/uis/ProductCard.swift
    
    @ViewBuilder
    private func PurchaseResultSection() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(AppColors.success)
                Text("Purchase Result")
                    .font(.headline)
                
                Spacer()
                
                Button("Dismiss") {
                    showPurchaseResult = false
                    purchaseResultMessage = ""
                    latestPurchase = nil
                }
                .disabled(isVerifying)
                .font(.caption)
                .foregroundColor(AppColors.primary)
            }
            
            Button {
                if let purchase = latestPurchase {
                    selectedPurchase = purchase
                }
            } label: {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "chevron.right.circle.fill")
                        .foregroundColor(AppColors.primary)
                    Text(purchaseResultMessage)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.primary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(8)
            }
            .buttonStyle(.plain)

            if !pendingPurchases.isEmpty {
                Button("Retry retained purchases") { retryPendingPurchases() }
                .disabled(isVerifying || verificationMethod == .none)
            }
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
        .padding(.horizontal)
    }
    
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
                        retryPendingPurchases()
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

            .disabled(isVerifying)

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
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
        .padding(.horizontal)
    }

    @ViewBuilder
    private func InstructionsCard() -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "info.circle.fill")
                    .foregroundColor(AppColors.primary)
                Text("Instructions")
                    .font(.headline)
                Spacer()
            }

            VStack(alignment: .leading, spacing: 8) {
                InstructionRow(
                    number: "1",
                    text: "Products are loaded from App Store Connect"
                )
                InstructionRow(
                    number: "2",
                    text: "Tap Purchase to initiate transaction"
                )
                InstructionRow(
                    number: "3",
                    text: "Events are handled via OpenIapStore callbacks"
                )
                InstructionRow(
                    number: "4",
                    text: "Receipt validation should be done server-side"
                )
            }
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
        .padding(.horizontal)
    }

    // using shared InstructionRow in Screens/uis/InstructionRow.swift
    
    // MARK: - OpenIapStore Setup
    
    private func setupIapProvider() {
        print("🔷 [PurchaseFlow] Setting up OpenIapStore...")
        
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
                print("✅ [PurchaseFlow] Connection initialized")
                await loadProducts()
                do {
                    let pending = try await iapStore.getPendingTransactionsIOS()
                    await MainActor.run {
                        for purchase in pending { handlePurchaseSuccess(purchase) }
                    }
                } catch {
                    print("⚠️ [PurchaseFlow] Could not load pending purchases: \(error.localizedDescription)")
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to initialize connection: \(error.localizedDescription)"
                    showError = true
                }
            }

            await MainActor.run { isInitialLoading = false }
        }
    }
    
    private func teardownConnection() {
        print("🔷 [PurchaseFlow] Tearing down connection...")
        Task {
            try await iapStore.endConnection()
            print("✅ [PurchaseFlow] Connection ended")
        }
    }
    
    // MARK: - Product Loading
    
    private func loadProducts() async {
        do {
            try await iapStore.fetchProducts(skus: productIds, type: .inApp)
            await MainActor.run {
                if iapStore.iosProducts.isEmpty {
                    errorMessage = "No products found. Please check your App Store Connect configuration."
                    showError = true
                }
            }
        } catch {
            await MainActor.run {
                errorMessage = "Failed to load products: \(error.localizedDescription)"
                showError = true
            }
        }
    }
    
    // MARK: - Purchase Flow
    
    private func purchaseProduct(_ product: OpenIapProduct) {
        print("🛒 [PurchaseFlow] Starting purchase for: \(product.id)")
        Task {
            do {
                let requestType: ProductQueryType = product.type == .subs ? .subs : .inApp
                _ = try await iapStore.requestPurchase(sku: product.id, type: requestType, autoFinish: false)
            } catch {
                // Error is already handled by OpenIapStore internally
                print("❌ [PurchaseFlow] Purchase failed: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Event Handlers
    
    @MainActor
    private func handlePurchaseSuccess(_ purchase: OpenIapPurchase) {
        guard productIds.contains(purchase.productId), !purchase.id.isEmpty,
              purchase.purchaseState == .purchased, !processedPurchaseIds.contains(purchase.id) else { return }
        pendingPurchases[purchase.id] = purchase
        if verificationMethod == .none {
            stagePendingPurchase(purchase)
            return
        }
        retryPendingPurchases()
    }

    @MainActor
    private func retryPendingPurchases() {
        guard verificationMethod != .none, !isVerifying, !pendingPurchases.isEmpty else { return }
        let method = verificationMethod
        isVerifying = true
        Task { @MainActor in
            defer { isVerifying = false }
            var attempted: Set<String> = []
            while let purchase = pendingPurchases.values
                .filter({ !attempted.contains($0.id) })
                .sorted(by: { $0.transactionDate < $1.transactionDate }).first {
                attempted.insert(purchase.id)
                latestPurchase = purchase
                let date = Date(timeIntervalSince1970: purchase.transactionDate / 1000)
                if await verifyAndFinishPurchase(purchase, transactionDate: date, method: method) {
                    pendingPurchases.removeValue(forKey: purchase.id)
                    processedPurchaseIds.insert(purchase.id)
                }
            }
        }
    }

    @MainActor
    private func stagePendingPurchase(_ purchase: OpenIapPurchase) {
        latestPurchase = purchase
        purchaseResultMessage = "Unfinished purchase: \(purchase.productId). Choose a verification method to retry retained receipts."
        showPurchaseResult = true
    }

    private func verifyAndFinishPurchase(
        _ purchase: OpenIapPurchase, transactionDate: Date, method: VerificationMethod
    ) async -> Bool {
        let dateString = DateFormatter.localizedString(from: transactionDate, dateStyle: .short, timeStyle: .short)

        switch method {
        case .none:
            await MainActor.run { stagePendingPurchase(purchase) }
            return false

        case .local:
            await MainActor.run {
                purchaseResultMessage = "🔍 Verifying locally..."
                showPurchaseResult = true
            }

            do {
                let pending = try await iapStore.getPendingTransactionsIOS()
                let isValid = purchase.matchesVerifiedPendingTransaction(in: pending)
                await MainActor.run {
                    purchaseResultMessage = """
                    \(isValid ? "✅" : "❌") Local verification \(isValid ? "passed" : "failed")
                    Product: \(purchase.productId)
                    Valid: \(isValid)
                    Date: \(dateString)
                    """
                }
                guard isValid else { return false }
                return await finishPurchase(purchase)
            } catch {
                await MainActor.run {
                    purchaseResultMessage = "❌ Local verification failed: \(error.localizedDescription)"
                    errorMessage = error.localizedDescription
                    showError = true
                }
            }

        case .iapkit:
            guard let apiKey = iapkitApiKey else {
                await MainActor.run {
                    purchaseResultMessage = "❌ IAPKit API Key not configured"
                    showPurchaseResult = true
                    errorMessage = "Set IAPKIT_API_KEY in Xcode Scheme or Info.plist"
                    showError = true
                }
                return false
            }

            await MainActor.run {
                purchaseResultMessage = "☁️ Verifying with IAPKit..."
                showPurchaseResult = true
            }

            // Get JWS token for verification
            guard let jws = purchase.purchaseToken, !jws.isEmpty else {
                await MainActor.run {
                    purchaseResultMessage = "❌ Missing JWS token"
                    errorMessage = "Missing JWS token"
                    showError = true
                }
                return false
            }

            let props = VerifyPurchaseWithProviderProps(
                iapkit: RequestVerifyPurchaseWithIapkitProps(
                    apiKey: apiKey,
                    apple: RequestVerifyPurchaseWithIapkitAppleProps(
                        jws: jws
                    ),
                    baseUrl: iapkitBaseUrl,
                    google: nil,
                    // Client payload is public configuration, never entitlement authority or secrets.
                    includeClientPayload: true
                ),
                provider: .iapkit
            )

            do {
                let result = try await iapStore.verifyPurchaseWithProvider(props)
                let isValid = result?.isValid ?? false
                let state = result?.state.rawValue ?? "unknown"
                let storeProductId = result?.productId ?? "not returned"
                let isVerifiedPurchase = purchase.acceptsIapkitVerification(result, isConsumable: purchase.productId != "dev.hyo.martie.certified")
                let payloadSummary: String
                if let payload = result?.clientPayload {
                    let preview = payload.body.count > 200
                        ? "\(String(payload.body.prefix(199)))…"
                        : payload.body
                    payloadSummary = """
                    Client payload: \(payload.format.rawValue), v\(Int(payload.version))
                    Preview: \(preview)
                    """
                } else {
                    payloadSummary = "Client payload: not returned"
                }

                print("📱 [PurchaseFlow] IAPKit verification result:")
                print("  - Requested product: \(purchase.productId)")
                print("  - Store product: \(storeProductId)")
                print("  - isValid: \(isValid)")
                print("  - state: \(state)")
                if let payload = result?.clientPayload {
                    print("  - Client payload: \(payload.format.rawValue), v\(Int(payload.version))")
                } else {
                    print("  - Client payload: not returned")
                }

                await MainActor.run {
                    purchaseResultMessage = """
                    \(isVerifiedPurchase ? "✅" : "❌") IAPKit verification \(isVerifiedPurchase ? "passed" : "failed")
                    Requested product: \(purchase.productId)
                    Store product: \(storeProductId)
                    isValid: \(isValid), state: \(state)
                    \(payloadSummary)
                    Date: \(dateString)
                    """
                }

                if isVerifiedPurchase {
                    return await finishPurchase(purchase)
                }
                // Keep unmatched store product ids or states pending.
            } catch {
                print("⚠️ [PurchaseFlow] IAPKit verification error: \(error.localizedDescription)")
                print("⚠️ [PurchaseFlow] Transaction left unfinished for verification retry")

                await MainActor.run {
                    purchaseResultMessage = """
                    ⚠️ IAPKit verification error
                    Product: \(purchase.productId)
                    Error: \(error.localizedDescription)
                    Date: \(dateString)
                    Note: Transaction not finished; retry verification later
                    """
                }
            }
        }
        return false
    }
    
    private func handlePurchaseError(_ error: OpenIapError) {
        print("❌ [PurchaseFlow] Purchase error: \(error.message)")
        
        // Update UI state
        purchaseResultMessage = "❌ Purchase failed: \(error.message)"
        showPurchaseResult = true
        
        // Show error alert for non-cancellation errors
        if error.code != .userCancelled {
            errorMessage = error.message
            showError = true
        }
    }
    
    private func finishPurchase(_ purchase: OpenIapPurchase) async -> Bool {
        do {
            try await iapStore.finishTransaction(purchase: purchase)
            print("✅ [PurchaseFlow] Transaction finished: \(purchase.id)")
            return true
        } catch {
            print("❌ [PurchaseFlow] Failed to finish transaction: \(error)")
            await MainActor.run {
                errorMessage = "Failed to finish transaction: \(error.localizedDescription)"
                showError = true
            }
            return false
        }
    }
}

#Preview {
    NavigationView {
        if #available(iOS 15.0, *) {
            PurchaseFlowScreen()
        } else {
            Text("iOS 15.0+ Required")
        }
    }
}
