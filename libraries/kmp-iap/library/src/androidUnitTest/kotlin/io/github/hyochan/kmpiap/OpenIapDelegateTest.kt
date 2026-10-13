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
import kotlin.test.assertIs
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
    fun `a Play outcome collector can start the next purchase before the finished request returns`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            for (outcome in listOf("error", "purchase", "user choice")) {
                val play = FakePlay()
                val delegate = delegateFor(Store.PLAY_STORE, play.module, registerListeners = true)
                // Main is unconfined here, as Main.immediate is for a collector on the main thread.
                val next = async(Dispatchers.Main, start = CoroutineStart.UNDISPATCHED) {
                    when (outcome) {
                        "error" -> delegate.purchaseErrorListener.first()
                        "purchase" -> delegate.purchaseUpdatedListener.first()
                        else -> delegate.userChoiceBillingListenerAndroid.first()
                    }
                    runCatching { delegate.requestPurchase(purchaseRequest("next")) }
                }
                val first = async(start = CoroutineStart.UNDISPATCHED) {
                    runCatching { delegate.requestPurchase(purchaseRequest()) }
                }

                when (outcome) {
                    "error" -> play.fail(OpenIapError.ItemUnavailable("unavailable").withProductId("premium"))
                    "purchase" -> play.buy("premium")
                    else -> play.chooseAlternativeBilling("premium")
                }
                assertTrue(play.isPending, "$outcome: the collector started the next purchase")
                play.buy("next")

                val nextResult = next.await().getOrThrow() as RequestPurchaseResultPurchases
                assertEquals("next", nextResult.value?.single()?.productId, outcome)
                val firstResult = first.await()
                when (outcome) {
                    "error" -> assertEquals(
                        ErrorCode.ItemUnavailable,
                        assertIs<PurchaseException>(firstResult.exceptionOrNull()).error.code,
                    )
                    "purchase" -> assertEquals(
                        "premium",
                        (firstResult.getOrThrow() as RequestPurchaseResultPurchases).value?.single()?.productId,
                    )
                    else -> assertEquals(emptyList(), (firstResult.getOrThrow() as RequestPurchaseResultPurchases).value)
                }
            }
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `a deferred same-product purchase and a rejected purchase leave the open Play request its own failure`() = runBlocking {
        val play = FakePlay()
        val delegate = delegateFor(Store.PLAY_STORE, play.module, registerListeners = true)
        val open = async(start = CoroutineStart.UNDISPATCHED) {
            runCatching { delegate.requestPurchase(purchaseRequest()) }
        }

        // An earlier Pending purchase of the same product completes; it does not end this request.
        play.deliverUnrelated("premium")
        val rejected = runCatching { delegate.requestPurchase(purchaseRequest()) }
        play.fail(OpenIapError.UserCancelled("cancelled").withProductId("premium"))

        assertEquals(ErrorCode.DeveloperError, assertIs<PurchaseException>(rejected.exceptionOrNull()).error.code)
        assertEquals(ErrorCode.UserCancelled, assertIs<PurchaseException>(open.await().exceptionOrNull()).error.code)
    }

    @Test
    fun `a Play request throws its own failure, not an earlier request's published while it waited`() = runBlocking {
        val play = FakePlay()
        val delegate = delegateFor(Store.PLAY_STORE, play.module, registerListeners = true)
        val earlier = async(start = CoroutineStart.UNDISPATCHED) {
            runCatching { delegate.requestPurchase(purchaseRequest()) }
        }
        val queryFailure = CompletableDeferred<OpenIapError?>()
        play.ownershipQuery = { queryFailure.await() }
        val waiting = async(start = CoroutineStart.UNDISPATCHED) {
            runCatching { delegate.requestPurchase(purchaseRequest()) }
        }

        play.fail(OpenIapError.UserCancelled("cancelled").withProductId("premium"))
        queryFailure.complete(OpenIapError.ServiceDisconnected("owned-purchase query failed"))

        assertEquals(ErrorCode.UserCancelled, assertIs<PurchaseException>(earlier.await().exceptionOrNull()).error.code)
        assertEquals(ErrorCode.ServiceDisconnected, assertIs<PurchaseException>(waiting.await().exceptionOrNull()).error.code)
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
    fun `a drop while initConnection is still resuming survives its success`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            var connects = 0
            val setupFinished = CompletableDeferred<Boolean>()
            val attached = AttachedListeners()
            val init: MutationInitConnectionHandler = { connects++; if (connects == 1) setupFinished.await() else true }
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

            val first = async(start = CoroutineStart.UNDISPATCHED) { delegate.initConnection(null) }
            // The store drops while initConnection is still suspended in it.
            attached.get<OpenIapConnectionStateListener>("ConnectionStateListener").onBillingServiceDisconnected()
            setupFinished.complete(true)
            assertTrue(first.await())

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

    /** openiap-google's Play request lifecycle: one request at a time, freed before its outcome is emitted. */
    private inner class FakePlay {
        private val updates = CopyOnWriteArraySet<OpenIapPurchaseUpdateListener>()
        private val errors = CopyOnWriteArraySet<OpenIapPurchaseErrorListener>()
        private val choices = CopyOnWriteArraySet<OpenIapUserChoiceBillingListener>()
        private var pending: CompletableDeferred<List<dev.hyo.openiap.Purchase>>? = null
        val isPending get() = pending != null
        // The owned-purchase query each request runs before Play admits it; an error ends the request.
        var ownershipQuery: suspend () -> OpenIapError? = { null }

        private val request: MutationRequestPurchaseHandler = request@{
            ownershipQuery()?.let { failure ->
                errors.forEach { it.onPurchaseError(failure) }
                return@request dev.hyo.openiap.RequestPurchaseResultPurchases(emptyList())
            }
            if (pending != null) {
                val busy = OpenIapError.DeveloperError("Another purchase is already in progress")
                errors.forEach { it.onPurchaseError(busy) }
                throw busy
            }
            val outcome = CompletableDeferred<List<dev.hyo.openiap.Purchase>>().also { pending = it }
            dev.hyo.openiap.RequestPurchaseResultPurchases(outcome.await())
        }

        val module = fakeModule { method, args ->
            when (method) {
                "addPurchaseUpdateListener" -> updates.add(args!![0] as OpenIapPurchaseUpdateListener)
                "removePurchaseUpdateListener" -> updates.remove(args!![0])
                "addPurchaseErrorListener" -> errors.add(args!![0] as OpenIapPurchaseErrorListener)
                "removePurchaseErrorListener" -> errors.remove(args!![0])
                "addUserChoiceBillingListener" -> choices.add(args!![0] as OpenIapUserChoiceBillingListener)
                "removeUserChoiceBillingListener" -> choices.remove(args!![0])
                "getRequestPurchase" -> request
                else -> if (method.endsWith("Listener")) null else error("Unexpected call: $method")
            }
        }

        private fun claim() = checkNotNull(pending) { "No purchase is pending" }.also { pending = null }

        fun fail(error: OpenIapError) {
            val claimed = claim()
            errors.forEach { it.onPurchaseError(error) }
            claimed.complete(emptyList())
        }

        fun buy(productId: String) {
            val claimed = claim()
            val purchase = nativePurchase(productId)
            updates.forEach { it.onPurchaseUpdated(purchase) }
            claimed.complete(listOf(purchase))
        }

        fun chooseAlternativeBilling(productId: String) {
            val claimed = claim()
            val details = dev.hyo.openiap.UserChoiceBillingDetails.fromJson(
                mapOf("externalTransactionToken" to "user-$productId", "products" to listOf(productId))
            )
            choices.forEach { it.onUserChoiceBilling(details) }
            claimed.complete(emptyList())
        }

        fun deliverUnrelated(productId: String) {
            val purchase = nativePurchase(productId)
            updates.forEach { it.onPurchaseUpdated(purchase) }
        }
    }

    private fun purchaseRequest(sku: String = "premium") = RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Purchase(
            RequestPurchasePropsByPlatforms(google = RequestPurchaseAndroidProps(skus = listOf(sku)))
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
