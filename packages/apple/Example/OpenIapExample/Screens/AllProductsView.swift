import SwiftUI
import OpenIAP

@available(iOS 15.0, *)
struct AllProductsView: View {
    @StateObject private var store = OpenIapStore()
    @State private var isLoading = false
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss

    // Product IDs from other screens
    private let allProductIds: [String] = [
        "dev.hyo.martie.10bulbs",
        "dev.hyo.martie.30bulbs",
        "dev.hyo.martie.certified",
        "dev.hyo.martie.premium",
        "dev.hyo.martie.premium_year"
    ]

    // Enum to unify product types for display
    private enum UnifiedProduct {
        case regular(ProductIOS)
        case subscription(ProductSubscriptionIOS)

        var id: String {
            switch self {
            case .regular(let product):
                return product.id
            case .subscription(let sub):
                return sub.id
            }
        }

        var sortOrder: Int {
            switch self {
            case .regular(let product):
                switch product.typeIOS {
                case .nonConsumable:
                    return 1  // First
                case .consumable:
                    return 2  // Second
                default:
                    return 3  // Third
                }
            case .subscription:
                return 4  // Last
            }
        }
    }

    // All products sorted by type: non-consumable, consumable, then subscriptions
    private var sortedAllProducts: [UnifiedProduct] {
        let regularProducts = store.iosProducts.map { UnifiedProduct.regular($0) }
        let subscriptionProducts = store.iosSubscriptionProducts.map { UnifiedProduct.subscription($0) }
        let allProducts = regularProducts + subscriptionProducts

        return allProducts.sorted { first, second in
            first.sortOrder < second.sortOrder
        }
    }


    var body: some View {
        NavigationView {
            ZStack {
                Color(UIColor.systemGroupedBackground)
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        if !store.isConnected {
                            connectionWarningCard
                        }

                        if isLoading {
                            loadingCard
                        }

                        if !isLoading && sortedAllProducts.isEmpty && store.isConnected {
                            emptyStateCard
                        }

                        // Display all products sorted by type: non-consumable, consumable, then subscriptions
                        ForEach(sortedAllProducts, id: \.id) { unifiedProduct in
                            switch unifiedProduct {
                            case .regular(let product):
                                productCard(for: product)
                            case .subscription(let subscription):
                                subscriptionCard(for: subscription)
                            }
                        }

                        if let error = errorMessage {
                            errorCard(message: error)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("All Products")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: {
                        Task {
                            try? await store.endConnection()
                        }
                        dismiss()
                    }) {
                        Image(systemName: "arrow.left")
                            .foregroundColor(.primary)
                    }
                }
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
        .onAppear {
            Task {
                await initializeStore()
            }
        }
    }

    private var connectionWarningCard: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.orange)
                .font(.title3)

            VStack(alignment: .leading, spacing: 4) {
                Text("Not Connected")
                    .font(.headline)
                Text("Billing service is not connected")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button("Retry") {
                Task {
                    await initializeStore()
                }
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .padding()
        .background(Color.orange.opacity(0.1))
        .cornerRadius(12)
    }

    private var loadingCard: some View {
        HStack {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle())

            Text("Loading products...")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .padding(.leading, 8)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }

    private var emptyStateCard: some View {
        VStack(spacing: 12) {
            Image(systemName: "bag")
                .font(.largeTitle)
                .foregroundColor(.secondary)

            Text("No products available")
                .font(.headline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
    }

    private func productCard(for product: ProductIOS) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(product.displayName ?? product.displayNameIOS)
                        .font(.headline)

                    if !product.description.isEmpty {
                        Text(product.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }

                Spacer()

                // Product type badges
                HStack(spacing: 4) {
                    // Main type badge
                    Text(product.type == .subs ? "subs" : "in-app")
                        .font(.caption)
                        .fontWeight(.medium)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(product.type == .subs ? Color.blue.opacity(0.1) : Color.green.opacity(0.1))
                        .foregroundColor(product.type == .subs ? .blue : .green)
                        .cornerRadius(6)

                    // Detailed type badge for non-subscription products
                    if product.type != .subs {
                        Text(getDetailedProductType(product.typeIOS))
                            .font(.caption2)
                            .fontWeight(.medium)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(getTypeColor(product.typeIOS).opacity(0.1))
                            .foregroundColor(getTypeColor(product.typeIOS))
                            .cornerRadius(4)
                    }
                }
            }

            HStack {
                Text(product.displayPrice)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.blue)

                Spacer()

                Text("SKU: \(product.id)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
    }

    private func errorCard(message: String) -> some View {
        HStack {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundColor(.red)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.red)

            Spacer()
        }
        .padding()
        .background(Color.red.opacity(0.1))
        .cornerRadius(12)
    }

    private func initializeStore() async {
        isLoading = true
        errorMessage = nil

        do {
            try await store.initConnection()

            if store.isConnected {
                // Fetch all products using "all" type
                try await store.fetchProducts(
                    skus: allProductIds,
                    type: .all
                )
            } else {
                errorMessage = "Failed to connect to App Store"
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func getDetailedProductType(_ type: ProductTypeIOS) -> String {
        switch type {
        case .consumable:
            return "consumable"
        case .nonConsumable:
            return "non-consumable"
        case .autoRenewableSubscription:
            return "auto-renewable"
        case .nonRenewingSubscription:
            return "non-renewing"
        }
    }

    private func getTypeColor(_ type: ProductTypeIOS) -> Color {
        switch type {
        case .consumable:
            return .orange
        case .nonConsumable:
            return .purple
        case .autoRenewableSubscription:
            return .blue
        case .nonRenewingSubscription:
            return .indigo
        }
    }

    private func subscriptionCard(for subscription: ProductSubscriptionIOS) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(subscription.displayName ?? subscription.displayNameIOS)
                        .font(.headline)

                    if !subscription.description.isEmpty {
                        Text(subscription.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }

                Spacer()

                // Subscription badge
                Text("subs")
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.blue.opacity(0.1))
                    .foregroundColor(.blue)
                    .cornerRadius(6)
            }

            HStack {
                Text(subscription.displayPrice)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.blue)

                Spacer()

                Text("SKU: \(subscription.id)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
    }
}

#Preview {
    AllProductsView()
}