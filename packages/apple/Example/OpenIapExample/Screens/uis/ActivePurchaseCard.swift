import SwiftUI
import OpenIAP

struct ActivePurchaseCard: View {
    let purchase: OpenIapPurchase
    let onConsume: () -> Void
    let onShowDetails: () -> Void
    
    private var isSubscription: Bool {
        purchase.isSubscription
    }
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: isSubscription ? "crown.fill" : "checkmark.seal.fill")
                .font(.system(size: 24))
                .foregroundColor(isSubscription ? AppColors.warning : AppColors.success)
                .frame(width: 44, height: 44)
                .background((isSubscription ? AppColors.warning : AppColors.success).opacity(0.1))
                .cornerRadius(12)
            
            VStack(alignment: .leading, spacing: 6) {
                Text(purchase.productId)
                    .font(.headline)
                    .fontWeight(.semibold)

                Text("Transaction: \(purchase.id)")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(Date(timeIntervalSince1970: purchase.transactionDate / 1000), style: .date)
                    .font(.caption)
                    .foregroundColor(.secondary)

                if isSubscription && purchase.isAutoRenewing {
                    Label("Auto-renewable", systemImage: "arrow.triangle.2.circlepath")
                        .font(.caption)
                        .foregroundColor(AppColors.primary)
                }
                
                if let expiryTime = purchase.expirationDateIOS != nil ? Date(timeIntervalSince1970: purchase.expirationDateIOS! / 1000) : nil {
                    Text("Expires: \(expiryTime, style: .relative)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()

            Button(action: onShowDetails) {
                Image(systemName: "info.circle")
                    .font(.system(size: 18))
                    .foregroundColor(AppColors.primary)
            }
            .buttonStyle(.plain)
            
            if !isSubscription && !purchase.purchaseState.isAcknowledged {
                Button(action: onConsume) {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle")
                            .font(.system(size: 12))
                        Text("Finish")
                    }
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(AppColors.success)
                    .cornerRadius(8)
                }
            }
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
        .padding(.horizontal)
    }
}
