package dev.hyo.openiap

import android.content.ContextWrapper
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Amazon flavor: Google Play offer-code redemption has no Amazon Appstore
 * counterpart, so openRedeemOfferCode must stay an explicit no-op that
 * never launches an intent, while the mutation bundle still wires both
 * generated handlers (deprecated Boolean + unified Purchase?) for parity.
 */
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
