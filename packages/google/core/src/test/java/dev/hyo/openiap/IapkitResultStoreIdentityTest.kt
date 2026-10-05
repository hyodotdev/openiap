package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class IapkitResultStoreIdentityTest {
    @Test fun `legacy official results derive and round trip their store id`() {
        for ((store, id) in listOf(
            IapStore.Apple to "apple",
            IapStore.Google to "play",
            IapStore.Horizon to "horizon",
            IapStore.Amazon to "amazon",
        )) {
            val result = RequestVerifyPurchaseWithIapkitResult(true, IapkitPurchaseState.Entitled, store)
            assertEquals(id, result.storeId)
            val roundTripped = RequestVerifyPurchaseWithIapkitResult.fromJson(result.toJson())
            assertEquals(id, roundTripped.storeId)
            assertEquals(store, roundTripped.store)
        }
    }

    @Test fun `unknown without an explicit store id fails fast`() {
        assertThrows(IllegalArgumentException::class.java) {
            RequestVerifyPurchaseWithIapkitResult(true, IapkitPurchaseState.Entitled, IapStore.Unknown)
        }
        assertThrows(IllegalArgumentException::class.java) {
            RequestVerifyPurchaseWithIapkitResult(true, IapkitPurchaseState.Entitled, IapStore.Unknown, null, null)
        }
        assertThrows(IllegalArgumentException::class.java) {
            RequestVerifyPurchaseWithIapkitResult.fromJson(mapOf("isValid" to true, "state" to "entitled", "store" to "unknown"))
        }
    }

    @Test fun `explicit store ids must match their store`() {
        val community = RequestVerifyPurchaseWithIapkitResult(true, IapkitPurchaseState.Entitled, IapStore.Unknown, null, null, null, "community-fixture")
        assertEquals("community-fixture", community.storeId)
        assertEquals("community-fixture", RequestVerifyPurchaseWithIapkitResult.fromJson(community.toJson()).storeId)
        for (id in listOf("unknown", "", "auto", "none", "apple", "play", "Bad id")) {
            assertThrows(IllegalArgumentException::class.java) {
                RequestVerifyPurchaseWithIapkitResult(true, IapkitPurchaseState.Entitled, IapStore.Unknown, null, null, null, id)
            }
            assertThrows(IllegalArgumentException::class.java) {
                RequestVerifyPurchaseWithIapkitResult.fromJson(mapOf("isValid" to true, "state" to "entitled", "store" to "unknown", "storeId" to id))
            }
        }
        assertThrows(IllegalArgumentException::class.java) {
            RequestVerifyPurchaseWithIapkitResult(true, IapkitPurchaseState.Entitled, IapStore.Google, null, null, null, "amazon")
        }
        assertThrows(IllegalArgumentException::class.java) {
            RequestVerifyPurchaseWithIapkitResult.fromJson(mapOf("isValid" to true, "state" to "entitled", "store" to "google", "storeId" to "amazon"))
        }
    }

    @Test fun `copy keeps store and store id consistent`() {
        val google = RequestVerifyPurchaseWithIapkitResult(true, IapkitPurchaseState.Entitled, IapStore.Google)
        assertEquals("play", google.storeId)
        val amazon = google.copy(store = IapStore.Amazon)
        assertEquals(IapStore.Amazon, amazon.store)
        assertEquals("amazon", amazon.storeId)
        assertEquals("play", google.copy().storeId)
        assertThrows(IllegalArgumentException::class.java) { google.copy(store = IapStore.Unknown) }
        val community = google.copy(store = IapStore.Unknown, storeId = "community-fixture")
        assertEquals("community-fixture", community.storeId)
        assertThrows(IllegalArgumentException::class.java) { google.copy(store = IapStore.Amazon, storeId = "play") }
    }

    @Test fun `copy keeps a community store id when the store is unchanged`() {
        val community = RequestVerifyPurchaseWithIapkitResult(true, IapkitPurchaseState.Entitled, IapStore.Unknown, null, null, null, "amazon-example")
        val updated = community.copy(isValid = false)
        assertEquals(false, updated.isValid)
        assertEquals(IapStore.Unknown, updated.store)
        assertEquals("amazon-example", updated.storeId)
    }

    @Test fun `descriptor rejects missing or blank identities`() {
        val valid = mapOf<String, Any?>(
            "capabilities" to listOf("pendingPurchases"),
            "clientProtocolVersion" to "0.2.0",
            "coreVersion" to "3.6.2",
            "platform" to "android",
            "storeId" to "community-fixture",
        )
        assertEquals("community-fixture", StoreProviderDescriptor.fromJson(valid).storeId)
        for (field in listOf("storeId", "coreVersion", "clientProtocolVersion")) {
            assertThrows(IllegalArgumentException::class.java) { StoreProviderDescriptor.fromJson(valid - field) }
            for (blank in listOf("", "   ")) {
                assertThrows(IllegalArgumentException::class.java) { StoreProviderDescriptor.fromJson(valid + (field to blank)) }
            }
        }
        assertThrows(IllegalArgumentException::class.java) { StoreProviderDescriptor.fromJson(valid - "capabilities") }
    }
}
