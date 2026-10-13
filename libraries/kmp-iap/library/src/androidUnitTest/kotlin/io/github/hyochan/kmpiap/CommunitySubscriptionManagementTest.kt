package io.github.hyochan.kmpiap

import dev.hyo.openiap.DeepLinkOptions as AndroidDeepLinkOptions
import dev.hyo.openiap.MutationDeepLinkToSubscriptionsHandler
import dev.hyo.openiap.MutationRestorePurchasesHandler
import dev.hyo.openiap.QueryGetActiveSubscriptionsHandler
import dev.hyo.openiap.QueryHasActiveSubscriptionsHandler
import io.github.hyochan.kmpiap.openiap.DeepLinkOptions
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CommunitySubscriptionManagementTest {
    @Test
    fun storefrontOverrideDoesNotNeedAnOptionalQueryHandler() = runBlocking {
        var calls = 0
        val provider = fakeModule { method, _ ->
            check(method == "getStorefront") { "Unexpected call: $method" }
            calls++
            "US"
        }
        for (store in listOf(Store.UNKNOWN, Store.PLAY_STORE, Store.AMAZON, Store.HORIZON)) {
            assertEquals("US", delegateFor(store, provider).getStorefront())
        }
        assertEquals(4, calls)
    }

    @Test
    fun requiredHandlersDoNotNeedOptionalDispatchTables() = runBlocking {
        val queries = mutableListOf<List<String>?>()
        var restores = 0
        val active: QueryGetActiveSubscriptionsHandler = { queries.add(it); emptyList() }
        val hasActive: QueryHasActiveSubscriptionsHandler = { queries.add(it); true }
        val restore: MutationRestorePurchasesHandler = { restores++ }
        val provider = fakeModule { method, _ ->
            when (method) {
                "getGetActiveSubscriptions" -> active
                "getHasActiveSubscriptions" -> hasActive
                "getRestorePurchases" -> restore
                else -> error("Unexpected call: $method")
            }
        }
        val delegate = delegateFor(Store.UNKNOWN, provider)

        assertTrue(delegate.getActiveSubscriptions(listOf("subscription")).isEmpty())
        assertTrue(delegate.hasActiveSubscriptions(null))
        delegate.restorePurchases()

        assertEquals(listOf(listOf("subscription"), null), queries)
        assertEquals(1, restores)
    }

    @Test
    fun deepLinkOptionsReachEveryStoreUnchanged() = runBlocking {
        val requests = mutableListOf<AndroidDeepLinkOptions?>()
        val handler: MutationDeepLinkToSubscriptionsHandler = { requests.add(it) }
        val provider = fakeModule { method, _ ->
            check(method == "getDeepLinkToSubscriptions") { "Unexpected call: $method" }
            handler
        }
        for (store in listOf(Store.UNKNOWN, Store.PLAY_STORE, Store.AMAZON, Store.HORIZON)) {
            requests.clear()
            val delegate = delegateFor(store, provider)

            delegate.deepLinkToSubscriptions(null)
            delegate.deepLinkToSubscriptions(DeepLinkOptions(skuAndroid = "subscription"))

            assertEquals(2, requests.size, "$store")
            assertNull(requests[0])
            assertEquals("subscription", requests[1]?.skuAndroid)
        }
    }
}
