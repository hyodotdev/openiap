package io.github.hyochan.flutter_inapp_purchase

import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import android.content.Context
import android.util.Log
import io.flutter.plugin.common.MethodChannel
import io.flutter.embedding.engine.plugins.FlutterPlugin.FlutterPluginBinding
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding

/** FlutterInappPurchasePlugin  */
class FlutterInappPurchasePlugin : FlutterPlugin, ActivityAware {
    private var androidInappPurchasePlugin: AndroidInappPurchasePlugin? = null
    private var channel: MethodChannel? = null
    override fun onAttachedToEngine(binding: FlutterPluginBinding) {
        onAttached(binding.applicationContext, binding.binaryMessenger)
    }

    private fun onAttached(context: Context, messenger: BinaryMessenger) {
        val methodChannel = MethodChannel(messenger, "flutter_inapp")
        channel = methodChannel
        configuredStore = BuildConfig.OPENIAP_STORE
        logInfo("Initializing Android IAP plugin for ${configuredStore} store")
        val plugin = AndroidInappPurchasePlugin()
        plugin.setContext(context)
        plugin.setChannel(methodChannel)
        androidInappPurchasePlugin = plugin
        methodChannel.setMethodCallHandler(plugin)
    }

    override fun onDetachedFromEngine(binding: FlutterPluginBinding) {
        channel?.setMethodCallHandler(null)
        androidInappPurchasePlugin?.dispose()
        androidInappPurchasePlugin = null
        channel = null
    }

    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        androidInappPurchasePlugin?.setActivity(binding.activity)
    }

    override fun onDetachedFromActivity() {
        androidInappPurchasePlugin?.setActivity(null)
        androidInappPurchasePlugin?.onDetachedFromActivity()
    }

    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
        onAttachedToActivity(binding)
    }

    override fun onDetachedFromActivityForConfigChanges() {
        androidInappPurchasePlugin?.setActivity(null)
    }

    companion object {
        private const val TAG = "FlutterInappPurchase"
        private var configuredStore = "play"

        private fun logInfo(message: String) {
            if (Log.isLoggable(TAG, Log.INFO)) {
                Log.i(TAG, message)
            }
        }

        fun getStore(): String {
            return when (configuredStore) {
                "amazon" -> "amazon"
                "horizon" -> "horizon"
                else -> "play_store"
            }
        }
    }
}
