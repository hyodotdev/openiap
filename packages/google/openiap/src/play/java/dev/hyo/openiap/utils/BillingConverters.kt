package dev.hyo.openiap.utils

import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.IapPlatform
import dev.hyo.openiap.PricingPhaseAndroid
import dev.hyo.openiap.PricingPhasesAndroid
import dev.hyo.openiap.Product
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductAndroidOneTimePurchaseOfferDetail
import dev.hyo.openiap.ProductSubscriptionAndroid
import dev.hyo.openiap.ProductSubscriptionAndroidOfferDetails
import dev.hyo.openiap.ProductType
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseInput
import dev.hyo.openiap.PurchaseState
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase as BillingPurchase

internal object BillingConverters {
    fun ProductDetails.toInAppProduct(): ProductAndroid {
        val offer = oneTimePurchaseOfferDetails
        val displayPrice = offer?.formattedPrice.orEmpty()
        val currency = offer?.priceCurrencyCode.orEmpty()
        val priceAmountMicros = offer?.priceAmountMicros ?: 0L

        return ProductAndroid(
            currency = currency,
            debugDescription = description,
            description = description,
            displayName = name,
            displayPrice = displayPrice,
            id = productId,
            nameAndroid = name,
            oneTimePurchaseOfferDetailsAndroid = offer?.let {
                ProductAndroidOneTimePurchaseOfferDetail(
                    formattedPrice = it.formattedPrice,
                    priceAmountMicros = it.priceAmountMicros.toString(),
                    priceCurrencyCode = it.priceCurrencyCode
                )
            },
            platform = IapPlatform.Android,
            price = priceAmountMicros.toDouble() / 1_000_000.0,
            subscriptionOfferDetailsAndroid = null,
            title = title,
            type = ProductType.InApp
        )
    }

    fun ProductDetails.toSubscriptionProduct(): ProductSubscriptionAndroid {
        val offers = subscriptionOfferDetails.orEmpty()
        val firstPhase = offers.firstOrNull()?.pricingPhases?.pricingPhaseList?.firstOrNull()
        val displayPrice = firstPhase?.formattedPrice.orEmpty()
        val currency = firstPhase?.priceCurrencyCode.orEmpty()
        val pricingDetails = offers.map { offer ->
            ProductSubscriptionAndroidOfferDetails(
                basePlanId = offer.basePlanId,
                offerId = offer.offerId,
                offerTags = offer.offerTags,
                offerToken = offer.offerToken,
                pricingPhases = PricingPhasesAndroid(
                    pricingPhaseList = offer.pricingPhases.pricingPhaseList.map { phase ->
                        PricingPhaseAndroid(
                            billingCycleCount = phase.billingCycleCount,
                            billingPeriod = phase.billingPeriod,
                            formattedPrice = phase.formattedPrice,
                            priceAmountMicros = phase.priceAmountMicros.toString(),
                            priceCurrencyCode = phase.priceCurrencyCode,
                            recurrenceMode = phase.recurrenceMode
                        )
                    }
                )
            )
        }

        return ProductSubscriptionAndroid(
            currency = currency,
            debugDescription = description,
            description = description,
            displayName = name,
            displayPrice = displayPrice,
            id = productId,
            nameAndroid = name,
            oneTimePurchaseOfferDetailsAndroid = oneTimePurchaseOfferDetails?.let {
                ProductAndroidOneTimePurchaseOfferDetail(
                    formattedPrice = it.formattedPrice,
                    priceAmountMicros = it.priceAmountMicros.toString(),
                    priceCurrencyCode = it.priceCurrencyCode
                )
            },
            platform = IapPlatform.Android,
            price = firstPhase?.priceAmountMicros?.toDouble()?.div(1_000_000.0),
            subscriptionOfferDetailsAndroid = pricingDetails,
            title = title,
            type = ProductType.Subs
        )
    }

    fun BillingPurchase.toPurchase(productType: String, basePlanId: String? = null): PurchaseAndroid {
        val state = PurchaseState.fromBillingState(purchaseState)
        return PurchaseAndroid(
            autoRenewingAndroid = isAutoRenewing,
            currentPlanId = basePlanId,
            dataAndroid = originalJson,
            developerPayloadAndroid = developerPayload,
            id = orderId ?: purchaseToken,
            ids = products,
            isAcknowledgedAndroid = isAcknowledged,
            isAutoRenewing = isAutoRenewing,
            obfuscatedAccountIdAndroid = accountIdentifiers?.obfuscatedAccountId,
            obfuscatedProfileIdAndroid = accountIdentifiers?.obfuscatedProfileId,
            packageNameAndroid = packageName,
            platform = IapPlatform.Android,
            productId = products.firstOrNull().orEmpty(),
            purchaseState = state,
            purchaseToken = purchaseToken,
            quantity = quantity,
            signatureAndroid = signature,
            transactionId = orderId,
            transactionDate = purchaseTime.toDouble()
        )
    }

}

fun PurchaseState.Companion.fromBillingState(state: Int): PurchaseState = when (state) {
    BillingPurchase.PurchaseState.PURCHASED -> PurchaseState.Purchased
    BillingPurchase.PurchaseState.PENDING -> PurchaseState.Pending
    BillingPurchase.PurchaseState.UNSPECIFIED_STATE -> PurchaseState.Unknown
    else -> PurchaseState.Unknown
}

fun PurchaseAndroid.toActiveSubscription(): ActiveSubscription = ActiveSubscription(
    autoRenewingAndroid = autoRenewingAndroid,
    basePlanIdAndroid = currentPlanId,
    currentPlanId = currentPlanId,
    isActive = true,
    productId = productId,
    purchaseToken = purchaseToken,
    purchaseTokenAndroid = purchaseToken,
    transactionDate = transactionDate,
    transactionId = id
)

// toProduct() and toPurchaseInput() moved to main/utils/ProductExtensions.kt to be shared across flavors
