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
import kotlin.test.assertFalse
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
        }
    }
}
