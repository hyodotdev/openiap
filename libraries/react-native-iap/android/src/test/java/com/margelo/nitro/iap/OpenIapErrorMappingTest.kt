package com.margelo.nitro.iap

import dev.hyo.openiap.OpenIapError
import org.junit.Assert.assertSame
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
}
