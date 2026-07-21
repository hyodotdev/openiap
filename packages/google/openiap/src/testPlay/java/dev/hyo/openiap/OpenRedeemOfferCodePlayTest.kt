package dev.hyo.openiap

import android.app.Activity
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Play flavor: openRedeemOfferCode must launch the Google Play offer-code
 * redemption page (https://play.google.com/redeem) via ACTION_VIEW and
 * return true once the flow was launched.
 *
 * The billing client is intentionally never initialized in these tests:
 * offer-code redemption must work without initConnection (no Play Billing
 * requirement), unlike the Billing Programs APIs.
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class OpenRedeemOfferCodePlayTest {

    @Test
    fun `openRedeemOfferCode launches the Play redeem page without a billing client`() {
        val activity = Robolectric.buildActivity(Activity::class.java).create().get()
        val module = OpenIapModule(ApplicationProvider.getApplicationContext<android.content.Context>())

        val launched = runBlocking { module.openRedeemOfferCode(activity) }

        assertTrue("openRedeemOfferCode must return true once the flow was launched", launched)
        val started = shadowOf(activity).nextStartedActivity
        assertNotNull("openRedeemOfferCode must start an ACTION_VIEW intent", started)
        assertEquals(Intent.ACTION_VIEW, started.action)
        assertEquals("https://play.google.com/redeem", started.data?.toString())
        assertTrue(
            "redeem intent must carry FLAG_ACTIVITY_NEW_TASK",
            (started.flags and Intent.FLAG_ACTIVITY_NEW_TASK) != 0
        )
    }

    @Test
    fun `mutation bundle wires openRedeemOfferCodeAndroid through the current activity`() {
        val activity = Robolectric.buildActivity(Activity::class.java).create().get()
        val module = OpenIapModule(ApplicationProvider.getApplicationContext<android.content.Context>())
        module.setActivity(activity)

        val handler = module.mutationHandlers.openRedeemOfferCodeAndroid
        assertNotNull("Play flavor must wire openRedeemOfferCodeAndroid for bundle parity", handler)

        val launched = runBlocking { handler!!.invoke() }

        assertTrue("wired handler must delegate to openRedeemOfferCode and return true", launched)
        assertNotNull(
            "wired handler must launch the redeem intent from the current activity",
            shadowOf(activity).nextStartedActivity
        )
    }

    @Test
    fun `openRedeemOfferCodeAndroid handler requires a current activity`() {
        val module = OpenIapModule(ApplicationProvider.getApplicationContext<android.content.Context>())

        val thrown = runCatching {
            runBlocking { module.mutationHandlers.openRedeemOfferCodeAndroid!!.invoke() }
        }.exceptionOrNull()

        assertTrue(
            "handler must throw MissingCurrentActivity when no activity is attached, got: $thrown",
            thrown is OpenIapError.MissingCurrentActivity
        )
    }
}
