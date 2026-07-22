package dev.hyo.openiap

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Test

/**
 * Horizon flavor: Google Play offer-code redemption has no Meta Horizon
 * counterpart, so openRedeemOfferCode must stay an explicit no-op that
 * returns false and never launches an intent, while the mutation bundle
 * still wires openRedeemOfferCodeAndroid for API parity with the
 * generated handler surface.
 */
class OpenRedeemOfferCodeHorizonNoOpTest {

    @Test
    fun `shared offer code handler is a no-op returning false`() {
        assertFalse(
            "Horizon offer-code paths must return false (no-op)",
            runBlocking { unsupportedRedeemOfferCode() }
        )
    }
}
