package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.IapkitPurchaseState
import io.github.hyochan.kmpiap.openiap.PendingPurchaseUpdateAndroid
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseState
import io.github.hyochan.kmpiap.openiap.PurchaseVerificationProvider
import io.github.hyochan.kmpiap.openiap.RequestPurchaseAndroidProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseIosProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import io.github.hyochan.kmpiap.openiap.RequestPurchasePropsByPlatforms
import io.github.hyochan.kmpiap.openiap.RequestSubscriptionAndroidProps
import io.github.hyochan.kmpiap.openiap.RequestSubscriptionPropsByPlatforms
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitResult
import io.github.hyochan.kmpiap.openiap.VerifyPurchaseWithProviderResult
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlin.time.Clock
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest

@OptIn(ExperimentalCoroutinesApi::class)
class PurchaseFlowTest {
    private fun purchase(
        id: String = "tx-1",
        productId: String = "premium",
        acknowledged: Boolean? = null,
        pendingChange: List<String>? = null,
        transactionDate: Double = 0.0,
    ) = PurchaseAndroid(
        id = id,
        productId = productId,
        purchaseState = PurchaseState.Purchased,
        purchaseToken = "token-$id",
        quantity = 1,
        store = IapStore.Google,
        storeId = "play",
        isAcknowledgedAndroid = acknowledged,
        pendingPurchaseUpdateAndroid = pendingChange?.let { PendingPurchaseUpdateAndroid(it, "token-change") },
        isAutoRenewing = false,
        transactionDate = transactionDate,
    )

    private fun TestScope.flowWith(
        confirm: suspend (Purchase, Boolean) -> PurchaseConfirmation,
        listenForPurchases: Flow<Purchase>? = null,
        getAvailablePurchases: suspend () -> List<Purchase> = { emptyList() },
        scope: CoroutineScope = backgroundScope,
        isConsumable: (String) -> Boolean = { false },
        finishTransaction: suspend (Purchase, Boolean) -> Unit = { _, _ -> },
    ) = PurchaseFlow(
        scope = scope,
        confirmWithBackend = confirm,
        isConsumable = isConsumable,
        finishTransaction = finishTransaction,
        getAvailablePurchases = getAvailablePurchases,
        getPendingTransactionsIOS = null,
        listenForPurchases = listenForPurchases,
        endsRequest = null,
        onDispose = {},
        wasRequested = { false },
        confirmTimeout = 30.seconds,
    )

    private fun TestScope.collect(flow: PurchaseFlow): List<PurchaseFlowOutcome> = mutableListOf<PurchaseFlowOutcome>().also { seen ->
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { flow.outcomes.collect { seen += it } }
    }

    @Test
    fun anOutcomeWaitsForTheNextCollectorAndIsNotReplayedAfterIt() = runTest {
        val flow = flowWith({ _, _ -> PurchaseConfirmation.Entitled(alreadyGranted = false) })

        flow.processPurchase(purchase(id = "a"))
        assertEquals("a", flow.outcomes.first().purchase.id)

        val revisit = collect(flow)
        runCurrent()
        assertEquals(emptyList(), revisit)
        flow.processPurchase(purchase(id = "b"))
        val later = collect(flow)
        runCurrent()

        assertEquals(listOf("b"), revisit.map { it.purchase.id })
        assertEquals(emptyList(), later)
    }

    @Test
    fun disposeEndsCollectionAndALaterCollectorEndsAtOnce() = runTest {
        val flow = flowWith({ _, _ -> PurchaseConfirmation.Entitled(alreadyGranted = false) })
        val live = backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { flow.outcomes.collect {} }

        flow.dispose()
        runCurrent()
        flow.processPurchase(purchase(id = "after"))

        assertTrue(live.isCompleted)
        assertEquals(emptyList(), flow.outcomes.toList())
        assertEquals(emptyList(), flow.outcomes.toList())
    }

    @Test
    fun deliveriesInTheSameTickShareOneRun() = runTest {
        var confirms = 0
        val store = MutableSharedFlow<Purchase>(extraBufferCapacity = 2)
        val flow = flowWith({ _, _ -> confirms++; PurchaseConfirmation.Entitled(alreadyGranted = false) }, store)
        val published = collect(flow)
        runCurrent()

        store.tryEmit(purchase())
        store.tryEmit(purchase())
        runCurrent()

        assertEquals(1, confirms)
        assertEquals(listOf("tx-1"), published.map { it.purchase.id })
    }

    @Test
    fun anErrorFromTheBackendCallFailsOnlyItsPurchase() = runTest {
        val store = MutableSharedFlow<Purchase>(extraBufferCapacity = 1)
        val flow = flowWith(
            { purchase, _ ->
                if (purchase.id == "broken") TODO("backend")
                PurchaseConfirmation.Entitled(alreadyGranted = false)
            },
            store,
        )
        val published = collect(flow)
        runCurrent()

        val failed = assertIs<PurchaseFlowStatus.Failed>(flow.processPurchase(purchase(id = "broken")))
        assertIs<NotImplementedError>(failed.error)
        store.tryEmit(purchase(id = "fine"))
        runCurrent()

        assertEquals(listOf("broken", "fine"), published.map { it.purchase.id })
        assertTrue(backgroundScope.isActive)
    }

    @Test
    fun disposeStopsARecoveryPassBeforeItsNextPurchase() = runTest {
        val answer = CompletableDeferred<PurchaseConfirmation>()
        var confirms = 0
        val flow = flowWith(
            { _, _ -> confirms++; answer.await() },
            getAvailablePurchases = { listOf(purchase(id = "a", acknowledged = false), purchase(id = "b", acknowledged = false)) },
        )

        val recovered = async { flow.recoverPurchases() }
        runCurrent()
        flow.dispose()
        answer.complete(PurchaseConfirmation.Entitled(alreadyGranted = false))

        assertEquals(listOf("a"), recovered.await().map { it.purchase.id })
        assertEquals(1, confirms)
    }

    @Test
    fun finishingUsesTheConsumabilityConfirmationSaw() = runTest {
        var reads = 0
        val finished = mutableListOf<Boolean>()
        val flow = flowWith(
            { _, _ -> PurchaseConfirmation.Entitled(alreadyGranted = false) },
            // A config refresh between confirming and finishing.
            isConsumable = { reads++ == 0 },
            finishTransaction = { _, consumable -> finished += consumable },
        )

        flow.processPurchase(purchase(productId = "coins"))

        assertEquals(listOf(true), finished)
        assertEquals(1, reads)
    }

    @Test
    fun aFlowNeedsAnActiveScope() = runTest {
        val ended = CoroutineScope(Job().apply { cancel() })

        val error = assertFailsWith<IllegalStateException> {
            flowWith({ _, _ -> PurchaseConfirmation.StorePending }, scope = ended)
        }
        assertEquals("createPurchaseFlow needs an active scope; this one has ended", error.message)
    }

    @Test
    fun aRunJoinedByARequestedDeliveryPublishesAsRequested() = runTest {
        val answer = CompletableDeferred<PurchaseConfirmation>()
        var confirms = 0
        val store = MutableSharedFlow<Purchase>(extraBufferCapacity = 1)
        val flow = flowWith({ _, _ -> confirms++; answer.await() }, listenForPurchases = store)
        val published = collect(flow)
        runCurrent()

        store.tryEmit(purchase())
        runCurrent()
        val processed = async { flow.processPurchase(purchase()) }
        runCurrent()
        answer.complete(PurchaseConfirmation.Invalid(reason = "expired"))

        assertEquals(PurchaseFlowStatus.Invalid(reason = "expired"), processed.await())
        runCurrent()
        assertEquals(listOf<PurchaseFlowStatus>(PurchaseFlowStatus.Invalid(reason = "expired")), published.map { it.status })
        assertEquals(1, confirms)
    }

    @Test
    fun aHungConfirmationFailsAfterTheTimeoutAndNoLongerHoldsThePurchase() = runTest {
        var confirms = 0
        val flow = flowWith({ _, _ -> confirms++; awaitCancellation() })

        val first = async { flow.processPurchase(purchase()) }
        advanceTimeBy(29_999)
        runCurrent()
        assertTrue(first.isActive)
        advanceTimeBy(2)

        val failed = assertIs<PurchaseFlowStatus.Failed>(first.await())
        assertEquals("confirmWithBackend did not answer within 30s", failed.error.message)
        val second = async { flow.processPurchase(purchase()) }
        runCurrent()
        assertEquals(2, confirms)
        second.cancel()
    }

    @Test
    fun concurrentRecoveriesShareOnePassAndAFailedReadReachesTheCaller() = runTest {
        var reads = 0
        val listed = CompletableDeferred<List<Purchase>>()
        val flow = flowWith(
            { _, _ -> PurchaseConfirmation.Entitled(alreadyGranted = true) },
            getAvailablePurchases = {
                reads++
                if (reads == 2) throw IllegalStateException("not connected")
                listed.await()
            },
        )

        val first = async { flow.recoverPurchases() }
        val second = async { flow.recoverPurchases() }
        runCurrent()
        listed.complete(listOf(purchase(acknowledged = false)))
        assertEquals(first.await(), second.await())
        assertEquals(1, first.await().size)
        assertEquals(1, reads)

        assertEquals("not connected", assertFailsWith<IllegalStateException> { flow.recoverPurchases() }.message)
        // The failed pass is gone and the scope still runs the next one.
        assertEquals(emptyList(), flow.recoverPurchases())
    }

    @Test
    fun anUngrantedOwnershipConflictIsConfirmedAgainOnItsNextDelivery() = runTest {
        var confirms = 0
        val flow = flowWith({ _, _ -> confirms++; PurchaseConfirmation.OwnershipConflict(alreadyGranted = false) })

        flow.processPurchase(purchase())
        flow.processPurchase(purchase())

        assertEquals(2, confirms)
    }

    @Test
    fun iapkitEvidenceFromAnotherCommunityStoreIsRefused() {
        val receipt = purchase().copy(store = IapStore.Unknown, storeId = "amazon_example")
        val result = VerifyPurchaseWithProviderResult(
            iapkit = RequestVerifyPurchaseWithIapkitResult(
                isValid = true,
                state = IapkitPurchaseState.Entitled,
                store = IapStore.Unknown,
                productId = "premium",
                environment = "Production",
                storeId = "other_adapter",
            ),
            provider = PurchaseVerificationProvider.Iapkit,
        )
        val options = IapkitConfirmationOptions(verifyAs = { IapStore.Amazon })

        val error = assertFailsWith<IllegalStateException> {
            iapkitVerification(result, receipt, isConsumable = false, options)
        }
        assertEquals("IAPKit verified store id other_adapter, expected amazon_example", error.message)
    }

    @Test
    fun backendAnswersOffTheContractAreRefused() {
        val offContract = listOf(
            "null",
            "\"entitled\"",
            "not json",
            """{"status":"granted"}""",
            """{"status":"entitled"}""",
            """{"status":"entitled","alreadyGranted":"yes"}""",
            """{"status":"ownership_conflict"}""",
            """{"status":"verification_delayed"}""",
            """{"status":"verification_delayed","retryAfterMs":-1}""",
            """{"status":"verification_delayed","retryAfterMs":"5000"}""",
        )
        for (body in offContract) {
            assertFailsWith<IllegalArgumentException>(body) { PurchaseConfirmation.fromJson(body) }
        }
        assertEquals(
            PurchaseConfirmation.Linked(),
            PurchaseConfirmation.fromJson("""{"status":"linked","retryAfterMs":1e400,"extra":true}"""),
        )
        assertEquals(
            PurchaseConfirmation.Invalid(reason = "EXPIRED"),
            PurchaseConfirmation.fromJson("""{"status":"invalid","reason":"EXPIRED"}"""),
        )
    }

    @Test
    fun requestMarksMatchTheProductOrItsPendingChangeOnceAndClearOnError() {
        val requests = PurchaseRequests()
        // A plan change requests its target.
        requests.mark(
            RequestPurchaseProps(
                request = RequestPurchaseProps.Request.Subscription(
                    RequestSubscriptionPropsByPlatforms(
                        google = RequestSubscriptionAndroidProps(skus = listOf("yearly"), purchaseToken = "monthly-token"),
                    )
                ),
                type = ProductQueryType.Subs,
            )
        )

        assertFalse(requests.wasRequested(purchase(productId = "monthly")))
        assertTrue(requests.wasRequested(purchase(productId = "monthly", pendingChange = listOf("yearly"))))
        assertFalse(requests.wasRequested(purchase(productId = "yearly")))

        requests.mark(
            RequestPurchaseProps(
                request = RequestPurchaseProps.Request.Purchase(
                    RequestPurchasePropsByPlatforms(
                        apple = RequestPurchaseIosProps(sku = "coins"),
                        google = RequestPurchaseAndroidProps(skus = listOf("coins")),
                    )
                ),
                type = ProductQueryType.InApp,
            )
        )
        requests.clear()
        assertFalse(requests.wasRequested(purchase(productId = "coins")))
    }

    @Test
    fun anOldReceiptForARequestedProductStaysUnrequested() {
        val requests = PurchaseRequests()
        requests.mark(
            RequestPurchaseProps(
                request = RequestPurchaseProps.Request.Purchase(
                    RequestPurchasePropsByPlatforms(google = RequestPurchaseAndroidProps(skus = listOf("coins")))
                ),
                type = ProductQueryType.InApp,
            )
        )
        val now = Clock.System.now().toEpochMilliseconds().toDouble()

        assertFalse(requests.wasRequested(purchase(productId = "coins", transactionDate = now - 20 * 60_000)))
        // A device clock running minutes ahead still counts the user's own purchase.
        assertTrue(requests.wasRequested(purchase(productId = "coins", transactionDate = now - 5 * 60_000)))
    }

    @Test
    fun confirmationRequestCarriesOnlyAppleOrGoogleEvidence() {
        assertEquals(
            PurchaseConfirmationRequest(IapStore.Google, "token-tx-1", "premium"),
            toPurchaseConfirmationRequest(purchase()),
        )
        for (item in listOf(
            purchase().copy(store = IapStore.Amazon),
            purchase().copy(purchaseToken = null),
            purchase().copy(purchaseToken = ""),
        )) {
            assertFailsWith<IllegalArgumentException> { toPurchaseConfirmationRequest(item) }
        }
        assertFailsWith<IllegalArgumentException> { toPurchaseConfirmationRequest(purchase().copy(quantity = 2)) }
    }
}
