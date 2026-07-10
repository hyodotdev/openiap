package io.github.hyochan.kmpiap

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SubscriptionReplacementResolutionTest {
    @Test
    fun `legacy replacement mode follows native Google precedence`() {
        assertNull(
            resolveLegacySubscriptionReplacementMode(
                purchaseToken = null,
                originalExternalTransactionId = "original-external-id",
                replacementMode = null
            )
        )
        assertEquals(
            5,
            resolveLegacySubscriptionReplacementMode(
                purchaseToken = "play-purchase-token",
                originalExternalTransactionId = null,
                replacementMode = null
            )
        )
        assertEquals(
            3,
            resolveLegacySubscriptionReplacementMode(
                purchaseToken = null,
                originalExternalTransactionId = "original-external-id",
                replacementMode = 3
            )
        )
        assertNull(
            resolveLegacySubscriptionReplacementMode(
                purchaseToken = "play-purchase-token",
                originalExternalTransactionId = null,
                replacementMode = 3,
                hasProductLevelReplacementParams = true
            )
        )
    }
}
