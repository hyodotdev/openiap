package dev.hyo.openiap

import android.app.Activity
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Horizon flavor: Google Play offer-code redemption has no Meta Horizon
 * counterpart, so openRedeemOfferCode must stay an explicit no-op that
 * returns false and never launches an intent, while the mutation bundle
 * still wires openRedeemOfferCodeAndroid for API parity with the
 * generated handler surface.
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class OpenRedeemOfferCodeHorizonNoOpTest {

    @Test
    fun `openRedeemOfferCode is a no-op returning false`() {
        val activity = Robolectric.buildActivity(Activity::class.java).create().get()
        val module = OpenIapModule(ApplicationProvider.getApplicationContext<android.content.Context>())

        val launched = runBlocking { module.openRedeemOfferCode(activity) }

        assertFalse("Horizon openRedeemOfferCode must return false (no-op)", launched)
        assertNull(
            "Horizon openRedeemOfferCode must never launch an intent",
            shadowOf(activity).nextStartedActivity
        )
    }

    @Test
    fun `mutation bundle wires openRedeemOfferCodeAndroid for bundle parity`() {
        val activity = Robolectric.buildActivity(Activity::class.java).create().get()
        val module = OpenIapModule(ApplicationProvider.getApplicationContext<android.content.Context>())
        module.setActivity(activity)

        val handler = module.mutationHandlers.openRedeemOfferCodeAndroid
        assertNotNull("Horizon flavor must wire openRedeemOfferCodeAndroid for bundle parity", handler)

        assertFalse(
            "Horizon openRedeemOfferCodeAndroid handler must return false (no-op)",
            runBlocking { handler!!.invoke() }
        )
    }
}
