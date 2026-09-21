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
