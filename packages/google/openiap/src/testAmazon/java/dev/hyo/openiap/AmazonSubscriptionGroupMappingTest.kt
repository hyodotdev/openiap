package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AmazonSubscriptionGroupMappingTest {

    @Test
    fun `requested subscription skus stay isolated across multiple groups`() {
        val requestedSkuByReceiptId = mutableMapOf(
            "receipt-premium-monthly" to "dev.hyo.martie.premium.monthly",
            "receipt-pro-monthly" to "dev.hyo.martie.pro.monthly"
        )

        val premiumPurchase = buildAmazonPurchase(
            packageName = "dev.hyo.martie",
            receiptId = "receipt-premium-monthly",
            receiptSku = "amazon-receipt-premium",
            isSubscription = true,
            purchaseDateMillis = 1_700_000_000_000.0,
            isCanceled = false,
            isDeferred = false,
            productIdOverride = requestedSkuByReceiptId["receipt-premium-monthly"]
        )
        val proPurchase = buildAmazonPurchase(
            packageName = "dev.hyo.martie",
            receiptId = "receipt-pro-monthly",
            receiptSku = "amazon-receipt-pro",
            isSubscription = true,
            purchaseDateMillis = 1_700_000_000_000.0,
            isCanceled = false,
            isDeferred = false,
            productIdOverride = requestedSkuByReceiptId["receipt-pro-monthly"]
        )

        assertEquals("dev.hyo.martie.premium.monthly", premiumPurchase.productId)
        assertEquals("dev.hyo.martie.premium.monthly", premiumPurchase.currentPlanId)
        assertEquals(listOf("dev.hyo.martie.premium.monthly"), premiumPurchase.ids)
        assertEquals("dev.hyo.martie.pro.monthly", proPurchase.productId)
        assertEquals("dev.hyo.martie.pro.monthly", proPurchase.currentPlanId)
        assertEquals(listOf("dev.hyo.martie.pro.monthly"), proPurchase.ids)
    }

    @Test
    fun `restored subscription without in flight request uses receipt sku`() {
        val requestedSkuByReceiptId = emptyMap<String, String>()

        assertNull(requestedSkuByReceiptId["receipt-restored-premium"])

        val purchase = buildAmazonPurchase(
            packageName = "dev.hyo.martie",
            receiptId = "receipt-restored-premium",
            receiptSku = "dev.hyo.martie.premium.monthly",
            isSubscription = true,
            purchaseDateMillis = 1_700_000_000_000.0,
            isCanceled = false,
            isDeferred = false,
            productIdOverride = requestedSkuByReceiptId["receipt-restored-premium"]
        )

        assertEquals("dev.hyo.martie.premium.monthly", purchase.productId)
        assertEquals("dev.hyo.martie.premium.monthly", purchase.currentPlanId)
        assertEquals(listOf("dev.hyo.martie.premium.monthly"), purchase.ids)
    }
}
