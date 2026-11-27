package io.github.hyochan.kmpiap

import dev.hyo.openiap.MutationRequestPurchaseHandler
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.RequestPurchaseAndroidProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import io.github.hyochan.kmpiap.openiap.RequestPurchasePropsByPlatforms
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest

@OptIn(ExperimentalCoroutinesApi::class)
class PurchaseFlowBindingTest {
    @Test
    fun `the SDK flow treats a delivery as requested once per requestPurchase until an error`() = runTest {
        val attached = AttachedListeners()
        val request: MutationRequestPurchaseHandler = { null }
        val module = fakeModule { method, args ->
            when {
                attached.record(method, args) -> null
                method == "getRequestPurchase" -> request
                else -> error("Unexpected call: $method")
            }
        }
        val iap = KmpIAP(delegateFor(Store.HORIZON, module, registerListeners = true))
        val flow = iap.createPurchaseFlow(
            scope = backgroundScope,
            confirmWithBackend = { _, _ -> PurchaseConfirmation.Invalid(reason = "expired") },
            isConsumable = { false },
        )
        val published = mutableListOf<PurchaseFlowOutcome>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { flow.outcomes.collect { published += it } }
        runCurrent()
        fun deliver(id: String) {
            attached.get<OpenIapPurchaseUpdateListener>("PurchaseUpdateListener").onPurchaseUpdated(horizonPurchase(id))
            runCurrent()
        }

        iap.requestPurchase(premiumRequest())
        deliver("requested")
        deliver("renewal")
        iap.requestPurchase(premiumRequest())
        attached.get<OpenIapPurchaseErrorListener>("PurchaseErrorListener")
            .onPurchaseError(OpenIapError.UserCancelled("cancelled"))
        runCurrent()
        deliver("after-cancel")

        assertEquals(
            listOf("requested" to false, "renewal" to true, "after-cancel" to true),
            published.map { it.purchase.id to (it.status as PurchaseFlowStatus.Invalid).recovered },
        )

        iap.requestPurchase(premiumRequest())
        flow.dispose()
        val afterDispose = io.github.hyochan.kmpiap.openiap.PurchaseAndroid(
            id = "after-dispose",
            isAutoRenewing = false,
            productId = "premium",
            purchaseState = io.github.hyochan.kmpiap.openiap.PurchaseState.Purchased,
            quantity = 1,
            store = io.github.hyochan.kmpiap.openiap.IapStore.Horizon,
            storeId = "horizon",
            transactionDate = System.currentTimeMillis().toDouble(),
        )
        assertFalse(iap.purchaseRequests.wasRequested(afterDispose))

        // A second dispose leaves the next flow's requests alone.
        iap.requestPurchase(premiumRequest())
        flow.dispose()
        assertTrue(iap.purchaseRequests.wasRequested(afterDispose))
    }

    @Test
    fun `a refused double tap keeps the purchase in flight requested`() = runTest {
        val attached = AttachedListeners()
        var requests = 0
        val request: MutationRequestPurchaseHandler = {
            if (requests++ > 0) throw OpenIapError.PurchaseInProgress()
            null
        }
        val module = fakeModule { method, args ->
            when {
                attached.record(method, args) -> null
                method == "getRequestPurchase" -> request
                else -> error("Unexpected call: $method")
            }
        }
        val iap = KmpIAP(delegateFor(Store.HORIZON, module, registerListeners = true))

        val flow = iap.createPurchaseFlow(
            scope = backgroundScope,
            confirmWithBackend = { _, _ -> PurchaseConfirmation.Invalid(reason = "expired") },
            isConsumable = { false },
        )
        runCurrent()
        iap.requestPurchase(premiumRequest())
        // Android reports the refusal on the error listener; a call that throws undoes only its own marks.
        attached.get<OpenIapPurchaseErrorListener>("PurchaseErrorListener")
            .onPurchaseError(OpenIapError.PurchaseInProgress())
        runCurrent()
        assertTrue(runCatching { iap.requestPurchase(premiumRequest()) }.isFailure)

        assertTrue(iap.purchaseRequests.wasRequested(premiumPurchase()))
        flow.dispose()
    }

    @Test
    fun `two overlapping requests that fail leave no mark, in either order`() {
        for (earlierFailsFirst in listOf(true, false)) {
            val requests = PurchaseRequests()
            val undoEarlier = requests.mark(premiumRequest())
            val undoLater = requests.mark(premiumRequest())
            if (earlierFailsFirst) {
                undoEarlier()
                undoLater()
            } else {
                undoLater()
                undoEarlier()
            }
            assertFalse(requests.wasRequested(premiumPurchase()), "earlierFailsFirst=$earlierFailsFirst")
        }
    }

    @Test
    fun `a failed request keeps an overlapping live request marked`() {
        val requests = PurchaseRequests()
        requests.mark(premiumRequest())
        requests.mark(premiumRequest())()
        assertTrue(requests.wasRequested(premiumPurchase()))
    }

    @Test
    fun `each purchase answers only its own request for the same product`() {
        val requests = PurchaseRequests()
        requests.mark(premiumRequest())
        requests.mark(premiumRequest())
        assertTrue(requests.wasRequested(premiumPurchase()))
        assertTrue(requests.wasRequested(premiumPurchase()))
        assertFalse(requests.wasRequested(premiumPurchase()))
    }

    private fun premiumPurchase() = io.github.hyochan.kmpiap.openiap.PurchaseAndroid(
        id = "in-flight",
        isAutoRenewing = false,
        productId = "premium",
        purchaseState = io.github.hyochan.kmpiap.openiap.PurchaseState.Purchased,
        quantity = 1,
        store = io.github.hyochan.kmpiap.openiap.IapStore.Horizon,
        storeId = "horizon",
        transactionDate = System.currentTimeMillis().toDouble(),
    )

    private fun premiumRequest() = RequestPurchaseProps(
        request = RequestPurchaseProps.Request.Purchase(
            RequestPurchasePropsByPlatforms(google = RequestPurchaseAndroidProps(skus = listOf("premium")))
        ),
        type = ProductQueryType.InApp,
    )

    private fun horizonPurchase(id: String) = dev.hyo.openiap.PurchaseAndroid(
        id = id,
        isAutoRenewing = false,
        productId = "premium",
        purchaseState = dev.hyo.openiap.PurchaseState.Purchased,
        purchaseToken = "token-$id",
        quantity = 1,
        store = dev.hyo.openiap.IapStore.Horizon,
        storeId = "horizon",
        transactionDate = System.currentTimeMillis().toDouble(),
    )
}
