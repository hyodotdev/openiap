package io.github.hyochan.kmpiap.dsl

import io.github.hyochan.kmpiap.openiap.AndroidSubscriptionOfferInput
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.ProductType
import io.github.hyochan.kmpiap.openiap.DeveloperBillingOptionParamsAndroid
import io.github.hyochan.kmpiap.openiap.RequestPurchaseAndroidProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseIosProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import io.github.hyochan.kmpiap.openiap.RequestPurchasePropsByPlatforms
import io.github.hyochan.kmpiap.openiap.RequestSubscriptionAndroidProps
import io.github.hyochan.kmpiap.openiap.RequestSubscriptionIosProps
import io.github.hyochan.kmpiap.openiap.RequestSubscriptionPropsByPlatforms
import io.github.hyochan.kmpiap.openiap.DiscountOfferInputIOS
import io.github.hyochan.kmpiap.openiap.PromotionalOfferJWSInputIOS
import io.github.hyochan.kmpiap.openiap.SubscriptionBillingPlanTypeIOS
import io.github.hyochan.kmpiap.openiap.SubscriptionProductReplacementParamsAndroid
import io.github.hyochan.kmpiap.openiap.WinBackOfferInputIOS

/**
 * DSL marker for type-safe builders
 */
@DslMarker
annotation class IapDsl

/**
 * DSL builder for products request
 */
@IapDsl
class ProductsRequestBuilder {
    private var _skus: List<String> = emptyList()
    private var _type: ProductQueryType? = null
    
    var skus: List<String>
        get() = _skus
        set(value) { _skus = value }
    
    var type: ProductQueryType
        get() = _type ?: throw IllegalStateException("Product type must be specified")
        set(value) { _type = value }

    internal fun build(): Pair<List<String>, ProductQueryType> {
        if (_skus.isEmpty()) {
            throw IllegalArgumentException("SKUs list cannot be empty")
        }
        if (_type == null) {
            throw IllegalArgumentException("Product type must be specified")
        }
        return Pair(_skus, _type!!)
    }
}

/**
 * DSL builder for purchase request
 */
@IapDsl
class PurchaseRequestBuilder {
    var type: ProductType = ProductType.InApp

    private var iosOptions: (IosOptionsBuilder.() -> Unit)? = null
    private var androidOptions: (AndroidOptionsBuilder.() -> Unit)? = null

    /**
     * Configure App Store purchase options.
     */
    fun apple(block: IosOptionsBuilder.() -> Unit) {
        iosOptions = block
    }

    /**
     * Configure Google Play, Amazon Appstore, or Meta Horizon purchase options.
     */
    fun google(block: AndroidOptionsBuilder.() -> Unit) {
        androidOptions = block
    }

    internal fun build(): RequestPurchaseProps {
        val iosBuilt = iosOptions?.let { IosOptionsBuilder().apply(it).build() }
        val androidBuilt = androidOptions?.let { AndroidOptionsBuilder().apply(it).build() }

        val queryType = when (type) {
            ProductType.InApp -> ProductQueryType.InApp
            ProductType.Subs -> ProductQueryType.Subs
        }

        val request = when (queryType) {
            ProductQueryType.InApp -> {
                val purchasePlatforms = RequestPurchasePropsByPlatforms(
                    apple = iosBuilt?.purchase,
                    google = androidBuilt?.purchase
                )

                if (purchasePlatforms.apple == null && purchasePlatforms.google == null) {
                    throw IllegalArgumentException("At least one platform must declare purchase options")
                }

                RequestPurchaseProps.Request.Purchase(purchasePlatforms)
            }
            ProductQueryType.Subs -> {
                val subscriptionPlatforms = RequestSubscriptionPropsByPlatforms(
                    apple = iosBuilt?.subscription,
                    google = androidBuilt?.subscription
                )

                if (subscriptionPlatforms.apple == null && subscriptionPlatforms.google == null) {
                    throw IllegalArgumentException("At least one platform must declare subscription options")
                }

                RequestPurchaseProps.Request.Subscription(subscriptionPlatforms)
            }
            ProductQueryType.All -> throw IllegalArgumentException("Product type ALL is not supported for purchases")
        }

        return RequestPurchaseProps(
            request = request,
            type = queryType
        )
    }
}

/**
 * iOS options builder for purchase request
 */
@IapDsl
class IosOptionsBuilder {
    var sku: String? = null
    var quantity: Int? = null
    var appAccountToken: String? = null
    var andDangerouslyFinishTransactionAutomatically: Boolean? = null
    var withOffer: DiscountOfferInputIOS? = null
    /**
     * Attribution tracking data for StoreKit 2's Product.PurchaseOption.custom API.
     * Added in openiap-apple v1.3.7
     */
    var advancedCommerceData: String? = null
    /**
     * Billing plan for annual subscriptions with monthly commitment (iOS 26.4+).
     */
    var billingPlanType: SubscriptionBillingPlanTypeIOS? = null
    /**
     * Compact JWS string for overriding introductory offer eligibility
     * (iOS 15+, WWDC 2025). When null, the system determines eligibility.
     */
    var compactJWS: String? = null
    /**
     * JWS promotional offer (iOS 15+, WWDC 2025).
     * New signature format using compact JWS string for promotional offers.
     * Back-deployed to iOS 15. Requires Xcode 16.4+ to compile.
     * Added in openiap-gql v1.3.13 / openiap-apple v1.3.11
     */
    var promotionalOfferJWS: PromotionalOfferJWSInputIOS? = null
    /**
     * Win-back offer to apply (iOS 18+).
     * Used to re-engage churned subscribers with a discount or free trial.
     * The offer is available when the customer is eligible.
     * Added in openiap-gql v1.3.13 / openiap-apple v1.3.11
     */
    var winBackOffer: WinBackOfferInputIOS? = null

    internal fun build(): BuiltIosOptions? {
        val skuValue = sku ?: return null
        val purchase = RequestPurchaseIosProps(
            sku = skuValue,
            quantity = quantity,
            appAccountToken = appAccountToken,
            andDangerouslyFinishTransactionAutomatically = andDangerouslyFinishTransactionAutomatically,
            withOffer = withOffer,
            advancedCommerceData = advancedCommerceData
        )
        val subscription = RequestSubscriptionIosProps(
            sku = skuValue,
            quantity = quantity,
            appAccountToken = appAccountToken,
            andDangerouslyFinishTransactionAutomatically = andDangerouslyFinishTransactionAutomatically,
            withOffer = withOffer,
            advancedCommerceData = advancedCommerceData,
            billingPlanType = billingPlanType,
            compactJWS = compactJWS,
            promotionalOfferJWS = promotionalOfferJWS,
            winBackOffer = winBackOffer
        )
        return BuiltIosOptions(purchase = purchase, subscription = subscription)
    }
}

/**
 * Android options builder for purchase request
 */
@IapDsl
class AndroidOptionsBuilder {
    var skus: List<String> = emptyList()
    var obfuscatedAccountId: String? = null
    var obfuscatedProfileId: String? = null
    var isOfferPersonalized: Boolean? = null
    var purchaseToken: String? = null
    /** Original external transaction ID for a developer-billed subscription replacement (9.1.0+). */
    var originalExternalTransactionId: String? = null
    var subscriptionOffers: List<AndroidSubscriptionOfferInput> = emptyList()
    var subscriptionProductReplacementParams: SubscriptionProductReplacementParamsAndroid? = null
    /**
     * Offer token for one-time purchase discounts (Android 8.0+).
     * Pass the offerToken from discountOffers
     * to apply a discount offer to the purchase.
     */
    var offerToken: String? = null
    /**
     * Developer billing option for External Payments (8.3.0+) or Billing Choice (9.1.0+).
     */
    var developerBillingOption: DeveloperBillingOptionParamsAndroid? = null

    internal fun build(): BuiltAndroidOptions? {
        if (skus.isEmpty()) return null

        val purchase = RequestPurchaseAndroidProps(
            skus = skus,
            obfuscatedAccountId = obfuscatedAccountId,
            obfuscatedProfileId = obfuscatedProfileId,
            isOfferPersonalized = isOfferPersonalized,
            offerToken = offerToken,
            developerBillingOption = developerBillingOption
        )

        val subscription = RequestSubscriptionAndroidProps(
            skus = skus,
            obfuscatedAccountId = obfuscatedAccountId,
            obfuscatedProfileId = obfuscatedProfileId,
            isOfferPersonalized = isOfferPersonalized,
            purchaseToken = purchaseToken,
            originalExternalTransactionId = originalExternalTransactionId,
            subscriptionOffers = if (subscriptionOffers.isNotEmpty()) subscriptionOffers else null,
            subscriptionProductReplacementParams = subscriptionProductReplacementParams,
            developerBillingOption = developerBillingOption
        )

        return BuiltAndroidOptions(purchase = purchase, subscription = subscription)
    }
}

internal data class BuiltIosOptions(
    val purchase: RequestPurchaseIosProps?,
    val subscription: RequestSubscriptionIosProps?
)

internal data class BuiltAndroidOptions(
    val purchase: RequestPurchaseAndroidProps?,
    val subscription: RequestSubscriptionAndroidProps?
)
