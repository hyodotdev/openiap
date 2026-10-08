package io.github.hyochan.kmpiap

import android.app.Activity
import dev.hyo.openiap.OpenIapError
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.MutationEndConnectionHandler
import dev.hyo.openiap.MutationVerifyPurchaseHandler
import dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener
import dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener
import io.github.hyochan.kmpiap.openiap.*
import java.lang.reflect.Proxy
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlin.coroutines.Continuation
import kotlin.coroutines.intrinsics.COROUTINE_SUSPENDED
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class CommunityOptionalOperationsTest {
    @Test
    fun publicOperationsMapInputsAndResultsWithoutOptionalTables() = runBlocking {
        val calls = mutableListOf<String>()
        val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
        val verification: MutationVerifyPurchaseHandler = { input ->
            assertEquals("opaque-token", input.google?.purchaseToken)
            dev.hyo.openiap.VerifyPurchaseResultAndroid.fromJson(mapOf(
                "isValid" to true, "receiptId" to "community-receipt", "productId" to "product", "quantity" to 2,
            ))
        }
        val provider = provider { method, args ->
            calls.add(method)
            when (method) {
                "getVerifyPurchase" -> verification
                "isBillingProgramAvailable" -> {
                    assertEquals(dev.hyo.openiap.BillingProgramAndroid.BillingChoice, args?.get(0))
                    dev.hyo.openiap.BillingProgramAvailabilityResultAndroid(billingProgram = dev.hyo.openiap.BillingProgramAndroid.BillingChoice, isAvailable = true)
                }
                "getBillingChoiceInfo" -> {
                    assertEquals("en-US", (args?.get(0) as dev.hyo.openiap.GetBillingChoiceInfoParamsAndroid).userLocale)
                    dev.hyo.openiap.BillingChoiceInfoAndroid("https://example.test/image", "loyalty")
                }
                "createBillingProgramReportingDetails" -> {
                    assertEquals(dev.hyo.openiap.BillingProgramAndroid.BillingChoice, args?.get(0))
                    assertEquals(dev.hyo.openiap.DeveloperBillingTypeAndroid.InApp, args?.get(1))
                    dev.hyo.openiap.BillingProgramReportingDetailsAndroid(dev.hyo.openiap.BillingProgramAndroid.BillingChoice, "external-token")
                }
                "showBillingProgramInformationDialog" -> {
                    assertEquals(activity, args?.get(0))
                    assertEquals("external-token", (args?.get(1) as dev.hyo.openiap.BillingProgramInformationDialogParamsAndroid).externalTransactionToken)
                    dev.hyo.openiap.BillingResultAndroid(debugMessage = "opened", responseCode = 0)
                }
                "showInAppMessages" -> {
                    assertEquals(activity, args?.get(0))
                    assertEquals(null, args?.get(1))
                    dev.hyo.openiap.InAppMessageResultAndroid("opaque-token", dev.hyo.openiap.InAppMessageResponseCodeAndroid.SubscriptionStatusUpdated)
                }
                "launchExternalLink" -> {
                    assertEquals(activity, args?.get(0))
                    assertEquals("https://example.test/pay", (args?.get(1) as dev.hyo.openiap.LaunchExternalLinkParamsAndroid).linkUri)
                    true
                }
                "openRedeemOfferCode" -> { assertEquals(activity, args?.get(0)); true }
                else -> error("Unexpected call: $method")
            }
        }
        val delegate = delegate(provider, activity)
        val verified = delegate.verifyPurchase(VerifyPurchaseProps.fromJson(mapOf("google" to mapOf(
            "purchaseToken" to "opaque-token", "accessToken" to "test-access", "packageName" to "test.package", "sku" to "product",
        )))) as VerifyPurchaseResultAndroid
        assertTrue(verified.isValid)
        assertEquals("community-receipt", verified.receiptId)
        assertEquals(2, verified.quantity)
        assertTrue(delegate.isBillingProgramAvailableAndroid(BillingProgramAndroid.BillingChoice).isAvailable)
        assertEquals("loyalty", delegate.getBillingChoiceInfoAndroid(GetBillingChoiceInfoParamsAndroid(userLocale = "en-US")).playBillingLoyaltyInfo)
        assertEquals("external-token", delegate.createBillingProgramReportingDetailsAndroid(BillingProgramAndroid.BillingChoice, DeveloperBillingTypeAndroid.InApp).externalTransactionToken)
        assertEquals("opened", delegate.showBillingProgramInformationDialogAndroid(BillingProgramInformationDialogParamsAndroid(externalTransactionToken = "external-token")).debugMessage)
        assertEquals("opaque-token", delegate.showInAppMessagesAndroid(null).purchaseToken)
        assertTrue(delegate.launchExternalLinkAndroid(linkParams()))
        assertTrue(delegate.openRedeemOfferCodeAndroid())
        assertEquals(8, calls.size)
    }

    @Test
    fun providerFailuresAndMissingActivityRemainTyped() = runBlocking {
        val failing = delegate(provider { _, args ->
            @Suppress("UNCHECKED_CAST")
            val continuation = args!!.last() as Continuation<Any?>
            continuation.resumeWith(Result.failure(OpenIapError.FeatureNotSupported("Provider declines this operation")))
            COROUTINE_SUSPENDED
        })
        val error = assertFailsWith<PurchaseException> { failing.isBillingProgramAvailableAndroid(BillingProgramAndroid.BillingChoice) }
        assertEquals(ErrorCode.FeatureNotSupported, error.error.code)
        assertEquals("Provider declines this operation", error.error.message)
        val ui = delegate(provider { method, _ -> error("Must not invoke $method without an Activity") })
        for (operation in listOf<suspend () -> Any?>(
            { ui.showInAppMessagesAndroid(null) },
            { ui.showBillingProgramInformationDialogAndroid(BillingProgramInformationDialogParamsAndroid(externalTransactionToken = "token")) },
            { ui.launchExternalLinkAndroid(linkParams()) },
            { ui.openRedeemOfferCodeAndroid() },
        )) assertEquals(ErrorCode.ActivityUnavailable, assertFailsWith<PurchaseException> { operation() }.error.code)
    }

    @Test
    fun billingSelectionEventsReachCollectorsAndDetachAtEndConnection() = runBlocking {
        val listeners = mutableMapOf<String, Any>()
        val end: MutationEndConnectionHandler = { true }
        val provider = provider { method, args ->
            when {
                method.startsWith("add") -> { listeners[method.removePrefix("add")] = args!![0]!!; null }
                method.startsWith("remove") -> { assertEquals(listeners.remove(method.removePrefix("remove")), args!![0]); null }
                method == "getEndConnection" -> end
                else -> error("Unexpected call: $method")
            }
        }
        val delegate = delegate(provider)
        delegate.javaClass.getDeclaredMethod("registerListeners", OpenIapProtocol::class.java).apply { isAccessible = true }.invoke(delegate, provider)
        val user = async(start = CoroutineStart.UNDISPATCHED) { delegate.userChoiceBillingAndroid() }
        val developer = async(start = CoroutineStart.UNDISPATCHED) { delegate.developerProvidedBillingAndroid() }
        (listeners.getValue("UserChoiceBillingListener") as OpenIapUserChoiceBillingListener).onUserChoiceBilling(
            dev.hyo.openiap.UserChoiceBillingDetails.fromJson(mapOf("externalTransactionToken" to "user-token", "products" to listOf("product"), "originalExternalTransactionId" to "original"))
        )
        (listeners.getValue("DeveloperProvidedBillingListener") as OpenIapDeveloperProvidedBillingListener).onDeveloperProvidedBilling(
            dev.hyo.openiap.DeveloperProvidedBillingDetailsAndroid.fromJson(mapOf("externalTransactionToken" to "developer-token", "products" to emptyList<Any>(), "linkUri" to "https://example.test/pay"))
        )
        val userResult = withTimeout(5_000) { user.await() }
        assertEquals("user-token", userResult.externalTransactionToken)
        assertEquals(listOf("product"), userResult.products)
        assertEquals("original", userResult.originalExternalTransactionId)
        assertEquals("https://example.test/pay", withTimeout(5_000) { developer.await() }.linkUri)
        assertTrue(delegate.endConnection())
        assertTrue(listeners.isEmpty())
    }

    @Test
    fun officialNonPlayStoresRetainUnsupportedOperations() = runBlocking {
        for (store in listOf(Store.AMAZON, Store.HORIZON)) {
            val delegate = OpenIapDelegateInAppPurchaseAndroid(store.name, store, "Android")
            assertFalse(delegate.isBillingProgramAvailableAndroid(BillingProgramAndroid.BillingChoice).isAvailable)
            assertFalse(delegate.launchExternalLinkAndroid(linkParams()))
            for (operation in listOf<suspend () -> Any?>(
                { delegate.verifyPurchase(VerifyPurchaseProps()) },
                { delegate.getBillingChoiceInfoAndroid(GetBillingChoiceInfoParamsAndroid()) },
                { delegate.createBillingProgramReportingDetailsAndroid(BillingProgramAndroid.BillingChoice, null) },
                { delegate.showBillingProgramInformationDialogAndroid(BillingProgramInformationDialogParamsAndroid(externalTransactionToken = "token")) },
            )) assertEquals(ErrorCode.FeatureNotSupported, assertFailsWith<PurchaseException> { operation() }.error.code)
        }
    }

    private fun delegate(provider: OpenIapProtocol, activity: Activity? = null): OpenIapDelegateInAppPurchaseAndroid =
        OpenIapDelegateInAppPurchaseAndroid("community", Store.UNKNOWN, "Android Community").also { delegate ->
            delegate.javaClass.getDeclaredField("module").apply { isAccessible = true }.set(delegate, provider)
            delegate.javaClass.getDeclaredField("currentActivity").apply { isAccessible = true }.set(delegate, activity)
        }

    private fun provider(invoke: (String, Array<out Any?>?) -> Any?): OpenIapProtocol =
        Proxy.newProxyInstance(OpenIapProtocol::class.java.classLoader, arrayOf(OpenIapProtocol::class.java)) { _, method, args -> invoke(method.name, args) } as OpenIapProtocol

    private fun linkParams() = LaunchExternalLinkParamsAndroid.fromJson(mapOf(
        "billingProgram" to "billing-choice", "launchMode" to "launch-in-external-browser-or-app", "linkType" to "link-to-digital-content-offer", "linkUri" to "https://example.test/pay",
    ))!!
}
