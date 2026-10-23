package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * initConnection on a ready client applies a changed billing program instead
 * of ignoring it, so no SDK or app has to end and reconnect by hand.
 */
class PlayConnectionConfigurationTest {
    private val standard = playConnectionConfiguration(emptySet(), null)
    private val externalOffer = playConnectionConfiguration(
        emptySet(),
        InitConnectionConfig(enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer),
    )

    @Test
    fun `a call without a config keeps the ready client`() {
        assertTrue(keepsLiveConnection(ready = true, live = externalOffer, requested = null))
    }

    @Test
    fun `the same config keeps the ready client`() {
        val again = playConnectionConfiguration(
            emptySet(),
            InitConnectionConfig(enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer),
        )
        assertTrue(keepsLiveConnection(ready = true, live = externalOffer, requested = again))
    }

    @Test
    fun `a different program rebuilds the ready client`() {
        assertFalse(keepsLiveConnection(ready = true, live = standard, requested = externalOffer))
        assertFalse(keepsLiveConnection(ready = true, live = externalOffer, requested = standard))
    }

    @Test
    fun `a client that is not ready always connects`() {
        assertFalse(keepsLiveConnection(ready = false, live = standard, requested = null))
    }

    @Test
    fun `the renderer counts only for Billing Choice`() {
        val withoutRenderer = playConnectionConfiguration(
            emptySet(),
            InitConnectionConfig(
                billingChoiceScreenTypeAndroid = null,
                enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer,
            ),
        )
        assertEquals(externalOffer, withoutRenderer)

        val developerRendered = playConnectionConfiguration(
            emptySet(),
            InitConnectionConfig(
                billingChoiceScreenTypeAndroid = BillingChoiceScreenTypeAndroid.DeveloperRendered,
                enableBillingProgramAndroid = BillingProgramAndroid.BillingChoice,
            ),
        )
        val googleRendered = playConnectionConfiguration(
            emptySet(),
            InitConnectionConfig(enableBillingProgramAndroid = BillingProgramAndroid.BillingChoice),
        )
        assertFalse(keepsLiveConnection(ready = true, live = googleRendered, requested = developerRendered))
        assertEquals(
            googleRendered,
            playConnectionConfiguration(
                emptySet(),
                InitConnectionConfig(
                    billingChoiceScreenTypeAndroid = null,
                    enableBillingProgramAndroid = BillingProgramAndroid.BillingChoice,
                ),
            ),
        )
    }

    @Test
    fun `user choice billing selects the user choice client`() {
        val userChoice = playConnectionConfiguration(
            setOf(BillingProgramAndroid.UserChoiceBilling),
            null,
        )
        assertEquals(BillingClientMode.UserChoice, userChoice.billingClientMode)
        assertEquals(BillingClientMode.Standard, standard.billingClientMode)
    }
}
