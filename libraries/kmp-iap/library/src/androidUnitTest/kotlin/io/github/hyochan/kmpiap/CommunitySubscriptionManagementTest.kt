package io.github.hyochan.kmpiap

import dev.hyo.openiap.DeepLinkOptions as AndroidDeepLinkOptions
import dev.hyo.openiap.MutationDeepLinkToSubscriptionsHandler
import dev.hyo.openiap.MutationRestorePurchasesHandler
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.QueryGetActiveSubscriptionsHandler
import dev.hyo.openiap.QueryHasActiveSubscriptionsHandler
import io.github.hyochan.kmpiap.openiap.DeepLinkOptions
import java.lang.reflect.Proxy
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CommunitySubscriptionManagementTest {
    @Test
    fun storefrontOverrideDoesNotNeedAnOptionalQueryHandler() = runBlocking {
        var calls = 0
        val provider = Proxy.newProxyInstance(
            OpenIapProtocol::class.java.classLoader,
            arrayOf(OpenIapProtocol::class.java),
        ) { _, method, _ ->
            check(method.name == "getStorefront") { "Unexpected call: ${method.name}" }
            calls++
            "US"
        } as OpenIapProtocol
        for (store in listOf(Store.UNKNOWN, Store.AMAZON, Store.HORIZON)) {
            val delegate = OpenIapDelegateInAppPurchaseAndroid(store.name, store, "Android")
            delegate.javaClass.getDeclaredField("module").apply { isAccessible = true }.set(delegate, provider)
            assertEquals("US", delegate.getStorefront())
        }
        assertEquals(3, calls)
    }

    @Test
    fun requiredHandlersDoNotNeedOptionalDispatchTables() = runBlocking {
        val queries = mutableListOf<List<String>?>()
        var restores = 0
        val active: QueryGetActiveSubscriptionsHandler = { queries.add(it); emptyList() }
        val hasActive: QueryHasActiveSubscriptionsHandler = { queries.add(it); true }
        val restore: MutationRestorePurchasesHandler = { restores++ }
        val provider = Proxy.newProxyInstance(
            OpenIapProtocol::class.java.classLoader,
            arrayOf(OpenIapProtocol::class.java),
        ) { _, method, _ ->
            when (method.name) {
                "getGetActiveSubscriptions" -> active
                "getHasActiveSubscriptions" -> hasActive
                "getRestorePurchases" -> restore
                else -> error("Unexpected call: ${method.name}")
            }
        } as OpenIapProtocol
        val delegate = OpenIapDelegateInAppPurchaseAndroid("community", Store.UNKNOWN, "Android Community")
        delegate.javaClass.getDeclaredField("module").apply { isAccessible = true }.set(delegate, provider)

        assertTrue(delegate.getActiveSubscriptions(listOf("subscription")).isEmpty())
        assertTrue(delegate.hasActiveSubscriptions(null))
        delegate.restorePurchases()

        assertEquals(listOf(listOf("subscription"), null), queries)
        assertEquals(1, restores)
    }

    @Test
    fun defaultOptionsReachTheProvider() = runBlocking {
        val requests = mutableListOf<AndroidDeepLinkOptions?>()
        val handler: MutationDeepLinkToSubscriptionsHandler = { requests.add(it) }
        val provider = Proxy.newProxyInstance(
            OpenIapProtocol::class.java.classLoader,
            arrayOf(OpenIapProtocol::class.java),
        ) { _, method, _ ->
            check(method.name == "getDeepLinkToSubscriptions") { "Unexpected call: ${method.name}" }
            handler
        } as OpenIapProtocol
        val delegate = OpenIapDelegateInAppPurchaseAndroid("community", Store.UNKNOWN, "Android Community")
        delegate.javaClass.getDeclaredField("module").apply { isAccessible = true }.set(delegate, provider)

        delegate.deepLinkToSubscriptions(null)
        delegate.deepLinkToSubscriptions(DeepLinkOptions(skuAndroid = "subscription"))

        assertEquals(2, requests.size)
        assertNull(requests[0])
        assertEquals("subscription", requests[1]?.skuAndroid)
        for (store in listOf(Store.AMAZON, Store.HORIZON)) {
            val official = OpenIapDelegateInAppPurchaseAndroid(store.name, store, "Android")
            official.javaClass.getDeclaredField("module").apply { isAccessible = true }.set(official, provider)
            val before = requests.size
            official.deepLinkToSubscriptions(null)
            assertEquals(before, requests.size)
            official.deepLinkToSubscriptions(DeepLinkOptions(skuAndroid = "official-subscription"))
            assertEquals(before + 1, requests.size)
            assertEquals("official-subscription", requests.last()?.skuAndroid)
        }
    }
}
