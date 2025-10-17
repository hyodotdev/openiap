import SwiftUI
import OpenIAP

struct SubscriptionCard: View {
    let productId: String
    let product: OpenIapProduct?
    let purchase: OpenIapPurchase?
    let isSubscribed: Bool
    let isCancelled: Bool
    let isLoading: Bool
    var upgradeInfo: UpgradeInfo? = nil
    let onSubscribe: () -> Void
    let onManage: () -> Void
    
    private var expirationInfo: (date: Date, formattedString: String, isExpiringSoon: Bool)? {
        guard let purchase = purchase,
              let expirationTime = purchase.expirationDateIOS else { return nil }
        
        let expirationDate = Date(timeIntervalSince1970: expirationTime / 1000)
        let formatter: DateFormatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        
        let timeInterval = expirationDate.timeIntervalSinceNow
        let isExpiringSoon = timeInterval < 86400 && timeInterval > 0
        
        return (expirationDate, formatter.string(from: expirationDate), isExpiringSoon)
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(product?.title ?? productId)
                            .font(.headline)

                        if isSubscribed {
                            Label("Subscribed", systemImage: "checkmark.seal.fill")
                                .font(.caption)
                                .foregroundColor(AppColors.success)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(AppColors.success.opacity(0.2))
                                .cornerRadius(4)
                        } else if let upgradeInfo = upgradeInfo, upgradeInfo.canUpgrade {
                            Label("Upgrade", systemImage: "arrow.up.circle.fill")
                                .font(.caption)
                                .foregroundColor(AppColors.primary)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(AppColors.primary.opacity(0.2))
                                .cornerRadius(4)
                        } else if let upgradeInfo = upgradeInfo, upgradeInfo.isDowngrade {
                            Label("Downgrade", systemImage: "arrow.down.circle")
                                .font(.caption)
                                .foregroundColor(.orange)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(Color.orange.opacity(0.2))
                                .cornerRadius(4)
                        }
                    }
                    
                    Text(productId)
                        .font(.caption)
                        .font(.system(.body, design: .monospaced))
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text(product.map { $0.displayPrice } ?? "--")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(AppColors.secondary)

                    Label(product.map { $0.typeIOS.rawValue } ?? "subscription", systemImage: "repeat")
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(AppColors.secondary.opacity(0.15))
                        .cornerRadius(4)
                }
            }
            
            if isSubscribed {
                VStack(alignment: .leading, spacing: 10) {
                    if let purchase = purchase {
                        VStack(alignment: .leading, spacing: 6) {
                            if let info = expirationInfo {
                                HStack {
                                    Label("Expires", systemImage: "calendar")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Spacer()
                                    Text(info.formattedString)
                                        .font(.caption)
                                        .fontWeight(.medium)
                                        .foregroundColor(info.isExpiringSoon ? AppColors.warning : AppColors.success)
                                }
                            }
                            
                            if let purchaseDate = Date(timeIntervalSince1970: purchase.transactionDate / 1000) as Date? {
                                HStack {
                                    Label("Started", systemImage: "clock")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Spacer()
                                    Text(DateFormatter.localizedString(from: purchaseDate, dateStyle: .medium, timeStyle: .short))
                                        .font(.caption)
                                        .fontWeight(.medium)
                                        .foregroundColor(.secondary)
                                }
                            }
                            
                            if let isPaused = purchase.isAutoRenewing as Bool? {
                                HStack {
                                    Label("Auto-Renew", systemImage: isPaused ? "arrow.triangle.2.circlepath" : "pause")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Spacer()
                                    Text(isPaused ? "Enabled" : "Disabled")
                                        .font(.caption)
                                        .fontWeight(.medium)
                                        .foregroundColor(isPaused ? AppColors.success : AppColors.warning)
                                }
                            }
                        }
                        .padding(12)
                        .background(Color.gray.opacity(0.05))
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                        )
                        .cornerRadius(6)
                    }
                    
                    if isCancelled {
                        Button(action: onSubscribe) {
                            HStack {
                                if isLoading {
                                    ProgressView()
                                        .scaleEffect(0.8)
                                        .tint(.white)
                                } else {
                                    Image(systemName: "arrow.clockwise.circle")
                                }
                                Text(isLoading ? "Reactivating..." : "Reactivate Subscription")
                                    .fontWeight(.medium)
                                Spacer()
                                Text(product?.displayPrice ?? "--")
                                    .fontWeight(.semibold)
                            }
                            .padding()
                            .background(isLoading ? AppColors.secondary.opacity(0.7) : AppColors.secondary)
                            .foregroundColor(.white)
                            .cornerRadius(8)
                        }
                        .disabled(isLoading)
                        
                        Text("Subscription will remain active until expiry")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                    } else {
                        Button(action: onManage) {
                            HStack {
                                Image(systemName: "gear")
                                    .font(.system(size: 14))
                                Text("Manage Subscription")
                                    .fontWeight(.medium)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Color.gray.opacity(0.15))
                            .foregroundColor(AppColors.primaryText)
                            .cornerRadius(8)
                        }
                        
                        Text("Cancel anytime in Settings")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }
            } else {
                // Show upgrade info message if available
                if let upgradeInfo = upgradeInfo, let currentTier = upgradeInfo.currentTier {
                    VStack(spacing: 8) {
                        // Check if this is a pending upgrade
                        if upgradeInfo.isPending {
                            // Show pending upgrade status
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Image(systemName: "clock.arrow.circlepath")
                                        .foregroundColor(.orange)
                                    Text("Upgrade pending from \(currentTier)")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Spacer()
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.orange.opacity(0.1))
                                .cornerRadius(6)

                                if let message = upgradeInfo.message {
                                    Text(message)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                        .padding(.horizontal, 12)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                        } else if let message = upgradeInfo.message, message.contains("Reactivate current subscription") {
                            // Cancelled subscription - cannot switch to different tier
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.orange)
                                Text(message)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Spacer()
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color.orange.opacity(0.1))
                            .cornerRadius(6)
                        } else {
                            // Show regular upgrade/switch option
                            HStack {
                                Image(systemName: upgradeInfo.canUpgrade ? "arrow.up.circle.fill" : "info.circle.fill")
                                    .foregroundColor(upgradeInfo.canUpgrade ? AppColors.primary : .orange)
                                Text(upgradeInfo.canUpgrade ? "Upgrade from \(currentTier)" : "Currently subscribed to \(currentTier)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Spacer()
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color.gray.opacity(0.1))
                            .cornerRadius(6)

                            Button(action: onSubscribe) {
                                HStack {
                                    if isLoading {
                                        ProgressView()
                                            .scaleEffect(0.8)
                                            .tint(.white)
                                    } else {
                                        Image(systemName: upgradeInfo.canUpgrade ? "arrow.up.circle" : "repeat.circle")
                                    }

                                    Text(isLoading ? "Processing..." : (upgradeInfo.canUpgrade ? "Upgrade Now" : "Switch Plan"))
                                        .fontWeight(.medium)

                                    Spacer()

                                    if !isLoading {
                                        VStack(alignment: .trailing, spacing: 2) {
                                            Text(product?.displayPrice ?? "--")
                                                .fontWeight(.semibold)
                                            if upgradeInfo.canUpgrade {
                                                Text("Pro-rated")
                                                    .font(.caption2)
                                                    .opacity(0.8)
                                            }
                                        }
                                    }
                                }
                                .padding()
                                .background(isLoading ? AppColors.secondary.opacity(0.7) : (upgradeInfo.canUpgrade ? AppColors.primary : AppColors.secondary))
                                .foregroundColor(.white)
                                .cornerRadius(8)
                            }
                            .disabled(isLoading)
                        }
                    }
                } else {
                    Button(action: onSubscribe) {
                        HStack {
                            if isLoading {
                                ProgressView()
                                    .scaleEffect(0.8)
                                    .tint(.white)
                            } else {
                                Image(systemName: "repeat.circle")
                            }

                            Text(isLoading ? "Processing..." : "Subscribe")
                                .fontWeight(.medium)

                            Spacer()

                            if !isLoading {
                                Text(product?.displayPrice ?? "--")
                                    .fontWeight(.semibold)
                            }
                        }
                        .padding()
                        .background(isLoading ? AppColors.secondary.opacity(0.7) : AppColors.secondary)
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                    .disabled(isLoading)
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
