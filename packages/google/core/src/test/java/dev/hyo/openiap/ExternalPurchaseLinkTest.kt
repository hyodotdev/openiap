package dev.hyo.openiap

import android.app.Activity
import java.lang.reflect.Proxy
import kotlin.coroutines.Continuation
import kotlin.coroutines.intrinsics.COROUTINE_SUSPENDED
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ExternalPurchaseLinkTest {
    private val request = ExternalPurchaseLinkRequest(url = "https://example.com/checkout")
    private val activity: Activity get() = Robolectric.buildActivity(Activity::class.java).setup().get()

    @Test
    fun `unavailable program shows no disclosure`() = runBlocking {
        val calls = mutableListOf<String>()
        val provider = provider(available = false, calls = calls)

        assertFalse(provider.externalPurchaseLinkAvailable())
        val result = provider.openExternalPurchaseLinkFlow(activity, request)

        assertEquals(ExternalPurchaseLinkStatus.Unavailable, result.status)
        assertNull(result.reportToken)
        assertEquals(listOf("isBillingProgramAvailable", "isBillingProgramAvailable"), calls)
    }

    @Test
    fun `unsupported provider is unavailable`() = runBlocking {
        val provider = provider { method, _ ->
            check(method == "isBillingProgramAvailable")
            throw OpenIapError.FeatureNotSupported("unsupported")
        }

        assertEquals(ExternalPurchaseLinkStatus.Unavailable, provider.openExternalPurchaseLinkFlow(activity, request).status)
    }

    @Test
    fun `cancelled disclosure returns no token`() = runBlocking {
        val provider = provider(available = true, launch = { throw OpenIapError.UserCancelled() })

        val result = provider.openExternalPurchaseLinkFlow(activity, request)

        assertEquals(ExternalPurchaseLinkStatus.Cancelled, result.status)
        assertNull(result.reportToken)
    }

    @Test
    fun `opened link returns the external offer token`() = runBlocking {
        var launched: LaunchExternalLinkParamsAndroid? = null
        val provider = provider(available = true, launch = { launched = it; true })

        val result = provider.openExternalPurchaseLinkFlow(
            activity,
            request.copy(google = ExternalPurchaseLinkAndroidProps(linkType = ExternalLinkTypeAndroid.LinkToAppDownload)),
        )

        assertEquals(ExternalPurchaseLinkStatus.Opened, result.status)
        assertEquals(IapPlatform.Android, result.platform)
        assertEquals("play-token", result.reportToken)
        assertEquals(BillingProgramAndroid.ExternalOffer, launched?.billingProgram)
        assertEquals(ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp, launched?.launchMode)
        assertEquals(ExternalLinkTypeAndroid.LinkToAppDownload, launched?.linkType)
        assertEquals("https://example.com/checkout", launched?.linkUri)
    }

    @Test
    fun `launch failure propagates`() {
        val provider = provider(available = true, launch = { throw OpenIapError.ServiceUnavailable() })

        assertThrows(OpenIapError.ServiceUnavailable::class.java) {
            runBlocking { provider.openExternalPurchaseLinkFlow(activity, request) }
        }
    }

    private fun provider(
        available: Boolean,
        calls: MutableList<String> = mutableListOf(),
        launch: (LaunchExternalLinkParamsAndroid) -> Boolean = { error("Unexpected launch") },
    ): OpenIapProtocol = provider { method, args ->
        calls.add(method)
        when (method) {
            "isBillingProgramAvailable" -> BillingProgramAvailabilityResultAndroid(
                billingProgram = args?.first() as BillingProgramAndroid,
                isAvailable = available,
            )
            "createBillingProgramReportingDetails" -> BillingProgramReportingDetailsAndroid(
                billingProgram = args?.first() as BillingProgramAndroid,
                externalTransactionToken = "play-token",
            )
            "launchExternalLink" -> launch(args?.get(1) as LaunchExternalLinkParamsAndroid)
            else -> error("Unexpected call: $method")
        }
    }

    private fun provider(invoke: (String, Array<out Any?>?) -> Any?): OpenIapProtocol =
        Proxy.newProxyInstance(OpenIapProtocol::class.java.classLoader, arrayOf(OpenIapProtocol::class.java)) { _, method, args ->
            try {
                invoke(method.name, args)
            } catch (error: OpenIapError) {
                // A proxy cannot throw a checked exception; resume the suspend call with it instead.
                @Suppress("UNCHECKED_CAST")
                (args!!.last() as Continuation<Any?>).resumeWithException(error)
                COROUTINE_SUSPENDED
            }
        } as OpenIapProtocol
}
