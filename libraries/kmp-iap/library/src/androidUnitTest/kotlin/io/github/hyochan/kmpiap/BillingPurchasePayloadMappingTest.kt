package io.github.hyochan.kmpiap

import com.android.billingclient.api.Purchase as BillingPurchase
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseState
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

@RunWith(RobolectricTestRunner::class)
class BillingPurchasePayloadMappingTest {
    private val originalJson =
        """
            {
              "orderId": "order-premium",
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

    private fun billingPurchase() = BillingPurchase(originalJson, "signature")

    @Test
    fun `preserves canonical billing purchase metadata`() {
        val purchase = billingPurchase().toPurchase() as PurchaseAndroid

        assertEquals(originalJson, purchase.dataAndroid)
        assertEquals("developer-payload", purchase.developerPayloadAndroid)
        assertEquals("order-premium", purchase.transactionId)
        assertEquals(PurchaseState.Purchased, purchase.purchaseState)
        assertEquals("signature", purchase.signatureAndroid)
        assertEquals(2, purchase.quantity)
        val pendingUpdate = assertNotNull(purchase.pendingPurchaseUpdateAndroid)
        assertEquals(
            listOf("premium.yearly"),
            pendingUpdate.products,
        )
        assertEquals(
            "pending-token",
            pendingUpdate.purchaseToken,
        )
    }

    @Test
    fun `preserves Android purchase token for active subscription replacement`() {
        val activeSubscription = billingPurchase().toActiveSubscription()

        assertEquals("purchase-token", activeSubscription.purchaseToken)
        assertEquals("purchase-token", activeSubscription.purchaseTokenAndroid)
        assertEquals("order-premium", activeSubscription.transactionId)
    }
}
