package dev.hyo.martie.util

import dev.hyo.openiap.IapStore
import dev.hyo.openiap.IapkitPurchaseState
import dev.hyo.openiap.PurchaseAndroid
import dev.hyo.openiap.PurchaseState
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class IapkitConfigTest {
    private val subscription = PurchaseAndroid(
        id = "receipt",
        isAutoRenewing = false,
        productId = "dev.hyo.martie.premium",
        purchaseState = PurchaseState.Purchased,
        purchaseToken = "receipt",
        quantity = 1,
        store = IapStore.Unknown,
        storeId = "amazon_example",
        transactionDate = 1.0,
    )

    private fun verified(
        purchase: PurchaseAndroid = subscription,
        valid: Boolean = true,
        state: IapkitPurchaseState = IapkitPurchaseState.Entitled,
        store: IapStore = purchase.store,
        storeId: String = purchase.storeId,
        productId: String = IapkitConfig.verificationProductId(purchase.productId, IapkitConfig.verificationStore(purchase)),
        environment: String = if (IapkitConfig.amazonRvsSandbox) "Sandbox" else "Production",
    ) = RequestVerifyPurchaseWithIapkitResult(
        isValid = valid,
        state = state,
        store = store,
        storeId = storeId,
        productId = productId,
        environment = environment,
    )

    @Test fun communitySubscriptionKeepsIdentityAndMatchesAmazonBase() {
        assertTrue(IapkitConfig.verificationStore(subscription) == IapStore.Amazon)
        assertTrue(IapkitConfig.acceptsVerification(verified(), subscription))
        assertFalse(IapkitConfig.acceptsVerification(verified(store = IapStore.Amazon, storeId = "amazon"), subscription))
    }

    @Test fun foreignOrUnconfiguredProviderCannotGrant() {
        assertFalse(IapkitConfig.acceptsVerification(verified(storeId = "foreign"), subscription))
        val foreign = subscription.copy(storeId = "foreign")
        assertTrue(IapkitConfig.verificationStore(foreign) == IapStore.Unknown)
        assertFalse(IapkitConfig.acceptsVerification(verified(purchase = foreign), foreign))
    }

    @Test fun productAndEnvironmentMustMatch() {
        assertFalse(IapkitConfig.acceptsVerification(verified(productId = "foreign.product"), subscription))
        assertFalse(IapkitConfig.acceptsVerification(verified(environment = if (IapkitConfig.amazonRvsSandbox) "Production" else "Sandbox"), subscription))
    }

    @Test fun onlyConsumablesAcceptReadyToConsume() {
        assertFalse(IapkitConfig.acceptsVerification(verified(state = IapkitPurchaseState.ReadyToConsume), subscription))
        val consumable = subscription.copy(productId = "dev.hyo.martie.10bulbs")
        assertTrue(IapkitConfig.acceptsVerification(verified(purchase = consumable, state = IapkitPurchaseState.ReadyToConsume), consumable))
        assertFalse(IapkitConfig.acceptsVerification(verified(purchase = consumable), consumable))
    }

    @Test fun invalidOrMissingVerificationCannotGrant() {
        assertFalse(IapkitConfig.acceptsVerification(null, subscription))
        assertFalse(IapkitConfig.acceptsVerification(verified(valid = false), subscription))
    }

    @Test fun officialAmazonAndGoogleRemainSupported() {
        val amazon = subscription.copy(store = IapStore.Amazon, storeId = "amazon")
        assertTrue(IapkitConfig.acceptsVerification(verified(purchase = amazon), amazon))
        val google = subscription.copy(store = IapStore.Google, storeId = "play")
        assertTrue(IapkitConfig.acceptsVerification(verified(purchase = google, state = IapkitPurchaseState.PendingAcknowledgment), google))
    }
    @Test fun restoredAmazonSubscriptionsResolveOnlyTheirExactTerm() {
        for (term in listOf("dev.hyo.martie.premium", "dev.hyo.martie.premium_year")) {
            for ((store, storeId) in listOf(IapStore.Amazon to "amazon", IapStore.Unknown to "amazon_example")) {
                val restored = subscription.copy(productId = "dev.hyo.martie.premium.base", currentPlanId = term, store = store, storeId = storeId)
                assertEquals(term, IapkitConfig.subscriptionProductId(restored))
                assertEquals("dev.hyo.martie.premium.base", restored.productId)
                assertTrue(IapkitConfig.acceptsVerification(verified(purchase = restored), restored))
                assertNull(IapkitConfig.subscriptionProductId(restored.copy(currentPlanId = null)))
                assertNull(IapkitConfig.subscriptionProductId(restored.copy(currentPlanId = "foreign.term")))
                assertNull(IapkitConfig.subscriptionProductId(restored.copy(store = IapStore.Unknown, storeId = "foreign")))
            }
        }
        assertTrue("dev.hyo.martie.premium.base" in IapkitConfig.subscriptionQueryIds)
        assertEquals(subscription.productId, IapkitConfig.subscriptionProductId(subscription.copy(store = IapStore.Google, storeId = "play", currentPlanId = "premium-year")))
    }

}
