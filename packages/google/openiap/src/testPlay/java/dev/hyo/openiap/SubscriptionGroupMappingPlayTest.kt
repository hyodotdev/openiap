package dev.hyo.openiap

import dev.hyo.openiap.utils.toActiveSubscription
import org.junit.Assert.assertEquals
import org.junit.Test

class SubscriptionGroupMappingPlayTest {

    @Test
    fun `active subscriptions keep independent product ids for multiple groups`() {
        val premium = purchase("dev.hyo.martie.premium.monthly", "token-premium")
            .toActiveSubscription()
        val pro = purchase("dev.hyo.martie.pro.monthly", "token-pro")
            .toActiveSubscription()

        assertEquals("dev.hyo.martie.premium.monthly", premium.productId)
        assertEquals("dev.hyo.martie.premium.monthly", premium.currentPlanId)
        assertEquals("token-premium", premium.purchaseToken)
        assertEquals("dev.hyo.martie.pro.monthly", pro.productId)
        assertEquals("dev.hyo.martie.pro.monthly", pro.currentPlanId)
        assertEquals("token-pro", pro.purchaseToken)
    }

    @Test
    fun `pending subscriptions are not active entitlements`() {
        val pending = purchase("dev.hyo.martie.premium", "token", PurchaseState.Pending)
            .toActiveSubscription()

        assertEquals(false, pending.isActive)
    }

    private fun purchase(
        productId: String,
        token: String,
        state: PurchaseState = PurchaseState.Purchased,
    ): PurchaseAndroid = PurchaseAndroid(
        autoRenewingAndroid = true,
        currentPlanId = productId,
        dataAndroid = "{}",
        id = token,
        ids = listOf(productId),
        isAcknowledgedAndroid = true,
        isAutoRenewing = true,
        packageNameAndroid = "dev.hyo.martie",
        productId = productId,
        purchaseState = state,
        purchaseToken = token,
        quantity = 1,
        signatureAndroid = null,
        store = IapStore.Google,
        transactionDate = 1_700_000_000_000.0,
        transactionId = token
    )
}
