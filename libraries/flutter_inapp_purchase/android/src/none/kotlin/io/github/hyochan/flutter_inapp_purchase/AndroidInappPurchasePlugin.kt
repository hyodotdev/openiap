package io.github.hyochan.flutter_inapp_purchase

import android.app.Activity
import android.content.Context
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.MethodChannel.MethodCallHandler

class AndroidInappPurchasePlugin internal constructor() : MethodCallHandler {
    fun setContext(context: Context?) = Unit

    fun setActivity(activity: Activity?) = Unit

    fun setChannel(channel: MethodChannel?) = Unit

    fun onDetachedFromActivity() = Unit

    fun dispose() = Unit

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "getStore" -> result.success("none")
            "initConnection", "endConnection", "isReady" -> result.success(false)
            "setPurchaseUpdatedListenerOptions" -> result.success(null)
            else -> result.error(
                ERROR_CODE,
                ERROR_MESSAGE,
                mapOf("code" to ERROR_VALUE, "message" to ERROR_MESSAGE),
            )
        }
    }

    companion object {
        internal const val ERROR_CODE = "E_IAP_NOT_AVAILABLE"
        internal const val ERROR_VALUE = "iap-not-available"
        internal const val ERROR_MESSAGE = "In-app purchases are disabled for this Android build."
    }
}
