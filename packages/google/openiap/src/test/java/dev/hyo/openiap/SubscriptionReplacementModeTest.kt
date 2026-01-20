package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

/**
 * Tests for SubscriptionReplacementModeAndroid enum and its mapping to
 * BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode constants.
 *
 * Reference (Billing Library 8.1.0+):
 * https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode
 *
 * Note: These constants differ from the legacy SubscriptionUpdateParams.ReplacementMode API.
 * See: https://github.com/hyodotdev/openiap/issues/71
 */
class SubscriptionReplacementModeTest {

    // MARK: - SubscriptionProductReplacementParams.ReplacementMode constants (8.1.0+)

    @Test
    fun `UNKNOWN_REPLACEMENT_MODE constant is 0`() {
        assertEquals(0, SubscriptionReplacementModeAndroid.UnknownReplacementMode.toReplacementModeConstant())
    }

    @Test
    fun `WITH_TIME_PRORATION constant is 1`() {
        assertEquals(1, SubscriptionReplacementModeAndroid.WithTimeProration.toReplacementModeConstant())
    }

    @Test
    fun `CHARGE_PRORATED_PRICE constant is 2`() {
        assertEquals(2, SubscriptionReplacementModeAndroid.ChargeProratedPrice.toReplacementModeConstant())
    }

    @Test
    fun `WITHOUT_PRORATION constant is 3`() {
        assertEquals(3, SubscriptionReplacementModeAndroid.WithoutProration.toReplacementModeConstant())
    }

    @Test
    fun `CHARGE_FULL_PRICE constant is 4 for SubscriptionProductReplacementParams`() {
        // This was incorrectly mapped to 5 (legacy value) before the fix
        // Correct value for SubscriptionProductReplacementParams.ReplacementMode is 4
        assertEquals(4, SubscriptionReplacementModeAndroid.ChargeFullPrice.toReplacementModeConstant())
    }

    @Test
    fun `DEFERRED constant is 5 for SubscriptionProductReplacementParams`() {
        // This was incorrectly mapped to 6 (legacy value) before the fix
        // Correct value for SubscriptionProductReplacementParams.ReplacementMode is 5
        assertEquals(5, SubscriptionReplacementModeAndroid.Deferred.toReplacementModeConstant())
    }

    @Test
    fun `KEEP_EXISTING constant is 6 for SubscriptionProductReplacementParams`() {
        // This was incorrectly mapped to 7 before the fix
        // Correct value for SubscriptionProductReplacementParams.ReplacementMode is 6
        // Note: KEEP_EXISTING is only available in Billing Library 8.1.0+
        assertEquals(6, SubscriptionReplacementModeAndroid.KeepExisting.toReplacementModeConstant())
    }

    // MARK: - Verify all enum values are covered

    @Test
    fun `all SubscriptionReplacementModeAndroid values have correct constants`() {
        val expectedMappings = mapOf(
            SubscriptionReplacementModeAndroid.UnknownReplacementMode to 0,
            SubscriptionReplacementModeAndroid.WithTimeProration to 1,
            SubscriptionReplacementModeAndroid.ChargeProratedPrice to 2,
            SubscriptionReplacementModeAndroid.WithoutProration to 3,
            SubscriptionReplacementModeAndroid.ChargeFullPrice to 4,
            SubscriptionReplacementModeAndroid.Deferred to 5,
            SubscriptionReplacementModeAndroid.KeepExisting to 6
        )

        // Verify all enum values are tested
        assertEquals(7, SubscriptionReplacementModeAndroid.entries.size)
        assertEquals(7, expectedMappings.size)

        // Verify each mapping
        for ((mode, expectedConstant) in expectedMappings) {
            assertEquals(
                "Mapping for $mode should be $expectedConstant",
                expectedConstant,
                mode.toReplacementModeConstant()
            )
        }
    }

    // MARK: - Document the difference between legacy and new API

    @Test
    fun `CHARGE_FULL_PRICE differs between legacy and new API`() {
        // Legacy SubscriptionUpdateParams.ReplacementMode: CHARGE_FULL_PRICE = 5
        // New SubscriptionProductReplacementParams.ReplacementMode: CHARGE_FULL_PRICE = 4
        val legacyValue = 5
        val newValue = 4

        assertEquals(newValue, SubscriptionReplacementModeAndroid.ChargeFullPrice.toReplacementModeConstant())
        // Document that legacy value is different
        assertNotEquals(
            "Legacy and new API values should differ for CHARGE_FULL_PRICE",
            legacyValue,
            newValue
        )
    }

    @Test
    fun `DEFERRED differs between legacy and new API`() {
        // Legacy SubscriptionUpdateParams.ReplacementMode: DEFERRED = 6
        // New SubscriptionProductReplacementParams.ReplacementMode: DEFERRED = 5
        val legacyValue = 6
        val newValue = 5

        assertEquals(newValue, SubscriptionReplacementModeAndroid.Deferred.toReplacementModeConstant())
        // Document that legacy value is different
        assertNotEquals(
            "Legacy and new API values should differ for DEFERRED",
            legacyValue,
            newValue
        )
    }

    // MARK: - Enum JSON serialization tests

    @Test
    fun `SubscriptionReplacementModeAndroid fromJson parses correctly`() {
        assertEquals(SubscriptionReplacementModeAndroid.UnknownReplacementMode, SubscriptionReplacementModeAndroid.fromJson("unknown-replacement-mode"))
        assertEquals(SubscriptionReplacementModeAndroid.WithTimeProration, SubscriptionReplacementModeAndroid.fromJson("with-time-proration"))
        assertEquals(SubscriptionReplacementModeAndroid.ChargeProratedPrice, SubscriptionReplacementModeAndroid.fromJson("charge-prorated-price"))
        assertEquals(SubscriptionReplacementModeAndroid.WithoutProration, SubscriptionReplacementModeAndroid.fromJson("without-proration"))
        assertEquals(SubscriptionReplacementModeAndroid.ChargeFullPrice, SubscriptionReplacementModeAndroid.fromJson("charge-full-price"))
        assertEquals(SubscriptionReplacementModeAndroid.Deferred, SubscriptionReplacementModeAndroid.fromJson("deferred"))
        assertEquals(SubscriptionReplacementModeAndroid.KeepExisting, SubscriptionReplacementModeAndroid.fromJson("keep-existing"))
    }

    @Test
    fun `SubscriptionReplacementModeAndroid fromJson parses PascalCase correctly`() {
        assertEquals(SubscriptionReplacementModeAndroid.UnknownReplacementMode, SubscriptionReplacementModeAndroid.fromJson("UnknownReplacementMode"))
        assertEquals(SubscriptionReplacementModeAndroid.WithTimeProration, SubscriptionReplacementModeAndroid.fromJson("WithTimeProration"))
        assertEquals(SubscriptionReplacementModeAndroid.ChargeProratedPrice, SubscriptionReplacementModeAndroid.fromJson("ChargeProratedPrice"))
        assertEquals(SubscriptionReplacementModeAndroid.WithoutProration, SubscriptionReplacementModeAndroid.fromJson("WithoutProration"))
        assertEquals(SubscriptionReplacementModeAndroid.ChargeFullPrice, SubscriptionReplacementModeAndroid.fromJson("ChargeFullPrice"))
        assertEquals(SubscriptionReplacementModeAndroid.Deferred, SubscriptionReplacementModeAndroid.fromJson("Deferred"))
        assertEquals(SubscriptionReplacementModeAndroid.KeepExisting, SubscriptionReplacementModeAndroid.fromJson("KeepExisting"))
    }

    @Test
    fun `SubscriptionReplacementModeAndroid toJson returns kebab-case`() {
        assertEquals("unknown-replacement-mode", SubscriptionReplacementModeAndroid.UnknownReplacementMode.toJson())
        assertEquals("with-time-proration", SubscriptionReplacementModeAndroid.WithTimeProration.toJson())
        assertEquals("charge-prorated-price", SubscriptionReplacementModeAndroid.ChargeProratedPrice.toJson())
        assertEquals("without-proration", SubscriptionReplacementModeAndroid.WithoutProration.toJson())
        assertEquals("charge-full-price", SubscriptionReplacementModeAndroid.ChargeFullPrice.toJson())
        assertEquals("deferred", SubscriptionReplacementModeAndroid.Deferred.toJson())
        assertEquals("keep-existing", SubscriptionReplacementModeAndroid.KeepExisting.toJson())
    }
}
