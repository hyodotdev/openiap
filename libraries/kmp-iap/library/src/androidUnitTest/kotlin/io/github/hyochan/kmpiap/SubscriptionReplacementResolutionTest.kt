package io.github.hyochan.kmpiap

import com.android.billingclient.api.BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode
import io.github.hyochan.kmpiap.openiap.SubscriptionProductReplacementParamsAndroid
import io.github.hyochan.kmpiap.openiap.SubscriptionReplacementModeAndroid
import io.github.hyochan.kmpiap.openiap.AndroidSubscriptionOfferInput
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
            assertFailsWith<IllegalArgumentException> {
                SubscriptionProductReplacementParamsAndroid.fromJson(input)
            }
        }
    }

    @Test
    fun `explicit subscription offers cover only requested SKUs`() {
        val monthly = AndroidSubscriptionOfferInput("monthly-token", "monthly")
        val yearly = AndroidSubscriptionOfferInput("yearly-token", "yearly")

        assertEquals(false, hasInvalidKmpSubscriptionOffers(listOf("monthly"), emptyList()))
        assertEquals(false, hasInvalidKmpSubscriptionOffers(listOf("monthly", "yearly"), listOf(monthly, yearly)))
        assertEquals(true, hasInvalidKmpSubscriptionOffers(listOf("monthly"), listOf(yearly)))
        assertEquals(false, hasInvalidKmpSubscriptionOffers(listOf("monthly"), listOf(monthly, monthly)))
        assertEquals(true, hasInvalidKmpSubscriptionOffers(listOf("monthly", "yearly"), listOf(monthly)))
    }

    @Test
    fun `explicit subscription offer tokens must exist in store metadata`() {
        assertEquals(false, isValidKmpSubscriptionOfferToken("token", emptyList()))
        assertEquals(false, isValidKmpSubscriptionOfferToken("future", listOf("known")))
        assertEquals(true, isValidKmpSubscriptionOfferToken("known", listOf("known")))
        assertEquals(false, areValidKmpSubscriptionOfferTokens(listOf("known", "future"), listOf("known")))
        assertEquals(false, areValidKmpSubscriptionOfferTokens(listOf("future", "known"), listOf("known")))
        assertEquals(true, areValidKmpSubscriptionOfferTokens(listOf("known", "known"), listOf("known")))
    }

    @Test
    fun `explicit one-time offer tokens must exist in store metadata`() {
        assertEquals(false, isValidKmpOneTimeOfferToken("", listOf("known")))
        assertEquals(false, isValidKmpOneTimeOfferToken("token", emptyList()))
        assertEquals(false, isValidKmpOneTimeOfferToken("future", listOf("known")))
        assertEquals(true, isValidKmpOneTimeOfferToken("known", listOf("known")))
    }
}
