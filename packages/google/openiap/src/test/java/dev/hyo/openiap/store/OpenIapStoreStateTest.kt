package dev.hyo.openiap.store

import dev.hyo.openiap.FetchProductsResultAll
import dev.hyo.openiap.FetchProductsResultProducts
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.ProductAndroid
import dev.hyo.openiap.ProductOrSubscription
import dev.hyo.openiap.ProductRequest
import dev.hyo.openiap.ProductSubscriptionAndroid
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseState
import dev.hyo.openiap.RequestPurchaseProps
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import java.util.concurrent.CountDownLatch
import kotlin.concurrent.thread
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class OpenIapStoreStateTest {
    private val module = FakeOpenIapProtocol()
    private lateinit var store: OpenIapStore

    @Before
    fun setUp() {
        Dispatchers.setMain(StandardTestDispatcher())
        store = OpenIapStore(module.protocol)
    }

    @After
    fun tearDown() {
        store.clear()
        Dispatchers.resetMain()
    }

    @Test
    fun `a re-fetch replaces products and subscriptions already seen`() = runBlocking {
        module.fetchProductsResult = FetchProductsResultProducts(listOf(product("coins", "$1.00")))
        store.fetchProducts(ProductRequest(listOf("coins")))
        module.fetchProductsResult = FetchProductsResultAll(
            listOf(
                ProductOrSubscription.ProductItem(product("coins", "$2.00")),
                ProductOrSubscription.ProductSubscriptionItem(subscription("premium", "$5.00")),
            )
        )
        store.fetchProducts(ProductRequest(listOf("coins", "premium")))
        module.fetchProductsResult = FetchProductsResultAll(
            listOf(ProductOrSubscription.ProductSubscriptionItem(subscription("premium", "$6.00")))
        )

        store.fetchProducts(ProductRequest(listOf("premium")))

        assertEquals(listOf("coins" to "$2.00", "premium" to "$6.00"), store.products.value.map { it.id to it.displayPrice })
        assertEquals(listOf("premium" to "$6.00"), store.subscriptions.value.map { it.id to it.displayPrice })
    }

    @Test
    fun `concurrent purchase requests leave no sku marked as purchasing`() {
        hammer { worker, iteration ->
            store.requestPurchase(purchaseProps("sku-$worker-$iteration"))
        }

        assertTrue(
            "lost status updates left stale skus: ${store.status.value.loadings.purchasing}",
            store.status.value.loadings.purchasing.isEmpty(),
        )
    }

    @Test
    fun `concurrent finishes remember every processed token`() {
        hammer { worker, iteration -> store.finishTransaction(purchase("token-$worker-$iteration"), false) }
        val firstPass = module.finishTransactionCalls.get()

        hammer { worker, iteration -> store.finishTransaction(purchase("token-$worker-$iteration"), false) }

        assertEquals(WORKERS * ITERATIONS, firstPass)
        assertEquals("a processed token must not be finished twice", firstPass, module.finishTransactionCalls.get())
    }

    @Test
    fun `concurrent finishes of one token reach the store once`() {
        module.finishDelayMillis = 50

        hammer(iterations = 1) { _, _ -> store.finishTransaction(purchase("shared-token"), false) }

        assertEquals(1, module.finishTransactionCalls.get())
    }

    @Test
    fun `concurrent finishes of one token share the in-flight failure`() = runBlocking {
        val gate = CompletableDeferred<Unit>()
        module.finishGate = gate
        module.finishError = IllegalStateException("store unavailable")
        // UNDISPATCHED runs each caller until it waits: the first in the store, the rest on it.
        val callers = (0 until WORKERS).map {
            async(start = CoroutineStart.UNDISPATCHED) {
                runCatching { store.finishTransaction(purchase("shared-token"), false) }
            }
        }

        gate.complete(Unit)

        assertEquals(1, module.finishTransactionCalls.get())
        assertTrue("every caller sees the store's failure", callers.awaitAll().all { it.isFailure })
    }

    @Test
    fun `a cancelled finish does not cancel a concurrent finish of the same token`() = runBlocking {
        module.finishGate = CompletableDeferred()
        val first = launch(start = CoroutineStart.UNDISPATCHED) {
            store.finishTransaction(purchase("shared-token"), false)
        }
        val second = async(start = CoroutineStart.UNDISPATCHED) {
            runCatching { store.finishTransaction(purchase("shared-token"), false) }
        }
        module.finishGate = null

        first.cancelAndJoin()

        assertTrue("the waiter must finish on its own: ${second.await()}", second.await().isSuccess)
        assertEquals("the waiter retries after the cancelled attempt", 2, module.finishTransactionCalls.get())
        assertEquals("a cancellation is not a store error", null, store.status.value.lastError)
    }

    @Test
    fun `a failed finish can be retried`() = runBlocking {
        module.finishError = IllegalStateException("store unavailable")
        runCatching { store.finishTransaction(purchase("retry-token"), false) }
        module.finishError = null

        store.finishTransaction(purchase("retry-token"), false)

        assertEquals(2, module.finishTransactionCalls.get())
    }

    private fun hammer(
        iterations: Int = ITERATIONS,
        block: suspend (worker: Int, iteration: Int) -> Unit,
    ) {
        val start = CountDownLatch(1)
        val workers = (0 until WORKERS).map { worker ->
            thread {
                start.await()
                runBlocking { repeat(iterations) { iteration -> block(worker, iteration) } }
            }
        }
        start.countDown()
        workers.forEach { it.join() }
    }

    private fun purchaseProps(sku: String): RequestPurchaseProps = RequestPurchaseProps.fromJson(
        mapOf("requestPurchase" to mapOf("google" to mapOf("skus" to listOf(sku)))),
    )

    private fun product(id: String, price: String) = ProductAndroid(
        currency = "USD",
        description = id,
        displayPrice = price,
        id = id,
        nameAndroid = id,
        title = id,
    )

    private fun subscription(id: String, price: String) = ProductSubscriptionAndroid(
        currency = "USD",
        description = id,
        displayPrice = price,
        id = id,
        nameAndroid = id,
        subscriptionOffers = emptyList(),
        title = id,
    )

    private fun purchase(token: String) = PurchaseAndroid(
        id = token,
        isAutoRenewing = false,
        productId = "coins",
        purchaseState = PurchaseState.Purchased,
        purchaseToken = token,
        quantity = 1,
        store = IapStore.Google,
        storeId = "play",
        transactionDate = 1.0,
    )

    private companion object {
        const val WORKERS = 8
        const val ITERATIONS = 500
    }
}
