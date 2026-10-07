package dev.hyo.openiap

import dev.hyo.openiap.store.OpenIapStore
import java.lang.reflect.Proxy
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OpenIapStoreProviderDispatchTest {
    @Test
    fun `required operations reach providers without optional dispatch tables`() = runBlocking {
        val queries = mutableListOf<List<String>?>()
        val management = mutableListOf<DeepLinkOptions?>()
        var restores = 0
        var requests = 0
        var finishes = 0
        val purchase = PurchaseAndroid.fromJson(mapOf(
            "id" to "opaque", "productId" to "product", "purchaseToken" to "token",
            "store" to "unknown", "storeId" to "community_fixture", "quantity" to 1,
            "purchaseState" to "purchased", "transactionDate" to 1.0, "isAutoRenewing" to false,
        ))
        val request: MutationRequestPurchaseHandler = { requests++; RequestPurchaseResultPurchase(purchase) }
        val finish: MutationFinishTransactionHandler = { value, consumable ->
            assertEquals(purchase, value)
            assertEquals(true, consumable)
            finishes++
            Unit
        }
        val active: QueryGetActiveSubscriptionsHandler = { queries.add(it); emptyList() }
        val hasActive: QueryHasActiveSubscriptionsHandler = { queries.add(it); true }
        val restore: MutationRestorePurchasesHandler = { restores++; Unit }
        val deepLink: MutationDeepLinkToSubscriptionsHandler = { management.add(it); Unit }
        val provider = Proxy.newProxyInstance(
            OpenIapProtocol::class.java.classLoader,
            arrayOf(OpenIapProtocol::class.java),
        ) { _, method, _ ->
            when (method.name) {
                "getGetActiveSubscriptions" -> active
                "getHasActiveSubscriptions" -> hasActive
                "getRestorePurchases" -> restore
                "getDeepLinkToSubscriptions" -> deepLink
                "getRequestPurchase" -> request
                "getFinishTransaction" -> finish
                "addPurchaseUpdateListener", "addPurchaseErrorListener", "addConnectionStateListener" -> null
                else -> error("Unexpected call: ${method.name}")
            }
        } as OpenIapProtocol
        val store = OpenIapStore(provider)

        assertTrue(store.getActiveSubscriptions(listOf("subscription")).isEmpty())
        assertTrue(store.hasActiveSubscriptions(null))
        store.restorePurchases()
        store.deepLinkToSubscriptions(DeepLinkOptions(skuAndroid = "subscription"))
        store.requestPurchase(RequestPurchaseProps.fromJson(mapOf(
            "type" to "in-app", "requestPurchase" to mapOf("google" to mapOf("skus" to listOf("product"))),
        )))
        store.finishTransaction(purchase, true)
        store.finishTransaction(purchase, true)

        assertEquals(listOf(listOf("subscription"), null), queries)
        assertEquals(1, restores)
        assertEquals("subscription", management.single()?.skuAndroid)
        assertEquals(1, requests)
        assertEquals(1, finishes)
    }
}
