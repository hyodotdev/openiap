package dev.hyo.openiap

import android.content.ContextWrapper
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertNull
import org.junit.Test

/** Horizon has no redemption surface and needs no Activity. */
class OpenRedeemOfferCodeHorizonNoOpTest {

    @Test
    fun `unified openRedeemOfferCode handler resolves null without an activity`() {
        val module = OpenIapModule(ContextWrapper(null))

        val purchase = runBlocking { module.mutationHandlers.openRedeemOfferCode!!.invoke() }

        assertNull("Horizon has no redemption surface; unified handler resolves null", purchase)
    }
}
