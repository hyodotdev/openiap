import SwiftUI
import OpenIAP

@available(iOS 15.0, *)
struct PurchaseDetailSheet: View {
    let purchase: OpenIapPurchase
    @Environment(\.dismiss) private var dismiss

    private struct DetailItem: Identifiable {
        let id = UUID()
        let label: String
        let value: String
    }

    private var commonItems: [DetailItem] {
        var items: [DetailItem] = [
            DetailItem(label: "Purchase ID", value: purchase.id),
            DetailItem(label: "Product ID", value: purchase.productId),
            DetailItem(label: "Platform", value: purchase.platform.rawValue.uppercased()),
            DetailItem(label: "Purchase State", value: purchase.purchaseState.rawValue.capitalized),
            DetailItem(label: "Quantity", value: String(purchase.quantity)),
            DetailItem(label: "Auto Renewing", value: boolLabel(purchase.isAutoRenewing))
        ]

        if let ids = purchase.ids, ids.isEmpty == false {
            items.append(DetailItem(label: "Associated IDs", value: ids.joined(separator: ", ")))
        }

        items.append(DetailItem(label: "Transaction Date", value: formattedDate(purchase.transactionDate)))

        if let token = purchase.purchaseToken, token.isEmpty == false {
            items.append(DetailItem(label: "Purchase Token", value: token))
        }

        return items
    }

    private var iosItems: [DetailItem] {
        var items: [DetailItem] = []

        if let quantityIOS = purchase.quantityIOS {
            items.append(DetailItem(label: "iOS Quantity", value: String(quantityIOS)))
        }
        if let originalDate = purchase.originalTransactionDateIOS {
            items.append(DetailItem(label: "Original Transaction Date", value: formattedDate(originalDate)))
        }
        if let originalId = purchase.originalTransactionIdentifierIOS, originalId.isEmpty == false {
            items.append(DetailItem(label: "Original Transaction ID", value: originalId))
        }
        if let token = purchase.appAccountToken, token.isEmpty == false {
            items.append(DetailItem(label: "App Account Token", value: token))
        }
        if let expiration = purchase.expirationDateIOS {
            items.append(DetailItem(label: "Expiration Date", value: formattedDate(expiration)))
        }
        if let environment = purchase.environmentIOS, environment.isEmpty == false {
            items.append(DetailItem(label: "Environment", value: environment))
        }
        if let storefront = purchase.storefrontCountryCodeIOS, storefront.isEmpty == false {
            items.append(DetailItem(label: "Storefront Country", value: storefront))
        }
        if let bundle = purchase.appBundleIdIOS, bundle.isEmpty == false {
            items.append(DetailItem(label: "App Bundle ID", value: bundle))
        }
        if let group = purchase.subscriptionGroupIdIOS, group.isEmpty == false {
            items.append(DetailItem(label: "Subscription Group", value: group))
        }
        if let upgraded = purchase.isUpgradedIOS {
            items.append(DetailItem(label: "Upgraded", value: boolLabel(upgraded)))
        }
        if let ownership = purchase.ownershipTypeIOS, ownership.isEmpty == false {
            items.append(DetailItem(label: "Ownership", value: ownership))
        }
        if let reason = purchase.reasonIOS, reason.isEmpty == false {
            items.append(DetailItem(label: "Reason", value: reason))
        }
        if let reasonString = purchase.reasonStringRepresentationIOS, reasonString.isEmpty == false {
            items.append(DetailItem(label: "Reason String", value: reasonString))
        }
        if let transactionReason = purchase.transactionReasonIOS, transactionReason.isEmpty == false {
            items.append(DetailItem(label: "Transaction Reason", value: transactionReason))
        }
        if let revocationDate = purchase.revocationDateIOS {
            items.append(DetailItem(label: "Revocation Date", value: formattedDate(revocationDate)))
        }
        if let revocationReason = purchase.revocationReasonIOS, revocationReason.isEmpty == false {
            items.append(DetailItem(label: "Revocation Reason", value: revocationReason))
        }
        if let offer = purchase.offerIOS {
            items.append(DetailItem(label: "Offer ID", value: offer.id))
            items.append(DetailItem(label: "Offer Type", value: offer.type))
            items.append(DetailItem(label: "Offer Payment Mode", value: offer.paymentMode))
        }
        if let currencyCode = purchase.currencyCodeIOS, currencyCode.isEmpty == false {
            items.append(DetailItem(label: "Currency Code", value: currencyCode))
        }
        if let currencySymbol = purchase.currencySymbolIOS, currencySymbol.isEmpty == false {
            items.append(DetailItem(label: "Currency Symbol", value: currencySymbol))
        }
        if let countryCode = purchase.countryCodeIOS, countryCode.isEmpty == false {
            items.append(DetailItem(label: "Country Code", value: countryCode))
        }
        if let webOrderId = purchase.webOrderLineItemIdIOS, webOrderId.isEmpty == false {
            items.append(DetailItem(label: "Web Order Line Item ID", value: webOrderId))
        }

        return items
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    summaryCard

                    DetailSection(title: "Common", items: commonItems)

                    if iosItems.isEmpty == false {
                        DetailSection(title: "iOS", items: iosItems)
                    }
                }
                .padding()
            }
            .background(Color(UIColor.systemGroupedBackground))
            .navigationTitle("Purchase Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(purchase.productId)
                        .font(.headline)
                    Text(shortTransactionId)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Label(purchase.purchaseState.rawValue.capitalized, systemImage: "doc.text.magnifyingglass")
                    .font(.caption)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.accentColor.opacity(0.1))
                    .cornerRadius(6)
            }

            if let expiration = purchase.expirationDateIOS {
                Text("Expires: \(formattedDate(expiration))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(AppColors.cardBackground)
        .cornerRadius(12)
        .shadow(radius: 1)
    }

    private var shortTransactionId: String {
        let prefix = purchase.id.prefix(12)
        return String(prefix) + (purchase.id.count > 12 ? "…" : "")
    }

    private func formattedDate(_ milliseconds: Double) -> String {
        let date = Date(timeIntervalSince1970: milliseconds / 1000)
        return PurchaseDetailSheet.dateFormatter.string(from: date)
    }

    private func boolLabel(_ value: Bool) -> String {
        value ? "Yes" : "No"
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .medium
        return formatter
    }()

    private struct DetailSection: View {
        let title: String
        let items: [DetailItem]

        var body: some View {
            VStack(alignment: .leading, spacing: 12) {
                Text(title)
                    .font(.headline)
                VStack(spacing: 10) {
                    ForEach(items) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(item.label)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(item.value)
                                .font(.footnote)
                                .foregroundColor(.primary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(.vertical, 6)
                        if item.id != items.last?.id {
                            Divider()
                        }
                    }
                }
                .padding()
                .background(AppColors.cardBackground)
                .cornerRadius(12)
                .shadow(radius: 1)
            }
        }
    }
}
