package expo.modules.iap

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
                ),
            )

        listOf(
            "known-receipt",
            "known-raw-purchase",
            "known-signature",
            "known-json-token",
        ).forEach { assertFalse(output.contains(it)) }
        assertTrue(output.contains("hidden"))
    }
}
