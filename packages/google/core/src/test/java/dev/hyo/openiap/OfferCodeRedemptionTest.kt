package dev.hyo.openiap

import android.app.Activity
import dev.hyo.openiap.utils.redeemOfferCode
import java.lang.reflect.Proxy
import kotlinx.coroutines.runBlocking
import kotlin.coroutines.Continuation
import kotlin.coroutines.intrinsics.COROUTINE_SUSPENDED
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class OfferCodeRedemptionTest {
    @Test
    fun `Activity calls the public override without optional handlers`() = runBlocking {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        for (result in listOf(true, false)) {
            val calls = mutableListOf<String>()
            val provider = provider { method, args ->
                calls.add(method)
                assertSame(activity, args?.first())
                when (method) {
                    "setActivity" -> null
                    "openRedeemOfferCode" -> result
                    else -> error("Unexpected call: $method")
                }
            }
            assertEquals(result, redeemOfferCode(provider, activity))
            assertEquals(listOf("setActivity", "openRedeemOfferCode"), calls)
        }
        val expected = OpenIapError.FeatureNotSupported()
        val failing = provider { method, args ->
            if (method == "setActivity") null else {
                @Suppress("UNCHECKED_CAST")
                val continuation = args!!.last() as Continuation<Boolean>
                continuation.resumeWith(Result.failure(expected))
                COROUTINE_SUSPENDED
            }
        }
        assertSame(expected, assertThrows(OpenIapError.FeatureNotSupported::class.java) {
            runBlocking { redeemOfferCode(failing, activity) }
        })
    }

    @Test
    fun `no Activity preserves legacy success false and typed failure`() = runBlocking {
        for (result in listOf(true, false)) {
            val handler: MutationOpenRedeemOfferCodeAndroidHandler = { result }
            val provider = provider { method, _ ->
                check(method == "getMutationHandlers")
                MutationHandlers(openRedeemOfferCodeAndroid = handler)
            }
            assertEquals(result, redeemOfferCode(provider, null))
        }
        for (handler in listOf<MutationOpenRedeemOfferCodeAndroidHandler?>(null, { throw OpenIapError.MissingCurrentActivity })) {
            val provider = provider { method, _ ->
                check(method == "getMutationHandlers")
                MutationHandlers(openRedeemOfferCodeAndroid = handler)
            }
            assertSame(OpenIapError.MissingCurrentActivity, assertThrows(OpenIapError.MissingCurrentActivity::class.java) {
                runBlocking { redeemOfferCode(provider, null) }
            })
        }
    }

    private fun provider(invoke: (String, Array<out Any?>?) -> Any?): OpenIapProtocol =
        Proxy.newProxyInstance(OpenIapProtocol::class.java.classLoader, arrayOf(OpenIapProtocol::class.java)) { _, method, args ->
            invoke(method.name, args)
        } as OpenIapProtocol
}
