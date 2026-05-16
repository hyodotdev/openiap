package io.github.hyochan.flutter_inapp_purchase

import android.app.Activity
import android.content.Context
import android.util.Log
import com.amazon.device.iap.PurchasingListener
import com.amazon.device.iap.PurchasingService
import com.amazon.device.iap.model.*
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/** AmazonInappPurchasePlugin  */
class AmazonInappPurchasePlugin : MethodCallHandler {
    private var safeResult: MethodResultWrapper? = null
    private var channel: MethodChannel? = null
    private var context: Context? = null
    private var activity: Activity? = null

    fun setContext(context: Context?) {
        this.context = context
    }

    fun setActivity(activity: Activity?) {
        this.activity = activity
    }

    fun setChannel(channel: MethodChannel?) {
        this.channel = channel
    }

    fun dispose() {
        safeResult = null
        channel = null
        context = null
        activity = null
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        if (call.method == "getStore") {
            result.success(FlutterInappPurchasePlugin.getStore())
            return
        }

        val ch = channel
        if (ch == null) {
            logError("onMethodCall received for ${call.method} but channel is null. Cannot send result.")
            result.error("E_CHANNEL_NULL", "MethodChannel is not attached", null)
            return
        }
        val ctx = context
        if (ctx == null) {
            logError("onMethodCall received for ${call.method} but context is null.")
            result.error("E_CONTEXT_NULL", "Context is not attached", null)
            return
        }

        val safe = MethodResultWrapper(result, ch)
        safeResult = safe

        try {
            PurchasingService.registerListener(ctx, purchasesUpdatedListener)
        } catch (e: Exception) {
            safe.error(
                call.method,
                "Call endConnection method if you want to start over.",
                e.message
            )
            return
        }
        when (call.method) {
            "initConnection" -> {
                PurchasingService.getUserData()
                safe.success("Billing client ready")
            }
            "endConnection" -> {
                safe.success("Billing client has ended.")
            }
            "setPurchaseUpdatedListenerOptions" -> {
                safe.success(null)
            }
            "isReady" -> {
                safe.success(true)
            }
            "showInAppMessages" -> {
                safe.success("in app messages not supported for amazon")
            }
            "getAvailableItemsByType" -> {
                val type = normalizeProductType(call.argument<String>("type"))
                logDebug("gaibt=$type")
                // NOTE: getPurchaseUpdates doesnt return Consumables which are FULFILLED
                if (type == "inapp") {
                    PurchasingService.getPurchaseUpdates(true)
                } else if (type == "subs") {
                    // Subscriptions are retrieved during inapp, so we just return empty list
                    safe.success("[]")
                } else {
                    safe.notImplemented()
                }
            }
            "getPurchaseHistoryByType" -> {
                // No equivalent
                safe.success("[]")
            }
            "buyItemByType" -> {
                val type = call.argument<String>("type")
                val sku: String? = call.argument<String>("sku")
                    ?: call.argument<String>("productId")
                    ?: call.argument<ArrayList<String>>("skus")?.firstOrNull()
                val oldSku = call.argument<String>("oldSku")
                logDebug("type=$type||sku=$sku||oldsku=$oldSku")
                if (sku.isNullOrBlank()) {
                    safe.error("E_DEVELOPER_ERROR", "Missing sku", null)
                    return
                }
                val requestId = PurchasingService.purchase(sku)
                logDebug("resid=$requestId")
            }
            "consumeProduct" -> {
                // consumable is a separate type in amazon
                safe.success("no-ops in amazon")
            }
            else -> {
                safe.notImplemented()
            }
        }
    }

    private fun normalizeProductType(type: String?): String {
        val normalized = type?.lowercase() ?: "inapp"
        return when {
            normalized == "all" -> "inapp"
            normalized.contains("sub") -> "subs"
            else -> "inapp"
        }
    }

    private fun currentResult(): MethodResultWrapper? {
        val result = safeResult
        if (result == null) {
            logWarning("Amazon IAP callback arrived without a pending method result.")
        }
        return result
    }

    private val purchasesUpdatedListener: PurchasingListener = object : PurchasingListener {
        override fun onUserDataResponse(userDataResponse: UserDataResponse) {
            logDebug("onUserDataResponse: RequestStatus (${userDataResponse.requestStatus})")
        }

        // getItemsByType
        override fun onProductDataResponse(response: ProductDataResponse) {
            val status = response.requestStatus
            logDebug("onProductDataResponse: RequestStatus ($status)")
            when (status) {
                ProductDataResponse.RequestStatus.SUCCESSFUL -> {
                    logDebug("onProductDataResponse: successful. The item data map in this response includes the valid SKUs")
                    val productData = response.productData
                    val unavailableSkus = response.unavailableSkus
                    logDebug("onProductDataResponse: ${unavailableSkus.size} unavailable skus")
                    logDebug("unavailableSkus=$unavailableSkus")
                    val items = JSONArray()
                    try {
                        for ((_, product) in productData) {
                            //val format = NumberFormat.getCurrencyInstance()
                            val item = JSONObject()
                            item.put("productId", product.sku)
                            item.put("price", product.price)
                            item.put("currency", null)
                            when (product.productType) {
                                ProductType.ENTITLED, ProductType.CONSUMABLE -> item.put(
                                    "type",
                                    "inapp"
                                )
                                ProductType.SUBSCRIPTION -> item.put("type", "subs")
                            }
                            item.put("localizedPrice", product.price)
                            item.put("title", product.title)
                            item.put("description", product.description)
                            item.put("introductoryPrice", "")
                            item.put("subscriptionPeriodAndroid", "")
                            item.put("freeTrialPeriodAndroid", "")
                            item.put("introductoryPriceCyclesAndroid", 0)
                            item.put("introductoryPricePeriodAndroid", "")
                            logDebug("onProductDataResponse: putting sku=${product.sku}")
                            items.put(item)
                        }
                        currentResult()?.success(items.toString())
                    } catch (e: JSONException) {
                        currentResult()?.error(TAG, "E_BILLING_RESPONSE_JSON_PARSE_ERROR", e.message)
                    }
                }
                ProductDataResponse.RequestStatus.FAILED -> {
                    logDebug("onProductDataResponse: failed, should retry request")
                    currentResult()?.error(TAG, "FAILED", null)
                }
                ProductDataResponse.RequestStatus.NOT_SUPPORTED -> {
                    logDebug("onProductDataResponse: failed, should retry request")
                    currentResult()?.error(TAG, "NOT_SUPPORTED", null)
                }
            }
        }

        // buyItemByType
        override fun onPurchaseResponse(response: PurchaseResponse) {
            val status = response.requestStatus
            logDebug("onPurchaseResponse: RequestStatus ($status)")
            when (status) {
                PurchaseResponse.RequestStatus.SUCCESSFUL -> {
                    val receipt = response.receipt
                    PurchasingService.notifyFulfillment(
                        receipt.receiptId,
                        FulfillmentResult.FULFILLED
                    )
                    val date = receipt.purchaseDate
                    val transactionDate = date.time
                    try {
                        val item = getPurchaseData(
                            receipt.sku,
                            receipt.receiptId,
                            receipt.receiptId,
                            transactionDate.toDouble()
                        )
                        logDebug("onPurchaseResponse: putting sku=${receipt.sku}")
                        val itemJson = item.toString()
                        currentResult()?.success(itemJson)
                        currentResult()?.invokeMethod("purchase-updated", itemJson)
                    } catch (e: JSONException) {
                        currentResult()?.error(TAG, "E_BILLING_RESPONSE_JSON_PARSE_ERROR", e.message)
                    }
                }
                PurchaseResponse.RequestStatus.FAILED -> currentResult()?.error(
                    TAG,
                    "buyItemByType",
                    "billingResponse is not ok: $status"
                )
                else -> {}
            }
        }

        // getAvailableItemsByType
        override fun onPurchaseUpdatesResponse(response: PurchaseUpdatesResponse) {
            val status = response.requestStatus
            logDebug("onPurchaseUpdatesResponse: RequestStatus ($status)")
            when (status) {
                PurchaseUpdatesResponse.RequestStatus.SUCCESSFUL -> {
                    val items = JSONArray()
                    try {
                        val receipts = response.receipts
                        for (receipt in receipts) {
                            val date = receipt.purchaseDate
                            val transactionDate = date.time
                            val item = getPurchaseData(
                                receipt.sku,
                                receipt.receiptId,
                                receipt.receiptId,
                                transactionDate.toDouble()
                            )
                            logDebug("onPurchaseUpdatesResponse: putting sku=${receipt.sku}")
                            items.put(item)
                        }
                        currentResult()?.success(items.toString())
                    } catch (e: JSONException) {
                        currentResult()?.error(TAG, "E_BILLING_RESPONSE_JSON_PARSE_ERROR", e.message)
                    }
                }
                PurchaseUpdatesResponse.RequestStatus.FAILED -> currentResult()?.error(
                    TAG,
                    "FAILED",
                    null
                )
                PurchaseUpdatesResponse.RequestStatus.NOT_SUPPORTED -> {
                    logDebug("onPurchaseUpdatesResponse: failed, should retry request")
                    currentResult()?.error(TAG, "NOT_SUPPORTED", null)
                }
            }
        }
    }

    @Throws(JSONException::class)
    fun getPurchaseData(
        productId: String?, transactionId: String?, transactionReceipt: String?,
        transactionDate: Double
    ): JSONObject {
        val item = JSONObject()
        item.put("productId", productId)
        item.put("transactionId", transactionId)
        item.put("transactionReceipt", transactionReceipt)
        item.put("transactionDate", transactionDate.toString())
        item.put("dataAndroid", null)
        item.put("signatureAndroid", null)
        item.put("purchaseToken", null)
        return item
    }

    companion object {
        private const val TAG = "InappPurchasePlugin"

        private fun shouldLog(): Boolean = Log.isLoggable(TAG, Log.DEBUG)

        private fun logDebug(message: String) {
            if (shouldLog()) {
                Log.d(TAG, message)
            }
        }

        private fun logWarning(message: String) {
            if (shouldLog()) {
                Log.w(TAG, message)
            }
        }

        private fun logError(message: String) {
            if (shouldLog()) {
                Log.e(TAG, message)
            }
        }
    }
}
