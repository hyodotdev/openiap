package io.github.hyochan.kmpiap

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BillingPurchaseSuspensionReflectionTest {
    @Test
    fun `reads getIsSuspended getter`() {
        assertTrue(billingPurchaseIsSuspended(GetIsSuspendedPurchase(true)))
    }

    @Test
    fun `falls back to isSuspended getter`() {
        assertTrue(billingPurchaseIsSuspended(IsSuspendedPurchase(true)))
    }

    @Test
    fun `missing suspended getter fails closed`() {
        assertFalse(billingPurchaseIsSuspended(Any()))
    }

    @Test
    fun `throwing suspended getter fails closed`() {
        assertFalse(billingPurchaseIsSuspended(ThrowingSuspendedPurchase()))
    }
}

internal class GetIsSuspendedPurchase(
    private val suspended: Boolean,
) {
    fun getIsSuspended(): Boolean = suspended
}

internal class IsSuspendedPurchase(
    private val suspended: Boolean,
) {
    fun isSuspended(): Boolean = suspended
}

internal class ThrowingSuspendedPurchase {
    fun getIsSuspended(): Boolean = error("Suspended state unavailable")
}
