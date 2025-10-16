import SwiftUI
import OpenIAP

struct PurchaseHistoryCard: View {
    let purchase: OpenIapPurchase
    let onShowDetails: () -> Void
    
    private var statusColor: Color {
        switch purchase.purchaseState {
        case .purchased:
            return AppColors.success
        case .pending:
            return AppColors.warning
        case .failed:
            return AppColors.error
        case .restored:
            return AppColors.primary
        case .deferred:
            return AppColors.secondary
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
        case .failed:
            return "Failed"
        case .restored:
            return "Restored"
        case .deferred:
            return "Deferred"
        case .unknown:
            return "Unknown"
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(purchase.productId)
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Text("Transaction: \(String(purchase.id.prefix(8)))...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text(statusText)
                        .font(.caption)
                        .fontWeight(.medium)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(statusColor.opacity(0.2))
                        .foregroundColor(statusColor)
                        .cornerRadius(4)
                    
                    Label(purchase.purchaseState.isAcknowledged ? "Consumed" : "Pending", 
                          systemImage: purchase.purchaseState.isAcknowledged ? "checkmark.circle.fill" : "clock")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Button(action: onShowDetails) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 18))
                        .foregroundColor(AppColors.primary)
                }
                .buttonStyle(.plain)
                .padding(.leading, 8)
            }
            
            HStack(spacing: 16) {
                Label("\(Date(timeIntervalSince1970: purchase.transactionDate / 1000), style: .date)", systemImage: "calendar")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                if purchase.quantity > 1 {
                    Label("Qty: \(purchase.quantity)", systemImage: "number")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
    }
}
