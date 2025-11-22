package dev.hyo.openiap

import com.google.gson.Gson
import dev.hyo.openiap.utils.validateReceiptWithGooglePlay
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit
import dev.hyo.openiap.IapkitEnvironment
import dev.hyo.openiap.IapkitStore
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitAppleProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitGoogleProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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

    @Test
    fun `verifyPurchaseWithIapkit throws without apple props`() = runTest {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = null,
            apple = null,
            endpoint = "https://iapkit.test/purchase/verify",
            google = null,
            store = IapkitStore.Apple
        )

        try {
            verifyPurchaseWithIapkit(props, "TEST") { _ ->
                throw AssertionError("Connection should not be created when apple props are missing")
            }
            throw AssertionError("Expected IllegalArgumentException for missing apple props")
        } catch (expected: IllegalArgumentException) {
            // Expected path
        }
    }

    @Test
    fun `verifyPurchaseWithIapkit throws without endpoint`() = runTest {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = null,
            apple = RequestVerifyPurchaseWithIapkitAppleProps(
                appId = null,
                environment = IapkitEnvironment.Sandbox,
                receipt = "receipt-token"
            ),
            endpoint = "   ",
            google = null,
            store = IapkitStore.Apple
        )

        try {
            verifyPurchaseWithIapkit(props, "TEST") { _ ->
                throw AssertionError("Connection should not be created when endpoint is missing")
            }
            throw AssertionError("Expected IllegalArgumentException for missing endpoint")
        } catch (expected: IllegalArgumentException) {
            // Expected path
        }
    }

    @Test
    fun `verifyPurchaseWithIapkit requires appId for production`() = runTest {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = null,
            apple = RequestVerifyPurchaseWithIapkitAppleProps(
                appId = null,
                environment = IapkitEnvironment.Production,
                receipt = "receipt-token"
            ),
            endpoint = "https://iapkit.test/purchase/verify",
            google = null,
            store = IapkitStore.Apple
        )

        try {
            verifyPurchaseWithIapkit(props, "TEST") { _ ->
                throw AssertionError("Connection should not be created when appId is missing")
            }
            throw AssertionError("Expected IllegalArgumentException for missing appId in production")
        } catch (expected: IllegalArgumentException) {
            // Expected path
        }
    }

    @Test
    fun `verifyPurchaseWithIapkit posts apple receipt with api key`() = runTest {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "secret",
            apple = RequestVerifyPurchaseWithIapkitAppleProps(
                appId = "com.example.app",
                environment = IapkitEnvironment.Production,
                receipt = "receipt-token"
            ),
            endpoint = "https://iapkit.test/purchase/verify",
            google = null,
            store = IapkitStore.Apple
        )

        val connection = FakeHttpURLConnection(200, """{"store":"apple","valid":true}""")
        val result = verifyPurchaseWithIapkit(props, "TEST") { _ -> connection }

        assertEquals(IapkitStore.Apple, result.store)
        assertTrue(result.valid)
        assertEquals("Bearer secret", connection.headers["Authorization"])

        val bodyMap = Gson().fromJson(requireNotNull(connection.writtenBody), Map::class.java) as Map<*, *>
        assertEquals("apple", bodyMap["store"])
        assertEquals("receipt-token", bodyMap["receipt"])
        assertEquals("production", bodyMap["environment"])
        assertEquals("com.example.app", bodyMap["appId"])
    }

    @Test
    fun `verifyPurchaseWithIapkit posts google purchase details`() = runTest {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = null,
            apple = null,
            endpoint = "https://iapkit.test/purchase/verify",
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                packageName = "dev.hyo.app",
                purchaseId = "premium_monthly",
                purchaseToken = "token-123"
            ),
            store = IapkitStore.Google
        )

        val connection = FakeHttpURLConnection(200, """{"store":"google","valid":false}""")
        val result = verifyPurchaseWithIapkit(props, "TEST") { _ -> connection }

        assertEquals(IapkitStore.Google, result.store)
        assertEquals(false, result.valid)

        val bodyMap = Gson().fromJson(requireNotNull(connection.writtenBody), Map::class.java) as Map<*, *>
        assertEquals("google", bodyMap["store"])
        assertEquals("dev.hyo.app", bodyMap["packageName"])
        assertEquals("premium_monthly", bodyMap["purchaseId"])
        assertEquals("token-123", bodyMap["purchaseToken"])
    }

    @Test
    fun `verifyPurchaseWithIapkit wraps non-2xx as InvalidReceipt`() = runTest {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = null,
            apple = RequestVerifyPurchaseWithIapkitAppleProps(
                appId = null,
                environment = null,
                receipt = "receipt-token"
            ),
            endpoint = "https://iapkit.test/purchase/verify",
            google = null,
            store = IapkitStore.Apple
        )

        try {
            verifyPurchaseWithIapkit(
                props,
                "TEST"
            ) { _ -> FakeHttpURLConnection(500, """{"error":"server"}""") }
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
    val headers: MutableMap<String, String> = mutableMapOf()
    var writtenBody: String? = null

    override fun getResponseCode(): Int = statusCode

    override fun getInputStream(): InputStream = ByteArrayInputStream(body.toByteArray())

    override fun getErrorStream(): InputStream = ByteArrayInputStream(body.toByteArray())

    override fun setRequestProperty(key: String?, value: String?) {
        if (key != null && value != null) {
            headers[key] = value
        }
    }

    override fun getOutputStream(): OutputStream {
        return object : ByteArrayOutputStream() {
            override fun close() {
                super.close()
                writtenBody = toString()
            }
        }
    }

    override fun disconnect() { /* no-op */ }

    override fun usingProxy(): Boolean = false

    override fun connect() { /* no-op */ }
}
