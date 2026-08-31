package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class HorizonIapkitOptionsTest {
    @Test
    fun resolvedUserIdPreservesSkuAndOptions() {
        val options = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "openiap-kit_pk_test",
            baseUrl = "https://kit.openiap.dev",
            includeClientPayload = true,
            horizon = RequestVerifyPurchaseWithIapkitHorizonProps(
                sku = "dev.hyo.martie.premium",
            ),
        )

        val resolved = withResolvedHorizonUserId(options, " 123456789 ")

        assertEquals("dev.hyo.martie.premium", resolved.horizon?.sku)
        assertEquals("123456789", resolved.horizon?.userId)
        assertEquals("openiap-kit_pk_test", resolved.apiKey)
        assertEquals("https://kit.openiap.dev", resolved.baseUrl)
        assertEquals(true, resolved.includeClientPayload)
    }

    @Test
    fun blankResolvedUserIdIsRejected() {
        val options = RequestVerifyPurchaseWithIapkitProps(
            horizon = RequestVerifyPurchaseWithIapkitHorizonProps(
                sku = "dev.hyo.martie.premium",
            ),
        )

        assertThrows(IllegalArgumentException::class.java) {
            withResolvedHorizonUserId(options, " ")
        }
    }
}
