package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.AlternativeBillingModeAndroid
import io.github.hyochan.kmpiap.openiap.BillingProgramAndroid
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PurchaseFallbackMatchingTest {
    @Test
    fun `product level replacement params require one target`() {
        assertTrue(isSubscriptionReplacementTargetCountValid(1, true))
        assertFalse(isSubscriptionReplacementTargetCountValid(2, true))
        assertTrue(isSubscriptionReplacementTargetCountValid(2, false))
    }

    @Test
    fun `rejects an existing purchase from before the current flow`() {
        assertFalse(
            isPurchaseForPendingRequest(
                transactionDateMillis = 999.0,
                productIds = listOf("premium"),
                requestedSkus = setOf("premium"),
                launchStartedAtMillis = 1_000.0,
            )
        )
    }

    @Test
    fun `accepts a fresh purchase containing a requested product`() {
        assertTrue(
            isPurchaseForPendingRequest(
                transactionDateMillis = 1_001.0,
                productIds = listOf("base", "addon"),
                requestedSkus = setOf("addon"),
                launchStartedAtMillis = 1_000.0,
            )
        )
    }

    @Test
    fun `rejects a fresh purchase for an unrelated product`() {
        assertFalse(
            isPurchaseForPendingRequest(
                transactionDateMillis = 1_001.0,
                productIds = listOf("unrelated"),
                requestedSkus = setOf("premium"),
                launchStartedAtMillis = 1_000.0,
            )
        )
    }

    @Test
    fun `explicit legacy and new billing programs reject incompatible dual enable`() {
        assertTrue(
            hasLegacyBillingProgramConflict(
                deprecatedMode = AlternativeBillingModeAndroid.AlternativeOnly,
                requestedProgram = BillingProgramAndroid.ExternalOffer,
            )
        )
        assertFalse(
            hasLegacyBillingProgramConflict(
                deprecatedMode = AlternativeBillingModeAndroid.UserChoice,
                requestedProgram = BillingProgramAndroid.UserChoiceBilling,
            )
        )
        assertEquals(
            null,
            resolveBillingProgramForConnection(
                requestedProgram = BillingProgramAndroid.UserChoiceBilling,
                deprecatedMode = AlternativeBillingModeAndroid.UserChoice,
            )
        )
        assertFalse(
            hasLegacyBillingProgramConflict(
                deprecatedMode = AlternativeBillingModeAndroid.None,
                requestedProgram = BillingProgramAndroid.ExternalOffer,
            )
        )
    }

    @Test
    fun `subscription replacement update source is exclusive and required`() {
        assertEquals(1, subscriptionUpdateSourceCount("play-token", null))
        assertEquals(1, subscriptionUpdateSourceCount(null, "external-id"))
        assertEquals(0, subscriptionUpdateSourceCount(null, null))
        assertEquals(2, subscriptionUpdateSourceCount("play-token", "external-id"))
    }
}
