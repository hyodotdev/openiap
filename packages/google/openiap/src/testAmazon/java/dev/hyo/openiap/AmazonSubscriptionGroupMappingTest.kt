package dev.hyo.openiap

import dev.hyo.openiap.utils.activeSubscriptions
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AmazonSubscriptionGroupMappingTest {

    @Test
    fun `available purchases reject both Amazon cancellation signals`() {
        assertTrue(
            shouldIncludeAmazonReceipt(
                isCanceled = false,
                hasCancelDate = false,
            ),
        )
        assertFalse(
            shouldIncludeAmazonReceipt(
                isCanceled = true,
                hasCancelDate = false,
            ),
        )
        assertFalse(
            shouldIncludeAmazonReceipt(
                isCanceled = false,
                hasCancelDate = true,
            ),
        )
    }

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

    @Test
    fun `restore keeps authoritative receipt sku even after an immediate request alias`() {
        val historicalRequestedSku = "local.catalog.alias"
        val receiptSku = "amazon.authoritative.subscription"

        val immediatePurchase = buildAmazonPurchase(
            packageName = "dev.hyo.martie",
            receiptId = "receipt-shared",
            receiptSku = receiptSku,
            isSubscription = true,
            purchaseDateMillis = 1_700_000_000_000.0,
            isCanceled = false,
            isDeferred = false,
            productIdOverride = historicalRequestedSku,
        )
        val restoredPurchase = buildAmazonPurchase(
            packageName = "dev.hyo.martie",
            receiptId = "receipt-shared",
            receiptSku = receiptSku,
            isSubscription = true,
            purchaseDateMillis = 1_700_000_000_000.0,
            isCanceled = false,
            isDeferred = false,
            productIdOverride = null,
        )

        assertEquals(historicalRequestedSku, immediatePurchase.productId)
        assertEquals(receiptSku, restoredPurchase.productId)
    }

    @Test
    fun `deferred Amazon subscription change stays active and exposes pending update`() {
        val purchase = buildAmazonPurchase(
            packageName = "dev.hyo.martie",
            receiptId = "receipt-current-monthly",
            receiptSku = "premium.monthly",
            isSubscription = true,
            purchaseDateMillis = 1_700_000_000_000.0,
            isCanceled = false,
            isDeferred = true,
            deferredSku = "premium.yearly",
            termSku = "premium.monthly",
            productIdOverride = "premium",
        )

        assertEquals(PurchaseState.Purchased, purchase.purchaseState)
        assertFalse(purchase.isAutoRenewing)
        assertNull(purchase.autoRenewingAndroid)
        assertTrue(listOf(purchase).activeSubscriptions(emptySet()).single().isActive)
        assertFalse(purchase.isSuspendedAndroid ?: true)
        assertEquals("premium", purchase.productId)
        assertEquals("premium.monthly", purchase.currentPlanId)
        assertEquals(
            listOf("premium.yearly"),
            purchase.pendingPurchaseUpdateAndroid?.products,
        )
        assertEquals(
            "receipt-current-monthly",
            purchase.pendingPurchaseUpdateAndroid?.purchaseToken,
        )
    }

    @Test
    fun `active paid terms stay listed when renewal preferences are unavailable`() {
        val subscription = buildAmazonPurchase(
            packageName = "dev.hyo.martie",
            receiptId = "receipt-active",
            receiptSku = "premium.monthly",
            isSubscription = true,
            purchaseDateMillis = 1_700_000_000_000.0,
            isCanceled = false,
            isDeferred = false,
        )
        val canceled = subscription.copy(id = "receipt-canceled", purchaseState = PurchaseState.Unknown)
        val oneTime = buildAmazonPurchase(
            packageName = "dev.hyo.martie",
            receiptId = "receipt-one-time",
            receiptSku = "coins",
            isSubscription = false,
            purchaseDateMillis = 1_700_000_000_000.0,
            isCanceled = false,
            isDeferred = false,
        )
        val purchases = listOf(subscription, canceled, oneTime)

        assertFalse(subscription.isAutoRenewing)
        assertNull(subscription.autoRenewingAndroid)
        assertEquals(false, oneTime.autoRenewingAndroid)
        val active = purchases.activeSubscriptions(emptySet())
        assertEquals(1, active.size)
        assertEquals("premium.monthly", active.single().currentPlanId)
        assertTrue(active.single().isActive)
        assertNull(active.single().autoRenewingAndroid)
        assertEquals(active, purchases.activeSubscriptions(setOf("premium.monthly")))
        assertTrue(purchases.activeSubscriptions(setOf("other.plan")).isEmpty())
    }
}
