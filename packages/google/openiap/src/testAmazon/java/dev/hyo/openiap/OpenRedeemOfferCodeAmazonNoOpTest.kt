package dev.hyo.openiap

import android.content.ContextWrapper
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

/** Amazon redemption is a no-op in both the native Boolean and SDK Purchase? paths. */
class OpenRedeemOfferCodeAmazonNoOpTest {

    @Test
    fun `shared offer code handler is a no-op returning false`() {
        assertFalse(
            "Amazon offer-code paths must return false (no-op)",
            runBlocking { unsupportedRedeemOfferCode() }
        )
    }

    @Test
    fun `unified openRedeemOfferCode handler resolves null without an activity`() {
        val module = OpenIapModule(ContextWrapper(null))

        val purchase = runBlocking { module.mutationHandlers.openRedeemOfferCode!!.invoke() }

        assertNull("Amazon has no redemption surface; unified handler resolves null", purchase)
    }
}
