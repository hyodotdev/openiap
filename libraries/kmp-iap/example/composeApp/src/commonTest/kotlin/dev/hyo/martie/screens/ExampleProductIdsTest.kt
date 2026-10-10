package dev.hyo.martie.screens

import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.PurchaseAndroid
import io.github.hyochan.kmpiap.openiap.PurchaseState
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ExampleProductIdsTest {
    private fun restored(term: String?, store: IapStore = IapStore.Unknown, storeId: String = "amazon_example") =
        PurchaseAndroid(
            id = "receipt",
            productId = "dev.hyo.martie.premium.base",
            currentPlanId = term,
            purchaseToken = "receipt",
            purchaseState = PurchaseState.Purchased,
            transactionDate = 1.0,
            quantity = 1,
            isAutoRenewing = true,
            store = store,
            storeId = storeId,
        )

    @Test fun restoredAmazonTermsPreserveReceiptIdentity() {
        for (term in SubscriptionProductIds) {
            for ((store, storeId) in listOf(IapStore.Amazon to "amazon", IapStore.Unknown to "amazon_example")) {
                val purchase = restored(term, store, storeId)
                assertEquals(term, subscriptionProductId(purchase))
                assertEquals("dev.hyo.martie.premium.base", purchase.productId)
                assertEquals("receipt", purchase.purchaseToken)
                assertEquals(purchase.productId, verificationProductId(purchase.productId, verificationStore(purchase)))
            }
        }
        assertTrue("dev.hyo.martie.premium.base" in SubscriptionQueryIds)
        assertEquals(SubscriptionProductIds.first(), subscriptionProductId(restored(null, IapStore.Google, "play").copy(
            productId = SubscriptionProductIds.first(), currentPlanId = "premium-monthly",
        )))
    }

    @Test fun missingForeignTermsAndProvidersStayUnrecognized() {
        assertNull(subscriptionProductId(restored(null)))
        assertNull(subscriptionProductId(restored("foreign.term")))
        assertNull(subscriptionProductId(restored(SubscriptionProductIds.first(), storeId = "foreign")))
        assertNull(subscriptionProductId(restored(SubscriptionProductIds.first()).copy(productId = "foreign.base")))
    }
}
