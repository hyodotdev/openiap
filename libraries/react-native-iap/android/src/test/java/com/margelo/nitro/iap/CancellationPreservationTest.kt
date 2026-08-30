package com.margelo.nitro.iap

import kotlin.coroutines.cancellation.CancellationException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.fail
import org.junit.Test

class CancellationPreservationTest {
    @Test
    fun `non-cancellation failures are translated`() {
        val source = IllegalStateException("billing failed")

        val result = catchNonCancellation(
            block = { throw source },
            onFailure = { "translated: ${it.message}" },
        )

        assertEquals("translated: billing failed", result)
    }

    @Test
    fun `cancellation bypasses formerly broad failure handling`() {
        val cancellation = CancellationException("cancelled")
        var handled = false

        try {
            catchNonCancellation(
                block = { throw cancellation },
                onFailure = {
                    handled = true
                },
            )
            fail("Expected cancellation")
        } catch (error: CancellationException) {
            assertSame(cancellation, error)
        }

        assertFalse(handled)
    }

    @Test
    fun `product lookup fallback cannot replace cancellation with an empty result`() {
        val cancellation = CancellationException("cancelled")
        var usedFallback = false

        try {
            catchNonCancellation<List<String>>(
                block = { throw cancellation },
                onFailure = {
                    usedFallback = true
                    emptyList()
                },
            )
            fail("Expected cancellation")
        } catch (error: CancellationException) {
            assertSame(cancellation, error)
        }

        assertFalse(usedFallback)
    }
}
