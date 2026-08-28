import Foundation
import StoreKit

/// Bridge between StoreKit types and OpenIAP types
/// - SeeAlso: https://developer.apple.com/documentation/storekit/product
@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
enum StoreKitTypesBridge {
    static func product(from product: StoreKit.Product) async -> Product {
        .productIos(await productIOS(from: product))
    }

    static func productSubscription(from product: StoreKit.Product) async -> ProductSubscription? {
        guard let subscription = await productSubscriptionIOS(from: product) else { return nil }
        return .productSubscriptionIos(subscription)
    }

    static func productIOS(from product: StoreKit.Product) async -> ProductIOS {
        ProductIOS(
            currency: currencyCode(from: product) ?? "",
            debugDescription: product.description,
            description: product.description,
            displayName: product.displayName,
            displayNameIOS: product.displayName,
            displayPrice: product.displayPrice,
            id: product.id,
            isFamilyShareableIOS: product.isFamilyShareable,
            jsonRepresentationIOS: String(data: product.jsonRepresentation, encoding: .utf8) ?? "",
            platform: .ios,
            price: NSDecimalNumber(decimal: product.price).doubleValue,
            pricingTermsIOS: makeSubscriptionPricingTerms(from: product.subscription),
            subscriptionOffers: product.subscription.map(makeStandardizedSubscriptionOffers).flatMap {
                $0.isEmpty ? nil : $0
            },
            title: product.displayName,
            type: productType(from: product.type),
            typeIOS: productTypeIOS(from: product.type)
        )
    }

    static func productSubscriptionIOS(from product: StoreKit.Product) async -> ProductSubscriptionIOS? {
        if product.type == .nonRenewable {
            return nonRenewingSubscriptionIOS(from: product)
        }

        guard let subscription = product.subscription else { return nil }

        // Get introductory offer payment mode
        // StoreKit may return `.empty` for incomplete introductory-offer metadata.
        // https://developer.apple.com/forums/thread/707319
        let introPaymentMode: PaymentModeIOS = {
            if let paymentMode = subscription.introductoryOffer?.paymentMode.paymentModeIOS,
               paymentMode != .empty {
                return paymentMode
            }
            return introductoryPaymentModeFromJSON(product.jsonRepresentation) ?? .empty
        }()

        // Get normalized introductory period unit (e.g., 14 days -> week)
        let introPeriodUnit: SubscriptionPeriodIOS? = {
            guard let period = subscription.introductoryOffer?.period else { return nil }
            let normalized = normalizePeriod(period)
            return normalized.unit.subscriptionPeriodIOS
        }()

        // Convert to standardized cross-platform SubscriptionOffer type
        let standardizedOffers = makeStandardizedSubscriptionOffers(from: subscription)

        return ProductSubscriptionIOS(
            bundledSubscriptionsIOS: bundledSubscriptionsIOS(from: subscription),
            currency: currencyCode(from: product) ?? "",
            debugDescription: product.description,
            description: product.description,
            displayName: product.displayName,
            displayNameIOS: product.displayName,
            displayPrice: product.displayPrice,
            id: product.id,
            introductoryPriceAsAmountIOS: introductoryPriceAmount(from: subscription.introductoryOffer),
            introductoryPriceIOS: subscription.introductoryOffer?.displayPrice,
            introductoryPriceNumberOfPeriodsIOS: introductoryPeriods(from: subscription.introductoryOffer),
            introductoryPricePaymentModeIOS: introPaymentMode,
            introductoryPriceSubscriptionPeriodIOS: introPeriodUnit,
            isFamilyShareableIOS: product.isFamilyShareable,
            jsonRepresentationIOS: String(data: product.jsonRepresentation, encoding: .utf8) ?? "",
            platform: .ios,
            price: NSDecimalNumber(decimal: product.price).doubleValue,
            pricingTermsIOS: makeSubscriptionPricingTerms(from: subscription),
            subscriptionGroupIdIOS: subscription.subscriptionGroupID,
            subscriptionOffers: standardizedOffers.isEmpty ? nil : standardizedOffers,
            subscriptionPeriodNumberIOS: String(subscription.subscriptionPeriod.value),
            subscriptionPeriodUnitIOS: subscription.subscriptionPeriod.unit.subscriptionPeriodIOS,
            title: product.displayName,
            type: .subs,
            typeIOS: productTypeIOS(from: product.type)
        )
    }

    private static func nonRenewingSubscriptionIOS(from product: StoreKit.Product) -> ProductSubscriptionIOS {
        ProductSubscriptionIOS(
            bundledSubscriptionsIOS: nil,
            currency: currencyCode(from: product) ?? "",
            debugDescription: product.description,
            description: product.description,
            displayName: product.displayName,
            displayNameIOS: product.displayName,
            displayPrice: product.displayPrice,
            id: product.id,
            introductoryPriceAsAmountIOS: nil,
            introductoryPriceIOS: nil,
            introductoryPriceNumberOfPeriodsIOS: nil,
            introductoryPricePaymentModeIOS: .empty,
            introductoryPriceSubscriptionPeriodIOS: nil,
            isFamilyShareableIOS: product.isFamilyShareable,
            jsonRepresentationIOS: String(data: product.jsonRepresentation, encoding: .utf8) ?? "",
            platform: .ios,
            price: NSDecimalNumber(decimal: product.price).doubleValue,
            pricingTermsIOS: nil,
            subscriptionGroupIdIOS: nil,
            subscriptionOffers: nil,
            subscriptionPeriodNumberIOS: nil,
            subscriptionPeriodUnitIOS: nil,
            title: product.displayName,
            type: .subs,
            typeIOS: .nonRenewingSubscription
        )
    }

    static func purchase(from transaction: StoreKit.Transaction, jwsRepresentation: String?) async -> Purchase {
        .purchaseIos(await purchaseIOS(from: transaction, jwsRepresentation: jwsRepresentation))
    }

    static func purchaseIOS(from transaction: StoreKit.Transaction, jwsRepresentation: String?) async -> PurchaseIOS {
        let transactionId = String(transaction.id)
        let purchaseState: PurchaseState = .purchased
        let expirationDate = transaction.expirationDate?.milliseconds
        let revocationDate = transaction.revocationDate?.milliseconds
        let renewalInfoIOS = await subscriptionRenewalInfoIOS(for: transaction)
        let bundleMetadata = bundleTransactionMetadataIOS(from: transaction)
        // Default to false if renewalInfo unavailable - safer to underreport than falsely claim auto-renewal
        let autoRenewing = renewalInfoIOS?.willAutoRenew ?? false
        let environment: String?
        if #available(iOS 16.0, tvOS 16.0, watchOS 9.0, *) {
            environment = transaction.environment.rawValue
        } else {
            environment = nil
        }
        let offerInfo: PurchaseOfferIOS?
        if #available(iOS 17.2, macOS 14.2, tvOS 17.2, watchOS 10.2, *) {
            offerInfo = makePurchaseOffer(from: transaction.offer)
        } else {
            offerInfo = nil
        }

        let ownershipDescription = ownershipTypeDescription(from: transaction.ownershipType)
        let reasonDetails = transactionReasonDetails(from: transaction)
        let advancedCommerceInfo: AdvancedCommerceInfoIOS? = extractAdvancedCommerceInfo(from: transaction)
        let currencyCode = transactionCurrencyCode(from: transaction)

        return PurchaseIOS(
            advancedCommerceInfoIOS: advancedCommerceInfo,
            appAccountToken: transaction.appAccountToken?.uuidString,
            appBundleIdIOS: transaction.appBundleID,
            billingPlanTypeIOS: billingPlanTypeIOS(from: transaction),
            bundleOriginalTransactionIdIOS: bundleMetadata.originalTransactionId,
            bundleProductIdIOS: bundleMetadata.productId,
            bundleSubscriptionGroupIdIOS: bundleMetadata.subscriptionGroupId,
            bundleTransactionIdIOS: bundleMetadata.transactionId,
            commitmentInfoIOS: transactionCommitmentInfoIOS(from: transaction),
            countryCodeIOS: {
                if #available(iOS 17.0, tvOS 17.0, watchOS 10.0, *) {
                    transaction.storefront.countryCode
                } else {
                    transaction.storefrontCountryCode
                }
            }(),
            currencyCodeIOS: currencyCode,
            currencySymbolIOS: currencySymbol(for: currencyCode),
            currentPlanId: currentPlanId(
                productId: transaction.productID,
                productType: transaction.productType
            ),
            environmentIOS: environment,
            expirationDateIOS: expirationDate,
            id: transactionId,
            ids: nil,
            isAutoRenewing: autoRenewing,
            isUpgradedIOS: transaction.isUpgraded,
            offerIOS: offerInfo,
            originalTransactionDateIOS: transaction.originalPurchaseDate.milliseconds,
            originalTransactionIdentifierIOS: transaction.originalID != 0 ? String(transaction.originalID) : nil,
            ownershipTypeIOS: ownershipDescription,
            previousOriginalTransactionIdIOS: bundleMetadata.previousOriginalTransactionId,
            productId: transaction.productID,
            purchaseState: purchaseState,
            purchaseToken: jwsRepresentation ?? transactionId,
            quantity: transaction.purchasedQuantity,
            quantityIOS: transaction.purchasedQuantity,
            reasonIOS: reasonDetails.lowercased,
            reasonStringRepresentationIOS: reasonDetails.string,
            renewalInfoIOS: renewalInfoIOS,
            revocationDateIOS: revocationDate,
            revocationReasonIOS: transaction.revocationReason.map(
                revocationReasonDescription(from:)
            ),
            revocationTypeIOS: revocationTypeIOS(from: transaction),
            store: .apple,
            storefrontCountryCodeIOS: {
                if #available(iOS 17.0, tvOS 17.0, watchOS 10.0, *) {
                    transaction.storefront.countryCode
                } else {
                    transaction.storefrontCountryCode
                }
            }(),
            subscriptionGroupIdIOS: transaction.subscriptionGroupID,
            transactionDate: transaction.purchaseDate.milliseconds,
            transactionId: transactionId,
            transactionReasonIOS: reasonDetails.uppercased,
            webOrderLineItemIdIOS: transaction.webOrderLineItemID.map { String($0) }
        )
    }

    private static func determineAutoRenewStatus(for transaction: StoreKit.Transaction) async -> Bool {
        guard isAutoRenewingSubscriptionProductType(transaction.productType) else { return false }

        if let resolved = await subscriptionAutoRenewState(for: transaction) {
            return resolved
        }

        return true
    }

    private static func subscriptionAutoRenewState(for transaction: StoreKit.Transaction) async -> Bool? {
        guard let groupId = transaction.subscriptionGroupID else { return nil }

        do {
            let statuses = try await StoreKit.Product.SubscriptionInfo.status(for: groupId)
            for status in statuses {
                guard case .verified(let statusTransaction) = status.transaction else { continue }
                guard statusTransaction.productID == transaction.productID else { continue }

                switch status.renewalInfo {
                case .verified(let info):
                    return info.willAutoRenew
                case .unverified(let info, _):
                    return info.willAutoRenew
                }
            }
        } catch {
            return nil
        }

        return nil
    }

    static func subscriptionRenewalInfoIOS(for transaction: StoreKit.Transaction) async -> RenewalInfoIOS? {
        guard isAutoRenewingSubscriptionProductType(transaction.productType) else {
            return nil
        }
        guard let groupId = transaction.subscriptionGroupID else {
            return nil
        }

        do {
            let statuses = try await StoreKit.Product.SubscriptionInfo.status(for: groupId)

            // First, try to find exact product match
            var targetStatus: StoreKit.Product.SubscriptionInfo.Status?
            for status in statuses {
                guard case .verified(let statusTransaction) = status.transaction else { continue }

                if statusTransaction.productID == transaction.productID {
                    targetStatus = status
                    break
                }
            }

            // If no exact match, use the first status from the same group
            // This handles cases where a subscription is cancelled but still active
            if targetStatus == nil, let firstStatus = statuses.first {
                targetStatus = firstStatus
            }

            guard let status = targetStatus else {
                return nil
            }

            // Process the found status (exact match or fallback)
            switch status.renewalInfo {
            case .verified(let info):
                    // Only set pendingUpgradeProductId if it's different from current product
                    // autoRenewPreference = product that will renew next
                    // If different from current, it means upgrade/downgrade is pending
                    let currentProductId: String? = {
                        guard case .verified(let txn) = status.transaction else { return nil }
                        return txn.productID
                    }()

                    let pendingProductId: String? = {
                        // If subscription is cancelled, there's no pending change
                        guard info.willAutoRenew else { return nil }
                        guard let current = currentProductId else { return nil }
                        // Only return pendingUpgradeProductId if it's different from current
                        return info.autoRenewPreference != current ? info.autoRenewPreference : nil
                    }()
                    let offerInfo = renewalOfferInfoIOS(from: info)
                    let bundleMetadata = renewalBundleMetadataIOS(from: info)
                    // priceIncreaseStatus only available on iOS 15.0+
                    let priceIncrease: String? = {
                        if #available(iOS 15.0, macOS 12.0, *) {
                            return String(describing: info.priceIncreaseStatus)
                        }
                        return nil
                    }()
                    let renewalInfo = RenewalInfoIOS(
                        autoRenewPreference: info.autoRenewPreference,
                        bundleOriginalTransactionId: bundleMetadata.originalTransactionId,
                        bundleProductId: bundleMetadata.productId,
                        bundleSubscriptionGroupId: bundleMetadata.subscriptionGroupId,
                        commitmentInfo: renewalCommitmentInfoIOS(from: info),
                        expirationReason: info.expirationReason?.rawValue.description,
                        gracePeriodExpirationDate: info.gracePeriodExpirationDate?.milliseconds,
                        isInBillingRetry: info.isInBillingRetry,
                        jsonRepresentation: nil,
                        pendingUpgradeProductId: pendingProductId,
                        priceIncreaseStatus: priceIncrease,
                        renewalBillingPlanType: renewalBillingPlanTypeIOS(from: info),
                        renewalDate: info.renewalDate?.milliseconds,
                        renewalOfferId: offerInfo?.id,
                        renewalOfferType: offerInfo?.type,
                        willAutoRenew: info.willAutoRenew,
                        willUnbundle: bundleMetadata.willUnbundle
                    )
                    return renewalInfo
                case .unverified(let info, _):
                    // Only set pendingUpgradeProductId if it's different from current product
                    let currentProductId: String? = {
                        guard case .verified(let txn) = status.transaction else { return nil }
                        return txn.productID
                    }()

                    let pendingProductId: String? = {
                        // If subscription is cancelled, there's no pending change
                        guard info.willAutoRenew else { return nil }
                        guard let current = currentProductId else { return nil }
                        return info.autoRenewPreference != current ? info.autoRenewPreference : nil
                    }()
                    let offerInfo = renewalOfferInfoIOS(from: info)
                    let bundleMetadata = renewalBundleMetadataIOS(from: info)
                    // priceIncreaseStatus only available on iOS 15.0+
                    let priceIncrease: String? = {
                        if #available(iOS 15.0, macOS 12.0, *) {
                            return String(describing: info.priceIncreaseStatus)
                        }
                        return nil
                    }()
                    let renewalInfo = RenewalInfoIOS(
                        autoRenewPreference: info.autoRenewPreference,
                        bundleOriginalTransactionId: bundleMetadata.originalTransactionId,
                        bundleProductId: bundleMetadata.productId,
                        bundleSubscriptionGroupId: bundleMetadata.subscriptionGroupId,
                        commitmentInfo: renewalCommitmentInfoIOS(from: info),
                        expirationReason: info.expirationReason?.rawValue.description,
                        gracePeriodExpirationDate: info.gracePeriodExpirationDate?.milliseconds,
                        isInBillingRetry: info.isInBillingRetry,
                        jsonRepresentation: nil,
                        pendingUpgradeProductId: pendingProductId,
                        priceIncreaseStatus: priceIncrease,
                        renewalBillingPlanType: renewalBillingPlanTypeIOS(from: info),
                        renewalDate: info.renewalDate?.milliseconds,
                        renewalOfferId: offerInfo?.id,
                        renewalOfferType: offerInfo?.type,
                        willAutoRenew: info.willAutoRenew,
                        willUnbundle: bundleMetadata.willUnbundle
                    )
                    return renewalInfo
            }

        } catch {
            OpenIapLog.debug("⚠️ Failed to fetch renewalInfo: \(error.localizedDescription)")
            return nil
        }
    }

    static func purchaseOptionsIOS(
        from props: some IosPropsProtocol,
        product: StoreKit.Product? = nil,
        purchaseIntentOffer: StoreKit.Product.SubscriptionOffer? = nil
    ) throws -> Set<StoreKit.Product.PurchaseOption> {
        var options: Set<StoreKit.Product.PurchaseOption> = []
        if let quantity = props.quantity, quantity > 1 {
            options.insert(.quantity(quantity))
        }
        if let token = props.appAccountToken {
            guard let uuid = UUID(uuidString: token) else {
                // Apple requires appAccountToken to be a valid UUID format.
                // If a non-UUID value is provided, Apple silently returns null for this field.
                // Fail fast with a clear error message so developers can identify the issue.
                // Reference: https://openiap.dev/docs/types/request
                // Note: We intentionally do NOT log the token value as it may contain sensitive data.
                OpenIapLog.error("❌ Invalid appAccountToken format. Must be a valid UUID (e.g., '550e8400-e29b-41d4-a716-446655440000')")
                throw PurchaseError.make(
                    code: .developerError,
                    productId: props.sku,
                    message: "appAccountToken must be a valid UUID format (e.g., '550e8400-e29b-41d4-a716-446655440000'). Apple silently returns null for non-UUID values."
                )
            }
            options.insert(.appAccountToken(uuid))
        }
        if let offerInput = props.withOffer {
            guard let option = promotionalOffer(from: offerInput) else {
                throw PurchaseError.make(
                    code: .developerError,
                    productId: props.sku,
                    message: "Invalid promotional offer: nonce must be valid UUID and signature must be base64 encoded"
                )
            }
            options.insert(option)
        }

        // Subscription-only options (only available on RequestSubscriptionIosProps)
        if let subscriptionProps = props as? RequestSubscriptionIosProps {
            // Xcode 26.5 (Swift 6.3.2) is the first SDK with billing plan symbols.
            if let billingPlanType = subscriptionProps.billingPlanType {
                #if compiler(>=6.3.2)
                if #available(iOS 26.4, macOS 26.4, tvOS 26.4, watchOS 26.4, visionOS 26.4, *) {
                    switch billingPlanType {
                    case .monthly:
                        options.insert(.billingPlanType(.monthly))
                    case .upFront:
                        options.insert(.billingPlanType(.upFront))
                    case .unknown:
                        throw PurchaseError.make(
                            code: .developerError,
                            productId: props.sku,
                            message: "billingPlanType must be monthly or up-front."
                        )
                    }
                } else {
                    throw PurchaseError.make(
                        code: .featureNotSupported,
                        productId: props.sku,
                        message: "billingPlanType requires iOS 26.4+ / macOS 26.4+ / tvOS 26.4+ / watchOS 26.4+ / visionOS 26.4+."
                    )
                }
                #else
                throw PurchaseError.make(
                    code: .featureNotSupported,
                    productId: props.sku,
                    message: "billingPlanType requires Xcode 26.5+ / Swift 6.3.2 compiler+."
                )
                #endif
            }

            // Win-back offers (iOS 18+)
            // Used to re-engage churned subscribers
            if let winBackInput = subscriptionProps.winBackOffer {
                if #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *) {
                    guard let product = product else {
                        OpenIapLog.error("❌ Win-back offer requires product context")
                        throw PurchaseError.make(
                            code: .developerError,
                            productId: props.sku,
                            message: "Win-back offer requires product context. Fetch the product before calling requestPurchase."
                        )
                    }
                    // StoreKit keeps win-back offers in a dedicated collection; they
                    // are not included in promotionalOffers.
                    if let subscription = product.subscription {
                        let winBackOffer = subscription.winBackOffers.first { offer in
                            offer.id == winBackInput.offerId
                        }
                        if let offer = winBackOffer {
                            options.insert(.winBackOffer(offer))
                            OpenIapLog.debug("✅ Added win-back offer: \(winBackInput.offerId)")
                        } else {
                            OpenIapLog.error("❌ Win-back offer not found: \(winBackInput.offerId)")
                            throw PurchaseError.make(
                                code: .developerError,
                                productId: props.sku,
                                message: "Win-back offer not found: \(winBackInput.offerId). Ensure the user is eligible and the offer ID is correct."
                            )
                        }
                    } else {
                        OpenIapLog.error("❌ Win-back offer requires a subscription product")
                        throw PurchaseError.make(
                            code: .developerError,
                            productId: props.sku,
                            message: "Win-back offers can only be applied to subscription products"
                        )
                    }
                } else {
                    // Fail fast when win-back offers are used on unsupported OS versions
                    OpenIapLog.error("❌ Win-back offers require iOS 18+ / macOS 15+ / tvOS 18+ / watchOS 11+ / visionOS 2+")
                    throw PurchaseError.make(
                        code: .developerError,
                        productId: props.sku,
                        message: "Win-back offers are only supported on iOS 18+ / macOS 15+ / tvOS 18+ / watchOS 11+ / visionOS 2+."
                    )
                }
            } else if let purchaseIntentOffer,
                      props.withOffer == nil,
                      subscriptionProps.promotionalOfferJWS == nil {
                if #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *) {
                    options.insert(.winBackOffer(purchaseIntentOffer))
                    OpenIapLog.debug("✅ Added win-back offer from PurchaseIntent")
                }
            }

            // JWS Promotional Offer (iOS 15+, WWDC 2025)
            // New signature format using compact JWS string for promotional offers
            // Back-deployed to iOS 15, but requires Xcode 26+ / Swift 6.3 compiler+ to compile.
            if let jwsOffer = subscriptionProps.promotionalOfferJWS {
                #if compiler(>=6.3)
                // Swift 6.3 compiler+ implementation
                options.formUnion(
                    StoreKit.Product.PurchaseOption.promotionalOffer(
                        jwsOffer.offerId,
                        compactJWS: jwsOffer.jws
                    )
                )
                OpenIapLog.debug("✅ Added JWS promotional offer: \(jwsOffer.offerId)")
                #else
                // Swift compiler < 6.3: API not available, throw error to fail fast.
                OpenIapLog.error("❌ JWS promotional offers require Xcode 26+ / Swift 6.3 compiler+")
                throw PurchaseError.make(
                    code: .developerError,
                    productId: props.sku,
                    message: "JWS promotional offers require Xcode 26+ / Swift 6.3 compiler+. Use withOffer with signature-based promotional offers instead."
                )
                #endif
            }

            // Introductory Offer Eligibility Override (iOS 15+, WWDC 2025)
            // Allows overriding the system's eligibility check with a server-signed JWS
            // Back-deployed to iOS 15, but requires Xcode 16.4+ / Swift 6.1 compiler+ to compile.
            if let compactJWS = subscriptionProps.compactJWS {
                #if compiler(>=6.1)
                // Swift 6.1 compiler+ implementation
                options.insert(.introductoryOfferEligibility(compactJWS: compactJWS))
                OpenIapLog.debug("✅ Added introductory offer eligibility override")
                #else
                // Swift compiler < 6.1: API not available, throw error to fail fast.
                OpenIapLog.error("❌ Introductory offer eligibility override requires Xcode 16.4+ / Swift 6.1 compiler+")
                throw PurchaseError.make(
                    code: .developerError,
                    productId: props.sku,
                    message: "Introductory offer eligibility override requires Xcode 16.4+ / Swift 6.1 compiler+. The system will determine eligibility automatically."
                )
                #endif
            }
        }

        // Advanced Commerce Data (iOS 15+)
        // Used with StoreKit 2's Product.PurchaseOption.custom API for passing
        // campaign tokens, affiliate IDs, or other attribution data
        if let advancedCommerceData = props.advancedCommerceData, !advancedCommerceData.isEmpty {
            let payload: [String: Any] = ["signatureInfo": ["token": advancedCommerceData]]
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: payload)
                options.insert(.custom(key: "advancedCommerceData", value: jsonData))
                OpenIapLog.debug("✅ Added advancedCommerceData purchase option")
            } catch {
                OpenIapLog.error("❌ Failed to serialize advancedCommerceData: \(error.localizedDescription)")
                throw PurchaseError.make(
                    code: .developerError,
                    productId: props.sku,
                    message: "Failed to serialize advancedCommerceData: \(error.localizedDescription)"
                )
            }
        }
        return options
    }

    /// Returns the currency code from the product's price format style.
    /// Uses iOS 16+ API when available, falls back to product's locale for iOS 15.
    static func currencyCode(from product: StoreKit.Product) -> String? {
        #if os(macOS)
        return product.priceFormatStyle.currencyCode
        #else
        if #available(iOS 16.0, tvOS 16.0, watchOS 9.0, *) {
            return product.priceFormatStyle.currencyCode
        } else {
            // iOS 15 fallback - use currency from the product's locale (not device locale)
            return product.priceFormatStyle.locale.currencyCode
        }
        #endif
    }

    static func transactionCurrencyCode(from transaction: StoreKit.Transaction) -> String? {
        #if os(macOS) || os(tvOS) || os(visionOS)
        // This bridge's deployment floors on these platforms already include
        // Transaction.currency, so compiling the deprecated fallback would
        // produce a misleading warning on macOS builds.
        return transaction.currency?.identifier
        #else
        if #available(iOS 16.0, macOS 13.0, tvOS 16.0, watchOS 9.0, visionOS 1.0, *) {
            return transaction.currency?.identifier
        }
        return transaction.currencyCode
        #endif
    }

    static func currencySymbol(for currencyCode: String?) -> String? {
        guard let currencyCode, !currencyCode.isEmpty else { return nil }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currencyCode
        return formatter.currencySymbol
    }

    static func currentPlanId(
        productId: String,
        productType: StoreKit.Product.ProductType
    ) -> String? {
        #if compiler(>=6.4)
        if #available(iOS 27.0, macOS 27.0, tvOS 27.0, watchOS 27.0, visionOS 27.0, *),
           productType == .subscriptionBundle || productType == .subscriptionSuite {
            return productId
        }
        #endif

        switch productType {
        case .autoRenewable, .nonRenewable:
            return productId
        default:
            return nil
        }
    }

    static func bundleTransactionMetadataIOS(
        from transaction: StoreKit.Transaction
    ) -> (
        originalTransactionId: String?,
        productId: String?,
        subscriptionGroupId: String?,
        transactionId: String?,
        previousOriginalTransactionId: String?
    ) {
        #if compiler(>=6.4)
        return (
            originalTransactionId: transaction.bundleOriginalTransactionID,
            productId: transaction.bundleProductID,
            subscriptionGroupId: transaction.bundleSubscriptionGroupID,
            transactionId: transaction.bundleTransactionID,
            previousOriginalTransactionId: transaction.previousOriginalTransactionID.map(String.init)
        )
        #else
        return (nil, nil, nil, nil, nil)
        #endif
    }

    static func renewalBundleMetadataIOS(
        from info: StoreKit.Product.SubscriptionInfo.RenewalInfo
    ) -> (
        originalTransactionId: String?,
        productId: String?,
        subscriptionGroupId: String?,
        willUnbundle: Bool?
    ) {
        #if compiler(>=6.4)
        return (
            originalTransactionId: info.bundleOriginalTransactionID,
            productId: info.bundleProductID,
            subscriptionGroupId: info.bundleSubscriptionGroupID,
            willUnbundle: info.willUnbundle
        )
        #else
        return (nil, nil, nil, nil)
        #endif
    }

    static func isAutoRenewingSubscriptionProductType(
        _ type: StoreKit.Product.ProductType
    ) -> Bool {
        #if compiler(>=6.4)
        if #available(iOS 27.0, macOS 27.0, tvOS 27.0, watchOS 27.0, visionOS 27.0, *),
           type == .subscriptionBundle || type == .subscriptionSuite {
            return true
        }
        #endif

        switch type {
        case .autoRenewable:
            return true
        default:
            return false
        }
    }

    static func renewalOfferInfoIOS(from info: StoreKit.Product.SubscriptionInfo.RenewalInfo) -> (id: String?, type: String?)? {
        #if compiler(>=6.1)
        if #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *) {
            if let offer = info.offer {
                return (id: offer.id, type: String(describing: offer.type))
            }
        }
        #endif

        #if compiler(>=5.9)
        let offerTypeString = info.offerType.map { String(describing: $0) }
        if info.offerID != nil || offerTypeString != nil {
            return (id: info.offerID, type: offerTypeString)
        }
        #endif
        return nil
    }

    static func renewalCommitmentInfoIOS(from info: StoreKit.Product.SubscriptionInfo.RenewalInfo) -> RenewalCommitmentInfoIOS? {
        #if compiler(>=6.3.2)
        if #available(iOS 26.4, macOS 26.4, tvOS 26.4, watchOS 26.4, visionOS 26.4, *) {
            guard let commitment = info.commitmentInfo else { return nil }
            return RenewalCommitmentInfoIOS(
                commitmentAutoRenewProductId: commitmentAutoRenewProductId(from: commitment.autoRenewPreference),
                commitmentAutoRenewStatus: commitment.willAutoRenew,
                commitmentRenewalBillingPlanType: billingPlanTypeIOS(from: commitment.renewalBillingPlanType),
                commitmentRenewalDate: commitment.renewalDate.milliseconds,
                commitmentRenewalPrice: NSDecimalNumber(decimal: commitment.renewalPrice).doubleValue
            )
        }
        #endif
        return nil
    }

    private static func commitmentAutoRenewProductId(from preference: String) -> String {
        preference
    }

    private static func commitmentAutoRenewProductId(from preference: String?) -> String {
        preference ?? ""
    }

    static func renewalBillingPlanTypeIOS(from info: StoreKit.Product.SubscriptionInfo.RenewalInfo) -> SubscriptionBillingPlanTypeIOS? {
        #if compiler(>=6.3.2)
        if #available(iOS 26.4, macOS 26.4, tvOS 26.4, watchOS 26.4, visionOS 26.4, *) {
            return info.renewalBillingPlanType.map { billingPlanTypeIOS(from: $0) }
        }
        #endif
        return nil
    }

    /// Recovers an upstream StoreKit introductory payment mode when
    /// `SubscriptionInfo.introductoryOffer` is missing or incomplete.
    static func introductoryPaymentModeFromJSON(_ data: Data) -> PaymentModeIOS? {
        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let attributes = json["attributes"] as? [String: Any],
            let offers = attributes["offers"] as? [[String: Any]],
            let discounts = offers.first?["discounts"] as? [[String: Any]],
            let introductory = discounts.first(where: {
                ($0["type"] as? String) == "IntroOffer"
            }),
            let modeType = introductory["modeType"] as? String
        else {
            return nil
        }

        switch modeType {
        case "FreeTrial":
            return .freeTrial
        case "PayAsYouGo":
            return .payAsYouGo
        case "PayUpFront":
            return .payUpFront
        default:
            return nil
        }
    }

    static func standardizedDiscountOfferTypeIOS(
        from type: StoreKit.Product.SubscriptionOffer.OfferType
    ) -> DiscountOfferType? {
        #if compiler(>=6.1)
        if #available(iOS 18.0, macOS 15.0, tvOS 18.0, watchOS 11.0, visionOS 2.0, *),
           type == .winBack {
            return nil
        }
        #endif
        if type == .introductory { return .introductory }
        if type == .promotional { return .promotional }
        return nil
    }

    static func purchaseOfferTypeStringIOS(from type: StoreKit.Transaction.OfferType) -> String {
        #if compiler(>=6.1)
        if type == .winBack {
            return SubscriptionOfferTypeIOS.winBack.rawValue
        }
        #endif
        if type == .introductory {
            return SubscriptionOfferTypeIOS.introductory.rawValue
        }
        if type == .promotional {
            return SubscriptionOfferTypeIOS.promotional.rawValue
        }
        return String(describing: type)
    }
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
private extension StoreKitTypesBridge {

    static func makeSubscriptionPricingTerms(from info: StoreKit.Product.SubscriptionInfo?) -> [SubscriptionPricingTermsIOS]? {
        guard let info else { return nil }
        #if compiler(>=6.3.2)
        if #available(iOS 26.4, macOS 26.4, tvOS 26.4, watchOS 26.4, visionOS 26.4, *) {
            let terms = info.pricingTerms.map { makeSubscriptionPricingTerm(from: $0) }
            return terms.isEmpty ? nil : terms
        }
        #endif
        return nil
    }

    static func bundledSubscriptionsIOS(
        from info: StoreKit.Product.SubscriptionInfo
    ) -> [BundledSubscriptionIOS]? {
        #if compiler(>=6.4)
        if #available(iOS 27.0, macOS 27.0, tvOS 27.0, watchOS 27.0, visionOS 27.0, *) {
            let bundledSubscriptions = info.bundledSubscriptions.map { subscription in
                BundledSubscriptionIOS(
                    description: subscription.description,
                    displayName: subscription.displayName,
                    displayPrice: subscription.displayPrice,
                    id: subscription.id,
                    isFamilyShareable: subscription.isFamilyShareable,
                    price: NSDecimalNumber(decimal: subscription.price).doubleValue,
                    subscriptionGroupDisplayName: subscription.subscriptionGroupDisplayName,
                    subscriptionGroupId: subscription.subscriptionGroupID,
                    subscriptionGroupLevel: subscription.subscriptionGroupLevel
                )
            }
            return bundledSubscriptions.isEmpty ? nil : bundledSubscriptions
        }
        #endif
        return nil
    }

    #if compiler(>=6.3.2)
    @available(iOS 26.4, macOS 26.4, tvOS 26.4, watchOS 26.4, visionOS 26.4, *)
    static func makeSubscriptionPricingTerm(from terms: StoreKit.Product.SubscriptionInfo.PricingTerms) -> SubscriptionPricingTermsIOS {
        let offers = terms.subscriptionOffers.compactMap { offer in
            standardizedDiscountOfferTypeIOS(from: offer.type).map { type in
                makeStandardizedSubscriptionOffer(from: offer, type: type)
            }
        }
        return SubscriptionPricingTermsIOS(
            billingDisplayPrice: terms.billingDisplayPrice,
            billingPeriod: SubscriptionPeriodValueIOS(
                unit: terms.billingPeriod.unit.subscriptionPeriodIOS,
                value: terms.billingPeriod.value
            ),
            billingPlanType: billingPlanTypeIOS(from: terms.billingPlanType),
            billingPrice: NSDecimalNumber(decimal: terms.billingPrice).doubleValue,
            commitmentInfo: SubscriptionCommitmentInfoIOS(
                displayPrice: terms.commitmentInfo.displayPrice,
                period: SubscriptionPeriodValueIOS(
                    unit: terms.commitmentInfo.period.unit.subscriptionPeriodIOS,
                    value: terms.commitmentInfo.period.value
                ),
                price: NSDecimalNumber(decimal: terms.commitmentInfo.price).doubleValue
            ),
            subscriptionOffers: offers.isEmpty ? nil : offers
        )
    }
    #endif

    #if compiler(>=6.3.2)
    @available(iOS 26.4, macOS 26.4, tvOS 26.4, watchOS 26.4, visionOS 26.4, *)
    static func billingPlanTypeIOS(from type: StoreKit.Product.SubscriptionInfo.BillingPlanType) -> SubscriptionBillingPlanTypeIOS {
        if type == .monthly {
            return .monthly
        }
        if type == .upFront {
            return .upFront
        }
        return SubscriptionBillingPlanTypeIOS(rawValue: type.rawValue) ?? .unknown
    }
    #endif

    static func billingPlanTypeIOS(from transaction: StoreKit.Transaction) -> SubscriptionBillingPlanTypeIOS? {
        #if compiler(>=6.3.2)
        if #available(iOS 26.4, macOS 26.4, tvOS 26.4, watchOS 26.4, visionOS 26.4, *) {
            return transaction.billingPlanType.map { billingPlanTypeIOS(from: $0) }
        }
        #endif
        return nil
    }

    static func transactionCommitmentInfoIOS(from transaction: StoreKit.Transaction) -> TransactionCommitmentInfoIOS? {
        #if compiler(>=6.3.2)
        if #available(iOS 26.4, macOS 26.4, tvOS 26.4, watchOS 26.4, visionOS 26.4, *) {
            guard let commitment = transaction.commitmentInfo else { return nil }
            return TransactionCommitmentInfoIOS(
                billingPeriodNumber: intClamping(commitment.billingPeriodNumber),
                commitmentExpiresDate: commitment.expirationDate.milliseconds,
                commitmentPrice: NSDecimalNumber(decimal: commitment.price).doubleValue,
                totalBillingPeriods: intClamping(commitment.totalBillingPeriods)
            )
        }
        #endif
        return nil
    }

    static func intClamping(_ value: UInt64) -> Int {
        value > UInt64(Int.max) ? Int.max : Int(value)
    }

    /// Converts StoreKit subscription offers to standardized cross-platform SubscriptionOffer type.
    /// This is the new format that works across iOS and Android.
    static func makeStandardizedSubscriptionOffers(from subscription: StoreKit.Product.SubscriptionInfo) -> [SubscriptionOffer] {
        var offers: [SubscriptionOffer] = []

        // Add introductory offer if available
        if let intro = subscription.introductoryOffer {
            offers.append(makeStandardizedSubscriptionOffer(from: intro, type: .introductory))
        }

        // Add promotional offers
        for promo in subscription.promotionalOffers {
            offers.append(makeStandardizedSubscriptionOffer(from: promo, type: .promotional))
        }

        return offers
    }

    /// Converts a single StoreKit subscription offer to standardized SubscriptionOffer.
    static func makeStandardizedSubscriptionOffer(from offer: StoreKit.Product.SubscriptionOffer, type: DiscountOfferType) -> SubscriptionOffer {
        SubscriptionOffer(
            basePlanIdAndroid: nil,
            currency: nil,  // iOS doesn't provide currency at offer level
            displayPrice: offer.displayPrice,
            id: offer.id ?? "",
            keyIdentifierIOS: nil,  // Not available from product, needs server-side generation
            localizedPriceIOS: offer.displayPrice,
            nonceIOS: nil,  // Needs server-side generation
            numberOfPeriodsIOS: offer.periodCount,
            offerTagsAndroid: nil,
            offerTokenAndroid: nil,
            paymentMode: offer.paymentMode.standardizedPaymentMode,
            period: SubscriptionPeriod(
                unit: offer.period.unit.standardizedPeriodUnit,
                value: offer.period.value
            ),
            periodCount: offer.periodCount,
            price: NSDecimalNumber(decimal: offer.price).doubleValue,
            pricingPhasesAndroid: nil,
            signatureIOS: nil,  // Needs server-side generation
            timestampIOS: nil,
            type: type
        )
    }

    static func introductoryPriceAmount(from offer: StoreKit.Product.SubscriptionOffer?) -> String? {
        guard let price = offer?.price else { return nil }
        return String(NSDecimalNumber(decimal: price).doubleValue)
    }

    static func introductoryPeriods(from offer: StoreKit.Product.SubscriptionOffer?) -> String? {
        guard let offer = offer else { return nil }
        let normalized = normalizePeriod(offer.period)
        // Multiply by periodCount to get total periods
        // e.g., "$0.99/month for 3 months" = 3 periods (not 1)
        let totalPeriods = normalized.value * offer.periodCount
        return String(totalPeriods)
    }

    /// Normalize a subscription period to the largest possible unit
    /// e.g., 14 days -> 2 weeks, 7 days -> 1 week
    /// Note: Does not convert to months due to calendar month variance (28-31 days)
    static func normalizePeriod(_ period: StoreKit.Product.SubscriptionPeriod) -> (value: Int, unit: StoreKit.Product.SubscriptionPeriod.Unit) {
        let value = period.value
        let unit = period.unit

        switch unit {
        case .day:
            // Only convert to weeks or years (avoid month due to variable days)
            if value % 365 == 0 {
                return (value / 365, .year)
            } else if value % 7 == 0 {
                return (value / 7, .week)
            }
            return (value, .day)
        case .week:
            // Only convert to years (avoid month due to variable weeks per month)
            if value % 52 == 0 {
                return (value / 52, .year)
            }
            return (value, .week)
        case .month:
            if value % 12 == 0 {
                return (value / 12, .year)
            }
            return (value, .month)
        default:
            return (value, unit)
        }
    }

    static func productType(from type: StoreKit.Product.ProductType) -> ProductType {
        #if compiler(>=6.4)
        if #available(iOS 27.0, macOS 27.0, tvOS 27.0, watchOS 27.0, visionOS 27.0, *),
           type == .subscriptionBundle || type == .subscriptionSuite {
            return .subs
        }
        #endif

        switch type {
        case .autoRenewable, .nonRenewable:
            return .subs
        case .consumable, .nonConsumable:
            return .inApp
        default:
            return .inApp
        }
    }

    static func productTypeIOS(from type: StoreKit.Product.ProductType) -> ProductTypeIOS {
        #if compiler(>=6.4)
        if #available(iOS 27.0, macOS 27.0, tvOS 27.0, watchOS 27.0, visionOS 27.0, *) {
            if type == .subscriptionBundle {
                return .subscriptionBundle
            }
            if type == .subscriptionSuite {
                return .subscriptionSuite
            }
        }
        #endif

        switch type {
        case .consumable:
            return .consumable
        case .nonConsumable:
            return .nonConsumable
        case .autoRenewable:
            return .autoRenewableSubscription
        case .nonRenewable:
            return .nonRenewingSubscription
        default:
            return .consumable
        }
    }

    static func promotionalOffer(from offer: DiscountOfferInputIOS) -> StoreKit.Product.PurchaseOption? {
        guard let nonce = UUID(uuidString: offer.nonce) else {
            OpenIapLog.error("❌ Invalid nonce format: \(offer.nonce)")
            return nil
        }

        guard let signature = Data(base64Encoded: offer.signature) else {
            OpenIapLog.error("❌ Invalid signature format (must be base64); value omitted")
            return nil
        }

        let timestamp = Int(offer.timestamp)
        OpenIapLog.debug("✅ Creating promotional offer - ID: \(offer.identifier), KeyID: \(offer.keyIdentifier), Timestamp: \(timestamp)")

        return .promotionalOffer(
            offerID: offer.identifier,
            keyID: offer.keyIdentifier,
            nonce: nonce,
            signature: signature,
            timestamp: timestamp
        )
    }

    @available(iOS 17.2, macOS 14.2, tvOS 17.2, watchOS 10.2, *)
    static func makePurchaseOffer(from offer: StoreKit.Transaction.Offer?) -> PurchaseOfferIOS? {
        guard let offer else { return nil }

        // Map StoreKit paymentMode to our PaymentModeIOS enum
        let paymentModeString: String
        if let mode = offer.paymentMode {
            switch mode {
            case .freeTrial:
                paymentModeString = PaymentModeIOS.freeTrial.rawValue
            case .payAsYouGo:
                paymentModeString = PaymentModeIOS.payAsYouGo.rawValue
            case .payUpFront:
                paymentModeString = PaymentModeIOS.payUpFront.rawValue
            default:
                paymentModeString = PaymentModeIOS.empty.rawValue
            }
        } else {
            paymentModeString = PaymentModeIOS.empty.rawValue
        }

        let typeString = purchaseOfferTypeStringIOS(from: offer.type)

        return PurchaseOfferIOS(
            id: offer.id ?? "",
            paymentMode: paymentModeString,
            type: typeString
        )
    }

    static func ownershipTypeDescription(from ownership: StoreKit.Transaction.OwnershipType) -> String {
        #if compiler(>=6.4)
        if ownership == .assigned {
            return "assigned"
        }
        #endif

        switch ownership {
        case .purchased:
            return "purchased"
        case .familyShared:
            return "family_shared"  // Maintain backward compatibility
        default:
            return "purchased"  // Default to purchased for compatibility
        }
    }

    struct TransactionReason {
        let lowercased: String
        let string: String
        let uppercased: String
    }
    
    struct JSONTransactionReason: Codable {
        let transactionReason: String
    }

    static func transactionReasonDetails(from transaction: StoreKit.Transaction) -> TransactionReason {
        if let revocation = transaction.revocationReason {
            let reasonString = revocationReasonDescription(from: revocation)
            return TransactionReason(
                lowercased: reasonString,
                string: reasonString,
                uppercased: reasonString.uppercased()
            )
        }

        if transaction.isUpgraded {
            return TransactionReason(lowercased: "upgrade", string: "upgrade", uppercased: "UPGRADE")
        }

        // Try to infer renewal for iOS <17
        if let decodedReason = try? JSONDecoder().decode(JSONTransactionReason.self, from: transaction.jsonRepresentation),
            decodedReason.transactionReason == "RENEWAL" {
            return TransactionReason(lowercased: "renewal", string: "renewal", uppercased: "RENEWAL")
        }

        return TransactionReason(lowercased: "purchase", string: "purchase", uppercased: "PURCHASE")
    }

    static func revocationReasonDescription(
        from revocation: StoreKit.Transaction.RevocationReason
    ) -> String {
        #if compiler(>=6.4)
        if revocation == .upgradedToBundle {
            return "upgraded_to_bundle"
        }
        #endif

        switch revocation {
        case .developerIssue:
            return "developer_issue"
        case .other:
            return "other"
        default:
            return "unknown"
        }
    }

    static func revocationTypeIOS(from transaction: StoreKit.Transaction) -> String? {
        #if compiler(>=6.4)
        if #available(iOS 26.4, macOS 26.4, tvOS 26.4, watchOS 26.4, visionOS 26.4, *) {
            return transaction.revocationType?.rawValue
        }
        #endif
        return nil
    }

    // MARK: - Advanced Commerce Info (iOS 18.4+)

    static func extractAdvancedCommerceInfo(from transaction: StoreKit.Transaction) -> AdvancedCommerceInfoIOS? {
        #if compiler(>=6.1)
        if #available(iOS 18.4, macOS 15.4, tvOS 18.4, watchOS 11.4, visionOS 2.4, *) {
            guard let info = transaction.advancedCommerceInfo else { return nil }
            let items: [AdvancedCommerceItemIOS] = info.items.map { item in
                let details = AdvancedCommerceItemDetailsIOS(
                    jsonRepresentation: advancedCommerceDetailsJSON(from: item.details)
                )
                let refunds: [AdvancedCommerceRefundIOS]? = item.refunds?.map { refund in
                    AdvancedCommerceRefundIOS(
                        jsonRepresentation: advancedCommerceRefundJSON(from: refund)
                    )
                }
                return AdvancedCommerceItemIOS(
                    details: details,
                    refunds: refunds,
                    revocationDate: item.revocationDate?.milliseconds
                )
            }
            return AdvancedCommerceInfoIOS(
                description: info.description,
                displayName: info.displayName,
                estimatedTax: decimalString(info.estimatedTax),
                items: items,
                period: info.period.map {
                    SubscriptionPeriodValueIOS(
                        unit: $0.unit.subscriptionPeriodIOS,
                        value: $0.value
                    )
                },
                requestReferenceId: info.requestReferenceID,
                taxCode: info.taxCode,
                taxExclusivePrice: decimalString(info.taxExclusivePrice),
                taxRate: decimalString(info.taxRate)
            )
        }
        #endif
        return nil
    }

    static func decimalString(_ value: Decimal?) -> String? {
        guard let value else { return nil }
        return NSDecimalNumber(decimal: value).stringValue
    }

    #if compiler(>=6.1)
    @available(iOS 18.4, macOS 15.4, tvOS 18.4, watchOS 11.4, visionOS 2.4, *)
    static func advancedCommerceDetailsJSON(from details: StoreKit.Transaction.AdvancedCommerceInfo.Item.Details) -> String? {
        let offer = details.offer.map { offer in
            [
                "period": offer.period.iso8601,
                "periodCount": offer.periodCount,
                "price": decimalString(offer.price),
                "reason": offer.reason.rawValue,
            ] as [String: Any?]
        }
        let partners: [[String: Any?]]?
        #if compiler(>=6.4)
        if #available(iOS 27.0, macOS 27.0, tvOS 27.0, watchOS 27.0, visionOS 27.0, *) {
            partners = details.partners.map { partner in
                [
                    "id": partner.id,
                    "name": partner.name,
                ]
            }
        } else {
            partners = nil
        }
        #else
        partners = nil
        #endif

        return compactJSONString(from: [
            "description": details.description,
            "displayName": details.displayName,
            "offer": offer,
            "partners": partners,
            "price": decimalString(details.price),
            "sku": details.sku,
        ])
    }

    @available(iOS 18.4, macOS 15.4, tvOS 18.4, watchOS 11.4, visionOS 2.4, *)
    static func advancedCommerceRefundJSON(from refund: StoreKit.Transaction.AdvancedCommerceInfo.Refund) -> String? {
        compactJSONString(from: [
            "amount": decimalString(refund.amount),
            "date": refund.date.milliseconds,
            "reason": refund.reason.rawValue,
            "type": refund.type.rawValue,
        ])
    }
    #endif

    static func compactJSONString(from object: [String: Any?]) -> String? {
        let compacted = compactJSONDictionary(object)
        guard JSONSerialization.isValidJSONObject(compacted),
              let data = try? JSONSerialization.data(withJSONObject: compacted, options: [.sortedKeys]) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    static func compactJSONDictionary(_ object: [String: Any?]) -> [String: Any] {
        object.reduce(into: [String: Any]()) { result, entry in
            guard let value = entry.value else { return }
            if let dictionary = value as? [String: Any?] {
                result[entry.key] = compactJSONDictionary(dictionary)
            } else if let array = value as? [[String: Any?]] {
                result[entry.key] = array.map { compactJSONDictionary($0) }
            } else {
                result[entry.key] = value
            }
        }
    }
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
private extension StoreKit.Product.SubscriptionOffer.PaymentMode {
    var paymentModeIOS: PaymentModeIOS {
        switch self {
        case .freeTrial: return .freeTrial
        case .payAsYouGo: return .payAsYouGo
        case .payUpFront: return .payUpFront
        default: return .empty
        }
    }

    /// Converts to standardized cross-platform PaymentMode enum.
    var standardizedPaymentMode: PaymentMode {
        switch self {
        case .freeTrial: return .freeTrial
        case .payAsYouGo: return .payAsYouGo
        case .payUpFront: return .payUpFront
        default: return .unknown
        }
    }
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
private extension StoreKit.Product.SubscriptionPeriod.Unit {
    var subscriptionPeriodIOS: SubscriptionPeriodIOS {
        switch self {
        case .day: return .day
        case .week: return .week
        case .month: return .month
        case .year: return .year
        default: return .empty
        }
    }

    /// Converts to standardized cross-platform SubscriptionPeriodUnit enum.
    var standardizedPeriodUnit: SubscriptionPeriodUnit {
        switch self {
        case .day: return .day
        case .week: return .week
        case .month: return .month
        case .year: return .year
        default: return .unknown
        }
    }
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
private extension StoreKit.Product.SubscriptionPeriod {
    var iso8601: String { "P\(value)\(unit.isoComponent)" }
}

@available(iOS 15.0, macOS 14.0, tvOS 16.0, watchOS 8.0, *)
private extension StoreKit.Product.SubscriptionPeriod.Unit {
    var isoComponent: String {
        switch self {
        case .day: return "D"
        case .week: return "W"
        case .month: return "M"
        case .year: return "Y"
        default: return "D"
        }
    }
}

extension Date {
    var milliseconds: Double { timeIntervalSince1970 * 1000 }
}
