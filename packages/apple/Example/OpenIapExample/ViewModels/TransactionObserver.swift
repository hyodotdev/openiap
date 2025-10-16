import SwiftUI
import OpenIAP

@MainActor
@available(iOS 15.0, *)
class TransactionObserver: ObservableObject {
    @Published var latestPurchase: OpenIapPurchase?
    @Published var errorMessage: String?
    @Published var isPending = false
    
    private let iapModule = OpenIapModule.shared
    private var purchaseSubscription: Subscription?
    private var errorSubscription: Subscription?
    
    init() {
        setupListeners()
    }
    
    deinit {
        // Clean up listeners
        if let subscription = purchaseSubscription {
            iapModule.removeListener(subscription)
        }
        if let subscription = errorSubscription {
            iapModule.removeListener(subscription)
        }
    }
    
    private func setupListeners() {
        // Add purchase updated listener
        purchaseSubscription = iapModule.purchaseUpdatedListener { [weak self] purchase in
            guard let iosPurchase = purchase.asIOS() else { return }
            Task { @MainActor in
                self?.handlePurchaseUpdated(iosPurchase)
            }
        }
        
        // Add purchase error listener
        errorSubscription = iapModule.purchaseErrorListener { [weak self] error in
            Task { @MainActor in
                self?.handlePurchaseError(error)
            }
        }
    }
    
    private func handlePurchaseUpdated(_ purchase: OpenIapPurchase) {
        print("✅ Purchase successful: \(purchase.transactionId)")
        latestPurchase = purchase
        isPending = false
        errorMessage = nil
    }
    
    private func handlePurchaseError(_ error: OpenIapError) {
        print("❌ Purchase failed - Code: \(error.code), Message: \(error.message)")
        errorMessage = error.message
        isPending = false
    }
}

// Example usage in SwiftUI View
struct TransactionObserverExampleView: View {
    @StateObject private var observer = TransactionObserver()
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Transaction Observer Example")
                .font(.title)
            
            if observer.isPending {
                ProgressView("Transaction pending...")
            }
            
            if let purchase = observer.latestPurchase {
                VStack(alignment: .leading) {
                    Text("Latest Purchase:")
                        .font(.headline)
                    Text("Product: \(purchase.productId)")
                    Text("Date: \(Date(timeIntervalSince1970: purchase.transactionDate / 1000), formatter: dateFormatter)")
                }
                .padding()
                .background(Color.green.opacity(0.1))
                .cornerRadius(8)
            }
            
            if let error = observer.errorMessage {
                Text("Error: \(error)")
                    .foregroundColor(.red)
                    .padding()
            }
        }
        .padding()
    }
    
    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }
}
