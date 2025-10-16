import SwiftUI
import OpenIAP

struct ProductCard: View {
    let product: OpenIapProduct
    let isPurchasing: Bool
    let onPurchase: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(product.title)
                        .font(.headline)
                    
                    Text(product.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    Text(product.displayPrice)
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(AppColors.primary)
                    
                    Text(product.typeIOS.rawValue)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(AppColors.secondary.opacity(0.2))
                        .cornerRadius(4)
                }
            }
            
            Button(action: onPurchase) {
                HStack {
                    if isPurchasing {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Processing...")
                    } else {
                        Image(systemName: "cart.fill")
                        Text("Purchase")
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .foregroundColor(.white)
                .background(isPurchasing ? Color.gray : AppColors.primary)
                .cornerRadius(8)
            }
            .disabled(isPurchasing)
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 2)
    }
}

