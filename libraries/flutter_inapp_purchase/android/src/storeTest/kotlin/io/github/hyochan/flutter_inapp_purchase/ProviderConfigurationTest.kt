@file:Suppress("ktlint:standard:package-name")

package io.github.hyochan.flutter_inapp_purchase

import android.content.Context
import android.os.Bundle
import android.os.Looper
import dev.hyo.openiap.DeepLinkOptions
import dev.hyo.openiap.ErrorCode
import dev.hyo.openiap.MutationDeepLinkToSubscriptionsHandler
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.OpenIapProvider
import dev.hyo.openiap.OpenIapProviderFactory
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.lang.reflect.Proxy

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ProviderConfigurationTest {
    @Test fun `subscription management works before billing init`() {
        val context = RuntimeEnvironment.getApplication()
        val info = context.packageManager.getApplicationInfo(context.packageName, 0)
        info.metaData = Bundle().apply { putString(OpenIapProvider.METADATA_KEY, SubscriptionManagementFactory::class.java.name) }
        shadowOf(context.packageManager).installPackage(
            android.content.pm.PackageInfo().apply {
                packageName = context.packageName
                applicationInfo = info
            },
        )
        val messenger =
            Proxy.newProxyInstance(
                BinaryMessenger::class.java.classLoader,
                arrayOf(BinaryMessenger::class.java),
            ) { _, _, _ -> null } as BinaryMessenger
        val plugin = AndroidInappPurchasePlugin()
        plugin.setContext(context)
        plugin.setChannel(MethodChannel(messenger, "test"))
        SubscriptionManagementFactory.requests.clear()
        for (method in listOf("deepLinkToSubscriptionsAndroid", "manageSubscription", "openPlayStoreSubscriptions")) {
            var responses = 0
            plugin.onMethodCall(
                MethodCall(method, mapOf("skuAndroid" to "sku", "packageNameAndroid" to "example.app")),
                object : MethodChannel.Result {
                    override fun success(result: Any?) {
                        responses++
                    }

                    override fun notImplemented() {
                        fail("Subscription management must be implemented")
                    }

                    override fun error(
                        code: String,
                        message: String?,
                        details: Any?,
                    ) {
                        fail("Unexpected $code: $message")
                    }
                },
            )
            shadowOf(Looper.getMainLooper()).idle()
            assertEquals(1, responses)
        }
        assertEquals(3, SubscriptionManagementFactory.requests.size)
        assertEquals("sku", SubscriptionManagementFactory.requests.first()?.skuAndroid)
        plugin.dispose()
    }

    @Test fun `missing provider reaches init callback after registration`() {
        val context = RuntimeEnvironment.getApplication()
        val info = context.packageManager.getApplicationInfo(context.packageName, 0)
        info.metaData = Bundle()
        shadowOf(context.packageManager).installPackage(
            android.content.pm.PackageInfo().apply {
                packageName = context.packageName
                applicationInfo = info
            },
        )
        val messenger =
            Proxy.newProxyInstance(
                BinaryMessenger::class.java.classLoader,
                arrayOf(BinaryMessenger::class.java),
            ) { _, _, _ -> null } as BinaryMessenger
        val plugin = AndroidInappPurchasePlugin()
        plugin.setContext(context)
        plugin.setChannel(MethodChannel(messenger, "test"))
        var errorCode: String? = null
        var details: Any? = null
        var responses = 0
        for (method in listOf(
            "initConnection",
            "deepLinkToSubscriptionsAndroid",
            "manageSubscription",
            "openPlayStoreSubscriptions",
            "getStorefront",
        )) {
            plugin.onMethodCall(
                MethodCall(method, null),
                object : MethodChannel.Result {
                    override fun success(result: Any?) {
                        fail("Missing provider must fail")
                    }

                    override fun notImplemented() {
                        fail("initConnection must be implemented")
                    }

                    override fun error(
                        code: String,
                        message: String?,
                        errorDetails: Any?,
                    ) {
                        assertEquals(ErrorCode.DeveloperError.rawValue, code)
                        errorCode = code
                        details = errorDetails
                        responses++
                    }
                },
            )
            shadowOf(Looper.getMainLooper()).idle()
        }
        assertEquals(ErrorCode.DeveloperError.rawValue, errorCode)
        assertEquals(5, responses)
        assertTrue(details is Map<*, *>)
        assertTrue((details as Map<*, *>)["message"].toString().contains("provider", ignoreCase = true))
        plugin.dispose()
    }
}

class SubscriptionManagementFactory : OpenIapProviderFactory {
    override val storeId = "test-subscription-management"
    override val coreVersion get() = OpenIapProvider.coreVersion
    override val clientProtocolVersion = "0.2.0"

    override fun create(context: Context): OpenIapProtocol {
        val deepLink: MutationDeepLinkToSubscriptionsHandler = { options ->
            requests.add(options)
            Unit
        }
        return Proxy.newProxyInstance(OpenIapProtocol::class.java.classLoader, arrayOf(OpenIapProtocol::class.java)) { _, method, _ ->
            if (method.name == "getDeepLinkToSubscriptions") deepLink else null
        } as OpenIapProtocol
    }

    companion object {
        val requests = mutableListOf<DeepLinkOptions?>()
    }
}
