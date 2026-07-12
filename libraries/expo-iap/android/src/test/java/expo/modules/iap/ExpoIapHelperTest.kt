package expo.modules.iap

import dev.hyo.openiap.OpenIapError
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ExpoIapHelperTest {
    @Test
    fun `end connection preserves false and still cleans up`() = runBlocking {
        var cleanedUp = false

        val result = endExpoConnectionWithCleanup(
            endConnection = { false },
            cleanup = { cleanedUp = true },
        )

        assertFalse(result)
        assertTrue(cleanedUp)
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
}
