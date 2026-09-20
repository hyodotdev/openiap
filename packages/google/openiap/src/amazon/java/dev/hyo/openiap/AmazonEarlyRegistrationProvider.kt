package dev.hyo.openiap

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.util.Log
import com.amazon.device.iap.PurchasingListener
import com.amazon.device.iap.PurchasingService
import com.amazon.device.iap.model.ProductDataResponse
import com.amazon.device.iap.model.PurchaseResponse
import com.amazon.device.iap.model.PurchaseUpdatesResponse
import com.amazon.device.iap.model.UserDataResponse

/**
 * Registers with the Appstore SDK at process start.
 *
 * The SDK installs its ActivityLifecycleCallbacks inside the first
 * registerListener call and launches the Appstore purchase Activity only from an
 * Activity it has seen resume. Registering from initConnection happens after the
 * host Activity resumed, so the SDK parks the purchase until the next onResume:
 * no dialog, then the 300s timeout (issue #460). A ContentProvider is the
 * earliest hook that needs no host code. OpenIapModule.ensureRegistered()
 * replaces the placeholder; the SDK keeps one listener and does not re-init.
 */
class AmazonEarlyRegistrationProvider : ContentProvider() {
    override fun onCreate(): Boolean {
        val application = context?.applicationContext ?: return false
        runCatching { PurchasingService.registerListener(application, PlaceholderListener) }
            // scripts/verify-amazon-registration-order.sh greps this exact message.
            .onSuccess { Log.i(TAG, "Amazon listener registered at process start") }
            .onFailure {
                Log.w(TAG, "Amazon early registration failed; purchase dialogs may not appear", it)
            }
        return true
    }

    /**
     * Stands in until OpenIapModule registers. The Appstore's NOTIFY broadcast
     * can cold-start the process with a purchase that completed while the app
     * was dead; the SDK fetches and acknowledges it, so it is logged and dropped
     * here. getAvailablePurchases returns the receipt, since nothing fulfilled it.
     */
    internal object PlaceholderListener : PurchasingListener {
        override fun onUserDataResponse(response: UserDataResponse) =
            drop("userData", response.requestId, response.requestStatus)

        override fun onProductDataResponse(response: ProductDataResponse) =
            drop("productData", response.requestId, response.requestStatus)

        override fun onPurchaseResponse(response: PurchaseResponse) =
            drop("purchase", response.requestId, response.requestStatus)

        override fun onPurchaseUpdatesResponse(response: PurchaseUpdatesResponse) =
            drop("purchaseUpdates", response.requestId, response.requestStatus)

        private fun drop(kind: String, requestId: Any?, status: Any?) {
            Log.w(
                TAG,
                "Amazon $kind response $requestId ($status) arrived before OpenIapModule registered; dropped",
            )
        }
    }

    private companion object {
        const val TAG = "OpenIAP"
    }

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor? = null

    override fun getType(uri: Uri): String? = null

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?,
    ): Int = 0
}
