package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class StoreIdentityTest {
    private fun payload(store: String) =
        mapOf<String, Any?>(
            "store" to store,
            "id" to "txn",
            "productId" to "sku",
            "quantity" to 1,
            "isAutoRenewing" to false,
            "purchaseState" to "purchased",
            "transactionDate" to 1.0,
        )

    @Test fun `legacy official identities decode and round trip`() {
        for ((store, id) in mapOf("apple" to "apple", "google" to "play", "horizon" to "horizon", "amazon" to "amazon")) {
            val purchase = PurchaseAndroid.fromJson(payload(store))
            assertEquals(id, purchase.storeId)
            assertEquals(id, PurchaseAndroid.fromJson(purchase.toJson()).storeId)
        }
    }

    @Test fun `community identity round trips and invalid identities fail`() {
        val json = payload("unknown") + ("storeId" to "community_fixture")
        assertEquals("community_fixture", PurchaseAndroid.fromJson(PurchaseAndroid.fromJson(json).toJson()).storeId)
        for (id in listOf(null, "", "auto", "none", "unknown", "apple", "play", "google", "amazon", "horizon", "Bad id", "with-hyphen", "store\n", 42)) {
            assertThrows(IllegalArgumentException::class.java) { PurchaseAndroid.fromJson(payload("unknown") + ("storeId" to id)) }
        }
        assertThrows(IllegalArgumentException::class.java) { PurchaseAndroid.fromJson(payload("google") + ("storeId" to "other")) }
    }

    @Test fun `result copies preserve additive values and compare identities`() {
        val original =
            RequestVerifyPurchaseWithIapkitResult.fromJson(
                mapOf(
                    "isValid" to true,
                    "state" to "entitled",
                    "store" to "unknown",
                    "clientPayload" to mapOf("body" to "signed", "format" to "json", "updatedAt" to 1.0, "version" to 1.0),
                    "storeId" to "community_fixture",
                    "productId" to "sku",
                    "environment" to "sandbox",
                ),
            )
        val copy = original.copy(isValid = false)
        assertEquals(original.storeId, copy.storeId)
        assertEquals(original.productId, copy.productId)
        assertEquals(original.environment, copy.environment)
        assertEquals(original.clientPayload, copy.clientPayload)
        assertEquals(original, original.copy())
        assertEquals(original.hashCode(), original.copy().hashCode())
        val other = RequestVerifyPurchaseWithIapkitResult.fromJson(original.toJson() + ("storeId" to "other_store"))
        assertNotEquals(original, other)
    }
}
