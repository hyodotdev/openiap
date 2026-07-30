import SwiftUI
import OpenIAP

@available(iOS 15.0, *)
struct OfferCodeScreen: View {
    @StateObject private var iapStore = OpenIapStore()
    @State private var showError = false
    @State private var errorMessage = ""
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        Image(systemName: "gift.fill")
                            .font(.largeTitle)
                            .foregroundColor(AppColors.primary)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Offer Code Redemption")
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
                    
                    Text("Redeem promotional offer codes for in-app purchases and subscriptions.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(AppColors.cardBackground)
                .cornerRadius(12)
                .shadow(radius: 2)
                .padding(.horizontal)
                
                Button(action: {
                    Task {
                        await presentOfferCodeRedemption()
                    }
                }) {
                    HStack {
                        Image(systemName: "gift")
                        Text("Redeem Offer Code")
                        Spacer()
                        Image(systemName: "arrow.up.forward.app")
                    }
                    .padding()
                    .background(AppColors.primary)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                .padding(.horizontal)
                
                InstructionCard()
                
                TestingNotesCard()
                
                Spacer(minLength: 20)
            }
            .padding(.vertical)
        }
        .background(AppColors.background)
        .navigationTitle("Offer Code")
        .navigationBarTitleDisplayMode(.large)
        .alert("Error", isPresented: $showError) {
            Button("OK") {}
        } message: {
            Text(errorMessage)
        }
        .onAppear {
            setupIapProvider()
        }
        .onDisappear {
            teardownConnection()
        }
    }
    
    // MARK: - OpenIapStore Setup
    
    private func setupIapProvider() {
        print("🔷 [OfferCode] Setting up OpenIapStore...")
        
        iapStore.onPurchaseSuccess = { purchase in
            if let iosPurchase = purchase.asIOS() {
                Task { @MainActor in
                    print("✅ [OfferCode] Offer code redeemed successfully: \(iosPurchase.productId)")
                }
            }
        }
        
        iapStore.onPurchaseError = { error in
            Task { @MainActor in
                errorMessage = error.message
                showError = true
            }
        }
        
        Task {
            do {
                try await iapStore.initConnection()
                print("✅ [OfferCode] Connection initialized")
            } catch {
                await MainActor.run {
                    errorMessage = "Failed to initialize connection: \(error.localizedDescription)"
                    showError = true
                }
            }
        }
    }
    
    private func teardownConnection() {
        print("🔷 [OfferCode] Tearing down connection...")
        Task {
            try await iapStore.endConnection()
            print("✅ [OfferCode] Connection ended")
        }
    }
    
    // MARK: - Offer Code Redemption
    
    private func presentOfferCodeRedemption() async {
        do {
            let purchase = try await iapStore.presentCodeRedemptionSheetResultIOS()
            if let purchase {
                print("✅ [OfferCode] Verified redemption: \(purchase.productId) (\(purchase.id))")
            } else {
                print("✅ [OfferCode] Legacy redemption sheet presented; refresh purchases after completion")
            }
        } catch {
            await MainActor.run {
                errorMessage = "Failed to present offer code redemption: \(error.localizedDescription)"
                showError = true
            }
        }
    }
}

// InstructionCard, TestingNotesCard, InstructionRow, and TestingNote moved to Screens/uis/
