import SwiftUI
import OpenIAP

struct ProductListCard: View {
    let product: OpenIapProduct
    let onPurchase: () -> Void
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: productIcon)
                .font(.system(size: 28))
                .foregroundColor(AppColors.primary)
                .frame(width: 44, height: 44)
                .background(AppColors.primary.opacity(0.1))
                .cornerRadius(12)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(productTitle)
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text(product.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            Spacer()
            
            VStack(spacing: 8) {
                Text(product.displayPrice)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(AppColors.primary)
                
                Button(action: onPurchase) {
                    Text("Buy")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 6)
                        .background(AppColors.primary)
                        .cornerRadius(8)
                }
            }
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
    }
    
    private var productIcon: String {
        if product.id.contains("10bulbs") {
            return "lightbulb"
        } else if product.id.contains("30bulbs") {
            return "lightbulb.fill"
        } else if product.id.contains("premium") {
            return "crown"
        } else {
            return "bag"
        }
    }
    
    private var productTitle: String {
        if product.id.contains("10bulbs") {
            return "10 Bulbs Pack"
        } else if product.id.contains("30bulbs") {
            return "30 Bulbs Pack"
        } else if product.id.contains("premium") {
            return "Premium Subscription"
        } else {
            return product.title
        }
    }
}

