package expo.modules.iap

import android.os.Looper
import dev.hyo.openiap.MutationAcknowledgePurchaseAndroidHandler
import dev.hyo.openiap.MutationConsumePurchaseAndroidHandler
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapProtocol
import expo.modules.kotlin.Promise
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.lang.reflect.Proxy

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AcknowledgeConsumeBridgeTest {
    private fun moduleWithStore(storeAccepts: Boolean): ExpoIapModule {
        val acknowledge: MutationAcknowledgePurchaseAndroidHandler = { storeAccepts }
        val consume: MutationConsumePurchaseAndroidHandler = { storeAccepts }
        val provider =
            Proxy.newProxyInstance(OpenIapProtocol::class.java.classLoader, arrayOf(OpenIapProtocol::class.java)) { _, method, _ ->
                when (method.name) {
                    "getAcknowledgePurchaseAndroid" -> acknowledge
                    "getConsumePurchaseAndroid" -> consume
                    else -> null
                }
            } as OpenIapProtocol
        val module = ExpoIapModule()
        module.javaClass
            .getDeclaredField("openIapLazy")
            .apply { isAccessible = true }
            .set(module, lazy { provider })
        return module
    }

    private fun invoke(
        module: ExpoIapModule,
        method: String,
        promise: Promise,
    ) {
        val function = module.definition().asyncFunctions.getValue(method)

        @Suppress("UNCHECKED_CAST")
        val body =
            function.javaClass
                .getDeclaredField("body")
                .apply { isAccessible = true }
                .get(function) as (Array<out Any?>, Promise) -> Unit
        body(arrayOf("token"), promise)
        shadowOf(Looper.getMainLooper()).idle()
    }

    @Test
    fun `a refused acknowledge or consume rejects instead of resolving success`() {
        for ((method, operation) in listOf("acknowledgePurchaseAndroid" to "acknowledge", "consumePurchaseAndroid" to "consume")) {
            var rejections = 0
            val promise =
                object : Promise {
                    override fun resolve(value: Any?) {
                        fail("$method must not resolve when the store refuses the token")
                    }

                    override fun reject(
                        code: String?,
                        message: String?,
                        cause: Throwable?,
                    ) {
                        assertEquals(OpenIapError.BillingError.CODE, code)
                        val envelope = message.orEmpty()
                        assertTrue(envelope.startsWith(ExpoIapHelper.ERROR_ENVELOPE_PREFIX))
                        val payload = JSONObject(envelope.removePrefix(ExpoIapHelper.ERROR_ENVELOPE_PREFIX))
                        assertEquals(OpenIapError.BillingError.CODE, payload.getString("code"))
                        assertTrue(payload.getString("debugMessage").contains(operation))
                        rejections++
                    }
                }
            invoke(moduleWithStore(storeAccepts = false), method, promise)
            assertEquals(1, rejections)
        }
    }

    @Test
    fun `an accepted token resolves`() {
        var resolved = 0
        val promise =
            object : Promise {
                override fun resolve(value: Any?) {
                    assertEquals(mapOf("responseCode" to 0), value)
                    resolved++
                }

                override fun reject(
                    code: String?,
                    message: String?,
                    cause: Throwable?,
                ) {
                    fail("An accepted token must not reject: $code $message")
                }
            }
        invoke(moduleWithStore(storeAccepts = true), "acknowledgePurchaseAndroid", promise)
        assertEquals(1, resolved)
    }
}
