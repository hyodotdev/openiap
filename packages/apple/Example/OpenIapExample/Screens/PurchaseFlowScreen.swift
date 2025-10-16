import SwiftUI
import OpenIAP

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
    
    // Product IDs configured in App Store Connect
    private let productIds: [String] = [
        "dev.hyo.martie.10bulbs",
        "dev.hyo.martie.30bulbs",
        "dev.hyo.martie.premium"
    ]
    
    var body: some View {
        ScrollView(.vertical, showsIndicators: true) {
            VStack(spacing: 20) {
                HeaderCardView()

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
                _ = try await iapStore.requestPurchase(sku: product.id, type: requestType)
            } catch {
                // Error is already handled by OpenIapStore internally
                print("❌ [PurchaseFlow] Purchase failed: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - Event Handlers
    
    private func handlePurchaseSuccess(_ purchase: OpenIapPurchase) {
        print("✅ [PurchaseFlow] Purchase successful: \(purchase.productId)")
        
        // Update UI state
        let transactionDate = Date(timeIntervalSince1970: purchase.transactionDate / 1000)
        purchaseResultMessage = """
        ✅ Purchase successful
        Product: \(purchase.productId)
        Transaction ID: \(purchase.id)
        Date: \(DateFormatter.localizedString(from: transactionDate, dateStyle: .short, timeStyle: .short))
        """
        showPurchaseResult = true
        latestPurchase = purchase

        // In production, validate receipt on your server before finishing
        Task {
            await finishPurchase(purchase)
        }
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
    
    private func finishPurchase(_ purchase: OpenIapPurchase) async {
        do {
            try await iapStore.finishTransaction(purchase: purchase)
            print("✅ [PurchaseFlow] Transaction finished: \(purchase.id)")
        } catch {
            print("❌ [PurchaseFlow] Failed to finish transaction: \(error)")
            await MainActor.run {
                errorMessage = "Failed to finish transaction: \(error.localizedDescription)"
                showError = true
            }
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
