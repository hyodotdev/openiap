package com.margelo.nitro.iap

import org.junit.Test
import org.junit.Assert.*
import java.io.ByteArrayOutputStream
import java.io.PrintStream
import java.io.PrintWriter
import java.io.StringWriter

/**
 * Unit tests for OpenIapException to verify that error messages
 * are returned without Java/Kotlin stack traces.
 *
 * This addresses Issue #3075 where error.code was undefined because
 * stack traces were breaking JSON parsing on the JavaScript side.
 */
class OpenIapExceptionTest {

    @Test
    fun `the installed fbjni formatter returns parseable JSON with a retained cause`() {
        val json = """{"code":"service-disconnected","message":"Disconnected"}"""
        val cause = IllegalStateException("Native failure")
        val exception = OpenIapException(json, cause)
        // fbjni's C++ exception adapter calls this private Java entry point.
        val formatter = Class.forName("com.facebook.jni.ExceptionHelper")
            .getDeclaredMethod("getErrorDescription", Throwable::class.java)
        formatter.isAccessible = true

        assertEquals(json + System.lineSeparator(), formatter.invoke(null, exception))
        assertSame(cause, exception.cause)
    }

    @Test
    fun `fbjni print writer receives only JSON even with a cause and suppressed error`() {
        val json = """{"code":"service-disconnected","message":"Disconnected","debugMessage":"line one\nline two"}"""
        val cause = IllegalStateException("""{"code":"user-cancelled","message":"unrelated cause"}""")
        val exception = OpenIapException(json, cause)
        exception.addSuppressed(IllegalArgumentException("suppressed diagnostic"))
        val output = StringWriter()

        exception.printStackTrace(PrintWriter(output))

        assertEquals(json + System.lineSeparator(), output.toString())
        assertSame(cause, exception.cause)
        assertTrue(cause.stackTrace.isNotEmpty())
        assertEquals(1, exception.suppressed.size)
    }

    @Test
    fun `print stream transport matches the no-cause JSON output`() {
        val json = """{"code":"unknown","message":"Quotes: \"x\", braces: {}, path: C:\\billing"}"""
        for (cause in listOf(null, RuntimeException("native failure"))) {
            val output = ByteArrayOutputStream()
            PrintStream(output).use { stream ->
                OpenIapException(json, cause).printStackTrace(stream)
            }
            assertEquals(json + System.lineSeparator(), output.toString("UTF-8"))
        }
    }

    @Test
    fun `test OpenIapException message returns clean JSON`() {
        val errorJson = """{"code":"init-connection","message":"Failed to initialize connection"}"""
        val exception = OpenIapException(errorJson)

        // Verify message is exactly the JSON string
        assertEquals(errorJson, exception.message)
    }

    @Test
    fun `test OpenIapException toString returns clean JSON without stack trace`() {
        val errorJson = """{"code":"user-cancelled","message":"User cancelled"}"""
        val exception = OpenIapException(errorJson)

        // toString() should return only the JSON, not "java.lang.Exception: ..."
        val result = exception.toString()
        assertEquals(errorJson, result)
        assertFalse(result.startsWith("java.lang.Exception:"))
        assertFalse(result.contains("\tat "))
    }

    @Test
    fun `test thrown OpenIapException message is clean`() {
        val errorJson = """{"code":"network-error","message":"Network error occurred","responseCode":-1}"""

        try {
            throw OpenIapException(errorJson)
        } catch (e: Exception) {
            // Verify the caught exception message is clean
            assertEquals(errorJson, e.message)
            assertEquals(errorJson, e.toString())
        }
    }

    @Test
    fun `test OpenIapException with complex JSON structure`() {
        val errorJson = """{"code":"purchase-error","message":"Purchase failed","responseCode":3,"debugMessage":"Item unavailable","productId":"com.test.product"}"""
        val exception = OpenIapException(errorJson)

        assertEquals(errorJson, exception.message)
        assertEquals(errorJson, exception.toString())
    }

    @Test
    fun `test multiple OpenIapException instances are independent`() {
        val error1 = """{"code":"error-1","message":"First error"}"""
        val error2 = """{"code":"error-2","message":"Second error"}"""

        val exception1 = OpenIapException(error1)
        val exception2 = OpenIapException(error2)

        assertEquals(error1, exception1.message)
        assertEquals(error2, exception2.message)
        assertNotEquals(exception1.message, exception2.message)
    }

    @Test
    fun `test OpenIapException with empty JSON`() {
        val errorJson = """{}"""
        val exception = OpenIapException(errorJson)

        assertEquals(errorJson, exception.message)
        assertEquals(errorJson, exception.toString())
    }

    @Test
    fun `test OpenIapException message does not contain stack trace keywords`() {
        val errorJson = """{"code":"test-error","message":"Test message"}"""
        val exception = OpenIapException(errorJson)

        val result = exception.toString()

        // Verify no stack trace keywords are present
        assertFalse("Should not contain 'at ' (stack trace)", result.contains("\tat "))
        assertFalse("Should not contain 'java.lang.Exception:'", result.contains("java.lang.Exception:"))
        assertFalse("Should not contain '.kt:' (Kotlin file reference)", result.contains(".kt:"))
        assertFalse("Should not contain '.java:' (Java file reference)", result.contains(".java:"))
    }
}
