package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ProductSubscriptionIOS
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

class ProductPayloadNormalizerTestIOS {
    @Test
    fun `normalizes legacy product aliases before generated decoding`() {
        val payload: Map<Any?, Any?> = mapOf(
            "id" to "premium.monthly",
            "type" to "subs",
            "typeIOS" to "auto-renewable-subscription",
            "subscriptionInfoIOS" to emptyMap<Any?, Any?>(),
            "subscription" to mapOf<Any?, Any?>(
                "subscriptionGroupId" to "group-1",
                "subscriptionPeriod" to mapOf<Any?, Any?>(
                    "unit" to "month",
                    "value" to 1,
                ),
            ),
            "subscriptionOffers" to emptyList<Any?>(),
            "offers" to listOf(
                mapOf<Any?, Any?>(
                    "displayPrice" to "Free",
                    "id" to "intro",
                    "price" to 0.0,
                    "type" to "introductory",
                )
            ),
            "discountsIOS" to emptyList<Any?>(),
            "discounts" to listOf(
                mapOf<Any?, Any?>(
                    "identifier" to "legacy-discount",
                    "numberOfPeriods" to 1,
                    "paymentMode" to "free-trial",
                    "price" to "Free",
                    "priceAmount" to 0.0,
                    "subscriptionPeriod" to "P1M",
                    "type" to "introductory",
                )
            ),
        )

        val normalized = assertNotNull(normalizeProductPayloadIOS(payload))
        val product = ProductSubscriptionIOS.fromJson(normalized)

        assertEquals("group-1", product.subscriptionInfoIOS?.subscriptionGroupId)
        assertEquals("intro", product.subscriptionOffers?.single()?.id)
        assertEquals("legacy-discount", product.discountsIOS?.single()?.identifier)
    }
}
