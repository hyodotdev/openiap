package dev.hyo.openiap

import com.meta.horizon.billingclient.api.Purchase as HorizonPurchase
import dev.hyo.openiap.utils.HorizonBillingConverters
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The Horizon billing-compatibility `Purchase.orderId` is a non-null String
 * and arrives blank on device, so a null-only `orderId ?: token` fallback
 * produced an empty `id`/`transactionId`. The SDKs' strict purchase decoders
 * reject an empty id, which failed the whole available-purchases batch on a
 * Quest 3 with real store data. These tests pin the blank-aware fallback.
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class HorizonBlankOrderIdTest {

    private fun horizonPurchase(orderId: String): HorizonPurchase = HorizonPurchase(
        5L,
        "purchase-token",
        listOf("product-id"),
        "dev.hyo.openiap.test",
        "",
        orderId,
        """{"purchaseState":0,"acknowledged":false,"autoRenewing":false}""",
        1,
        "signature",
    )

    @Test
    fun `blank orderId falls back to the purchase token for id and transactionId`() {
        val purchase = with(HorizonBillingConverters) {
            horizonPurchase(orderId = "").toPurchase()
        }

        assertEquals("purchase-token", purchase.id)
        assertEquals("purchase-token", purchase.transactionId)
    }

    @Test
    fun `present orderId is preserved for id and transactionId`() {
        val purchase = with(HorizonBillingConverters) {
            horizonPurchase(orderId = "order-1").toPurchase()
        }

        assertEquals("order-1", purchase.id)
        assertEquals("order-1", purchase.transactionId)
    }

    @Test
    fun `blank orderId falls back to the purchase token for active subscriptions`() {
        val subscription = with(HorizonBillingConverters) {
            horizonPurchase(orderId = "").toActiveSubscription()
        }

        assertEquals("purchase-token", subscription.transactionId)
    }
}
