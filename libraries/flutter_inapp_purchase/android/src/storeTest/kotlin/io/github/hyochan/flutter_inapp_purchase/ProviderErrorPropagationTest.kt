@file:Suppress("ktlint:standard:package-name")

package io.github.hyochan.flutter_inapp_purchase

import dev.hyo.openiap.MutationVerifyPurchaseHandler
import dev.hyo.openiap.MutationVerifyPurchaseWithProviderHandler
import dev.hyo.openiap.OpenIapError
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ProviderErrorPropagationTest {
    @Before fun installFakeProvider() = FakeProviderFactory.install()

    @Test
    fun `malformed ownership options reject without calling the provider`() {
        val plugin = fakeEngine()
        for (params in listOf(mapOf("google" to "bad"), mapOf("google" to emptyMap<String, Any?>()))) {
            assertEquals("error:${OpenIapError.DeveloperError.CODE}", plugin.call("verifyAppOwnership", params))
            assertEquals(0, FakeProviderFactory.calls)
        }
        plugin.dispose()
        settle()
    }

    @Test
    fun `verification exposes native unsupported and connection errors with diagnostics`() {
        for (error in listOf(OpenIapError.FeatureNotSupported("Use the vendor backend"), OpenIapError.NotPrepared)) {
            val verify: MutationVerifyPurchaseHandler = { throw error }
            val managed: MutationVerifyPurchaseWithProviderHandler = { throw error }
            FakeProviderFactory.handlers["getVerifyPurchase"] = verify
            FakeProviderFactory.handlers["getVerifyPurchaseWithProvider"] = managed
            val plugin = fakeEngine()
            for (method in listOf("verifyPurchase", "verifyPurchaseWithProvider")) {
                val params =
                    if (method == "verifyPurchase") {
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
                settle()
                assertEquals(1, responses)
            }
            plugin.dispose()
            settle()
        }
    }
}
