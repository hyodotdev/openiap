package expo.modules.iap

import dev.hyo.openiap.OpenIapError
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ExpoIapHelperTest {
    @Test
    fun `canonical deep link keys win over legacy aliases`() {
        val parsed =
            ExpoIapHelper.parseDeepLinkSubscriptionParams(
                mapOf(
                    "skuAndroid" to "canonical.sku",
                    "sku" to "legacy.sku",
                    "packageNameAndroid" to "dev.canonical",
                    "packageName" to "dev.legacy",
                ),
            )

        assertEquals("canonical.sku", parsed.sku)
        assertEquals("dev.canonical", parsed.packageName)
    }

    @Test
    fun `explicit null deep link keys suppress legacy aliases`() {
        val parsed =
            ExpoIapHelper.parseDeepLinkSubscriptionParams(
                mapOf(
                    "skuAndroid" to null,
                    "sku" to "legacy.sku",
                    "packageNameAndroid" to null,
                    "packageName" to "dev.legacy",
                ),
            )

        assertEquals(null, parsed.sku)
        assertEquals(null, parsed.packageName)
    }

    @Test
    fun `legacy deep link aliases remain compatible when canonical keys are absent`() {
        val parsed =
            ExpoIapHelper.parseDeepLinkSubscriptionParams(
                mapOf(
                    "sku" to "legacy.sku",
                    "packageName" to "dev.legacy",
                ),
            )

        assertEquals("legacy.sku", parsed.sku)
        assertEquals("dev.legacy", parsed.packageName)
    }

    @Test
    fun `canonical google request wins over legacy android request`() {
        val parsed =
            ExpoIapHelper.parseRequestPurchaseParams(
                mapOf(
                    "type" to "in-app",
                    "request" to
                        mapOf(
                            "google" to mapOf("skus" to listOf("canonical")),
                            "android" to mapOf("skus" to listOf("legacy")),
                        ),
                ),
            )

        assertEquals(listOf("canonical"), parsed.skus)
    }

    @Test
    fun `explicit null google request suppresses legacy android request`() {
        val parsed =
            ExpoIapHelper.parseRequestPurchaseParams(
                mapOf(
                    "type" to "in-app",
                    "request" to
                        mapOf(
                            "google" to null,
                            "android" to mapOf("skus" to listOf("legacy")),
                        ),
                ),
            )

        assertTrue(parsed.skus.isEmpty())
    }

    @Test
    fun `explicit null skus suppress legacy sku array`() {
        val parsed =
            ExpoIapHelper.parseRequestPurchaseParams(
                mapOf(
                    "type" to "in-app",
                    "skus" to null,
                    "skuArr" to listOf("legacy"),
                ),
            )

        assertTrue(parsed.skus.isEmpty())
    }

    @Test
    fun `canonical subscription offers suppress legacy offer token fallback`() {
        val parsed =
            ExpoIapHelper.parseRequestPurchaseParams(
                mapOf(
                    "type" to "subs",
                    "skus" to listOf("premium"),
                    "subscriptionOffers" to emptyList<Map<String, String>>(),
                    "offerTokenArr" to listOf("legacy-token"),
                ),
            )

        assertTrue(parsed.explicitSubscriptionOffers.isEmpty())
        assertTrue(parsed.offerTokenArr.isEmpty())
    }

    @Test
    fun `explicit null subscription offers suppress legacy offer token fallback`() {
        val parsed =
            ExpoIapHelper.parseRequestPurchaseParams(
                mapOf(
                    "type" to "subs",
                    "skus" to listOf("premium"),
                    "subscriptionOffers" to null,
                    "offerTokenArr" to listOf("legacy-token"),
                ),
            )

        assertTrue(parsed.explicitSubscriptionOffers.isEmpty())
        assertTrue(parsed.offerTokenArr.isEmpty())
    }

    @Test
    fun `end connection preserves false and still cleans up`() =
        runBlocking {
            var cleanedUp = false

            val result =
                endExpoConnectionWithCleanup(
                    endConnection = { false },
                    cleanup = { cleanedUp = true },
                )

            assertFalse(result)
            assertTrue(cleanedUp)
        }

    @Test
    fun `end connection preserves OpenIapError code`() {
        assertEquals(OpenIapError.NetworkError.CODE, endConnectionErrorCode(OpenIapError.NetworkError))
    }

    @Test
    fun `end connection falls back to service disconnected`() {
        assertEquals(
            OpenIapError.ServiceDisconnected.CODE,
            endConnectionErrorCode(IllegalStateException("cleanup failed")),
        )
    }

    @Test
    fun `serializeOpenIapError preserves ProductNotFound product id`() {
        val payload = ExpoIapHelper.serializeOpenIapError(OpenIapError.ProductNotFound("premium_monthly"))

        assertEquals("premium_monthly", payload["productId"])
    }

    @Test
    fun `serializeOpenIapError preserves SkuNotFound product id`() {
        val payload = ExpoIapHelper.serializeOpenIapError(OpenIapError.SkuNotFound("coins_100"))

        assertEquals("coins_100", payload["productId"])
    }

    @Test
    fun `serializeOpenIapError does not invent a product id`() {
        val payload = ExpoIapHelper.serializeOpenIapError(OpenIapError.NetworkError)

        assertFalse(payload.containsKey("productId"))
    }

    @Test
    fun `serializeOpenIapError preserves missing activity code`() {
        val payload = ExpoIapHelper.serializeOpenIapError(OpenIapError.MissingCurrentActivity)

        assertEquals(OpenIapError.MissingCurrentActivity.CODE, payload["code"])
        assertEquals(OpenIapError.MissingCurrentActivity.message, payload["message"])
    }
}
