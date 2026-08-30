package com.margelo.nitro.iap

import dev.hyo.openiap.OpenIapError
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class OpenIapErrorMappingTest {
    @Test
    fun `preserves a direct OpenIapError`() {
        assertSame(OpenIapError.NotPrepared, parseOpenIapError(OpenIapError.NotPrepared))
    }

    @Test
    fun `preserves an OpenIapError in the cause chain`() {
        val wrapped = IllegalStateException("Billing client not ready", OpenIapError.NotPrepared)

        assertSame(OpenIapError.NotPrepared, parseOpenIapError(wrapped))
    }

    @Test
    fun `reports not prepared before purchase delegation`() {
        var emitted: OpenIapError? = null

        assertTrue(rejectDisconnectedPurchase(isInitialized = false) { emitted = it })
        assertSame(OpenIapError.NotPrepared, emitted)

        emitted = null
        assertFalse(rejectDisconnectedPurchase(isInitialized = true) { emitted = it })
        assertNull(emitted)
    }
}
