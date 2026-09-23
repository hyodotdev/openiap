package dev.hyo.openiap

import com.meta.horizon.billingclient.api.BillingClient
import com.meta.horizon.billingclient.api.BillingResult
import com.meta.horizon.billingclient.api.Purchase as HorizonPurchase
import com.meta.horizon.billingclient.api.PurchasesResponseListener
import com.meta.horizon.billingclient.api.QueryPurchasesParams
import dev.hyo.openiap.helpers.ActiveStoreConnection
import dev.hyo.openiap.helpers.ActiveStoreOperationRegistry
import dev.hyo.openiap.helpers.queryPurchasesHorizon
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Meta returns its durable purchase cache with SERVICE_UNAVAILABLE when it
 * cannot reach the store, as seen on a Quest 3.
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class HorizonCachedPurchasesTest {

    private class RespondingClient(
        private val responseCode: Int,
        private val purchases: List<HorizonPurchase>?,
    ) : RecordingBillingClient() {
        override fun queryPurchasesAsync(
            queryPurchasesParams: QueryPurchasesParams,
            listener: PurchasesResponseListener,
        ) {
            listener.onQueryPurchasesResponse(
                BillingResult.newBuilder()
                    .setResponseCode(responseCode)
                    .setDebugMessage("The query to fetch purchases failed")
                    .build(),
                purchases,
            )
        }
    }

    private fun horizonPurchase(productId: String): HorizonPurchase = HorizonPurchase(
        5L,
        "token-$productId",
        listOf(productId),
        "dev.hyo.openiap.test",
        "",
        "order-$productId",
        """{"purchaseState":0,"acknowledged":false,"autoRenewing":false}""",
        1,
        "signature",
    )

    private fun query(responseCode: Int, purchases: List<HorizonPurchase>?): List<Purchase> {
        val client: BillingClient = RespondingClient(responseCode, purchases)
        val lock = Any()
        val operations: ActiveStoreOperationRegistry<BillingClient> =
            ActiveStoreOperationRegistry(lock) { ActiveStoreConnection(client, 0L) }
        return runBlocking {
            queryPurchasesHorizon(client, operations, BillingClient.ProductType.INAPP)
        }
    }

    @Test
    fun `service unavailable with cached purchases returns them`() {
        val purchases = query(
            BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE,
            listOf(horizonPurchase("dev.hyo.martie.10bulbs")),
        )

        assertEquals(1, purchases.size)
        assertEquals("dev.hyo.martie.10bulbs", purchases.first().productId)
    }

    @Test
    fun `service unavailable without a cache still fails`() {
        assertThrows(Throwable::class.java) {
            query(BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE, null)
        }
    }

    @Test
    fun `service unavailable with an empty cache still fails`() {
        // A Quest that owned an unconsumed 10 Bulbs got this, and read it as owning nothing.
        assertThrows(Throwable::class.java) {
            query(BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE, emptyList())
        }
    }

    @Test
    fun `another error is not excused by a purchase list`() {
        assertThrows(Throwable::class.java) {
            query(
                BillingClient.BillingResponseCode.DEVELOPER_ERROR,
                listOf(horizonPurchase("dev.hyo.martie.10bulbs")),
            )
        }
    }

    @Test
    fun `an ok response is unaffected`() {
        val purchases = query(
            BillingClient.BillingResponseCode.OK,
            listOf(horizonPurchase("dev.hyo.martie.30bulbs")),
        )

        assertEquals(1, purchases.size)
        assertEquals("dev.hyo.martie.30bulbs", purchases.first().productId)
    }
}
