package com.margelo.nitro.iap

import dev.hyo.openiap.DiscountOffer
import dev.hyo.openiap.ProductAndroidOneTimePurchaseOfferDetail
import dev.hyo.openiap.ProductCommon
import dev.hyo.openiap.ProductSubscriptionAndroidOfferDetails
import dev.hyo.openiap.SubscriptionOffer

internal fun legacySubscriptionOfferMaps(
    offers: List<ProductSubscriptionAndroidOfferDetails>,
): List<Map<String, Any?>> = offers.map { it.toJson().withoutTypeNames() }

internal fun subscriptionOfferMaps(
    offers: List<SubscriptionOffer>,
): List<Map<String, Any?>> = offers.map { it.toJson().withoutTypeNames() }

internal fun discountOfferMaps(
    offers: List<DiscountOffer>,
): List<Map<String, Any?>> = offers.map { it.toJson().withoutTypeNames() }

internal fun ProductAndroidOneTimePurchaseOfferDetail.toNitroOneTimePurchaseOfferDetail(): NitroOneTimePurchaseOfferDetail =
    NitroOneTimePurchaseOfferDetail(
        formattedPrice = formattedPrice,
        priceAmountMicros = priceAmountMicros,
        priceCurrencyCode = priceCurrencyCode,
        offerId = offerId?.let { Variant_NullType_String.Second(it) },
        offerToken = offerToken,
        offerTags = offerTags.toTypedArray(),
        fullPriceMicros = fullPriceMicros?.let { Variant_NullType_String.Second(it) },
        purchaseOptionId = purchaseOptionId?.let { Variant_NullType_String.Second(it) },
        discountDisplayInfo = discountDisplayInfo?.let { discount ->
            Variant_NullType_NitroDiscountDisplayInfoAndroid.Second(
                NitroDiscountDisplayInfoAndroid(
                    percentageDiscount = discount.percentageDiscount?.toDouble()?.let {
                        Variant_NullType_Double.Second(it)
                    },
                    discountAmount = discount.discountAmount?.let { amount ->
                        Variant_NullType_NitroDiscountAmountAndroid.Second(
                            NitroDiscountAmountAndroid(
                                discountAmountMicros = amount.discountAmountMicros,
                                formattedDiscountAmount = amount.formattedDiscountAmount,
                            )
                        )
                    },
                )
            )
        },
        validTimeWindow = validTimeWindow?.let { window ->
            Variant_NullType_NitroValidTimeWindowAndroid.Second(
                NitroValidTimeWindowAndroid(
                    startTimeMillis = window.startTimeMillis,
                    endTimeMillis = window.endTimeMillis,
                )
            )
        },
        limitedQuantityInfo = limitedQuantityInfo?.let { info ->
            Variant_NullType_NitroLimitedQuantityInfoAndroid.Second(
                NitroLimitedQuantityInfoAndroid(
                    maximumQuantity = info.maximumQuantity.toDouble(),
                    remainingQuantity = info.remainingQuantity.toDouble(),
                )
            )
        },
        preorderDetailsAndroid = preorderDetailsAndroid?.let { preorder ->
            Variant_NullType_NitroPreorderDetailsAndroid.Second(
                NitroPreorderDetailsAndroid(
                    preorderPresaleEndTimeMillis = preorder.preorderPresaleEndTimeMillis,
                    preorderReleaseTimeMillis = preorder.preorderReleaseTimeMillis,
                )
            )
        },
        rentalDetailsAndroid = rentalDetailsAndroid?.let { rental ->
            Variant_NullType_NitroRentalDetailsAndroid.Second(
                NitroRentalDetailsAndroid(
                    rentalExpirationPeriod = rental.rentalExpirationPeriod?.let {
                        Variant_NullType_String.Second(it)
                    },
                    rentalPeriod = rental.rentalPeriod,
                )
            )
        },
    )

internal fun ProductCommon.nitroDebugDescription(): Variant_NullType_String? =
    debugDescription?.let { Variant_NullType_String.Second(it) }

private fun Map<String, Any?>.withoutTypeNames(): Map<String, Any?> =
    entries
        .filter { it.key != "__typename" }
        .associate { (key, value) -> key to value.withoutTypeNames() }

private fun Any?.withoutTypeNames(): Any? = when (this) {
    is Map<*, *> -> entries
        .filter { it.key != "__typename" }
        .associate { (key, value) -> key.toString() to value.withoutTypeNames() }
    is List<*> -> map { it.withoutTypeNames() }
    else -> this
}
