package dev.hyo.godotiap

import org.json.JSONObject
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GodotIapLogTest {
    @Test
    fun `map sanitizer preserves null sensitive values and masks present values`() {
        val output =
            GodotIapLog.stringify(
                mapOf(
                    "purchaseToken" to null,
                    "userIdAmazon" to JSONObject.NULL,
                    "apiKey" to "known-api-key",
                ),
            )

        assertNullSensitiveValues(output)
    }

    @Test
    fun `json sanitizer preserves null sensitive values and masks present values`() {
        val output =
            GodotIapLog.stringify(
                """{"purchaseToken":null,"userIdAmazon":null,"apiKey":"known-api-key"}""",
            )

        assertNullSensitiveValues(output)
    }

    private fun assertNullSensitiveValues(output: String) {
        assertTrue(output.contains("\"purchaseToken\":null"))
        assertTrue(output.contains("\"userIdAmazon\":null"))
        assertTrue(output.contains("\"apiKey\":\"hidden\""))
        assertFalse(output.contains("known-api-key"))
    }
}
