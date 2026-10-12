package dev.hyo.openiap

import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class HorizonPurchaseSafetyTest {

    @Test
    fun `purchase polling retries failures and stops on the first match`() = runTest {
        var attempts = 0
        var failures = 0

        val result = pollHorizonPurchases(
            initialDelayMillis = 0,
            intervalMillis = 0,
            maxAttempts = 4,
            ownsRequest = { true },
            query = {
                attempts += 1
                when (attempts) {
                    1 -> throw IllegalStateException("temporary failure")
                    2 -> listOf("other")
                    else -> listOf("requested", "other")
                }
            },
            matches = { it == "requested" },
            onQueryFailure = { failures += 1 },
        )

        assertEquals(listOf("requested"), result)
        assertEquals(3, attempts)
        assertEquals(1, failures)
    }

    @Test
    fun `purchase polling distinguishes lost ownership from bounded timeout`() = runTest {
        var ownsRequest = true
        var attempts = 0
        val lostOwnership = pollHorizonPurchases(
            initialDelayMillis = 0,
            intervalMillis = 0,
            maxAttempts = 3,
            ownsRequest = { ownsRequest },
            query = {
                attempts += 1
                ownsRequest = false
                emptyList<String>()
            },
            matches = { true },
        )
        val timeout = pollHorizonPurchases(
            initialDelayMillis = 0,
            intervalMillis = 0,
            maxAttempts = 2,
            ownsRequest = { true },
            query = { emptyList<String>() },
            matches = { true },
        )

        assertNull(lostOwnership)
        assertEquals(1, attempts)
        assertTrue(timeout!!.isEmpty())
    }

    @Test
    fun `unsupported Horizon purchase options fail before launch`() {
        assertTrue(
            horizonUnsupportedPurchaseError(
                type = ProductQueryType.InApp,
                offerToken = "one-time-offer",
                originalExternalTransactionId = null,
                hasDeveloperBillingOption = false,
            ) is OpenIapError.FeatureNotSupported
        )
        assertTrue(
            horizonUnsupportedPurchaseError(
                type = ProductQueryType.Subs,
                offerToken = null,
                originalExternalTransactionId = "external-transaction",
                hasDeveloperBillingOption = false,
            ) is OpenIapError.FeatureNotSupported
        )
        assertTrue(
            horizonUnsupportedPurchaseError(
                type = ProductQueryType.Subs,
                offerToken = null,
                originalExternalTransactionId = null,
                hasDeveloperBillingOption = true,
            ) is OpenIapError.FeatureNotSupported
        )
    }

    @Test
    fun `Horizon purchase requires exactly one sku`() {
        assertTrue(horizonPurchaseSkuCountError(emptyList()) is OpenIapError.EmptySkuList)
        assertNull(horizonPurchaseSkuCountError(listOf("coins")))

        val multipleSkuError = horizonPurchaseSkuCountError(listOf("coins", "gems"))
        assertTrue(multipleSkuError is OpenIapError.DeveloperError)
        assertEquals(
            "Meta Horizon Billing purchases one SKU at a time",
            multipleSkuError?.debugMessage,
        )
    }

    @Test
    fun `Horizon initConnection requires a current Activity`() = runTest {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val module = OpenIapModule(context)

        val thrown = runCatching { module.initConnection(null) }.exceptionOrNull()

        assertTrue(thrown is OpenIapError.MissingCurrentActivity)
    }

    @Test
    fun `subscription management deep link fails fast when unsupported`() = runTest {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val module = OpenIapModule(context)
        var thrown: Throwable? = null

        try {
            module.deepLinkToSubscriptions(null)
        } catch (error: Throwable) {
            thrown = error
        }

        assertTrue(thrown is OpenIapError.FeatureNotSupported)
    }

    @Test
    fun `subscription offer validation rejects blank tokens and unrelated products`() {
        assertTrue(
            hasInvalidHorizonSubscriptionOffer(
                requestedSkus = listOf("monthly"),
                offers = listOf(AndroidSubscriptionOfferInput(offerToken = "", sku = "monthly")),
            )
        )
        assertTrue(
            hasInvalidHorizonSubscriptionOffer(
                requestedSkus = listOf("monthly"),
                offers = listOf(AndroidSubscriptionOfferInput(offerToken = "token", sku = "yearly")),
            )
        )
        assertTrue(
            hasInvalidHorizonSubscriptionOffer(
                requestedSkus = listOf("monthly"),
                offers = listOf(
                    AndroidSubscriptionOfferInput(offerToken = "intro", sku = "monthly"),
                    AndroidSubscriptionOfferInput(offerToken = "standard", sku = "monthly"),
                ),
            )
        )
        assertFalse(
            hasInvalidHorizonSubscriptionOffer(
                requestedSkus = listOf("monthly"),
                offers = listOf(AndroidSubscriptionOfferInput(offerToken = "token", sku = "monthly")),
            )
        )
    }

    @Test
    fun `purchase correlation uses all product ids and only unambiguous metadata`() {
        assertTrue(
            matchesRequestedProductIds(
                primaryProductId = "primary",
                productIds = listOf("primary", "requested"),
                requestedProductIds = listOf("requested"),
            )
        )
        assertEquals("base", uniqueHorizonBasePlanId(listOf(null, "", "base", "base")))
        assertNull(uniqueHorizonBasePlanId(listOf("monthly", "yearly")))
        assertEquals("offer", uniqueHorizonOfferToken(listOf(null, "", "offer", "offer")))
        assertNull(uniqueHorizonOfferToken(listOf("intro", "standard")))

        assertEquals(
            ProductQueryType.Subs,
            resolveHorizonProductType(
                productIds = listOf("monthly"),
                pendingRequestSkus = setOf("monthly"),
                pendingRequestType = ProductQueryType.Subs,
                cachedSubscriptionProductIds = emptySet(),
                cachedInAppProductIds = setOf("monthly"),
            )
        )
        assertNull(
            resolveHorizonProductType(
                productIds = listOf("ambiguous"),
                pendingRequestSkus = emptySet(),
                pendingRequestType = null,
                cachedSubscriptionProductIds = setOf("ambiguous"),
                cachedInAppProductIds = setOf("ambiguous"),
            )
        )
    }
}
