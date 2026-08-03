package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AmazonUserDataMappingTest {

    @Test
    fun `amazon purchases carry the RVS user data when provided`() {
        val purchase = buildAmazonPurchase(
            packageName = "dev.hyo.martie",
            receiptId = "receipt-1",
            receiptSku = "dev.hyo.martie.premium",
            isSubscription = false,
            purchaseDateMillis = 1_700_000_000_000.0,
            isCanceled = false,
            isDeferred = false,
            userIdAmazon = "amazon-user-1",
            userMarketplaceAmazon = "US"
        )

        assertEquals("amazon-user-1", purchase.userIdAmazon)
        assertEquals("US", purchase.userMarketplaceAmazon)
    }

    @Test
    fun `amazon purchases default to null user data when unavailable`() {
        val purchase = buildAmazonPurchase(
            packageName = "dev.hyo.martie",
            receiptId = "receipt-2",
            receiptSku = "dev.hyo.martie.premium",
            isSubscription = false,
            purchaseDateMillis = 1_700_000_000_000.0,
            isCanceled = false,
            isDeferred = false
        )

        assertNull(purchase.userIdAmazon)
        assertNull(purchase.userMarketplaceAmazon)
    }
}
