@file:Suppress("ktlint:standard:package-name")

package io.github.hyochan.flutter_inapp_purchase

import android.os.Looper
import dev.hyo.openiap.MutationVerifyPurchaseHandler
import dev.hyo.openiap.MutationVerifyPurchaseWithProviderHandler
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapProtocol
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import org.junit.Assert.assertEquals
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
class ProviderErrorPropagationTest {
    @Test
    fun `verification exposes native unsupported and connection errors with diagnostics`() {
        for (error in listOf(OpenIapError.FeatureNotSupported("Use the vendor backend"), OpenIapError.NotPrepared)) {
            val verify: MutationVerifyPurchaseHandler = { throw error }
            val managed: MutationVerifyPurchaseWithProviderHandler = { throw error }
            val provider =
                Proxy.newProxyInstance(OpenIapProtocol::class.java.classLoader, arrayOf(OpenIapProtocol::class.java)) { _, method, _ ->
                    when (method.name) {
                        "getVerifyPurchase" -> verify
                        "getVerifyPurchaseWithProvider" -> managed
                        else -> null
                    }
                } as OpenIapProtocol
            val messenger =
                Proxy.newProxyInstance(
                    BinaryMessenger::class.java.classLoader,
                    arrayOf(BinaryMessenger::class.java),
                ) { _, _, _ -> null } as BinaryMessenger
            val plugin = AndroidInappPurchasePlugin()
            plugin.setContext(RuntimeEnvironment.getApplication())
            plugin.setChannel(MethodChannel(messenger, "test"))
            for ((name, value) in mapOf("openIap" to provider, "connectionReady" to true, "listenersAttached" to true)) {
                plugin.javaClass
                    .getDeclaredField(name)
                    .apply { isAccessible = true }
                    .set(plugin, value)
            }
            for (method in listOf("verifyPurchase", "verifyPurchaseWithProvider")) {
                val params =
                    if (method ==
                        "verifyPurchase"
                    ) {
                        mapOf(
                            "google" to
                                mapOf("sku" to "sku", "accessToken" to "fixture", "packageName" to "test.app", "purchaseToken" to "opaque"),
                        )
                    } else {
                        mapOf("provider" to "iapkit")
                    }
                var responses = 0
                plugin.onMethodCall(
                    MethodCall(method, params),
                    object : MethodChannel.Result {
                        override fun success(result: Any?) {
                            fail("Unsupported verification must reject")
                        }

                        override fun notImplemented() {
                            fail("Verification API must exist")
                        }

                        override fun error(
                            code: String,
                            message: String?,
                            details: Any?,
                        ) {
                            assertEquals(error.code, code)
                            assertEquals(error.message, message)
                            assertEquals(error.code, (details as Map<*, *>)["code"])
                            responses++
                        }
                    },
                )
                shadowOf(Looper.getMainLooper()).idle()
                assertEquals(1, responses)
            }
            plugin.dispose()
        }
    }
}
