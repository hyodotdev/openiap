package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Test

class AmazonIapkitOptionsTest {
    @Test
    fun resolvedUserIdPreservesProductBindingAndOptions() {
        val options = RequestVerifyPurchaseWithIapkitProps(
            amazon = RequestVerifyPurchaseWithIapkitAmazonProps(
                expectedProductId = "dev.hyo.martie.10bulbs",
                receiptId = "amzn1.receipt.test",
                sandbox = true,
                userId = null,
            ),
            apiKey = "openiap-kit_pk_test",
            apple = null,
            baseUrl = "https://kit.openiap.dev",
            google = null,
            includeClientPayload = true,
        )

        val resolved = withResolvedAmazonUserId(options, "amzn1.account.test")

        assertEquals("dev.hyo.martie.10bulbs", resolved.amazon?.expectedProductId)
        assertEquals("amzn1.receipt.test", resolved.amazon?.receiptId)
        assertEquals(true, resolved.amazon?.sandbox)
        assertEquals("amzn1.account.test", resolved.amazon?.userId)
        assertEquals("openiap-kit_pk_test", resolved.apiKey)
        assertEquals("https://kit.openiap.dev", resolved.baseUrl)
        assertEquals(true, resolved.includeClientPayload)
    }
}
