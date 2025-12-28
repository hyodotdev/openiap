package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class BillingProgramAndroidTest {

    @Test
    fun `fromJson handles kebab-case format`() {
        assertEquals(BillingProgramAndroid.Unspecified, BillingProgramAndroid.fromJson("unspecified"))
        assertEquals(BillingProgramAndroid.UserChoiceBilling, BillingProgramAndroid.fromJson("user-choice-billing"))
        assertEquals(BillingProgramAndroid.ExternalContentLink, BillingProgramAndroid.fromJson("external-content-link"))
        assertEquals(BillingProgramAndroid.ExternalOffer, BillingProgramAndroid.fromJson("external-offer"))
        assertEquals(BillingProgramAndroid.ExternalPayments, BillingProgramAndroid.fromJson("external-payments"))
    }

    @Test
    fun `fromJson handles PascalCase format`() {
        assertEquals(BillingProgramAndroid.Unspecified, BillingProgramAndroid.fromJson("Unspecified"))
        assertEquals(BillingProgramAndroid.UserChoiceBilling, BillingProgramAndroid.fromJson("UserChoiceBilling"))
        assertEquals(BillingProgramAndroid.ExternalContentLink, BillingProgramAndroid.fromJson("ExternalContentLink"))
        assertEquals(BillingProgramAndroid.ExternalOffer, BillingProgramAndroid.fromJson("ExternalOffer"))
        assertEquals(BillingProgramAndroid.ExternalPayments, BillingProgramAndroid.fromJson("ExternalPayments"))
    }

    @Test
    fun `fromJson throws on unknown value`() {
        assertThrows(IllegalArgumentException::class.java) {
            BillingProgramAndroid.fromJson("unknown-value")
        }
    }

    @Test
    fun `toJson returns kebab-case format`() {
        assertEquals("unspecified", BillingProgramAndroid.Unspecified.toJson())
        assertEquals("user-choice-billing", BillingProgramAndroid.UserChoiceBilling.toJson())
        assertEquals("external-content-link", BillingProgramAndroid.ExternalContentLink.toJson())
        assertEquals("external-offer", BillingProgramAndroid.ExternalOffer.toJson())
        assertEquals("external-payments", BillingProgramAndroid.ExternalPayments.toJson())
    }

    @Test
    fun `rawValue matches toJson output`() {
        BillingProgramAndroid.entries.forEach { program ->
            assertEquals(program.rawValue, program.toJson())
        }
    }

    @Test
    fun `fromJson and toJson are symmetric`() {
        BillingProgramAndroid.entries.forEach { program ->
            val json = program.toJson()
            val parsed = BillingProgramAndroid.fromJson(json)
            assertEquals(program, parsed)
        }
    }
}
