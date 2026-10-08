package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.PurchaseIOS
import io.github.hyochan.kmpiap.openiap.PurchaseState
import kotlin.test.Test
import kotlin.test.assertContains

class PurchaseJsonBridgeTestIOS {
    @Test
    fun `purchase JSON keeps booleans as JSON booleans across Objective-C`() {
        for (renewing in listOf(false, true)) {
            val purchase = PurchaseIOS(
                id = "opaque-transaction",
                transactionId = "opaque-transaction",
                productId = "fixture.product",
                purchaseState = PurchaseState.Purchased,
                isAutoRenewing = renewing,
                quantity = 1,
                store = IapStore.Unknown,
                storeId = "community_fixture",
                transactionDate = 1_700_000_000_000.0,
            )
            val payload = purchase.toJson() + mapOf("nested" to listOf(mapOf("flag" to renewing)))
            val json = payload.toJsonStringIOS()
            assertContains(json, "\"isAutoRenewing\":$renewing")
            assertContains(json, "\"flag\":$renewing")
            assertContains(json, "\"storeId\":\"community_fixture\"")
        }
    }
}
