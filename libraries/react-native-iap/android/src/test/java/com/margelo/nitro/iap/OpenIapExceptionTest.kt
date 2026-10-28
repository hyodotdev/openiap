package com.margelo.nitro.iap

import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.PurchaseError
import dev.hyo.openiap.SubResponseCodeAndroid
import org.json.JSONObject
import org.junit.Test
import org.junit.Assert.*
import java.io.ByteArrayOutputStream
import java.io.PrintStream
import java.io.PrintWriter
import java.io.StringWriter

class OpenIapExceptionTest {
    @Test
    fun `the installed fbjni formatter serializes the typed error and retains its cause`() {
        val payload = PurchaseError(code = ErrorCode.ServiceDisconnected, message = "Disconnected")
        val cause = IllegalStateException("Native failure")
        val exception = OpenIapException(payload, cause)
        val formatter = Class.forName("com.facebook.jni.ExceptionHelper")
            .getDeclaredMethod("getErrorDescription", Throwable::class.java)
        formatter.isAccessible = true

        val transport = formatter.invoke(null, exception) as String
        val json = JSONObject(transport)
        assertEquals("service-disconnected", json.getString("code"))
        assertEquals("Disconnected", json.getString("message"))
        assertEquals(exception.message + System.lineSeparator(), transport)
        assertSame(payload, exception.purchaseError)
        assertSame(cause, exception.cause)
    }

    @Test
    fun `print writer keeps diagnostics without cause or suppressed stack traces`() {
        val payload = PurchaseError(
            code = ErrorCode.ServiceDisconnected,
            message = "Disconnected",
            debugMessage = "line one\nline two",
        )
        val cause = IllegalStateException("unrelated user-cancelled cause")
        val exception = OpenIapException(payload, cause)
        exception.addSuppressed(IllegalArgumentException("suppressed diagnostic"))
        val output = StringWriter()

        exception.printStackTrace(PrintWriter(output))

        val transport = output.toString()
        assertEquals("line one\nline two", JSONObject(transport).getString("debugMessage"))
        assertEquals(exception.message + System.lineSeparator(), transport)
        assertFalse(transport.contains("unrelated user-cancelled cause"))
        assertFalse(transport.contains("suppressed diagnostic"))
        assertTrue(cause.stackTrace.isNotEmpty())
        assertSame(cause, exception.cause)
        assertEquals(1, exception.suppressed.size)
    }

    @Test
    fun `print stream escapes message text with and without a native cause`() {
        val message = "Quotes: \"x\", braces: {}, path: C:\\billing\nnext line"
        val payload = PurchaseError(code = ErrorCode.Unknown, message = message)
        for (cause in listOf(null, RuntimeException("native failure"))) {
            val output = ByteArrayOutputStream()
            val exception = OpenIapException(payload, cause)
            PrintStream(output).use { stream -> exception.printStackTrace(stream) }
            val transport = output.toString("UTF-8")
            assertEquals(message, JSONObject(transport).getString("message"))
            assertEquals(exception.message + System.lineSeparator(), transport)
        }
    }

    @Test
    fun `legacy JSON retains canonical diagnostics and omits metadata and null fields`() {
        val payload = PurchaseError(
            code = ErrorCode.QueryProduct,
            message = "Products unavailable",
            responseCode = 3,
            debugMessage = "Store diagnostic",
            productIds = emptyList(),
            productType = "subs",
            isEmptyProductList = true,
            subResponseCodeAndroid = SubResponseCodeAndroid.UserIneligible,
        )
        val exception = OpenIapException(payload)
        val json = JSONObject(exception.message)
        assertEquals("query-product", json.getString("code"))
        assertEquals("Products unavailable", json.getString("message"))
        assertEquals(3, json.getInt("responseCode"))
        assertEquals("Store diagnostic", json.getString("debugMessage"))
        assertEquals(0, json.getJSONArray("productIds").length())
        assertEquals("subs", json.getString("productType"))
        assertTrue(json.getBoolean("isEmptyProductList"))
        assertEquals("user-ineligible", json.getString("subResponseCodeAndroid"))
        assertFalse(json.has("__typename"))
        assertFalse(json.has("productId"))
        assertEquals(exception.message, exception.toString())
        assertFalse(exception.toString().contains("\tat "))
        assertFalse(exception.toString().startsWith("java.lang.Exception:"))
    }
}
