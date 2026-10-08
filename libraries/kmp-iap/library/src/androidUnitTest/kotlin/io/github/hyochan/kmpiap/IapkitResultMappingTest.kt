package io.github.hyochan.kmpiap

import dev.hyo.openiap.IapStore as AndroidIapStore
import dev.hyo.openiap.IapkitPurchaseState as AndroidIapkitPurchaseState
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitResult as AndroidRequestVerifyPurchaseWithIapkitResult
import io.github.hyochan.kmpiap.openiap.IapStore
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class IapkitResultMappingTest {
    @Test
    fun `official iapkit identities map through unchanged`() {
        val cases = listOf(
            Triple(AndroidIapStore.Google, IapStore.Google, "play"),
            Triple(AndroidIapStore.Horizon, IapStore.Horizon, "horizon"),
            Triple(AndroidIapStore.Amazon, IapStore.Amazon, "amazon"),
        )
        for ((androidStore, expectedStore, expectedStoreId) in cases) {
            val mapped = AndroidRequestVerifyPurchaseWithIapkitResult(
                isValid = true,
                state = AndroidIapkitPurchaseState.Entitled,
                store = androidStore,
            ).toKmpIapkitResult()
            assertEquals(expectedStore, mapped.store)
            assertEquals(expectedStoreId, mapped.storeId)
        }
    }

    @Test
    fun `community iapkit identities map through unchanged`() {
        val mapped = AndroidRequestVerifyPurchaseWithIapkitResult(
            isValid = true,
            state = AndroidIapkitPurchaseState.Entitled,
            store = AndroidIapStore.Unknown,
            clientPayload = null,
            productId = null,
            environment = null,
            storeId = "community_fixture",
        ).toKmpIapkitResult()
        assertEquals(IapStore.Unknown, mapped.store)
        assertEquals("community_fixture", mapped.storeId)
    }

    @Test
    fun `an identity the generated types cannot represent fails closed`() {
        val android = AndroidRequestVerifyPurchaseWithIapkitResult(
            isValid = true,
            state = AndroidIapkitPurchaseState.Entitled,
            store = AndroidIapStore.Unknown,
            clientPayload = null,
            productId = null,
            environment = null,
            storeId = "community_fixture",
        )
        // A drifted openiap-google may stamp an id this build rejects. Public
        // constructors forbid that today, so corrupt it reflectively.
        android.javaClass.getDeclaredField("storeId").apply { isAccessible = true }
            .set(android, "unknown")
        // Callers catch Exception and report PurchaseVerificationFailed.
        assertFailsWith<IllegalArgumentException> { android.toKmpIapkitResult() }
    }
}
