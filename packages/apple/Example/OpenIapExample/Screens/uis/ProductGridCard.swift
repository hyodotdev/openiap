import SwiftUI
import OpenIAP

struct ProductGridCard: View {
    let product: OpenIapProduct
    let onPurchase: () -> Void
    
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: productIcon)
                .font(.system(size: 32))
                .foregroundColor(AppColors.primary)
                .frame(height: 40)
            
            VStack(spacing: 4) {
                Text(productTitle)
                    .font(.headline)
                    .fontWeight(.semibold)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                
                Text(product.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            
            Spacer()
            
            VStack(spacing: 8) {
                Text(product.displayPrice)
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(AppColors.primary)
                
                Button(action: onPurchase) {
                    Text("Purchase")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(AppColors.primary)
                        .cornerRadius(8)
                }
            }
        }
        .padding()
        .frame(height: 180)
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
        .padding(.horizontal, 4)
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
            return "10 Bulbs"
        } else if product.id.contains("30bulbs") {
            return "30 Bulbs"
        } else if product.id.contains("premium") {
            return "Premium"
        } else {
            return product.title
        }
    }
}

