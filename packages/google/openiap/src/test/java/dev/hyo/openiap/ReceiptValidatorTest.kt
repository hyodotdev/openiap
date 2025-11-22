package dev.hyo.openiap

import dev.hyo.openiap.utils.validateReceiptWithGooglePlay
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class ReceiptValidatorTest {

    @Test
    fun `validateReceiptWithGooglePlay throws without androidOptions`() = runTest {
        val props = ReceiptValidationProps(androidOptions = null, sku = "product.sku")

        try {
            validateReceiptWithGooglePlay(props, "TEST_TAG") { _ ->
                throw AssertionError("Connection should not be created when options are missing")
            }
            throw AssertionError("Expected IllegalArgumentException for missing androidOptions")
        } catch (expected: IllegalArgumentException) {
            // Expected path
        }
    }

    @Test
    fun `validateReceiptWithGooglePlay parses successful response`() = runTest {
        val options = ReceiptValidationAndroidOptions(
            accessToken = "token",
            isSub = true,
            packageName = "dev.hyo.app",
            productToken = "purchaseToken"
        )
        val props = ReceiptValidationProps(androidOptions = options, sku = "premium_monthly")
        val body = """
            {
              "autoRenewing": true,
              "betaProduct": false,
              "cancelDate": null,
              "cancelReason": null,
              "deferredDate": null,
              "deferredSku": null,
              "freeTrialEndDate": 1.0,
              "gracePeriodEndDate": 2.0,
              "parentProductId": "parent",
              "productId": "premium_monthly",
              "productType": "subs",
              "purchaseDate": 3.0,
              "quantity": 1,
              "receiptId": "rid-123",
              "renewalDate": 4.0,
              "term": "P1M",
              "termSku": "plan_monthly",
              "testTransaction": false
            }
        """.trimIndent()

        val result = validateReceiptWithGooglePlay(
            props,
            "TEST_TAG"
        ) { _ -> FakeHttpURLConnection(200, body) }

        assertEquals("premium_monthly", result.productId)
        assertEquals("plan_monthly", result.termSku)
        assertEquals(true, result.autoRenewing)
        assertEquals(false, result.betaProduct)
        assertEquals(1, result.quantity)
    }

    @Test
    fun `validateReceiptWithGooglePlay wraps non-2xx as InvalidReceipt`() = runTest {
        val options = ReceiptValidationAndroidOptions(
            accessToken = "token",
            isSub = false,
            packageName = "dev.hyo.app",
            productToken = "purchaseToken"
        )
        val props = ReceiptValidationProps(androidOptions = options, sku = "premium_monthly")

        try {
            validateReceiptWithGooglePlay(
                props,
                "TEST_TAG"
            ) { _ -> FakeHttpURLConnection(401, """{"error":"unauthorized"}""") }
            throw AssertionError("Expected InvalidReceipt for non-2xx response")
        } catch (error: OpenIapError.InvalidReceipt) {
            assertEquals("Invalid receipt", error.message)
        }
    }
}

private class FakeHttpURLConnection(
    private val statusCode: Int,
    private val body: String
) : HttpURLConnection(URL("https://example.com")) {

    override fun getResponseCode(): Int = statusCode

    override fun getInputStream(): InputStream = ByteArrayInputStream(body.toByteArray())

    override fun getErrorStream(): InputStream = ByteArrayInputStream(body.toByteArray())

    override fun disconnect() { /* no-op */ }

    override fun usingProxy(): Boolean = false

    override fun connect() { /* no-op */ }
}
