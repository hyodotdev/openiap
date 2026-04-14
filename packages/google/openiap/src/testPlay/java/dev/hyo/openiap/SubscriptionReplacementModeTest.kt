package dev.hyo.openiap

import com.android.billingclient.api.BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Tests for SubscriptionReplacementModeAndroid enum and its mapping to
 * BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode constants.
 *
 * These tests reference the native Billing Library constants directly so the
 * mapping cannot drift if Google ever renumbers the values.
 *
 * Reference (Billing Library 8.1.0+):
 * https://developer.android.com/reference/com/android/billingclient/api/BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams.ReplacementMode
 *
 * Note: These constants differ from the legacy SubscriptionUpdateParams.ReplacementMode API.
 * See: https://github.com/hyodotdev/openiap/issues/71
 */
class SubscriptionReplacementModeTest {

    @Test
    fun `UnknownReplacementMode maps to native UNKNOWN_REPLACEMENT_MODE`() {
        assertEquals(
            ReplacementMode.UNKNOWN_REPLACEMENT_MODE,
            SubscriptionReplacementModeAndroid.UnknownReplacementMode.toReplacementModeConstant()
        )
    }

    @Test
    fun `WithTimeProration maps to native WITH_TIME_PRORATION`() {
        assertEquals(
            ReplacementMode.WITH_TIME_PRORATION,
            SubscriptionReplacementModeAndroid.WithTimeProration.toReplacementModeConstant()
        )
    }

    @Test
    fun `ChargeProratedPrice maps to native CHARGE_PRORATED_PRICE`() {
        assertEquals(
            ReplacementMode.CHARGE_PRORATED_PRICE,
            SubscriptionReplacementModeAndroid.ChargeProratedPrice.toReplacementModeConstant()
        )
    }

    @Test
    fun `WithoutProration maps to native WITHOUT_PRORATION`() {
        assertEquals(
            ReplacementMode.WITHOUT_PRORATION,
            SubscriptionReplacementModeAndroid.WithoutProration.toReplacementModeConstant()
        )
    }

    @Test
    fun `ChargeFullPrice maps to native CHARGE_FULL_PRICE`() {
        assertEquals(
            ReplacementMode.CHARGE_FULL_PRICE,
            SubscriptionReplacementModeAndroid.ChargeFullPrice.toReplacementModeConstant()
        )
    }

    @Test
    fun `Deferred maps to native DEFERRED`() {
        assertEquals(
            ReplacementMode.DEFERRED,
            SubscriptionReplacementModeAndroid.Deferred.toReplacementModeConstant()
        )
    }

    @Test
    fun `KeepExisting maps to native KEEP_EXISTING`() {
        assertEquals(
            ReplacementMode.KEEP_EXISTING,
            SubscriptionReplacementModeAndroid.KeepExisting.toReplacementModeConstant()
        )
    }

    @Test
    fun `all enum values are covered by toReplacementModeConstant`() {
        assertEquals(7, SubscriptionReplacementModeAndroid.entries.size)
        for (mode in SubscriptionReplacementModeAndroid.entries) {
            mode.toReplacementModeConstant()
        }
    }

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
