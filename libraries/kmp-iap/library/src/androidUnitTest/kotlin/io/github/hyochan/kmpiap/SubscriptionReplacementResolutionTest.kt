package io.github.hyochan.kmpiap

import kotlin.test.Test
import kotlin.test.assertEquals
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
}
