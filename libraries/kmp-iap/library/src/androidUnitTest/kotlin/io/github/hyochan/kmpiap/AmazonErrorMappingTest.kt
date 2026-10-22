package io.github.hyochan.kmpiap

import dev.hyo.openiap.OpenIapError
import io.github.hyochan.kmpiap.openiap.ErrorCode
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class AmazonErrorMappingTest {
    @Test
    fun `Amazon cancellation maps to KMP user-cancelled error`() {
        val error = OpenIapError.UserCancelled("Amazon purchase was cancelled")

        val mapped = error.toKmpPurchaseError()

        assertEquals(ErrorCode.UserCancelled, mapped.code)
        assertEquals("Amazon purchase was cancelled", mapped.message)
        assertEquals("Amazon purchase was cancelled", mapped.debugMessage)
    }

    @Test
    fun `a message built around the store's cause is kept, a fixed one gives way to it`() {
        val curated = OpenIapError.DeveloperError("Invalid replacement mode")
            .withMessage("Play rejected the replacement: Invalid replacement mode. Valid modes: WITH_TIME_PRORATION")
        val fixed = OpenIapError.DeveloperError("Amazon IAPKit verification could not resolve userId")

        assertEquals(curated.message, curated.toKmpPurchaseError().message)
        assertEquals("Amazon IAPKit verification could not resolve userId", fixed.toKmpPurchaseError().message)
    }

    @Test
    fun `native query diagnostics map to KMP purchase error`() {
        val error = OpenIapError.QueryProduct.withDiagnostics(
            responseCode = 6,
            debugMessage = "Amazon getProductData failed",
            productIds = listOf("premium", "coins"),
            productType = "in-app",
            isEmptyProductList = false,
        )

        val mapped = error.toKmpPurchaseError()

        assertEquals(ErrorCode.QueryProduct, mapped.code)
        assertEquals("Amazon getProductData failed", mapped.debugMessage)
        assertEquals(6, mapped.responseCode)
        assertEquals(listOf("premium", "coins"), mapped.productIds)
        assertEquals("in-app", mapped.productType)
        assertFalse(mapped.isEmptyProductList ?: true)
    }

    @Test
    fun `native product identifiers map to KMP purchase error`() {
        val mapped = OpenIapError.SkuNotFound("premium").toKmpPurchaseError()

        assertEquals("premium", mapped.productId)
    }

    @Test
    fun `delegated end preserves false and always cleans up`() = runTest {
        var cleanedUp = false

        val ended = endDelegatedConnectionWithCleanup(
            endConnection = { false },
            cleanup = { cleanedUp = true },
        )

        assertFalse(ended)
        assertTrue(cleanedUp)
    }

    @Test
    fun `delegated end exception still cleans up`() = runTest {
        var cleanedUp = false

        assertFailsWith<IllegalStateException> {
            endDelegatedConnectionWithCleanup(
                endConnection = { error("native end failed") },
                cleanup = { cleanedUp = true },
            )
        }

        assertTrue(cleanedUp)
    }

    @Test
    fun `delegated end cancellation remains cancellation and still cleans up`() = runTest {
        var cleanedUp = false

        assertFailsWith<CancellationException> {
            endDelegatedConnectionWithCleanup(
                endConnection = { throw CancellationException("cancelled") },
                cleanup = { cleanedUp = true },
            )
        }

        assertTrue(cleanedUp)
    }
}
