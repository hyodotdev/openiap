package expo.modules.iap

import android.os.Looper
import dev.hyo.openiap.MutationInitConnectionHandler
import dev.hyo.openiap.MutationVerifyPurchaseHandler
import dev.hyo.openiap.MutationVerifyPurchaseWithProviderHandler
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapProtocol
import expo.modules.kotlin.Promise
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.lang.reflect.Proxy

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ProviderErrorPropagationTest {
    @Test
    fun `verification preserves provider errors instead of declaring the receipt invalid`() {
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
            val module = ExpoIapModule()
            module.javaClass
                .getDeclaredField("openIap\$delegate")
                .apply { isAccessible = true }
                .set(module, lazy { provider })
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
                val promise =
                    object : Promise {
                        override fun resolve(value: Any?) {
                            fail("Unsupported verification must reject")
                        }

                        override fun reject(
                            code: String?,
                            message: String?,
                            cause: Throwable?,
                        ) {
                            assertEquals(error.code, code)
                            assertEquals(error.message, message)
                            responses++
                        }
                    }
                val function = module.definition().asyncFunctions.getValue(method)

                @Suppress("UNCHECKED_CAST")
                val body =
                    function.javaClass
                        .getDeclaredField("body")
                        .apply { isAccessible = true }
                        .get(function) as (
                        Array<out Any?>,
                        Promise,
                    ) -> Unit
                body(arrayOf(params), promise)
                shadowOf(Looper.getMainLooper()).idle()
                assertEquals(1, responses)
            }
        }
    }

    @Test
    fun `initConnection preserves provider errors instead of reporting init failure`() {
        val error = OpenIapError.ProviderConfiguration("No Android store provider registered.")
        val init: MutationInitConnectionHandler = { throw error }
        val provider =
            Proxy.newProxyInstance(OpenIapProtocol::class.java.classLoader, arrayOf(OpenIapProtocol::class.java)) { _, method, _ ->
                when (method.name) {
                    "getInitConnection" -> init
                    else -> null
                }
            } as OpenIapProtocol
        val module = ExpoIapModule()
        module.javaClass
            .getDeclaredField("openIap\$delegate")
            .apply { isAccessible = true }
            .set(module, lazy { provider })
        var responses = 0
        val promise =
            object : Promise {
                override fun resolve(value: Any?) {
                    fail("A throwing provider must reject")
                }

                override fun reject(
                    code: String?,
                    message: String?,
                    cause: Throwable?,
                ) {
                    assertEquals(error.code, code)
                    assertEquals(error.message, message)
                    responses++
                }
            }
        val function = module.definition().asyncFunctions.getValue("initConnection")

        @Suppress("UNCHECKED_CAST")
        val body =
            function.javaClass
                .getDeclaredField("body")
                .apply { isAccessible = true }
                .get(function) as (
                Array<out Any?>,
                Promise,
            ) -> Unit
        body(arrayOf(null), promise)
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(1, responses)
    }
}
