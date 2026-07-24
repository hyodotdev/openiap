package dev.hyo.openiap.utils

import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.Purchase as BillingPurchase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class BillingPurchasePayloadMappingTest {
    private val originalJson =
        """
        {
          "orderId": "GPA.1234-5678",
          "packageName": "dev.hyo.martie",
          "productId": "premium.monthly",
          "productIds": ["premium.monthly"],
          "purchaseTime": 1700000000000,
          "purchaseState": 0,
          "purchaseToken": "purchase-token",
          "quantity": 2,
          "acknowledged": true,
          "autoRenewing": true,
          "developerPayload": "developer-payload",
          "pendingPurchaseUpdate": {
            "productIds": ["premium.yearly"],
            "purchaseToken": "pending-token"
          }
        }
        """.trimIndent()

    @Test
    fun `preserves canonical Play purchase payload fields`() {
        val billingPurchase = BillingPurchase(originalJson, "signature")
        val purchase = with(BillingConverters) {
            billingPurchase.toPurchase(
                productType = BillingClient.ProductType.SUBS,
                basePlanId = "monthly-base-plan",
            )
        }

        assertEquals("monthly-base-plan", purchase.currentPlanId)
        assertEquals(originalJson, purchase.dataAndroid)
        assertEquals("developer-payload", purchase.developerPayloadAndroid)
        assertEquals("GPA.1234-5678", purchase.transactionId)
        assertEquals("signature", purchase.signatureAndroid)
        assertEquals(2, purchase.quantity)
        assertNotNull(purchase.pendingPurchaseUpdateAndroid)
        val pendingUpdate = requireNotNull(purchase.pendingPurchaseUpdateAndroid)
        assertEquals(listOf("premium.yearly"), pendingUpdate.products)
        assertEquals("pending-token", pendingUpdate.purchaseToken)
    }
}
