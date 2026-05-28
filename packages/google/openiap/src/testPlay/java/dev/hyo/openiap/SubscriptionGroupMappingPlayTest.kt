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

    private fun purchase(productId: String, token: String): PurchaseAndroid = PurchaseAndroid(
        autoRenewingAndroid = true,
        currentPlanId = productId,
        dataAndroid = "{}",
        id = token,
        ids = listOf(productId),
        isAcknowledgedAndroid = true,
        isAutoRenewing = true,
        packageNameAndroid = "dev.hyo.martie",
        platform = IapPlatform.Android,
        productId = productId,
        purchaseState = PurchaseState.Purchased,
        purchaseToken = token,
        quantity = 1,
        signatureAndroid = null,
        store = IapStore.Google,
        transactionDate = 1_700_000_000_000.0,
        transactionId = token
    )
}
