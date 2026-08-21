package com.margelo.nitro.iap

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Test

class RnIapLogTest {
    @Test
    fun `logger preserves null sensitive values and masks present values`() {
        val sanitized =
            RnIapLog.sanitizeMap(
                mapOf(
                    "purchaseToken" to null,
                    "userIdAmazon" to JSONObject.NULL,
                    "apiKey" to "known-api-key",
                ),
            )

        assertSame(JSONObject.NULL, sanitized["purchaseToken"])
        assertSame(JSONObject.NULL, sanitized["userIdAmazon"])
        assertEquals("hidden", sanitized["apiKey"])
        assertFalse(sanitized.containsValue("known-api-key"))
    }
}
