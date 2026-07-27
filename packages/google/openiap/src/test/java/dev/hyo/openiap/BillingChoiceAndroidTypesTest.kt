package dev.hyo.openiap

import dev.hyo.openiap.helpers.resolveBillingProgramsForConnection
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BillingChoiceAndroidTypesTest {
    @Test
    fun `user choice details preserve the published JVM ABI and legacy JSON`() {
        val type = UserChoiceBillingDetails::class.java

        assertNotNull(type.getDeclaredConstructor(String::class.java, List::class.java))
        assertEquals(List::class.java, type.getDeclaredMethod("component2").returnType)
        assertNotNull(type.getDeclaredMethod("copy", String::class.java, List::class.java))
        assertTrue(type.declaredMethods.any { it.name == "copy\$default" && it.parameterCount == 5 })

        val legacy = UserChoiceBillingDetails.fromJson(
            mapOf(
                "externalTransactionToken" to "external-token",
                "products" to listOf("premium_monthly")
            )
        )
        assertNull(legacy.originalExternalTransactionId)
        assertNull(legacy.productDetailsAndroid)

        val structured = UserChoiceBillingDetails.fromJson(
            mapOf(
                "externalTransactionToken" to "external-token",
                "originalExternalTransactionId" to "original-external-id",
                "products" to listOf("premium_monthly"),
                "productDetailsAndroid" to listOf(
                    mapOf(
                        "id" to "premium_monthly",
                        "offerToken" to "offer-token",
                        "type" to "subs"
                    )
                )
            )
        )
        assertEquals("original-external-id", structured.originalExternalTransactionId)
        assertEquals(ProductType.Subs, structured.productDetailsAndroid?.single()?.type)
    }

    @Test
    fun `purchase errors preserve the published JVM ABI and accept new diagnostics`() {
        val type = PurchaseError::class.java
        val legacyParameterTypes = arrayOf(
            ErrorCode::class.java,
            String::class.java,
            Boolean::class.javaObjectType,
            String::class.java,
            String::class.java,
            List::class.java,
            String::class.java,
            Int::class.javaObjectType
        )

        assertNotNull(type.getDeclaredConstructor(*legacyParameterTypes))
        assertEquals(Int::class.javaObjectType, type.getDeclaredMethod("component8").returnType)
        assertNotNull(type.getDeclaredMethod("copy", *legacyParameterTypes))
        assertTrue(type.declaredMethods.any { it.name == "copy\$default" && it.parameterCount == 11 })

        val details = PurchaseError.fromJson(
            mapOf(
                "code" to "purchase-error",
                "message" to "Purchase failed",
                "subResponseCodeAndroid" to "user-ineligible"
            )
        )
        assertEquals(SubResponseCodeAndroid.UserIneligible, details.subResponseCodeAndroid)
    }

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
