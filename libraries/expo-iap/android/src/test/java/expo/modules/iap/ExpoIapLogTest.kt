package expo.modules.iap

import org.json.JSONObject
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ExpoIapLogTest {
    @Test
    fun `logger redacts receipt raw purchase data and nested json secrets`() {
        val output =
            ExpoIapLog.stringify(
                mapOf(
                    "receiptData" to "known-receipt",
                    "dataAndroid" to "known-raw-purchase",
                    "signatureAndroid" to "known-signature",
                    "metadata" to """{"purchaseToken":"known-json-token"}""",
                    "iapkit" to
                        mapOf(
                            "clientPayload" to
                                mapOf(
                                    "format" to "toml",
                                    "body" to "known-client-payload-body",
                                    "version" to 1,
                                ),
                        ),
                ),
            )

        listOf(
            "known-receipt",
            "known-raw-purchase",
            "known-signature",
            "known-json-token",
            "known-client-payload-body",
        ).forEach { assertFalse(output.contains(it)) }
        assertTrue(output.contains("hidden"))
    }

    @Test
    fun `logger preserves null sensitive values without claiming data was sent`() {
        val output =
            ExpoIapLog.stringify(
                mapOf(
                    "purchaseToken" to null,
                    "userIdAmazon" to JSONObject.NULL,
                    "apiKey" to "known-api-key",
                ),
            )

        assertTrue(output.contains("\"purchaseToken\":null"))
        assertTrue(output.contains("\"userIdAmazon\":null"))
        assertTrue(output.contains("\"apiKey\":\"hidden\""))
        assertFalse(output.contains("known-api-key"))
    }
}
