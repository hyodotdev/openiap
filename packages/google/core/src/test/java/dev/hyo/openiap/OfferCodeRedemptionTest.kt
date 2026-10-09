package dev.hyo.openiap

import android.app.Activity
import dev.hyo.openiap.utils.redeemOfferCode
import java.lang.reflect.Proxy
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class OfferCodeRedemptionTest {
    private val purchase = PurchaseAndroid(
        id = "redeemed", isAutoRenewing = false, productId = "premium",
        purchaseState = PurchaseState.Purchased, quantity = 1,
        store = IapStore.Unknown, storeId = "community_fixture", transactionDate = 1.0,
    )

    @Test
    fun `Activity is attached before the canonical handler and its purchase is preserved`() = runBlocking {
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val calls = mutableListOf<String>()
        val provider = provider { method, args ->
            calls.add(method)
            when (method) {
                "setActivity" -> { assertSame(activity, args?.first()); null }
                "getMutationHandlers" -> MutationHandlers(openRedeemOfferCode = { purchase })
                else -> error("Unexpected call: $method")
            }
        }
        assertSame(purchase, redeemOfferCode(provider, activity))
        assertEquals(listOf("setActivity", "getMutationHandlers"), calls)
    }

    @Test
    fun `no Activity preserves a synchronous purchase or a store no-op`() = runBlocking {
        for (result in listOf(purchase, null)) {
            val provider = provider { method, _ ->
                check(method == "getMutationHandlers")
                MutationHandlers(openRedeemOfferCode = { result })
            }
            assertSame(result, redeemOfferCode(provider, null))
        }
    }

    @Test
    fun `typed provider failures and cancellation are propagated unchanged`() {
        for (expected in listOf(OpenIapError.MissingCurrentActivity, CancellationException("cancelled"))) {
            val provider = provider { method, _ ->
                check(method == "getMutationHandlers")
                MutationHandlers(openRedeemOfferCode = { throw expected })
            }
            val actual = runCatching { runBlocking { redeemOfferCode(provider, null) } }.exceptionOrNull()
            assertSame(expected, actual)
        }
    }

    @Test
    fun `an absent handler reports feature not supported`() {
        val provider = provider { method, _ ->
            check(method == "getMutationHandlers")
            MutationHandlers()
        }
        assertThrows(OpenIapError.FeatureNotSupported::class.java) {
            runBlocking { redeemOfferCode(provider, null) }
        }
    }

    private fun provider(invoke: (String, Array<out Any?>?) -> Any?): OpenIapProtocol =
        Proxy.newProxyInstance(OpenIapProtocol::class.java.classLoader, arrayOf(OpenIapProtocol::class.java)) { _, method, args ->
            invoke(method.name, args)
        } as OpenIapProtocol
}
