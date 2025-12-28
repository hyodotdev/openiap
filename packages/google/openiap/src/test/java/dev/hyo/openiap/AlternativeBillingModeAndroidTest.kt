package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

/**
 * Tests for AlternativeBillingModeAndroid enum.
 * Note: AlternativeBillingModeAndroid is deprecated. Use BillingProgramAndroid instead.
 * These tests ensure backward compatibility for existing code.
 */
@Suppress("DEPRECATION")
class AlternativeBillingModeAndroidTest {

    @Test
    fun `fromJson handles kebab-case format`() {
        assertEquals(AlternativeBillingModeAndroid.None, AlternativeBillingModeAndroid.fromJson("none"))
        assertEquals(AlternativeBillingModeAndroid.UserChoice, AlternativeBillingModeAndroid.fromJson("user-choice"))
        assertEquals(AlternativeBillingModeAndroid.AlternativeOnly, AlternativeBillingModeAndroid.fromJson("alternative-only"))
    }

    @Test
    fun `fromJson handles PascalCase format`() {
        assertEquals(AlternativeBillingModeAndroid.None, AlternativeBillingModeAndroid.fromJson("None"))
        assertEquals(AlternativeBillingModeAndroid.UserChoice, AlternativeBillingModeAndroid.fromJson("UserChoice"))
        assertEquals(AlternativeBillingModeAndroid.AlternativeOnly, AlternativeBillingModeAndroid.fromJson("AlternativeOnly"))
    }

    @Test
    fun `fromJson throws on unknown value`() {
        assertThrows(IllegalArgumentException::class.java) {
            AlternativeBillingModeAndroid.fromJson("unknown-value")
        }
    }

    @Test
    fun `toJson returns kebab-case format`() {
        assertEquals("none", AlternativeBillingModeAndroid.None.toJson())
        assertEquals("user-choice", AlternativeBillingModeAndroid.UserChoice.toJson())
        assertEquals("alternative-only", AlternativeBillingModeAndroid.AlternativeOnly.toJson())
    }

    @Test
    fun `rawValue matches toJson output`() {
        AlternativeBillingModeAndroid.entries.forEach { mode ->
            assertEquals(mode.rawValue, mode.toJson())
        }
    }

    @Test
    fun `fromJson and toJson are symmetric`() {
        AlternativeBillingModeAndroid.entries.forEach { mode ->
            val json = mode.toJson()
            val parsed = AlternativeBillingModeAndroid.fromJson(json)
            assertEquals(mode, parsed)
        }
    }
}
