package dev.hyo.openiap

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class HorizonVerifyPurchaseTest {
    private val module = OpenIapModule(ApplicationProvider.getApplicationContext<Context>())

    @Test
    fun `google options alone are a developer error instead of a Play request`() = runTest {
        val props = VerifyPurchaseProps(
            google = VerifyPurchaseGoogleOptions(
                accessToken = "token",
                packageName = "dev.hyo.martie",
                purchaseToken = "purchase-token",
                sku = "coins",
            ),
        )

        val thrown = runCatching { module.verifyPurchase(props) }.exceptionOrNull()

        assertEquals(
            OpenIapError.DeveloperError(
                "Horizon verifyPurchase requires horizon options (sku, userId, accessToken)"
            ),
            thrown,
        )
    }

    @Test
    fun `a missing app id names the manifest meta-data`() = runTest {
        val props = VerifyPurchaseProps(
            horizon = VerifyPurchaseHorizonOptions(accessToken = "token", sku = "coins", userId = "meta-user"),
        )

        val thrown = runCatching { module.verifyPurchase(props) }.exceptionOrNull()

        assertEquals(
            OpenIapError.DeveloperError(
                "Horizon verifyPurchase requires the com.meta.horizon.platform.HORIZON_APP_ID manifest meta-data"
            ),
            thrown,
        )
    }
}
