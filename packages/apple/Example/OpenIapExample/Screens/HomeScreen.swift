import SwiftUI
import OpenIAP

@available(iOS 15.0, *)
struct HomeScreen: View {
    @State private var showAllProducts = false

    var body: some View {
        GeometryReader { geometry in
            ScrollView {
                VStack(spacing: 20) {
                    Spacer(minLength: 0)
                    
                    Button(action: {
                        showAllProducts = true
                    }) {
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Image(systemName: "bag.fill")
                                    .font(.largeTitle)
                                    .foregroundColor(AppColors.primary)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("OpenIAP Example")
                                        .font(.headline)
                                        .foregroundColor(.primary)

                                    Text("iOS")
                                        .font(.caption)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 2)
                                        .background(AppColors.secondary.opacity(0.2))
                                        .cornerRadius(4)
                                }

                                Spacer()

                                Image(systemName: "chevron.right")
                                    .foregroundColor(.secondary)
                                    .font(.system(size: 14))
                            }

                            Text("Test in-app purchases and subscription features with StoreKit integration.")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.leading)
                        }
                        .padding()
                        .background(AppColors.cardBackground)
                        .cornerRadius(12)
                        .shadow(radius: 2)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .padding(.horizontal)
                    
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: 2), spacing: 16) {
                        FeatureCard(
                            title: "Purchase\nFlow",
                            subtitle: "Test product purchases",
                            icon: "cart.fill",
                            color: Color.teal,
                            destination: AnyView(PurchaseFlowScreen())
                        )

                        FeatureCard(
                            title: "Subscription\nFlow",
                            subtitle: "Test subscriptions",
                            icon: "repeat.circle.fill",
                            color: AppColors.secondary,
                            destination: AnyView(SubscriptionFlowScreen())
                        )

                        FeatureCard(
                            title: "My\nPurchases",
                            subtitle: "View your purchases",
                            icon: "list.bullet.rectangle.fill",
                            color: AppColors.success,
                            destination: AnyView(AvailablePurchasesScreen())
                        )

                        FeatureCard(
                            title: "Offer\nCode",
                            subtitle: "Redeem promotional codes",
                            icon: "gift.fill",
                            color: AppColors.warning,
                            destination: AnyView(OfferCodeScreen())
                        )

                        if #available(iOS 16.0, *) {
                            FeatureCard(
                                title: "Alternative\nBilling",
                                subtitle: "External purchase links",
                                icon: "link.circle.fill",
                                color: Color.purple,
                                destination: AnyView(AlternativeBillingScreen())
                            )
                        }
                    }
                    .padding(.horizontal)
                    
                    Spacer(minLength: 0)
                }
                .padding(.vertical)
                .frame(minHeight: geometry.size.height)
            }
        }
        .background(AppColors.background)
        .navigationTitle("OpenIAP Samples")
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $showAllProducts) {
            AllProductsView()
        }
    }
}
