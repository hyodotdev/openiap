package dev.hyo.openiap.utils

import com.meta.horizon.billingclient.api.ProductDetails as HorizonProductDetails
import com.meta.horizon.billingclient.api.Purchase as HorizonPurchase
import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.DiscountOfferType
import dev.hyo.openiap.IapPlatform
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.PaymentMode
import dev.hyo.openiap.PricingPhaseAndroid
import dev.hyo.openiap.PricingPhasesAndroid
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductStatusAndroid
import dev.hyo.openiap.ProductSubscriptionAndroid
import dev.hyo.openiap.ProductType
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseState
import dev.hyo.openiap.SubscriptionOffer
import dev.hyo.openiap.SubscriptionPeriod
import dev.hyo.openiap.SubscriptionPeriodUnit

private val billingPeriodRegex = Regex("""^P(\d+)([DWMY])$""")

internal object HorizonBillingConverters {

    fun HorizonProductDetails.toInAppProduct(): ProductAndroid {
        val offer = oneTimePurchaseOfferDetails
        val displayPrice = offer?.formattedPrice.orEmpty()
        val currency = offer?.priceCurrencyCode.orEmpty()
        val priceAmountMicros = offer?.priceAmountMicros ?: 0L

        return ProductAndroid(
            currency = currency,
            debugDescription = description,
            description = description,
            discountOffers = null,  // Horizon doesn't support discount offers yet
            displayName = name,
            displayPrice = displayPrice,
            id = productId,
            nameAndroid = name,
            platform = IapPlatform.Android,
            price = priceAmountMicros.toDouble() / 1_000_000.0,
            productStatusAndroid = ProductStatusAndroid.Ok,
            subscriptionOffers = null,
            title = title,
            type = ProductType.InApp
        )
    }

    fun HorizonProductDetails.toSubscriptionProduct(): ProductSubscriptionAndroid {
        val offers = subscriptionOfferDetails.orEmpty()
        val firstPhase = offers.firstOrNull()?.pricingPhases?.pricingPhaseList?.firstOrNull()
        val displayPrice = firstPhase?.formattedPrice.orEmpty()
        val currency = firstPhase?.priceCurrencyCode.orEmpty()

        val standardizedOffers = offers.map { offer ->
            val phases = PricingPhasesAndroid(
                pricingPhaseList = offer.pricingPhases.pricingPhaseList.map { phase ->
                    PricingPhaseAndroid(
                        billingCycleCount = phase.billingCycleCount,
                        billingPeriod = phase.billingPeriod,
                        formattedPrice = phase.formattedPrice,
                        priceAmountMicros = phase.priceAmountMicros.toString(),
                        priceCurrencyCode = phase.priceCurrencyCode,
                        recurrenceMode = phase.recurrenceMode,
                    )
                }
            )
            val phase = phases.pricingPhaseList.firstOrNull()
            SubscriptionOffer(
                basePlanIdAndroid = offer.basePlanId,
                currency = phase?.priceCurrencyCode,
                displayPrice = phase?.formattedPrice.orEmpty(),
                id = offer.offerId ?: offer.basePlanId,
                offerTagsAndroid = offer.offerTags,
                offerTokenAndroid = offer.offerToken,
                paymentMode = phase?.let {
                    when {
                        it.priceAmountMicros == "0" -> PaymentMode.FreeTrial
                        it.recurrenceMode == 3 -> PaymentMode.PayUpFront
                        else -> PaymentMode.PayAsYouGo
                    }
                },
                period = phase?.billingPeriod?.let { billingPeriod ->
                    billingPeriodRegex.matchEntire(billingPeriod)?.let { match ->
                        val unit = when (match.groupValues[2]) {
                            "D" -> SubscriptionPeriodUnit.Day
                            "W" -> SubscriptionPeriodUnit.Week
                            "M" -> SubscriptionPeriodUnit.Month
                            "Y" -> SubscriptionPeriodUnit.Year
                            else -> SubscriptionPeriodUnit.Unknown
                        }
                        SubscriptionPeriod(unit = unit, value = match.groupValues[1].toInt())
                    }
                },
                periodCount = phase?.billingCycleCount,
                price = phase?.priceAmountMicros?.toDoubleOrNull()?.div(1_000_000.0) ?: 0.0,
                pricingPhasesAndroid = phases,
                type = if (offer.offerId == null) {
                    DiscountOfferType.Introductory
                } else {
                    DiscountOfferType.Promotional
                },
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
            platform = IapPlatform.Android,
            price = firstPhase?.priceAmountMicros?.toDouble()?.div(1_000_000.0),
            productStatusAndroid = ProductStatusAndroid.Ok,
            subscriptionOffers = standardizedOffers,
            title = title,
            type = ProductType.Subs
        )
    }

    fun HorizonPurchase.toPurchase(basePlanId: String? = null): PurchaseAndroid {
        val token = purchaseToken
        val productsList = products ?: emptyList()
        val state = PurchaseState.fromHorizonState(getPurchaseState())

        return PurchaseAndroid(
            autoRenewingAndroid = isAutoRenewing(),
            currentPlanId = basePlanId,
            dataAndroid = originalJson,
            developerPayloadAndroid = developerPayload,
            id = orderId ?: token,
            ids = productsList,
            isAcknowledgedAndroid = isAcknowledged(),
            isAutoRenewing = isAutoRenewing(),
            obfuscatedAccountIdAndroid = null,
            obfuscatedProfileIdAndroid = null,
            packageNameAndroid = packageName,
            productId = productsList.firstOrNull().orEmpty(),
            purchaseState = state,
            purchaseToken = token,
            quantity = quantity ?: 1,
            signatureAndroid = signature,
            store = IapStore.Horizon,
            transactionDate = (purchaseTime ?: 0L).toDouble(),
            transactionId = orderId ?: token
        )
    }

    fun HorizonPurchase.toActiveSubscription(): ActiveSubscription = ActiveSubscription(
        autoRenewingAndroid = isAutoRenewing(),
        basePlanIdAndroid = null,
        currentPlanId = null,
        isActive = true,
        productId = products?.firstOrNull().orEmpty(),
        purchaseToken = purchaseToken,
        purchaseTokenAndroid = purchaseToken,
        transactionDate = (purchaseTime ?: 0L).toDouble(),
        transactionId = orderId ?: purchaseToken
    )

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
}

/**
 * Maps Horizon Purchase state to internal PurchaseState enum.
 * Horizon SDK implements Google Play Billing compatibility layer,
 * so states match the Play Billing Library states.
 */
fun PurchaseState.Companion.fromHorizonState(state: Int): PurchaseState = when (state) {
    com.meta.horizon.billingclient.api.Purchase.PurchaseState.PURCHASED -> PurchaseState.Purchased
    com.meta.horizon.billingclient.api.Purchase.PurchaseState.PENDING -> PurchaseState.Pending
    com.meta.horizon.billingclient.api.Purchase.PurchaseState.UNSPECIFIED_STATE -> PurchaseState.Unknown
    else -> PurchaseState.Unknown
}
