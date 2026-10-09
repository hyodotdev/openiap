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
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class OpenRedeemOfferCodeTest {
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

            assertNull(iap.openRedeemOfferCode())
            assertTrue(launchContext === appContext)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `failed Play redeem launch preserves its typed error`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            val appContext = object : ContextWrapper(null) {
                override fun getApplicationContext(): Context = this
            }
            val iap = InAppPurchaseAndroid(
                applicationContextProvider = { appContext },
                redeemFlowLauncher = { false },
            )
            val error = assertFailsWith<PurchaseException> { iap.openRedeemOfferCode() }
            assertEquals(ErrorCode.Unknown, error.error.code)
            assertEquals("Failed to open the Play Store redeem page", error.error.message)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `unified Play redeem flow preserves typed launch failure`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            val iap = InAppPurchaseAndroid(applicationContextProvider = { null })

            val unified = assertFailsWith<PurchaseException> { iap.openRedeemOfferCode() }
            assertEquals(ErrorCode.ActivityUnavailable, unified.error.code)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `unsupported store implementations report the redeem flow as not launched without waiting`() = runTest {
        for ((storeName, store) in listOf(
            "amazon" to Store.AMAZON,
            "horizon" to Store.HORIZON,
        )) {
            val implementation = OpenIapDelegateInAppPurchaseAndroid(
                storeName = storeName,
                store = store,
                versionPlatform = "Android $storeName",
            )

            assertNull(implementation.openRedeemOfferCode())
        }
    }
}
