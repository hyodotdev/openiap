package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ErrorCode
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

@OptIn(ExperimentalCoroutinesApi::class)
class OpenRedeemOfferCodeAndroidTest {
    @Test
    fun `Play redeem flow fails with ActivityUnavailable when no activity or context is captured`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            val error = assertFailsWith<PurchaseException> {
                InAppPurchaseAndroid().openRedeemOfferCodeAndroid()
            }

            assertEquals(ErrorCode.ActivityUnavailable, error.error.code)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun `non-Play stores report the redeem flow as not launched without waiting`() = runTest {
        for ((storeName, store) in listOf(
            "amazon" to Store.AMAZON,
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
