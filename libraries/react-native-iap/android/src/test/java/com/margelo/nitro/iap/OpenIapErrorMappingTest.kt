package com.margelo.nitro.iap

import dev.hyo.openiap.OpenIapError
import org.junit.Assert.assertEquals
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
        val wrapped = IllegalStateException("Service unavailable", OpenIapError.NotPrepared)

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

    @Test
    fun `endConnection preserves a provider configuration error`() {
        val failure = OpenIapError.ProviderConfiguration("No Android store provider registered.")

        assertSame(failure, mapEndConnectionError(failure))
        assertEquals("developer-error", failure.code)
    }

    @Test
    fun `endConnection maps an unexpected failure to service disconnected`() {
        val mapped = mapEndConnectionError(IllegalStateException("teardown failed"))

        assertEquals(OpenIapError.ServiceDisconnected.CODE, mapped.code)
        assertEquals("teardown failed", mapped.debugMessage)
    }

    @Test
    fun `initConnection preserves a provider configuration error`() {
        val failure = OpenIapError.ProviderConfiguration("No Android store provider registered.")

        assertSame(failure, mapInitConnectionError(failure, null))
        assertEquals("developer-error", failure.code)
    }

    @Test
    fun `initConnection maps an unexpected failure to init connection`() {
        assertSame(OpenIapError.InitConnection, mapInitConnectionError(IllegalStateException("boom"), null))
    }
}
