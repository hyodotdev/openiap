package com.margelo.nitro.iap

import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.PurchaseError
import dev.hyo.openiap.SubResponseCodeAndroid as SchemaSubResponseCode
import org.junit.Assert.*
import org.junit.Test

class ProtocolPurchaseErrorTest {
    @Test
    fun `typed transport preserves every schema field without parsing descriptions`() {
        val payload = PurchaseError(
            code = ErrorCode.QueryProduct,
            message = "Query failed: {\"code\":\"user-cancelled\"} is text",
            debugMessage = "Caused by: diagnostic text",
            isEmptyProductList = false,
            productId = "premium",
            productIds = listOf("premium", "other"),
            productType = "subs",
            responseCode = -1,
            subResponseCodeAndroid = SchemaSubResponseCode.UserIneligible,
        )
        val cause = IllegalStateException("native cause")
        val exception = OpenIapException(payload, cause)
        assertSame(payload, exception.purchaseError)
        assertSame(cause, exception.cause)
        val result = protocolPurchaseError(exception)
        assertEquals("query-product", result.code)
        assertEquals(payload.message, result.message)
        assertEquals(payload.debugMessage, result.debugMessage?.asType<String>())
        assertEquals(false, result.isEmptyProductList?.asType<Boolean>())
        assertEquals("premium", result.productId?.asType<String>())
        assertArrayEquals(arrayOf("premium", "other"), result.productIds?.asType<Array<String>>())
        assertEquals("subs", result.productType?.asType<String>())
        assertEquals(-1.0, result.responseCode?.asType<Double>())
        assertEquals(SubResponseCodeAndroid.USER_INELIGIBLE, result.subResponseCodeAndroid)
    }

    @Test
    fun `canonical diagnostics retain an empty product array`() {
        val error = OpenIapError.QueryProduct(isEmptyProductList = true, productIds = emptyList())
        val canonical = toPurchaseError(error)
        assertEquals(emptyList<String>(), canonical.productIds)
        assertEquals(true, canonical.isEmptyProductList)
        assertArrayEquals(emptyArray<String>(), protocolPurchaseError(OpenIapException(canonical)).productIds?.asType<Array<String>>())
    }

    @Test
    fun `unknown failures keep description text without inventing structured fields`() {
        val message = "{\"code\":\"user-cancelled\",\"message\":\"nested\"}"
        val result = protocolPurchaseError(IllegalStateException(message))
        assertEquals("unknown", result.code)
        assertEquals(message, result.message)
        assertNull(result.responseCode)
        assertNull(result.productIds)
    }
}
