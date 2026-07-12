package dev.hyo.openiap

import android.content.ContextWrapper
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

class AlternativeOnlyRequestPurchaseTest {
    @Test
    fun `requestPurchase does not activate alternative only before connection succeeds`() = runBlocking {
        val module = OpenIapModule(
            context = ContextWrapper(null),
            alternativeBillingMode = AlternativeBillingMode.ALTERNATIVE_ONLY,
        )
        val props = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(skus = listOf("product-id")),
                )
            ),
            type = ProductQueryType.InApp,
        )

        val result = module.requestPurchase(props) as RequestPurchaseResultPurchases

        assertEquals(emptyList<Purchase>(), result.value)
    }

    @Test
    fun `failed setup preserves pending programs and retry commits configuration`() {
        val pending = mutableSetOf(BillingProgramAndroid.ExternalOffer)

        val failedMode = commitPlayConnectionConfiguration(
            connected = false,
            pendingPrograms = pending,
            attemptedPendingPrograms = pending.toSet(),
            requestedMode = AlternativeBillingMode.ALTERNATIVE_ONLY,
        )
        assertEquals(AlternativeBillingMode.NONE, failedMode)
        assertEquals(setOf(BillingProgramAndroid.ExternalOffer), pending)

        val connectedMode = commitPlayConnectionConfiguration(
            connected = true,
            pendingPrograms = pending,
            attemptedPendingPrograms = pending.toSet(),
            requestedMode = AlternativeBillingMode.ALTERNATIVE_ONLY,
        )
        assertEquals(AlternativeBillingMode.ALTERNATIVE_ONLY, connectedMode)
        assertEquals(emptySet<BillingProgramAndroid>(), pending)
    }
}
