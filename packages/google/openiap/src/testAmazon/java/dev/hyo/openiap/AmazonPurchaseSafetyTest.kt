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
    fun `a second purchase while one runs is refused as in progress`() {
        val module = OpenIapModule(ApplicationProvider.getApplicationContext<Context>())
        val errors = CopyOnWriteArrayList<OpenIapError>()
        module.addPurchaseErrorListener(OpenIapPurchaseErrorListener { errors += it })
        // initConnection registers with the Appstore SDK on the main thread before any purchase.
        OpenIapModule::class.java.getDeclaredField("isRegistered").apply { isAccessible = true }.set(module, true)
        val running = OpenIapModule::class.java.getDeclaredField("activePurchaseSku").apply { isAccessible = true }
        @Suppress("UNCHECKED_CAST")
        (running.get(module) as java.util.concurrent.atomic.AtomicReference<String?>).set("coins")
        val props = RequestPurchaseProps(
            request = RequestPurchaseProps.Request.Purchase(
                RequestPurchasePropsByPlatforms(google = RequestPurchaseAndroidProps(skus = listOf("coins"))),
            ),
            type = ProductQueryType.InApp,
        )

        val second = runCatching { runBlocking { module.requestPurchase(props) } }

        assertTrue("the double tap fails its call: $second", second.exceptionOrNull() is OpenIapError.PurchaseInProgress)
        assertEquals(listOf(OpenIapError.PurchaseInProgress.CODE), errors.map { it.code })
        @Suppress("UNCHECKED_CAST")
        assertEquals("the first purchase keeps its slot", "coins", (running.get(module) as java.util.concurrent.atomic.AtomicReference<String?>).get())
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
