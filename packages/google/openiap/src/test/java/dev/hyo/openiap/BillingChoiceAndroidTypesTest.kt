package dev.hyo.openiap

import dev.hyo.openiap.helpers.resolveBillingProgramsForConnection
import dev.hyo.openiap.helpers.resolveLegacySubscriptionReplacementMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BillingChoiceAndroidTypesTest {
    @Test
    fun `Billing Choice image layout serializes correctly`() {
        assertEquals(
            BillingChoiceImageLayoutAndroid.RectangularFourByOne,
            BillingChoiceImageLayoutAndroid.fromJson("rectangular-four-by-one")
        )
        assertEquals(
            "rectangular-two-by-two",
            BillingChoiceImageLayoutAndroid.RectangularTwoByTwo.toJson()
        )
    }

    @Test
    fun `Billing Choice screen type serializes correctly`() {
        assertEquals(
            BillingChoiceScreenTypeAndroid.DeveloperRendered,
            BillingChoiceScreenTypeAndroid.fromJson("developer-rendered")
        )
        assertEquals(
            "google-rendered",
            BillingChoiceScreenTypeAndroid.GoogleRendered.toJson()
        )
    }

    @Test
    fun `Billing Choice connection config defaults and serializes renderer`() {
        assertEquals(
            BillingChoiceScreenTypeAndroid.GoogleRendered,
            InitConnectionConfig().billingChoiceScreenTypeAndroid
        )
        assertEquals(
            BillingChoiceScreenTypeAndroid.DeveloperRendered,
            InitConnectionConfig.fromJson(
                mapOf("billingChoiceScreenTypeAndroid" to "developer-rendered")
            ).billingChoiceScreenTypeAndroid
        )
    }

    @Test
    fun `Billing Choice external link preserves reporting token`() {
        val params = LaunchExternalLinkParamsAndroid.fromJson(
            mapOf(
                "billingProgram" to "billing-choice",
                "externalTransactionToken" to "external-token",
                "launchMode" to "launch-in-external-browser-or-app",
                "linkType" to "link-to-digital-content-offer",
                "linkUri" to "https://example.com/checkout"
            )
        )!!

        assertEquals(BillingProgramAndroid.BillingChoice, params.billingProgram)
        assertEquals("external-token", params.externalTransactionToken)
    }

    @Test
    fun `Developer billing type serializes correctly`() {
        assertEquals(
            DeveloperBillingTypeAndroid.InApp,
            DeveloperBillingTypeAndroid.fromJson("in-app")
        )
        assertEquals(
            "external-link",
            DeveloperBillingTypeAndroid.ExternalLink.toJson()
        )
    }

    @Test
    fun `in-app message enums serialize correctly`() {
        assertEquals(
            InAppMessageCategoryAndroid.Transactional,
            InAppMessageCategoryAndroid.fromJson("transactional")
        )
        assertEquals(
            InAppMessageResponseCodeAndroid.SubscriptionStatusUpdated,
            InAppMessageResponseCodeAndroid.fromJson("subscription-status-updated")
        )
    }

    @Test
    fun `developer billing option supports in-app and external-link Billing Choice`() {
        val inApp = DeveloperBillingOptionParamsAndroid.fromJson(
            mapOf("billingProgram" to "billing-choice")
        )!!
        assertEquals(BillingProgramAndroid.BillingChoice, inApp.billingProgram)
        assertNull(inApp.linkUri)
        assertNull(inApp.launchMode)
        assertNull(inApp.externalTransactionToken)

        val externalLink = DeveloperBillingOptionParamsAndroid.fromJson(
            mapOf(
                "billingProgram" to "billing-choice",
                "externalTransactionToken" to "external-token",
                "launchMode" to "caller-will-launch-link",
                "linkUri" to "https://example.com/checkout"
            )
        )!!
        assertEquals("external-token", externalLink.externalTransactionToken)
        assertEquals(
            DeveloperBillingLaunchModeAndroid.CallerWillLaunchLink,
            externalLink.launchMode
        )
    }

    @Test
    fun `developer provided billing details preserve nullable fields and products`() {
        val details = DeveloperProvidedBillingDetailsAndroid.fromJson(
            mapOf(
                "externalTransactionToken" to null,
                "linkUri" to "https://example.com/checkout",
                "originalExternalTransactionId" to "original-external-id",
                "products" to listOf(
                    mapOf(
                        "id" to "premium_monthly",
                        "type" to "subs",
                        "offerToken" to "offer-token"
                    )
                )
            )
        )

        assertNull(details.externalTransactionToken)
        assertEquals("https://example.com/checkout", details.linkUri)
        assertEquals("original-external-id", details.originalExternalTransactionId)
        assertEquals(ProductType.Subs, details.products.single().type)
        assertEquals("offer-token", details.products.single().offerToken)
    }

    @Test
    fun `developer billed replacement does not inject a Play replacement mode`() {
        assertNull(
            resolveLegacySubscriptionReplacementMode(
                purchaseToken = null,
                originalExternalTransactionId = "original-external-id",
                replacementMode = null
            )
        )
        assertEquals(
            5,
            resolveLegacySubscriptionReplacementMode(
                purchaseToken = "play-purchase-token",
                originalExternalTransactionId = null,
                replacementMode = null
            )
        )
        assertEquals(
            3,
            resolveLegacySubscriptionReplacementMode(
                purchaseToken = null,
                originalExternalTransactionId = "original-external-id",
                replacementMode = 3
            )
        )
        assertNull(
            resolveLegacySubscriptionReplacementMode(
                purchaseToken = "play-purchase-token",
                originalExternalTransactionId = null,
                replacementMode = 3,
                hasProductLevelReplacementParams = true
            )
        )
    }

    @Test
    fun `pre-init billing programs survive connection config reset`() {
        assertEquals(
            setOf(BillingProgramAndroid.ExternalOffer),
            resolveBillingProgramsForConnection(
                pendingPrograms = setOf(BillingProgramAndroid.ExternalOffer),
                configuredProgram = null
            )
        )
        assertEquals(
            setOf(
                BillingProgramAndroid.ExternalOffer,
                BillingProgramAndroid.BillingChoice
            ),
            resolveBillingProgramsForConnection(
                pendingPrograms = setOf(BillingProgramAndroid.ExternalOffer),
                configuredProgram = BillingProgramAndroid.BillingChoice
            )
        )
    }
}
