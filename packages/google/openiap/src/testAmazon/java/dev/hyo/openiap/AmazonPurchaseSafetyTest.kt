package dev.hyo.openiap

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import dev.hyo.openiap.listener.OpenIapPurchaseErrorListener
import java.util.concurrent.CopyOnWriteArrayList
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], instrumentedPackages = ["com.amazon"])
@OptIn(ExperimentalCoroutinesApi::class)
class AmazonPurchaseSafetyTest {

    @Test
    fun `play only purchase options fail before the Appstore SDK is called`() {
        // A context without a base makes Appstore SDK registration throw.
        val module = OpenIapModule(ContextWrapper(null))
        val errors = CopyOnWriteArrayList<OpenIapError>()
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })
        val props = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(
                    google = RequestPurchaseAndroidProps(
                        skus = listOf("coins"),
                        offerToken = "one-time-offer",
                    ),
                ),
            ),
            type = ProductQueryType.InApp,
        )

        val result = runBlocking { module.requestPurchase(props) }

        assertEquals(RequestPurchaseResultPurchases(emptyList()), result)
        assertTrue(errors.single() is OpenIapError.FeatureNotSupported)
    }

    @Test
    fun `unsupported Amazon purchase options are refused`() {
        assertTrue(
            amazonUnsupportedPurchaseError(
                offerToken = null,
                originalExternalTransactionId = "external-transaction",
                hasDeveloperBillingOption = false,
            ) is OpenIapError.FeatureNotSupported
        )
        assertTrue(
            amazonUnsupportedPurchaseError(
                offerToken = null,
                originalExternalTransactionId = null,
                hasDeveloperBillingOption = true,
            ) is OpenIapError.FeatureNotSupported
        )
        assertNull(
            amazonUnsupportedPurchaseError(
                offerToken = null,
                originalExternalTransactionId = null,
                hasDeveloperBillingOption = false,
            )
        )
    }

    @Test
    fun `deepLinkToSubscriptions reports an Appstore page that cannot open`() {
        val context = object : ContextWrapper(ApplicationProvider.getApplicationContext<Context>()) {
            override fun startActivity(intent: Intent) {
                throw ActivityNotFoundException("no Appstore")
            }
        }
        Dispatchers.setMain(Dispatchers.Unconfined)

        val thrown = try {
            runCatching { runBlocking { OpenIapModule(context).deepLinkToSubscriptions(null) } }
                .exceptionOrNull()
        } finally {
            Dispatchers.resetMain()
        }

        assertTrue("expected OpenIapError.UnknownError, got $thrown", thrown is OpenIapError.UnknownError)
    }
}
