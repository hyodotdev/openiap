package dev.hyo.godotiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class GodotIapVerificationBridgeTest {
    @Test
    fun `legacy iapkit fields include custom base url`() {
        val props = linkedMapOf<String, Any?>(
            "provider" to "iapkit",
            "apiKey" to "test-api-key",
            "baseUrl" to "http://10.0.2.2:4174",
            "includeClientPayload" to true,
            "google" to mapOf("purchaseToken" to "purchase-token"),
        )

        val normalized = normalizeVerifyPurchaseWithProviderProps(props)
        val iapkit = normalized["iapkit"] as Map<*, *>

        assertEquals("iapkit", normalized["provider"])
        assertEquals("test-api-key", iapkit["apiKey"])
        assertEquals("http://10.0.2.2:4174", iapkit["baseUrl"])
        assertEquals(true, iapkit["includeClientPayload"])
        assertEquals(
            mapOf("purchaseToken" to "purchase-token"),
            iapkit["google"],
        )
    }

    @Test
    fun `nested iapkit payload is passed through unchanged`() {
        val props = linkedMapOf<String, Any?>(
            "provider" to "iapkit",
            "iapkit" to mapOf(
                "baseUrl" to "http://10.0.2.2:4174",
                "google" to mapOf("purchaseToken" to "purchase-token"),
            ),
        )

        assertSame(props, normalizeVerifyPurchaseWithProviderProps(props))
    }
}
