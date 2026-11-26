@file:Suppress("ktlint:standard:package-name")

package io.github.hyochan.flutter_inapp_purchase

import dev.hyo.openiap.MutationVerifyPurchaseWithProviderHandler
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitHorizonProps
import dev.hyo.openiap.VerifyPurchaseWithProviderResult
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class IapkitVerificationPayloadTest {
    @Before fun installFakeProvider() = FakeProviderFactory.install()

    @Test
    fun `horizon options reach the provider with the sandbox flag as sent`() {
        val received = mutableListOf<RequestVerifyPurchaseWithIapkitHorizonProps?>()
        val verify: MutationVerifyPurchaseWithProviderHandler = { props ->
            received += props.iapkit?.horizon
            VerifyPurchaseWithProviderResult(provider = props.provider)
        }
        FakeProviderFactory.handlers["getVerifyPurchaseWithProvider"] = verify
        val plugin = fakeEngine()

        for (sandbox in listOf(true, false, null)) {
            plugin.call(
                "verifyPurchaseWithProvider",
                mapOf(
                    "provider" to "iapkit",
                    "iapkit" to
                        mapOf(
                            "horizon" to
                                mapOf("sku" to "coins", "userId" to "meta-user", "sandbox" to sandbox)
                                    .filterValues { it != null },
                        ),
                ),
            )
        }

        assertEquals(
            listOf(true, false, null).map {
                RequestVerifyPurchaseWithIapkitHorizonProps(sku = "coins", userId = "meta-user", sandbox = it)
            },
            received,
        )
        plugin.dispose()
        settle()
    }
}
