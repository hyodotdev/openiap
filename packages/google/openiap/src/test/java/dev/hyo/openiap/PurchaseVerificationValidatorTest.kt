package dev.hyo.openiap

import com.google.gson.Gson
import dev.hyo.openiap.utils.verifyPurchaseWithGooglePlay
import dev.hyo.openiap.utils.verifyPurchaseWithHorizon
import dev.hyo.openiap.utils.verifyPurchaseWithIapkit
import dev.hyo.openiap.IapStore
import dev.hyo.openiap.IapkitPurchaseState
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitGoogleProps
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitProps
import dev.hyo.openiap.VerifyPurchaseAndroidOptions
import dev.hyo.openiap.VerifyPurchaseGoogleOptions
import dev.hyo.openiap.VerifyPurchaseHorizonOptions
import dev.hyo.openiap.VerifyPurchaseProps
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

class PurchaseVerificationValidatorTest {

    @Test
    fun `verifyPurchaseWithGooglePlay throws without google or androidOptions`() = runTest {
        val props = VerifyPurchaseProps(sku = "product.sku")

        try {
            verifyPurchaseWithGooglePlay(props, "TEST_TAG") { _ ->
                throw AssertionError("Connection should not be created when options are missing")
            }
            throw AssertionError("Expected IllegalArgumentException for missing google options")
        } catch (expected: IllegalArgumentException) {
            // Expected path
        }
    }

    @Test
    fun `verifyPurchaseWithGooglePlay works with new google field`() = runTest {
        val googleOptions = VerifyPurchaseGoogleOptions(
            accessToken = "token",
            isSub = true,
            packageName = "dev.hyo.app",
            purchaseToken = "purchaseToken"
        )
        val props = VerifyPurchaseProps(google = googleOptions, sku = "premium_monthly")
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

        val result = verifyPurchaseWithGooglePlay(
            props,
            "TEST_TAG"
        ) { _ -> FakeHttpURLConnection(200, body) }

        assertEquals("premium_monthly", result.productId)
        assertEquals("plan_monthly", result.termSku)
        assertEquals(true, result.autoRenewing)
    }

    @Test
    fun `verifyPurchaseWithGooglePlay parses successful response`() = runTest {
        val options = VerifyPurchaseAndroidOptions(
            accessToken = "token",
            isSub = true,
            packageName = "dev.hyo.app",
            productToken = "purchaseToken"
        )
        val props = VerifyPurchaseProps(androidOptions = options, sku = "premium_monthly")
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

        val result = verifyPurchaseWithGooglePlay(
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
    fun `verifyPurchaseWithGooglePlay wraps non-2xx as InvalidPurchaseVerification`() = runTest {
        val options = VerifyPurchaseAndroidOptions(
            accessToken = "token",
            isSub = false,
            packageName = "dev.hyo.app",
            productToken = "purchaseToken"
        )
        val props = VerifyPurchaseProps(androidOptions = options, sku = "premium_monthly")

        try {
            verifyPurchaseWithGooglePlay(
                props,
                "TEST_TAG"
            ) { _ -> FakeHttpURLConnection(401, """{"error":"unauthorized"}""") }
            throw AssertionError("Expected InvalidPurchaseVerification for non-2xx response")
        } catch (error: OpenIapError.InvalidPurchaseVerification) {
            // InvalidPurchaseVerification is the expected exception
            assertTrue(true)
        }
    }

    @Test
    fun `verifyPurchaseWithIapkit throws without google props`() = runTest {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = null,
            apple = null,
            google = null
        )

        try {
            verifyPurchaseWithIapkit(props, "TEST") { _ ->
                throw AssertionError("Connection should not be created when google props are missing")
            }
            throw AssertionError("Expected IllegalArgumentException for missing google props")
        } catch (expected: IllegalArgumentException) {
            // Expected path
        }
    }

    @Test
    fun `verifyPurchaseWithIapkit uses default endpoint`() = runTest {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = null,
            apple = null,
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = "token-abc"
            )
        )

        verifyPurchaseWithIapkit(props, "TEST") { _ ->
            FakeHttpURLConnection(200, """{"store":"google","isValid":true,"state":"ENTITLED"}""")
        }
    }

    @Test
    fun `verifyPurchaseWithIapkit throws when google payload missing purchaseToken`() = runTest {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = null,
            apple = null,
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = ""
            )
        )

        try {
            verifyPurchaseWithIapkit(props, "TEST") { _ ->
                throw AssertionError("Connection should not be created when google payload is invalid")
            }
            throw AssertionError("Expected IllegalArgumentException for invalid google payload")
        } catch (expected: IllegalArgumentException) {
            // Expected path
        }
    }

    @Test
    fun `verifyPurchaseWithIapkit posts google receipt with api key`() = runTest {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = "secret",
            apple = null,
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = "token-123"
            )
        )

        val connection = FakeHttpURLConnection(200, """{"store":"google","isValid":true,"state":"ENTITLED"}""")
        val result = verifyPurchaseWithIapkit(props, "TEST") { _ -> connection }

        assertEquals(IapStore.Google, result.store)
        assertTrue(result.isValid)
        assertEquals("Bearer secret", connection.headers["Authorization"])

        val bodyMap = Gson().fromJson(requireNotNull(connection.writtenBody), Map::class.java) as Map<*, *>
        assertEquals("google", bodyMap["store"])
        assertEquals("token-123", bodyMap["purchaseToken"])
    }

    @Test
    fun `verifyPurchaseWithIapkit posts google purchase details`() = runTest {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = null,
            apple = null,
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = "token-123"
            )
        )

        val connection = FakeHttpURLConnection(200, """{"store":"google","isValid":false,"state":"INAUTHENTIC"}""")
        val result = verifyPurchaseWithIapkit(props, "TEST") { _ -> connection }

        assertEquals(IapStore.Google, result.store)
        assertEquals(false, result.isValid)

        val bodyMap = Gson().fromJson(requireNotNull(connection.writtenBody), Map::class.java) as Map<*, *>
        assertEquals("google", bodyMap["store"])
        assertEquals("token-123", bodyMap["purchaseToken"])
    }

    @Test
    fun `verifyPurchaseWithIapkit wraps non-2xx as PurchaseVerificationFailed`() = runTest {
        val props = RequestVerifyPurchaseWithIapkitProps(
            apiKey = null,
            apple = null,
            google = RequestVerifyPurchaseWithIapkitGoogleProps(
                purchaseToken = "token-123"
            )
        )

        try {
            verifyPurchaseWithIapkit(
                props,
                "TEST"
            ) { _ -> FakeHttpURLConnection(500, """{"error":"server"}""") }
            throw AssertionError("Expected PurchaseVerificationFailed for non-2xx response")
        } catch (error: OpenIapError.PurchaseVerificationFailed) {
            // PurchaseVerificationFailed is the expected exception
            assertTrue(true)
        }
    }

    // ===== Horizon verification tests =====

    @Test
    fun `verifyPurchaseWithHorizon throws without horizon options`() = runTest {
        val props = VerifyPurchaseProps(sku = "50_gems")

        try {
            verifyPurchaseWithHorizon(props, "test-app-id", "TEST") { _ ->
                throw AssertionError("Connection should not be created when horizon options are missing")
            }
            throw AssertionError("Expected IllegalArgumentException for missing horizon options")
        } catch (expected: IllegalArgumentException) {
            // Expected path
        }
    }

    @Test
    fun `verifyPurchaseWithHorizon parses successful response`() = runTest {
        val horizonOptions = VerifyPurchaseHorizonOptions(
            sku = "50_gems",
            userId = "123456789",
            accessToken = "OC|app_id|app_secret"
        )
        val props = VerifyPurchaseProps(horizon = horizonOptions, sku = "50_gems")

        val result = verifyPurchaseWithHorizon(
            props,
            "test-app-id",
            "TEST"
        ) { _ -> FakeHttpURLConnection(200, """{"success":true,"grant_time":1744148687}""") }

        assertEquals(true, result.success)
        assertEquals(1744148687L, result.grantTime)
    }

    @Test
    fun `verifyPurchaseWithHorizon throws on failure response`() = runTest {
        val horizonOptions = VerifyPurchaseHorizonOptions(
            sku = "50_gems",
            userId = "123456789",
            accessToken = "OC|app_id|app_secret"
        )
        val props = VerifyPurchaseProps(horizon = horizonOptions, sku = "50_gems")

        try {
            verifyPurchaseWithHorizon(
                props,
                "test-app-id",
                "TEST"
            ) { _ -> FakeHttpURLConnection(400, """{"error":"invalid_user"}""") }
            throw AssertionError("Expected InvalidPurchaseVerification for non-2xx response")
        } catch (error: OpenIapError.InvalidPurchaseVerification) {
            assertTrue(true)
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
