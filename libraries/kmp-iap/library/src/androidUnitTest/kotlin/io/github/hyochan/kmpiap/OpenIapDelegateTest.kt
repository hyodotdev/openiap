package io.github.hyochan.kmpiap

import android.content.ContextWrapper
import dev.hyo.openiap.MutationAcknowledgePurchaseAndroidHandler
import dev.hyo.openiap.MutationConsumePurchaseAndroidHandler
import dev.hyo.openiap.MutationInitConnectionHandler
import dev.hyo.openiap.MutationRequestPurchaseHandler
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.QueryGetActiveSubscriptionsHandler
import dev.hyo.openiap.listener.OpenIapConnectionStateListener
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import io.github.hyochan.kmpiap.openiap.BillingProgramAndroid
import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.InitConnectionConfig
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.RequestPurchaseAndroidProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import io.github.hyochan.kmpiap.openiap.RequestPurchasePropsByPlatforms
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResultPurchases
import io.github.hyochan.kmpiap.openiap.SubResponseCodeAndroid
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseProps
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.take
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.yield
import java.util.concurrent.CopyOnWriteArraySet
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class OpenIapDelegateTest {
    @Test
    // Runs once per flavor task; CI runs the Play, Horizon, and Amazon tasks.
    fun `the flavor under test delegates to openiap-google`() {
        assertTrue(createPlatformInAppPurchase() is OpenIapDelegateInAppPurchaseAndroid)
    }

    @Test
    fun `a restore burst reaches a collector still busy with the first purchase`() = runBlocking {
        val attached = AttachedListeners()
        val module = fakeModule { method, args ->
            check(attached.record(method, args)) { "Unexpected call: $method" }
            null
        }
        val delegate = delegateFor(Store.HORIZON, module, registerListeners = true)
        val firstHandled = CompletableDeferred<Unit>()
        val received = mutableListOf<String>()
        val collector = launch(start = CoroutineStart.UNDISPATCHED) {
            delegate.purchaseUpdatedListener.take(3).collect { purchase ->
                received += purchase.productId
                firstHandled.await()
            }
        }
        val listener = attached.get<OpenIapPurchaseUpdateListener>("PurchaseUpdateListener")

        listener.onPurchaseUpdated(nativePurchase("restored-0"))
        yield() // the collector takes the first purchase and stays busy with it
        listener.onPurchaseUpdated(nativePurchase("restored-1"))
        listener.onPurchaseUpdated(nativePurchase("restored-2"))
        firstHandled.complete(Unit)

        withTimeout(5_000) { collector.join() }
        assertEquals(listOf("restored-0", "restored-1", "restored-2"), received)
    }

    @Test
    fun `Play throws the failure its purchase request reported, once`() = runBlocking {
        for (store in listOf(Store.PLAY_STORE, Store.HORIZON)) {
            val errorListeners = CopyOnWriteArraySet<OpenIapPurchaseErrorListener>()
            val request: MutationRequestPurchaseHandler = {
                errorListeners.forEach { it.onPurchaseError(OpenIapError.UserCancelled("cancelled")) }
                dev.hyo.openiap.RequestPurchaseResultPurchases(emptyList())
            }
            val module = fakeModule { method, args ->
                when (method) {
                    "addPurchaseErrorListener" -> errorListeners.add(args!![0] as OpenIapPurchaseErrorListener)
                    "removePurchaseErrorListener" -> errorListeners.remove(args!![0])
                    "getRequestPurchase" -> request
                    else -> if (method.endsWith("Listener")) null else error("Unexpected call: $method")
                }
            }
            val delegate = delegateFor(store, module, registerListeners = true)
            val events = mutableListOf<PurchaseError>()
            val collector = launch(start = CoroutineStart.UNDISPATCHED) {
                delegate.purchaseErrorListener.collect { events += it }
            }

            if (store == Store.PLAY_STORE) {
                val failure = assertFailsWith<PurchaseException> { delegate.requestPurchase(purchaseRequest()) }
                assertEquals(ErrorCode.UserCancelled, failure.error.code)
            } else {
                // Horizon keeps returning the empty result it always has.
                val result = delegate.requestPurchase(purchaseRequest()) as RequestPurchaseResultPurchases
                assertEquals(emptyList(), result.value)
            }
            yield()
            collector.cancel()
            assertEquals(listOf(ErrorCode.UserCancelled), events.map { it.code }, "$store events")
            assertEquals(1, errorListeners.size, "$store request listener detached")
        }
    }

    @Test
    fun `a Play request ignores failures reported for other products`() = runBlocking {
        val errorListeners = CopyOnWriteArraySet<OpenIapPurchaseErrorListener>()
        val request: MutationRequestPurchaseHandler = {
            errorListeners.forEach { it.onPurchaseError(OpenIapError.SkuNotFound("other-product")) }
            dev.hyo.openiap.RequestPurchaseResultPurchases(emptyList())
        }
        val module = fakeModule { method, args ->
            when (method) {
                "addPurchaseErrorListener" -> errorListeners.add(args!![0] as OpenIapPurchaseErrorListener)
                "removePurchaseErrorListener" -> errorListeners.remove(args!![0])
                "getRequestPurchase" -> request
                else -> error("Unexpected call: $method")
            }
        }

        val result = delegateFor(Store.PLAY_STORE, module).requestPurchase(purchaseRequest())

        assertEquals(emptyList(), (result as RequestPurchaseResultPurchases).value)
    }

    @Test
    // The delegate drops the old 60 s UserCancelled timeout; openiap-google owns flow timeouts.
    fun `the delegate adds no purchase timeout of its own`() = runTest {
        val request: MutationRequestPurchaseHandler = {
            delay(10 * 60_000L)
            dev.hyo.openiap.RequestPurchaseResultPurchases(listOf(nativePurchase("premium")))
        }
        val module = fakeModule { method, _ ->
            when (method) {
                "getRequestPurchase" -> request
                else -> if (method.endsWith("Listener")) null else error("Unexpected call: $method")
            }
        }

        val result = delegateFor(Store.PLAY_STORE, module).requestPurchase(purchaseRequest())

        assertEquals("premium", (result as RequestPurchaseResultPurchases).value?.single()?.productId)
    }

    @Test
    fun `every store throws when it refuses an acknowledge or consume`() = runBlocking {
        val rejected: MutationAcknowledgePurchaseAndroidHandler = { false }
        val notConsumed: MutationConsumePurchaseAndroidHandler = { false }
        val module = fakeModule { method, _ ->
            when (method) {
                "getAcknowledgePurchaseAndroid" -> rejected
                "getConsumePurchaseAndroid" -> notConsumed
                else -> error("Unexpected call: $method")
            }
        }

        for (store in listOf(Store.PLAY_STORE, Store.HORIZON, Store.AMAZON, Store.UNKNOWN)) {
            val delegate = delegateFor(store, module)
            for (finish in listOf<suspend () -> Boolean>(
                { delegate.acknowledgePurchaseAndroid("token") },
                { delegate.consumePurchaseAndroid("token") },
            )) assertEquals(ErrorCode.ServiceError, assertFailsWith<PurchaseException> { finish() }.error.code, "$store")
        }
    }

    @Test
    fun `an empty subscription filter reaches the store unchanged`() = runBlocking {
        val queries = mutableListOf<List<String>?>()
        val active: QueryGetActiveSubscriptionsHandler = { queries += it; emptyList() }
        val module = fakeModule { method, _ ->
            check(method == "getGetActiveSubscriptions") { "Unexpected call: $method" }
            active
        }

        delegateFor(Store.PLAY_STORE, module).getActiveSubscriptions(emptyList())

        assertEquals(listOf<List<String>?>(emptyList()), queries)
    }

    @Test
    fun `Play choice resolvers fail fast unless initConnection enabled their program`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            val attached = AttachedListeners()
            val init: MutationInitConnectionHandler = { true }
            val module = fakeModule { method, args ->
                when {
                    attached.record(method, args) -> null
                    method == "setActivity" -> null
                    method == "getInitConnection" -> init
                    else -> error("Unexpected call: $method")
                }
            }
            val play = delegateFor(Store.PLAY_STORE, module, context = ContextWrapper(null), registerListeners = true)
            // Collecting the listener flow before initConnection is the documented pattern.
            val collected = async(start = CoroutineStart.UNDISPATCHED) {
                play.developerProvidedBillingListenerAndroid.first()
            }

            for (resolver in listOf<suspend () -> Any>(
                { play.userChoiceBillingAndroid() },
                { play.developerProvidedBillingAndroid() },
            )) {
                val failure = assertFailsWith<PurchaseException> { withTimeout(1_000) { resolver() } }
                assertEquals(ErrorCode.DeveloperError, failure.error.code)
            }

            assertTrue(play.initConnection(InitConnectionConfig(enableBillingProgramAndroid = BillingProgramAndroid.ExternalPayments)))
            val resolved = async(start = CoroutineStart.UNDISPATCHED) { play.developerProvidedBillingAndroid() }
            assertEquals(
                ErrorCode.DeveloperError,
                assertFailsWith<PurchaseException> { withTimeout(1_000) { play.userChoiceBillingAndroid() } }.error.code,
            )
            attached.get<OpenIapDeveloperProvidedBillingListener>("DeveloperProvidedBillingListener").onDeveloperProvidedBilling(
                dev.hyo.openiap.DeveloperProvidedBillingDetailsAndroid.fromJson(
                    mapOf("externalTransactionToken" to "developer-token", "products" to emptyList<Any>())
                )
            )

            assertEquals("developer-token", resolved.await().externalTransactionToken)
            assertEquals("developer-token", collected.await().externalTransactionToken)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `Play rejects requestPurchase under the external-offer program`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            val init: MutationInitConnectionHandler = { true }
            val module = fakeModule { method, _ ->
                when (method) {
                    "setActivity" -> null
                    "getInitConnection" -> init
                    else -> error("Unexpected call: $method")
                }
            }
            val play = delegateFor(Store.PLAY_STORE, module, context = ContextWrapper(null))
            assertTrue(play.initConnection(InitConnectionConfig(enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer)))

            val failure = assertFailsWith<PurchaseException> { play.requestPurchase(purchaseRequest()) }

            assertEquals(ErrorCode.FeatureNotSupported, failure.error.code)
            assertTrue(failure.error.message.contains("launchExternalLinkAndroid"))
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `a second Play purchase fails fast and cannot take the first one's failure`() = runBlocking {
        val errorListeners = CopyOnWriteArraySet<OpenIapPurchaseErrorListener>()
        val sheetClosed = CompletableDeferred<Unit>()
        var requestsInModule = 0
        val request: MutationRequestPurchaseHandler = {
            requestsInModule++
            if (requestsInModule > 1) {
                // The real module also rejects a second request and reports it to every listener.
                val busy = OpenIapError.DeveloperError("Another purchase is already in progress")
                errorListeners.forEach { it.onPurchaseError(busy) }
                throw busy
            }
            sheetClosed.await()
            errorListeners.forEach { it.onPurchaseError(OpenIapError.UserCancelled("cancelled")) }
            dev.hyo.openiap.RequestPurchaseResultPurchases(emptyList())
        }
        val module = fakeModule { method, args ->
            when (method) {
                "addPurchaseErrorListener" -> errorListeners.add(args!![0] as OpenIapPurchaseErrorListener)
                "removePurchaseErrorListener" -> errorListeners.remove(args!![0])
                "getRequestPurchase" -> request
                else -> error("Unexpected call: $method")
            }
        }
        val play = delegateFor(Store.PLAY_STORE, module)

        val first = async(start = CoroutineStart.UNDISPATCHED) {
            assertFailsWith<PurchaseException> { play.requestPurchase(purchaseRequest()) }
        }
        val second = assertFailsWith<PurchaseException> { play.requestPurchase(purchaseRequest()) }
        sheetClosed.complete(Unit)

        assertEquals(ErrorCode.DeveloperError, second.error.code)
        assertEquals(ErrorCode.UserCancelled, first.await().error.code)
        assertEquals(1, requestsInModule)
    }

    @Test
    fun `Play billing programs reach openiap-google`() = runBlocking {
        val module = fakeModule { method, _ ->
            check(method == "isBillingProgramAvailable") { "Unexpected call: $method" }
            dev.hyo.openiap.BillingProgramAvailabilityResultAndroid(
                billingProgram = dev.hyo.openiap.BillingProgramAndroid.ExternalPayments,
                isAvailable = true,
            )
        }

        assertTrue(
            delegateFor(Store.PLAY_STORE, module)
                .isBillingProgramAvailableAndroid(BillingProgramAndroid.ExternalPayments)
                .isAvailable
        )
    }

    @Test
    fun `Play verifyPurchase reports a malformed request as a verification failure`() = runBlocking {
        val module = fakeModule { method, _ -> error("Unexpected call: $method") }

        val failure = assertFailsWith<PurchaseException> {
            delegateFor(Store.PLAY_STORE, module).verifyPurchase(VerifyPurchaseProps())
        }

        assertEquals(ErrorCode.PurchaseVerificationFailed, failure.error.code)
    }

    @Test
    fun `a dropped billing service makes the next initConnection reconnect`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            var connects = 0
            val attached = AttachedListeners()
            val init: MutationInitConnectionHandler = { connects++; true }
            val module = fakeModule { method, args ->
                when {
                    attached.record(method, args) -> null
                    method == "setActivity" -> null
                    method == "getInitConnection" -> init
                    else -> error("Unexpected call: $method")
                }
            }
            val delegate = delegateFor(
                Store.PLAY_STORE,
                module,
                context = ContextWrapper(null),
                registerListeners = true,
            )

            assertTrue(delegate.initConnection(null))
            assertTrue(delegate.initConnection(null))
            assertEquals(1, connects)

            attached.get<OpenIapConnectionStateListener>("ConnectionStateListener").onBillingServiceDisconnected()

            assertTrue(delegate.initConnection(null))
            assertEquals(2, connects)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `billing selection listeners deliver every choice through KmpIAP`() = runBlocking {
        val attached = AttachedListeners()
        val module = fakeModule { method, args ->
            check(attached.record(method, args)) { "Unexpected call: $method" }
            null
        }
        val iap = KmpIAP(delegateFor(Store.PLAY_STORE, module, registerListeners = true))
        val developer = async(start = CoroutineStart.UNDISPATCHED) {
            iap.developerProvidedBillingListenerAndroid.take(2).toList()
        }
        val user = async(start = CoroutineStart.UNDISPATCHED) {
            iap.userChoiceBillingListenerAndroid.take(2).toList()
        }

        val developerListener = attached.get<OpenIapDeveloperProvidedBillingListener>("DeveloperProvidedBillingListener")
        val userListener = attached.get<OpenIapUserChoiceBillingListener>("UserChoiceBillingListener")
        repeat(2) {
            developerListener.onDeveloperProvidedBilling(
                dev.hyo.openiap.DeveloperProvidedBillingDetailsAndroid.fromJson(
                    mapOf("externalTransactionToken" to "developer-$it", "products" to emptyList<Any>())
                )
            )
            userListener.onUserChoiceBilling(
                dev.hyo.openiap.UserChoiceBillingDetails.fromJson(
                    mapOf("externalTransactionToken" to "user-$it", "products" to listOf("product"))
                )
            )
        }

        assertEquals(
            listOf("developer-0", "developer-1"),
            withTimeout(5_000) { developer.await() }.map { it.externalTransactionToken },
        )
        assertEquals(
            listOf("user-0", "user-1"),
            withTimeout(5_000) { user.await() }.map { it.externalTransactionToken },
        )
        val horizon = KmpIAP(delegateFor(Store.HORIZON, module))
        assertTrue(horizon.developerProvidedBillingListenerAndroid.toList().isEmpty())
        assertTrue(horizon.userChoiceBillingListenerAndroid.toList().isEmpty())
    }

    @Test
    fun `Play sub-response codes reach KMP errors`() {
        val mapped = OpenIapError.PurchaseFailed("declined")
            .withSubResponseCode(dev.hyo.openiap.SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds)
            .toKmpPurchaseError()

        assertEquals(SubResponseCodeAndroid.PaymentDeclinedDueToInsufficientFunds, mapped.subResponseCodeAndroid)
    }

    @Test
    fun `storefront country accepts only authoritative nonblank store value`() {
        assertEquals("KR", authoritativeStorefrontCountryOrNull(" KR "))
        assertNull(authoritativeStorefrontCountryOrNull("  "))
        assertNull(authoritativeStorefrontCountryOrNull(null))
    }

    private fun purchaseRequest() = RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Purchase(
            RequestPurchasePropsByPlatforms(google = RequestPurchaseAndroidProps(skus = listOf("premium")))
        ),
        type = ProductQueryType.InApp,
    )

    private fun nativePurchase(productId: String) = dev.hyo.openiap.PurchaseAndroid(
        id = "order-$productId",
        isAutoRenewing = false,
        productId = productId,
        purchaseState = dev.hyo.openiap.PurchaseState.Purchased,
        purchaseToken = "token-$productId",
        quantity = 1,
        store = dev.hyo.openiap.IapStore.Google,
        storeId = "play",
        transactionDate = 1.0,
    )
}
