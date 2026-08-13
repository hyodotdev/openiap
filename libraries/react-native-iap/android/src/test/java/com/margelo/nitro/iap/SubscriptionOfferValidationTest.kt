package com.margelo.nitro.iap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import dev.hyo.openiap.ProductQueryType

class SubscriptionOfferValidationTest {
    @Test
    fun `valid offers preserve every entry`() {
        val offers = arrayOf(
            AndroidSubscriptionOfferInput(offerToken = "base", sku = "monthly"),
            AndroidSubscriptionOfferInput(offerToken = "promo", sku = "monthly"),
        )

        assertEquals(listOf("base", "promo"), requireValidSubscriptionOffers(offers).map { it.offerToken })
    }

    @Test
    fun `blank offer fields reject the whole list`() {
        listOf(
            AndroidSubscriptionOfferInput(offerToken = "", sku = "monthly"),
            AndroidSubscriptionOfferInput(offerToken = "base", sku = ""),
        ).forEach { invalidOffer ->
            assertThrows(IllegalArgumentException::class.java) {
                requireValidSubscriptionOffers(arrayOf(invalidOffer))
            }
        }
    }

    @Test
    fun `branch specific options cannot cross purchase types`() {
        assertThrows(IllegalArgumentException::class.java) {
            requireMatchingPurchaseOptions(
                type = ProductQueryType.InApp,
                hasSubscriptionOffers = true,
                hasSubscriptionReplacementParams = false,
                purchaseToken = null,
                originalExternalTransactionId = null,
                offerToken = null,
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            requireMatchingPurchaseOptions(
                type = ProductQueryType.Subs,
                hasSubscriptionOffers = false,
                hasSubscriptionReplacementParams = false,
                purchaseToken = null,
                originalExternalTransactionId = null,
                offerToken = "one-time-token",
            )
        }
    }
}
