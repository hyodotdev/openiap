@file:Suppress("DEPRECATION")

package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.dsl.PurchaseRequestBuilder
import io.github.hyochan.kmpiap.openiap.ProductType
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class PurchaseDslDeprecationTest {
    @Test
    fun legacyPlatformDslProducesCanonicalPurchaseFields() {
        val request = PurchaseRequestBuilder().apply {
            type = ProductType.InApp
            ios { sku = "apple.product" }
            android { skus = listOf("google.product") }
        }.build()

        val platforms = (request.request as RequestPurchaseProps.Request.Purchase).value
        assertEquals("apple.product", platforms.apple?.sku)
        assertEquals(listOf("google.product"), platforms.google?.skus)
        assertNull(platforms.ios)
        assertNull(platforms.android)
    }

    @Test
    fun canonicalPlatformDslProducesCanonicalSubscriptionFields() {
        val request = PurchaseRequestBuilder().apply {
            type = ProductType.Subs
            apple { sku = "apple.subscription" }
            google { skus = listOf("google.subscription") }
        }.build()

        val platforms = (request.request as RequestPurchaseProps.Request.Subscription).value
        assertEquals("apple.subscription", platforms.apple?.sku)
        assertEquals(listOf("google.subscription"), platforms.google?.skus)
        assertNotNull(platforms.apple)
        assertNotNull(platforms.google)
        assertNull(platforms.ios)
        assertNull(platforms.android)
    }
}
