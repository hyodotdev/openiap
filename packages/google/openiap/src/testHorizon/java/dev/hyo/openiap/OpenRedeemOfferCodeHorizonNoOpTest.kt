package dev.hyo.openiap

import android.content.ContextWrapper
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Horizon flavor: Google Play offer-code redemption has no Meta Horizon
 * counterpart, so openRedeemOfferCode must stay an explicit no-op that
 * never launches an intent, while the mutation bundle still wires both
 * generated handlers (deprecated Boolean + unified Purchase?) for parity.
 */
class OpenRedeemOfferCodeHorizonNoOpTest {

    @Test
    fun `shared offer code handler is a no-op returning false`() {
        assertFalse(
            "Horizon offer-code paths must return false (no-op)",
            runBlocking { unsupportedRedeemOfferCode() }
        )
    }

    @Test
    fun `unified openRedeemOfferCode handler resolves null without an activity`() {
        val module = OpenIapModule(ContextWrapper(null))

        val purchase = runBlocking { module.mutationHandlers.openRedeemOfferCode!!.invoke() }

        assertNull("Horizon has no redemption surface; unified handler resolves null", purchase)
    }
}
