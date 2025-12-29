import SwiftUI
import OpenIAP

// Deprecated: prefer ActivePurchaseCard and PurchaseHistoryCard
struct PurchaseCard: View {
    let purchase: OpenIapPurchase
    let onConsume: () -> Void
    
    private var isSubscription: Bool {
        purchase.id.contains("premium")
    }
    
    private var statusColor: Color {
        switch purchase.purchaseState {
        case .purchased:
            return AppColors.success
        case .pending:
            return AppColors.warning
        case .unknown:
            return AppColors.secondary
        }
    }

    private var statusText: String {
        switch purchase.purchaseState {
        case .purchased:
            return "Purchased"
        case .pending:
            return "Pending"
        case .unknown:
            return "Unknown"
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(purchase.id)
                        .font(.headline)
                        .font(.system(.body, design: .monospaced))
                    
                    Text("Transaction: \(purchase.id)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Text(statusText)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(statusColor.opacity(0.2))
                    .foregroundColor(statusColor)
                    .cornerRadius(4)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Purchased:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(Date(timeIntervalSince1970: purchase.transactionDate / 1000), style: .date)
                        .font(.caption)
                }
                
                if let expiryTime = purchase.expirationDateIOS != nil ? Date(timeIntervalSince1970: purchase.expirationDateIOS! / 1000) : nil {
                    HStack {
                        Text("Expires:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(expiryTime, style: .relative)
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                }
                
                if isSubscription {
                    HStack {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.caption)
                        Text("Auto-renewable")
                            .font(.caption)
                    }
                    .foregroundColor(AppColors.primary)
                }
            }
            
            if !isSubscription && !purchase.purchaseState.isAcknowledged {
                Button(action: onConsume) {
                    HStack {
                        Image(systemName: "checkmark.circle")
                        Text("Consume")
                        Spacer()
                    }
                    .padding()
                    .background(AppColors.primary)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
            } else {
                HStack {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundColor(AppColors.success)
                    Text("Acknowledged")
                        .font(.caption)
                        .foregroundColor(AppColors.success)
                }
                .padding(.vertical, 8)
            }
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
        .padding(.horizontal)
    }
}

