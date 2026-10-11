package dev.hyo.martie.screens

import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseState
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ExampleReceiptRecoveryTest {
    private fun receipt(id: String = "one") = PurchaseAndroid(
        id = id, productId = ConsumableProductIds.first(), purchaseToken = "token-$id",
        purchaseState = PurchaseState.Purchased, transactionDate = 1.0, quantity = 1,
        isAutoRenewing = false, store = IapStore.Unknown, storeId = "amazon_example",
    )

    private fun recovery() = ExampleReceiptRecovery { it.productId in ConsumableProductIds }

    @Test fun noneRetainsReceiptForRetryWithoutAnOwnershipResult() {
        val recovery = recovery()
        val purchase = receipt()
        assertTrue(recovery.retain(purchase))
        assertEquals(listOf(purchase), recovery.receipts())
        assertTrue(recovery.begin(recovery.receipts().single()))
    }

    @Test fun rejectedAndFailedCompletionAttemptsRemainRetryable() {
        val recovery = recovery()
        val purchase = receipt()
        repeat(3) {
            assertTrue(recovery.begin(purchase))
            assertFalse(recovery.begin(purchase))
            recovery.retryable(purchase)
            assertEquals(listOf(purchase), recovery.receipts())
        }
        assertTrue(recovery.begin(purchase))
        recovery.completed(purchase)
        recovery.retryable(purchase)
        assertTrue(recovery.receipts().isEmpty())
        assertFalse(recovery.begin(purchase))
        assertFalse(recovery.retain(purchase))
    }

    @Test fun completingOneReceiptDoesNotLoseOthersWithTheSameProduct() {
        val recovery = recovery()
        val first = receipt()
        val second = receipt("two")
        assertTrue(recovery.begin(first))
        assertTrue(recovery.retain(second))
        recovery.completed(first)
        assertEquals(listOf(second), recovery.receipts())
        assertTrue(recovery.begin(second))
    }

    @Test fun duplicateCallbacksCannotDispatchWhileAReceiptIsInFlight() {
        val recovery = recovery()
        val purchase = receipt()
        assertTrue(recovery.begin(purchase))
        repeat(3) {
            assertTrue(recovery.retain(purchase))
            assertFalse(recovery.begin(purchase))
        }
        assertEquals(listOf(purchase), recovery.receipts())
    }

    @Test fun recoverySnapshotSurvivesCompletionDuringReplay() {
        val recovery = recovery()
        val receipts = listOf(receipt(), receipt("two"))
        receipts.forEach { recovery.retain(it) }
        val dispatched = mutableListOf<String>()
        recovery.receipts().forEach {
            assertTrue(recovery.begin(it))
            dispatched += it.id
            recovery.completed(it)
        }
        assertEquals(receipts.map { it.id }, dispatched)
        assertTrue(recovery.receipts().isEmpty())
    }

    @Test fun providersWithTheSameReceiptIdRemainSeparate() {
        val recovery = recovery()
        val first = receipt()
        val otherProvider = first.copy(storeId = "other_provider")
        assertTrue(recovery.begin(first))
        assertTrue(recovery.begin(otherProvider))
        recovery.completed(first)
        assertEquals(listOf(otherProvider), recovery.receipts())
    }

    @Test fun pendingForeignAndUnidentifiablePurchasesAreNeverRetained() {
        val recovery = recovery()
        for (purchase in listOf(receipt().copy(purchaseState = PurchaseState.Pending),
            receipt().copy(purchaseState = PurchaseState.Unknown),
            receipt().copy(productId = "foreign"), receipt().copy(id = "", purchaseToken = null))) {
            assertFalse(recovery.retain(purchase))
            assertFalse(recovery.begin(purchase))
        }
        assertTrue(recovery.receipts().isEmpty())
    }

    @Test fun tokenIdentifiesAReceiptWhenTransactionIdIsAbsent() {
        val recovery = recovery()
        val purchase = receipt().copy(id = "")
        assertTrue(recovery.begin(purchase))
        assertFalse(recovery.begin(purchase))
        recovery.retryable(purchase)
        assertTrue(recovery.begin(purchase))
    }

    @Test fun subscriptionTermCallbackAndRestoredBaseShareCompletionIdentity() {
        val recovery = ExampleReceiptRecovery { subscriptionProductId(it) in SubscriptionProductIds }
        val callback = receipt().copy(productId = SubscriptionProductIds.first(), isAutoRenewing = true)
        val restored = callback.copy(productId = "dev.hyo.martie.premium.base",
            currentPlanId = SubscriptionProductIds.first())
        assertTrue(recovery.begin(callback))
        assertFalse(recovery.begin(restored))
        assertEquals(1, recovery.receipts().size)
        recovery.completed(callback)
        recovery.retryable(callback)
        assertFalse(recovery.retain(restored))
        assertFalse(recovery.begin(restored))
        assertTrue(recovery.receipts().isEmpty())
    }
}
