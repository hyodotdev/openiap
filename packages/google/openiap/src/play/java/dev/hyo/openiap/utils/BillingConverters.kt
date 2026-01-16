package dev.hyo.openiap.utils

import dev.hyo.openiap.ActiveSubscription
import dev.hyo.openiap.DiscountAmountAndroid
import dev.hyo.openiap.DiscountDisplayInfoAndroid
import dev.hyo.openiap.DiscountOffer
import dev.hyo.openiap.DiscountOfferType
import dev.hyo.openiap.IapPlatform
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.LimitedQuantityInfoAndroid
import dev.hyo.openiap.PaymentMode
import dev.hyo.openiap.PricingPhaseAndroid
import dev.hyo.openiap.PricingPhasesAndroid
import dev.hyo.openiap.Product
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.PreorderDetailsAndroid
import dev.hyo.openiap.ProductAndroidOneTimePurchaseOfferDetail
import dev.hyo.openiap.ProductSubscriptionAndroid
import dev.hyo.openiap.ProductSubscriptionAndroidOfferDetails
import dev.hyo.openiap.ProductType
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseInput
import dev.hyo.openiap.PurchaseState
import dev.hyo.openiap.RentalDetailsAndroid
import dev.hyo.openiap.SubscriptionOffer
import dev.hyo.openiap.SubscriptionPeriod
import dev.hyo.openiap.SubscriptionPeriodUnit
import dev.hyo.openiap.ValidTimeWindowAndroid
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase as BillingPurchase

internal object BillingConverters {
    /**
     * Converts a ProductDetails.OneTimePurchaseOfferDetails to ProductAndroidOneTimePurchaseOfferDetail
     * This includes all discount-related fields available in Billing Library 7.0+
     */
    private fun ProductDetails.OneTimePurchaseOfferDetails.toOfferDetail(): ProductAndroidOneTimePurchaseOfferDetail {
        // Extract discount display info if available
        val discountInfo = discountDisplayInfo?.let { info ->
            DiscountDisplayInfoAndroid(
                percentageDiscount = runCatching { info.percentageDiscount }.getOrNull(),
                discountAmount = runCatching {
                    info.discountAmount?.let { amount ->
                        DiscountAmountAndroid(
                            discountAmountMicros = amount.discountAmountMicros.toString(),
                            formattedDiscountAmount = amount.formattedDiscountAmount
                        )
                    }
                }.getOrNull()
            )
        }

        // Extract valid time window if available
        val timeWindow = validTimeWindow?.let { window ->
            ValidTimeWindowAndroid(
                startTimeMillis = window.startTimeMillis.toString(),
                endTimeMillis = window.endTimeMillis.toString()
            )
        }

        // Extract limited quantity info if available
        val quantityInfo = limitedQuantityInfo?.let { info ->
            LimitedQuantityInfoAndroid(
                maximumQuantity = info.maximumQuantity,
                remainingQuantity = info.remainingQuantity
            )
        }

        // Extract preorder details if available (Billing Library 8.1.0+)
        val preorder = runCatching { preorderDetails }?.getOrNull()?.let { details ->
            PreorderDetailsAndroid(
                preorderPresaleEndTimeMillis = details.preorderPresaleEndTimeMillis.toString(),
                preorderReleaseTimeMillis = details.preorderReleaseTimeMillis.toString()
            )
        }

        // Extract rental details if available (Billing Library 7.0+)
        val rental = runCatching { rentalDetails }?.getOrNull()?.let { details ->
            RentalDetailsAndroid(
                rentalPeriod = details.rentalPeriod,
                rentalExpirationPeriod = runCatching { details.rentalExpirationPeriod }.getOrNull()
            )
        }

        return ProductAndroidOneTimePurchaseOfferDetail(
            offerId = runCatching { offerId }.getOrNull(),
            offerToken = offerToken ?: "",
            offerTags = runCatching { offerTags.orEmpty() }.getOrElse { emptyList() },
            formattedPrice = formattedPrice,
            priceCurrencyCode = priceCurrencyCode,
            priceAmountMicros = priceAmountMicros.toString(),
            fullPriceMicros = runCatching { fullPriceMicros?.toString() }.getOrNull(),
            discountDisplayInfo = discountInfo,
            validTimeWindow = timeWindow,
            limitedQuantityInfo = quantityInfo,
            preorderDetailsAndroid = preorder,
            rentalDetailsAndroid = rental
        )
    }

    /**
     * Converts a ProductDetails.OneTimePurchaseOfferDetails to standardized DiscountOffer.
     * This is the new cross-platform type for one-time product discounts.
     */
    private fun ProductDetails.OneTimePurchaseOfferDetails.toDiscountOffer(): DiscountOffer {
        val discountInfo = discountDisplayInfo

        return DiscountOffer(
            id = runCatching { offerId }.getOrNull(),
            displayPrice = formattedPrice,
            price = priceAmountMicros.toDouble() / 1_000_000.0,
            currency = priceCurrencyCode,
            type = DiscountOfferType.OneTime,
            offerTokenAndroid = offerToken,
            offerTagsAndroid = runCatching { offerTags.orEmpty() }.getOrElse { emptyList() },
            fullPriceMicrosAndroid = runCatching { fullPriceMicros?.toString() }.getOrNull(),
            percentageDiscountAndroid = runCatching { discountInfo?.percentageDiscount }.getOrNull(),
            discountAmountMicrosAndroid = runCatching { discountInfo?.discountAmount?.discountAmountMicros?.toString() }.getOrNull(),
            formattedDiscountAmountAndroid = runCatching { discountInfo?.discountAmount?.formattedDiscountAmount }.getOrNull(),
            validTimeWindowAndroid = validTimeWindow?.let { window ->
                ValidTimeWindowAndroid(
                    startTimeMillis = window.startTimeMillis.toString(),
                    endTimeMillis = window.endTimeMillis.toString()
                )
            },
            limitedQuantityInfoAndroid = limitedQuantityInfo?.let { info ->
                LimitedQuantityInfoAndroid(
                    maximumQuantity = info.maximumQuantity,
                    remainingQuantity = info.remainingQuantity
                )
            },
            preorderDetailsAndroid = runCatching { preorderDetails }?.getOrNull()?.let { details ->
                PreorderDetailsAndroid(
                    preorderPresaleEndTimeMillis = details.preorderPresaleEndTimeMillis.toString(),
                    preorderReleaseTimeMillis = details.preorderReleaseTimeMillis.toString()
                )
            },
            rentalDetailsAndroid = runCatching { rentalDetails }?.getOrNull()?.let { details ->
                RentalDetailsAndroid(
                    rentalPeriod = details.rentalPeriod,
                    rentalExpirationPeriod = runCatching { details.rentalExpirationPeriod }.getOrNull()
                )
            }
        )
    }

    /**
     * Parses ISO 8601 duration format (e.g., "P1W", "P1M", "P1Y") to SubscriptionPeriod.
     */
    private fun parseBillingPeriod(billingPeriod: String): SubscriptionPeriod? {
        if (billingPeriod.isEmpty()) return null

        val regex = Regex("P(\\d+)([DWMY])")
        val match = regex.find(billingPeriod) ?: return null

        val value = match.groupValues[1].toIntOrNull() ?: return null
        val unit = when (match.groupValues[2]) {
            "D" -> SubscriptionPeriodUnit.Day
            "W" -> SubscriptionPeriodUnit.Week
            "M" -> SubscriptionPeriodUnit.Month
            "Y" -> SubscriptionPeriodUnit.Year
            else -> SubscriptionPeriodUnit.Unknown
        }

        return SubscriptionPeriod(unit = unit, value = value)
    }

    /**
     * Determines PaymentMode from recurrenceMode and price.
     * recurrenceMode: 1 = INFINITE_RECURRING, 2 = FINITE_RECURRING, 3 = NON_RECURRING
     */
    private fun determinePaymentMode(recurrenceMode: Int, priceAmountMicros: Long): PaymentMode {
        return when {
            priceAmountMicros == 0L -> PaymentMode.FreeTrial
            recurrenceMode == 3 -> PaymentMode.PayUpFront
            recurrenceMode == 2 -> PaymentMode.PayAsYouGo
            recurrenceMode == 1 -> PaymentMode.PayAsYouGo
            else -> PaymentMode.Unknown
        }
    }

    /**
     * Converts a ProductDetails.SubscriptionOfferDetails to standardized SubscriptionOffer.
     * This is the new cross-platform type for subscription offers.
     */
    private fun ProductDetails.SubscriptionOfferDetails.toSubscriptionOffer(): SubscriptionOffer {
        val firstPhase = pricingPhases.pricingPhaseList.firstOrNull()
        val displayPrice = firstPhase?.formattedPrice.orEmpty()
        val currency = firstPhase?.priceCurrencyCode.orEmpty()
        val price = firstPhase?.priceAmountMicros?.toDouble()?.div(1_000_000.0) ?: 0.0

        val period = firstPhase?.billingPeriod?.let { parseBillingPeriod(it) }
        val paymentMode = firstPhase?.let {
            determinePaymentMode(it.recurrenceMode, it.priceAmountMicros)
        }

        val offerType = when {
            offerId == null && firstPhase?.priceAmountMicros == 0L -> DiscountOfferType.Introductory
            offerId != null -> DiscountOfferType.Promotional
            else -> DiscountOfferType.Introductory
        }

        return SubscriptionOffer(
            id = offerId ?: basePlanId,
            displayPrice = displayPrice,
            price = price,
            currency = currency,
            type = offerType,
            period = period,
            periodCount = firstPhase?.billingCycleCount,
            paymentMode = paymentMode,
            basePlanIdAndroid = basePlanId,
            offerTokenAndroid = offerToken,
            offerTagsAndroid = offerTags,
            pricingPhasesAndroid = PricingPhasesAndroid(
                pricingPhaseList = pricingPhases.pricingPhaseList.map { phase ->
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

    fun ProductDetails.toInAppProduct(): ProductAndroid {
        // Get all offers using getOneTimePurchaseOfferDetailsList() for discount support
        val allOffers = runCatching { oneTimePurchaseOfferDetailsList }.getOrNull().orEmpty()

        // Fall back to legacy oneTimePurchaseOfferDetails if list is empty
        val offer = oneTimePurchaseOfferDetails
        val displayPrice = offer?.formattedPrice.orEmpty()
        val currency = offer?.priceCurrencyCode.orEmpty()
        val priceAmountMicros = offer?.priceAmountMicros ?: 0L

        // Convert all offers to the list format (deprecated)
        val offerDetailsList = if (allOffers.isNotEmpty()) {
            allOffers.map { it.toOfferDetail() }
        } else {
            // Fall back to legacy single offer if list is empty
            offer?.let { listOf(it.toOfferDetail()) }
        }

        // Convert to standardized DiscountOffer (new cross-platform type)
        val discountOffers = if (allOffers.isNotEmpty()) {
            allOffers.map { it.toDiscountOffer() }
        } else {
            offer?.let { listOf(it.toDiscountOffer()) }
        }

        return ProductAndroid(
            currency = currency,
            debugDescription = description,
            description = description,
            discountOffers = discountOffers,
            displayName = name,
            displayPrice = displayPrice,
            id = productId,
            nameAndroid = name,
            oneTimePurchaseOfferDetailsAndroid = offerDetailsList,
            platform = IapPlatform.Android,
            price = priceAmountMicros.toDouble() / 1_000_000.0,
            subscriptionOfferDetailsAndroid = null,
            subscriptionOffers = null,
            title = title,
            type = ProductType.InApp
        )
    }

    fun ProductDetails.toSubscriptionProduct(): ProductSubscriptionAndroid {
        val offers = subscriptionOfferDetails.orEmpty()
        val firstPhase = offers.firstOrNull()?.pricingPhases?.pricingPhaseList?.firstOrNull()
        val displayPrice = firstPhase?.formattedPrice.orEmpty()
        val currency = firstPhase?.priceCurrencyCode.orEmpty()

        // Convert to deprecated format (for backwards compatibility)
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

        // Convert to standardized SubscriptionOffer (new cross-platform type)
        val subscriptionOffers = offers.map { it.toSubscriptionOffer() }

        // Get all one-time offers for subscriptions that may have them
        val allOneTimeOffers = runCatching { oneTimePurchaseOfferDetailsList }.getOrNull().orEmpty()
        val oneTimeOfferDetailsList = if (allOneTimeOffers.isNotEmpty()) {
            allOneTimeOffers.map { it.toOfferDetail() }
        } else {
            oneTimePurchaseOfferDetails?.let { listOf(it.toOfferDetail()) }
        }

        // Convert to standardized DiscountOffer (new cross-platform type)
        val discountOffers = if (allOneTimeOffers.isNotEmpty()) {
            allOneTimeOffers.map { it.toDiscountOffer() }
        } else {
            oneTimePurchaseOfferDetails?.let { listOf(it.toDiscountOffer()) }
        }

        return ProductSubscriptionAndroid(
            currency = currency,
            debugDescription = description,
            description = description,
            discountOffers = discountOffers,
            displayName = name,
            displayPrice = displayPrice,
            id = productId,
            nameAndroid = name,
            oneTimePurchaseOfferDetailsAndroid = oneTimeOfferDetailsList,
            platform = IapPlatform.Android,
            price = firstPhase?.priceAmountMicros?.toDouble()?.div(1_000_000.0),
            subscriptionOfferDetailsAndroid = pricingDetails,
            subscriptionOffers = subscriptionOffers,
            title = title,
            type = ProductType.Subs
        )
    }

    fun BillingPurchase.toPurchase(productType: String, basePlanId: String? = null): PurchaseAndroid {
        val state = PurchaseState.fromBillingState(purchaseState)

        // Check if subscription is suspended (available in Billing Library 8.1.0+)
        // Suspended subscriptions should NOT grant entitlements - direct users to subscription center
        val isSuspended = if (productType == BillingClient.ProductType.SUBS) {
            runCatching {
                // Use reflection to maintain backward compatibility
                val method = this::class.java.getMethod("isSuspended")
                method.invoke(this) as? Boolean
            }.getOrNull()
        } else {
            null
        }

        return PurchaseAndroid(
            autoRenewingAndroid = isAutoRenewing,
            currentPlanId = basePlanId,
            dataAndroid = originalJson,
            developerPayloadAndroid = developerPayload,
            id = orderId ?: purchaseToken,
            ids = products,
            isAcknowledgedAndroid = isAcknowledged,
            isAutoRenewing = isAutoRenewing,
            isSuspendedAndroid = isSuspended,
            obfuscatedAccountIdAndroid = accountIdentifiers?.obfuscatedAccountId,
            obfuscatedProfileIdAndroid = accountIdentifiers?.obfuscatedProfileId,
            packageNameAndroid = packageName,
            platform = IapPlatform.Android,
            productId = products.firstOrNull().orEmpty(),
            purchaseState = state,
            purchaseToken = purchaseToken,
            quantity = quantity,
            signatureAndroid = signature,
            store = IapStore.Google,
            transactionDate = purchaseTime.toDouble(),
            transactionId = orderId
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
