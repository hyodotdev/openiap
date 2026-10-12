package dev.hyo.openiap

import android.app.Activity
import androidx.test.core.app.ApplicationProvider
import com.amazon.device.iap.internal.model.PurchaseResponseBuilder
import com.amazon.device.iap.internal.model.ReceiptBuilder
import com.amazon.device.iap.internal.model.UserDataBuilder
import com.amazon.device.iap.model.ProductType as AmazonProductType
import com.amazon.device.iap.model.PurchaseResponse
import com.amazon.device.iap.model.RequestId
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import java.util.Date
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLooper

/** The 2-second cancel fallback for an Appstore purchase UI that closes without a response. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], instrumentedPackages = ["com.amazon"])
@OptIn(ExperimentalCoroutinesApi::class)
class AmazonPurchaseCancelFallbackTest {

    @Test
    fun `a success after the cancel fallback still reaches purchase listeners`() {
        val module = OpenIapModule(ApplicationProvider.getApplicationContext())
        val updates = CopyOnWriteArrayList<Purchase>()
        module.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { updates += it })
        val pending = trackPurchase(module)

        Robolectric.buildActivity(Activity::class.java).setup()
        ShadowLooper.idleMainLooper(2, TimeUnit.SECONDS)
        assertTrue(
            "the fallback reports the purchase as cancelled",
            pending.getCompletionExceptionOrNull() is OpenIapError.UserCancelled,
        )

        module.onPurchaseResponse(successfulResponse())

        assertEquals(listOf(SKU), updates.map { it.productId })
        assertEquals(listOf(RECEIPT_ID), updates.map { it.purchaseToken })
    }

    @Test
    fun `setting the activity does not arm the cancel fallback`() {
        val module = OpenIapModule(ApplicationProvider.getApplicationContext())
        val pending = trackPurchase(module)

        module.setActivity(Robolectric.buildActivity(Activity::class.java).create().get())
        ShadowLooper.idleMainLooper(2, TimeUnit.SECONDS)

        assertFalse("only a resume after the Appstore UI arms the fallback", pending.isCompleted)
    }

    /** Puts the module in the state requestAmazonPurchase leaves while the Appstore UI is open. */
    private fun trackPurchase(module: OpenIapModule): CompletableDeferred<PurchaseResponse> {
        val pending = CompletableDeferred<PurchaseResponse>()
        privateMap<CompletableDeferred<PurchaseResponse>>(module, "purchaseRequests")[REQUEST_ID] = pending
        privateMap<String>(module, "purchaseSkuByRequestId")[REQUEST_ID] = SKU
        OpenIapModule::class.java.getDeclaredMethod("trackPurchaseRequest", String::class.java).apply {
            isAccessible = true
            invoke(module, REQUEST_ID)
        }
        return pending
    }

    @Suppress("UNCHECKED_CAST")
    private fun <V> privateMap(module: OpenIapModule, name: String): ConcurrentHashMap<String, V> =
        OpenIapModule::class.java.getDeclaredField(name).apply { isAccessible = true }
            .get(module) as ConcurrentHashMap<String, V>

    private fun successfulResponse(): PurchaseResponse = PurchaseResponseBuilder()
        .setRequestId(RequestId.fromString(REQUEST_ID))
        .setRequestStatus(PurchaseResponse.RequestStatus.SUCCESSFUL)
        .setUserData(UserDataBuilder().setUserId("amazon-user").setMarketplace("US").build())
        .setReceipt(
            ReceiptBuilder()
                .setReceiptId(RECEIPT_ID)
                .setSku(SKU)
                .setProductType(AmazonProductType.CONSUMABLE)
                .setPurchaseDate(Date(1_700_000_000_000L))
                .build()
        )
        .build()

    private companion object {
        const val REQUEST_ID = "purchase-request-1"
        const val SKU = "coins"
        const val RECEIPT_ID = "receipt-1"
    }
}
