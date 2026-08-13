package expo.modules.iap

import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.ProductQueryType
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ExpoIapHelperTest {
    @Test
    fun `purchase parser rejects all`() {
        assertThrows(IllegalArgumentException::class.java) {
            ExpoIapHelper.parsePurchaseProductQueryType("all")
        }
        assertEquals(ProductQueryType.All, ExpoIapHelper.parseProductQueryType("all"))
    }

    @Test
    fun `deep link parser uses canonical keys`() {
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
    fun `deep link parser ignores removed aliases`() {
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
    fun `removed deep link aliases are not accepted`() {
        val parsed =
            ExpoIapHelper.parseDeepLinkSubscriptionParams(
                mapOf(
                    "sku" to "legacy.sku",
                    "packageName" to "dev.legacy",
                ),
            )

        assertEquals(null, parsed.sku)
        assertEquals(null, parsed.packageName)
    }

    @Test
    fun `request parser uses the canonical google request`() {
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
    fun `request parser rejects the removed android request alias`() {
        assertThrows(IllegalArgumentException::class.java) {
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
        }
    }

    @Test
    fun `request parser ignores the removed sku array alias`() {
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
    fun `request parser ignores the removed offer token array alias`() {
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
    }

    @Test
    fun `purchase parser rejects mixed SKU lists`() {
        assertThrows(IllegalArgumentException::class.java) {
            ExpoIapHelper.parseRequestPurchaseParams(
                mapOf("type" to "in-app", "skus" to listOf("coins", 7)),
            )
        }
    }

    @Test
    fun `purchase parser rejects malformed offers atomically`() {
        assertThrows(IllegalArgumentException::class.java) {
            ExpoIapHelper.parseRequestPurchaseParams(
                mapOf(
                    "type" to "subs",
                    "skus" to listOf("premium"),
                    "subscriptionOffers" to listOf(
                        mapOf("sku" to "premium", "offerToken" to "known"),
                        mapOf("sku" to "premium"),
                    ),
                ),
            )
        }
    }

    @Test
    fun `purchase parser rejects a nested type discriminator`() {
        assertThrows(IllegalArgumentException::class.java) {
            ExpoIapHelper.parseRequestPurchaseParams(
                mapOf(
                    "type" to "in-app",
                    "request" to mapOf(
                        "google" to mapOf(
                            "type" to "subs",
                            "skus" to listOf("premium"),
                        ),
                    ),
                ),
            )
        }
    }

    @Test
    fun `purchase parser rejects branch mismatched options`() {
        listOf(
            mapOf(
                "type" to "in-app",
                "skus" to listOf("coins"),
                "subscriptionOffers" to emptyList<Any>(),
            ),
            mapOf(
                "type" to "in-app",
                "skus" to listOf("coins"),
                "subscriptionProductReplacementParams" to mapOf(
                    "oldProductId" to "old",
                    "replacementMode" to "without-proration",
                ),
            ),
            mapOf(
                "type" to "subs",
                "skus" to listOf("premium"),
                "offerToken" to "one-time-token",
            ),
        ).forEach { request ->
            assertThrows(IllegalArgumentException::class.java) {
                ExpoIapHelper.parseRequestPurchaseParams(request)
            }
        }
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
    fun `verify purchase parser preserves Horizon options`() {
        val props = verifyPurchasePropsFromMap(
            mapOf(
                "horizon" to mapOf(
                    "sku" to "premium",
                    "userId" to "user-1",
                    "accessToken" to "secret",
                ),
            ),
        )

        assertEquals("premium", props.horizon?.sku)
        assertEquals("user-1", props.horizon?.userId)
        assertEquals("secret", props.horizon?.accessToken)
        assertEquals(null, props.google)
    }

    @Test
    fun `end connection preserves OpenIapError code`() {
        assertEquals(OpenIapError.NetworkError.CODE, endConnectionErrorCode(OpenIapError.NetworkError))
    }

    @Test
    fun `purchase failure before core emits and rejects`() {
        var emitted = 0
        var rejected: Pair<String, String>? = null

        deliverPurchaseRequestFailure(
            reachedOpenIapRequest = false,
            errorCode = "purchase-error",
            errorEnvelope = "envelope",
            emitLocalError = { emitted += 1 },
            rejectPendingPromises = { code, message -> rejected = code to message },
        )

        assertEquals(1, emitted)
        assertEquals("purchase-error" to "envelope", rejected)
    }

    @Test
    fun `purchase failure after core suppresses duplicate event but still rejects`() {
        var emitted = 0
        var rejected: Pair<String, String>? = null

        deliverPurchaseRequestFailure(
            reachedOpenIapRequest = true,
            errorCode = "user-cancelled",
            errorEnvelope = "envelope",
            emitLocalError = { emitted += 1 },
            rejectPendingPromises = { code, message -> rejected = code to message },
        )

        assertEquals(0, emitted)
        assertEquals("user-cancelled" to "envelope", rejected)
    }

    @Test
    fun `purchase coroutine cancellation rejects without publishing a purchase error`() {
        var emitted = 0
        var rejected: Pair<String, String>? = null

        deliverPurchaseRequestFailure(
            reachedOpenIapRequest = false,
            isCancellation = true,
            errorCode = "service-disconnected",
            errorEnvelope = "envelope",
            emitLocalError = { emitted += 1 },
            rejectPendingPromises = { code, message -> rejected = code to message },
        )

        assertEquals(0, emitted)
        assertEquals("service-disconnected" to "envelope", rejected)
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
