package dev.hyo.openiap

import androidx.test.core.app.ApplicationProvider
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29], instrumentedPackages = ["com.amazon"])
class PurchasePlatformValidationTest {
    @Test
    fun `apple-only requests emit one developer error before returning or throwing`() = runTest {
        for (type in listOf("in-app", "subs")) {
            val module = OpenIapModule(ApplicationProvider.getApplicationContext())
            val errors = mutableListOf<OpenIapError>()
            var updates = 0
            module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })
            module.addPurchaseUpdateListener { updates += 1 }
            val request = RequestPurchaseProps.fromJson(mapOf(
                "type" to type,
                (if (type == "subs") "requestSubscription" else "requestPurchase") to
                    mapOf("apple" to mapOf("sku" to "coins")),
            ))

            val outcome = runCatching { module.requestPurchase(request) }

            assertEquals(type, 1, errors.size)
            assertTrue(errors.single() is OpenIapError.DeveloperError)
            assertEquals(0, updates)
            outcome.fold(
                onSuccess = { result ->
                    assertTrue((result as RequestPurchaseResultPurchases).value.isNullOrEmpty())
                },
                onFailure = { error -> assertSame(errors.single(), error) },
            )
        }
    }
}
