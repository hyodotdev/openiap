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
    fun `a caller that joined another config's attempt applies its own next`() {
        assertTrue(reconnectsAfterJoin(hasConfig = true, joined = standard, requested = externalOffer))
        assertFalse(reconnectsAfterJoin(hasConfig = true, joined = externalOffer, requested = externalOffer))
        assertFalse(reconnectsAfterJoin(hasConfig = false, joined = externalOffer, requested = standard))
    }

    @Test
    fun `a repeated config keeps a program queued for the live connection`() {
        val queued = setOf(BillingProgramAndroid.UserChoiceBilling)
        val live = playConnectionConfiguration(queued, InitConnectionConfig())
        val again = requestedConnectionConfiguration(emptySet(), InitConnectionConfig(), live, queued)
        assertEquals(live, again)
        assertTrue(keepsLiveConnection(ready = true, live = live, requested = again))
    }

    @Test
    fun `a reconnect without a config restores the program after a service drop`() {
        assertEquals(
            externalOffer,
            requestedConnectionConfiguration(emptySet(), null, externalOffer, emptySet()),
        )
        assertEquals(standard, requestedConnectionConfiguration(emptySet(), null, null, emptySet()))
    }

    @Test
    fun `an explicit empty config returns to the standard client`() {
        val requested =
            requestedConnectionConfiguration(emptySet(), InitConnectionConfig(), externalOffer, emptySet())
        assertEquals(standard, requested)
        assertFalse(keepsLiveConnection(ready = true, live = externalOffer, requested = requested))
    }

    @Test
    fun `no purchase starts while the client is being rebuilt`() {
        assertTrue(
            purchaseAdmissionError(clientReady = true, purchaseInProgress = false, reconnecting = true)
                is OpenIapError.ServiceDisconnected,
        )
        assertTrue(
            purchaseAdmissionError(clientReady = true, purchaseInProgress = true, reconnecting = false)
                is OpenIapError.DeveloperError,
        )
        assertEquals(
            null,
            purchaseAdmissionError(clientReady = true, purchaseInProgress = false, reconnecting = false),
        )
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
