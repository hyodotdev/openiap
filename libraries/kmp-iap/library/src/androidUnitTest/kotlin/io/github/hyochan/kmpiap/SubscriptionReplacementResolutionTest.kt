package io.github.hyochan.kmpiap

import com.android.billingclient.api.BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode
import io.github.hyochan.kmpiap.openiap.SubscriptionProductReplacementParamsAndroid
import io.github.hyochan.kmpiap.openiap.SubscriptionReplacementModeAndroid
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class SubscriptionReplacementResolutionTest {
    @Test
    fun `subscription replacement follows native Google precedence`() {
        assertNull(
            resolveSubscriptionReplacementMode(
                purchaseToken = null,
                originalExternalTransactionId = "original-external-id",
            )
        )
        assertEquals(
            5,
            resolveSubscriptionReplacementMode(
                purchaseToken = "play-purchase-token",
                originalExternalTransactionId = null,
            )
        )
        assertNull(
            resolveSubscriptionReplacementMode(
                purchaseToken = "play-purchase-token",
                originalExternalTransactionId = null,
                hasProductLevelReplacementParams = true
            )
        )
    }

    @Test
    fun `concrete product replacement modes map to native values`() {
        val mappings = mapOf(
            SubscriptionReplacementModeAndroid.WithTimeProration to ReplacementMode.WITH_TIME_PRORATION,
            SubscriptionReplacementModeAndroid.ChargeProratedPrice to ReplacementMode.CHARGE_PRORATED_PRICE,
            SubscriptionReplacementModeAndroid.ChargeFullPrice to ReplacementMode.CHARGE_FULL_PRICE,
            SubscriptionReplacementModeAndroid.WithoutProration to ReplacementMode.WITHOUT_PRORATION,
            SubscriptionReplacementModeAndroid.Deferred to ReplacementMode.DEFERRED,
            SubscriptionReplacementModeAndroid.KeepExisting to ReplacementMode.KEEP_EXISTING,
        )

        mappings.forEach { (mode, nativeValue) ->
            assertEquals(nativeValue, mapReplacementMode(mode))
        }
    }

    @Test
    fun `unknown and missing product replacement modes are rejected`() {
        val inputs = listOf(
            mapOf("oldProductId" to "old.product", "replacementMode" to "future-mode"),
            mapOf("oldProductId" to "old.product"),
        )

        inputs.forEach { input ->
            val params = requireNotNull(SubscriptionProductReplacementParamsAndroid.fromJson(input))
            assertEquals(SubscriptionReplacementModeAndroid.UnknownReplacementMode, params.replacementMode)
            assertFailsWith<IllegalArgumentException> {
                mapReplacementMode(params.replacementMode)
            }
        }
    }
}
