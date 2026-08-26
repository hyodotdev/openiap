// Deprecated suffixed redeem APIs stay covered until their OpenIAP 4.0 removal.
@file:Suppress("DEPRECATION")

package io.github.hyochan.kmpiap

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class OpenRedeemOfferCodeAndroidTest {
    @Test
    fun `Play redeem flow uses application context without billing initialization`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            val appContext = object : ContextWrapper(null) {
                override fun getApplicationContext(): Context = this
            }
            var launchContext: Context? = null
            val iap = InAppPurchaseAndroid(
                applicationContextProvider = { appContext },
                redeemFlowLauncher = { context ->
                    launchContext = context
                    true
                },
            )

            assertTrue(iap.openRedeemOfferCodeAndroid())
            assertTrue(launchContext === appContext)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `unified Play redeem flow launches the same page and resolves null`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            val appContext = object : ContextWrapper(null) {
                override fun getApplicationContext(): Context = this
            }
            var launchContext: Context? = null
            val iap = InAppPurchaseAndroid(
                applicationContextProvider = { appContext },
                redeemFlowLauncher = { context ->
                    launchContext = context
                    true
                },
            )

            assertNull(iap.openRedeemOfferCode())
            assertTrue(launchContext === appContext)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `unified Play redeem flow keeps the suffixed typed launch failure`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            val iap = InAppPurchaseAndroid(applicationContextProvider = { null })

            val unified = assertFailsWith<PurchaseException> { iap.openRedeemOfferCode() }
            val suffixed = assertFailsWith<PurchaseException> { iap.openRedeemOfferCodeAndroid() }
            assertEquals(ErrorCode.ActivityUnavailable, unified.error.code)
            assertEquals(suffixed.error.code, unified.error.code)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `unsupported store implementations report the redeem flow as not launched without waiting`() = runTest {
        for ((storeName, store) in listOf(
            "amazon" to Store.AMAZON,
            // Horizon uses the Play Billing Compatibility SDK, matching the production factory metadata.
            "horizon" to Store.PLAY_STORE,
        )) {
            val implementation = AmazonInAppPurchaseAndroid(
                storeName = storeName,
                store = store,
                versionPlatform = "Android $storeName",
            )

            assertFalse(implementation.openRedeemOfferCodeAndroid())
            // Unified op resolves null without launching on Amazon and Horizon.
            assertNull(implementation.openRedeemOfferCode())
        }
    }
}
