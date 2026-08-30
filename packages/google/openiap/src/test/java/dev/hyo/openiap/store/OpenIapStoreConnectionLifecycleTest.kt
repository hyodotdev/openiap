package dev.hyo.openiap.store

import dev.hyo.openiap.IapStore
import dev.hyo.openiap.MutationEndConnectionHandler
import dev.hyo.openiap.MutationInitConnectionHandler
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.Purchase
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseState
import dev.hyo.openiap.QueryGetAvailablePurchasesHandler
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import java.lang.reflect.Proxy
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class OpenIapStoreConnectionLifecycleTest {
    @Test
    fun `purchase updates survive a connection cycle`() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val module = FakeOpenIapProtocol()
        val store = OpenIapStore(module.protocol)
        val purchase = PurchaseAndroid(
            id = "transaction-id",
            isAutoRenewing = false,
            productId = "premium",
            purchaseState = PurchaseState.Purchased,
            purchaseToken = "purchase-token",
            quantity = 1,
            store = IapStore.Google,
            transactionDate = 1.0,
        )
        module.availablePurchases = listOf(purchase)

        try {
            assertEquals(1, module.purchaseUpdateListeners.size)
            assertEquals(1, module.purchaseErrorListeners.size)
            assertTrue(store.initConnection())
            assertEquals(1, module.purchaseUpdateListeners.size)
            assertEquals(1, module.purchaseErrorListeners.size)
            assertTrue(store.endConnection())
            assertEquals(0, module.purchaseUpdateListeners.size)
            assertEquals(0, module.purchaseErrorListeners.size)
            assertTrue(store.initConnection())
            assertEquals(1, module.purchaseUpdateListeners.size)
            assertEquals(1, module.purchaseErrorListeners.size)

            module.emitPurchase(purchase)
            assertEquals(purchase, store.currentPurchase.value)

            advanceUntilIdle()
            assertEquals(1, module.availablePurchaseRequests)
            assertEquals(listOf(purchase), store.availablePurchases.value)
        } finally {
            store.clear()
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `listeners return after a failed reconnect`() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        val module = FakeOpenIapProtocol()
        val store = OpenIapStore(module.protocol)

        try {
            assertTrue(store.initConnection())
            assertTrue(store.endConnection())
            module.connectionResult = false

            assertFalse(store.initConnection())
            assertEquals(1, module.purchaseUpdateListeners.size)
            assertEquals(1, module.purchaseErrorListeners.size)
        } finally {
            store.clear()
            Dispatchers.resetMain()
        }
    }
}

private class FakeOpenIapProtocol {
    val purchaseUpdateListeners = linkedSetOf<OpenIapPurchaseUpdateListener>()
    val purchaseErrorListeners = linkedSetOf<OpenIapPurchaseErrorListener>()
    var availablePurchases: List<Purchase> = emptyList()
    var availablePurchaseRequests = 0
    var connectionResult = true

    private val initConnection: MutationInitConnectionHandler = { connectionResult }
    private val endConnection: MutationEndConnectionHandler = { true }
    private val getAvailablePurchases: QueryGetAvailablePurchasesHandler = {
        availablePurchaseRequests += 1
        availablePurchases
    }

    val protocol: OpenIapProtocol = Proxy.newProxyInstance(
        OpenIapProtocol::class.java.classLoader,
        arrayOf(OpenIapProtocol::class.java),
    ) { proxy, method, args ->
        when (method.name) {
            "getInitConnection" -> initConnection
            "getEndConnection" -> endConnection
            "getGetAvailablePurchases" -> getAvailablePurchases
            "addPurchaseUpdateListener" -> {
                purchaseUpdateListeners += args.single() as OpenIapPurchaseUpdateListener
                Unit
            }
            "removePurchaseUpdateListener" -> {
                purchaseUpdateListeners -= args.single() as OpenIapPurchaseUpdateListener
                Unit
            }
            "addPurchaseErrorListener" -> {
                purchaseErrorListeners += args.single() as OpenIapPurchaseErrorListener
                Unit
            }
            "removePurchaseErrorListener" -> {
                purchaseErrorListeners -= args.single() as OpenIapPurchaseErrorListener
                Unit
            }
            "setActivity" -> Unit
            "equals" -> proxy === args.single()
            "hashCode" -> System.identityHashCode(proxy)
            "toString" -> "FakeOpenIapProtocol"
            else -> error("Unexpected OpenIapProtocol call: ${method.name}")
        }
    } as OpenIapProtocol

    fun emitPurchase(purchase: Purchase) {
        for (listener in purchaseUpdateListeners) {
            listener.onPurchaseUpdated(purchase)
        }
    }
}
