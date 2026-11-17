package io.github.hyochan.kmpiap

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class IosProductDecodingTest {
    private val iap = InAppPurchaseIOS()
    private val product = mapOf(
        "id" to "dev.hyo.martie.10bulbs",
        "type" to "in-app",
        "typeIOS" to "consumable",
    )
    private val subscription = mapOf(
        "id" to "dev.hyo.martie.premium",
        "type" to "subs",
        "typeIOS" to "auto-renewable-subscription",
    )
    private val unreadable = product + mapOf(
        "id" to "dev.hyo.martie.unreadable",
        "type" to "a-type-this-sdk-does-not-know",
    )

    @Test
    fun `a product the SDK cannot read is skipped and the rest are returned`() {
        assertEquals(
            listOf("dev.hyo.martie.10bulbs"),
            iap.convertAnyListToProducts(listOf(unreadable, product, "not a product")).map { it.id },
        )
        assertEquals(
            listOf("dev.hyo.martie.premium"),
            iap.convertAnyListToProductSubscriptions(listOf("not a product", subscription)).map { it.id },
        )
        assertEquals(
            listOf<Any?>("dev.hyo.martie.10bulbs", "dev.hyo.martie.premium"),
            iap.convertAnyListToProductOrSubscriptions(listOf(unreadable, product, "not a product", subscription))
                .map { it.toJson()["id"] },
        )
    }

    @Test
    fun `a subscription with malformed optional fields is still returned`() {
        val malformed = subscription + mapOf(
            "id" to "dev.hyo.martie.malformed",
            "typeIOS" to "a-type-this-sdk-does-not-know",
            "price" to "free",
            "subscriptionPeriodUnitIOS" to "fortnight",
            "pricingTermsIOS" to listOf("not a term"),
            "subscriptionOffers" to listOf("not an offer", mapOf("period" to "monthly", "price" to "1")),
        )
        assertEquals(
            listOf("dev.hyo.martie.malformed", "dev.hyo.martie.premium"),
            iap.convertAnyListToProductSubscriptions(listOf(malformed, subscription)).map { it.id },
        )
    }

    @Test
    fun `a promoted product the SDK cannot read is null`() {
        assertNull(iap.convertAnyToProductIOS(unreadable))
        assertEquals("dev.hyo.martie.10bulbs", iap.convertAnyToProductIOS(product)?.id)
    }
}
