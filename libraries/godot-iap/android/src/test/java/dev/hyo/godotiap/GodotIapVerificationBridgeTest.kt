package dev.hyo.godotiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.After
import org.junit.Before
import org.junit.Test

class GodotIapVerificationBridgeTest {
    private val deprecationWarnings = mutableListOf<String>()

    @Before
    fun setUpDeprecationCapture() {
        GodotIapLog.resetDeprecationsForTests()
        GodotIapLog.setDeprecationHandlerForTests(deprecationWarnings::add)
    }

    @After
    fun tearDownDeprecationCapture() {
        GodotIapLog.setDeprecationHandlerForTests(null)
        GodotIapLog.resetDeprecationsForTests()
        deprecationWarnings.clear()
    }

    @Test
    fun `legacy iapkit fields normalize and warn once`() {
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
        assertEquals(1, deprecationWarnings.size)
        normalizeVerifyPurchaseWithProviderProps(props)
        assertEquals(1, deprecationWarnings.size)
    }

    @Test
    fun `canonical iapkit payload wins while supplied legacy keys still warn`() {
        val props = linkedMapOf<String, Any?>(
            "provider" to "iapkit",
            "iapkit" to mapOf(
                "baseUrl" to "http://10.0.2.2:4174",
                "google" to mapOf("purchaseToken" to "purchase-token"),
            ),
            "apiKey" to "ignored-legacy-key",
        )

        assertSame(props, normalizeVerifyPurchaseWithProviderProps(props))
        assertEquals(1, deprecationWarnings.size)
    }

    @Test
    fun `explicit null canonical iapkit never revives flattened input`() {
        val props = linkedMapOf<String, Any?>(
            "provider" to "iapkit",
            "iapkit" to null,
            "apiKey" to "ignored-legacy-key",
        )

        val normalized = normalizeVerifyPurchaseWithProviderProps(props)

        assertSame(props, normalized)
        assertNull(normalized["iapkit"])
        assertEquals(1, deprecationWarnings.size)
    }
}
