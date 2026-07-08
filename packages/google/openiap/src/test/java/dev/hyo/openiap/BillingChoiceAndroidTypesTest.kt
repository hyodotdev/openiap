package dev.hyo.openiap

import org.junit.Assert.assertEquals
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
}
