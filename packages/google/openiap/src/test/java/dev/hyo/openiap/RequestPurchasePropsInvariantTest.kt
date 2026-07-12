package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RequestPurchasePropsInvariantTest {
    private val purchase = mapOf(
        "google" to mapOf("skus" to listOf("coins")),
    )
    private val subscription = mapOf(
        "google" to mapOf("skus" to listOf("premium")),
    )

    @Test
    fun `decoder rejects both purchase branches`() {
        assertThrows(IllegalArgumentException::class.java) {
            RequestPurchaseProps.fromJson(
                mapOf(
                    "requestPurchase" to purchase,
                    "requestSubscription" to subscription,
                )
            )
        }
    }

    @Test
    fun `decoder rejects a branch with the wrong product type`() {
        assertThrows(IllegalArgumentException::class.java) {
            RequestPurchaseProps.fromJson(
                mapOf(
                    "requestSubscription" to subscription,
                    "type" to "in-app",
                )
            )
        }
    }

    @Test
    fun `decoder infers subscription type when omitted`() {
        val decoded = RequestPurchaseProps.fromJson(
            mapOf("requestSubscription" to subscription)
        )

        assertEquals(ProductQueryType.Subs, decoded.type)
    }
}
