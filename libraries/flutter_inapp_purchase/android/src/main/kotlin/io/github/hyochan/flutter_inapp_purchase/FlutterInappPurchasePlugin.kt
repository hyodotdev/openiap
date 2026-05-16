package io.github.hyochan.flutter_inapp_purchase

import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import android.content.Context
import android.os.Build
import android.util.Log
import io.flutter.plugin.common.MethodChannel
import io.flutter.embedding.engine.plugins.FlutterPlugin.FlutterPluginBinding
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import android.content.pm.PackageManager.NameNotFoundException

/** FlutterInappPurchasePlugin  */
class FlutterInappPurchasePlugin : FlutterPlugin, ActivityAware {
    private var androidInappPurchasePlugin: AndroidInappPurchasePlugin? = null
    private var amazonInappPurchasePlugin: AmazonInappPurchasePlugin? = null
    private var channel: MethodChannel? = null
    override fun onAttachedToEngine(binding: FlutterPluginBinding) {
        onAttached(binding.applicationContext, binding.binaryMessenger)
    }

    private fun onAttached(context: Context, messenger: BinaryMessenger) {
        isAndroid = isPackageInstalled(context, "com.android.vending")
        isAmazon = isPackageInstalled(context, "com.amazon.venezia")

        // In the case of an amazon device which has been side loaded with the Google Play store,
        // we should use the store the app was installed from.
        if (isAmazon && isAndroid) {
            if (isAppInstalledFrom(context, "amazon")) {
                isAndroid = false
            } else {
                isAmazon = false
            }
        }

        // If neither Play Store nor Amazon is detected, default to Android (for Horizon and other stores)
        // This allows openiap to handle different billing implementations via flavors
        if (!isAndroid && !isAmazon) {
            logInfo("No Play Store or Amazon detected - defaulting to Android plugin (supports Horizon and other stores)")
            isAndroid = true
        }

        val methodChannel = MethodChannel(messenger, "flutter_inapp")
        channel = methodChannel
        if (isAndroid) {
            logInfo("Initializing Android IAP plugin")
            val plugin = AndroidInappPurchasePlugin()
            plugin.setContext(context)
            plugin.setChannel(methodChannel)
            androidInappPurchasePlugin = plugin
            methodChannel.setMethodCallHandler(plugin)
        } else if (isAmazon) {
            logInfo("Initializing Amazon IAP plugin")
            val plugin = AmazonInappPurchasePlugin()
            plugin.setContext(context)
            plugin.setChannel(methodChannel)
            amazonInappPurchasePlugin = plugin
            methodChannel.setMethodCallHandler(plugin)
        }
    }

    override fun onDetachedFromEngine(binding: FlutterPluginBinding) {
        channel?.setMethodCallHandler(null)
        androidInappPurchasePlugin?.dispose()
        amazonInappPurchasePlugin?.dispose()
        androidInappPurchasePlugin = null
        amazonInappPurchasePlugin = null
        channel = null
    }

    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        if (isAndroid) {
            androidInappPurchasePlugin?.setActivity(binding.activity)
        } else if (isAmazon) {
            amazonInappPurchasePlugin?.setActivity(binding.activity)
        }
    }

    override fun onDetachedFromActivity() {
        if (isAndroid) {
            androidInappPurchasePlugin?.setActivity(null)
            androidInappPurchasePlugin?.onDetachedFromActivity()
        } else if (isAmazon) {
            amazonInappPurchasePlugin?.setActivity(null)
        }
    }

    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
        onAttachedToActivity(binding)
    }

    override fun onDetachedFromActivityForConfigChanges() {
        if (isAndroid) {
            androidInappPurchasePlugin?.setActivity(null)
        } else if (isAmazon) {
            amazonInappPurchasePlugin?.setActivity(null)
        }
    }

    companion object {
        private const val TAG = "FlutterInappPurchase"
        private var isAndroid = false
        private var isAmazon = false

        private fun logInfo(message: String) {
            if (Log.isLoggable(TAG, Log.INFO)) {
                Log.i(TAG, message)
            }
        }

        fun getStore(): String {
            return when {
                isAndroid -> "play_store"
                isAmazon -> "amazon"
                else -> "none"
            }
        }

        private fun isPackageInstalled(ctx: Context, packageName: String): Boolean {
            return try {
                ctx.packageManager.getPackageInfo(packageName, 0)
                true
            } catch (e: NameNotFoundException) {
                false
            }
        }

        fun isAppInstalledFrom(ctx: Context, installer: String?): Boolean {
            val installerPackageName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                ctx.packageManager.getInstallSourceInfo(ctx.packageName).installingPackageName
            } else {
                @Suppress("DEPRECATION")
                ctx.packageManager.getInstallerPackageName(ctx.packageName)
            }
            return installer != null && installerPackageName != null && installerPackageName.contains(
                installer
            )
        }
    }
}
