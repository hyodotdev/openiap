package io.github.hyochan.flutter_inapp_purchase

import dev.hyo.openiap.ProductQueryType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class PurchaseParamsValidationTest {
    @Test
    fun `all is query only`() {
        assertThrows(IllegalArgumentException::class.java) {
            validateFlutterPurchaseParams(mapOf("type" to "all", "skus" to listOf("coins")))
        }
        assertEquals(
            ProductQueryType.InApp,
            validateFlutterPurchaseParams(mapOf("type" to "in-app", "skus" to listOf("coins"))).type,
        )
    }

    @Test
    fun `mixed SKU lists are rejected`() {
        assertThrows(IllegalArgumentException::class.java) {
            validateFlutterPurchaseParams(mapOf("type" to "in-app", "skus" to listOf("coins", 7)))
        }
    }

    @Test
    fun `malformed subscription offers are rejected atomically`() {
        val malformed =
            listOf(
                mapOf("sku" to "premium", "offerToken" to "known"),
                mapOf("sku" to "premium"),
            )
        assertThrows(IllegalArgumentException::class.java) {
            validateFlutterPurchaseParams(
                mapOf("type" to "subs", "skus" to listOf("premium"), "subscriptionOffers" to malformed),
            )
        }
    }

    @Test
    fun `branch specific options cannot cross purchase types`() {
        listOf(
            mapOf(
                "type" to "in-app",
                "skus" to listOf("coins"),
                "subscriptionOffers" to emptyList<Any>(),
            ),
            mapOf(
                "type" to "subs",
                "skus" to listOf("premium"),
                "offerToken" to "one-time-token",
            ),
        ).forEach { request ->
            assertThrows(IllegalArgumentException::class.java) {
                validateFlutterPurchaseParams(request)
            }
        }
    }
}
