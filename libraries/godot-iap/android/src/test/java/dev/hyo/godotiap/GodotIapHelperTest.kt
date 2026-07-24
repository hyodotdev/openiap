package dev.hyo.godotiap

import dev.hyo.openiap.ProductQueryType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.After
import org.junit.Before
import org.junit.Test

class GodotIapHelperTest {
    private val deprecationWarnings = mutableListOf<String>()

    @Before
    fun setUpDeprecationCapture() {
        GodotIapLog.resetDeprecationsForTests()
        GodotIapLog.setDeprecationHandlerForTests(deprecationWarnings::add)
    }

    @After
    fun tearDownDeprecationCapture() {
        GodotIapLog.setDeprecationHandlerForTests(null)
        GodotIapLog.resetDeprecationsForTests()
        deprecationWarnings.clear()
    }

    @Test
    fun `canonical product query types preserve their exact meaning`() {
        assertEquals(
            ProductQueryType.InApp,
            GodotIapHelper.parseProductQueryType("in-app", ProductQueryType.All),
        )
        assertEquals(
            ProductQueryType.Subs,
            GodotIapHelper.parseProductQueryType("subs", ProductQueryType.All),
        )
        assertEquals(
            ProductQueryType.All,
            GodotIapHelper.parseProductQueryType("all", ProductQueryType.InApp),
        )
        assertTrue(deprecationWarnings.isEmpty())
    }

    @Test
    fun `known two-x aliases normalize to canonical product query types`() {
        assertEquals(ProductQueryType.InApp, GodotIapHelper.parseProductQueryType("inapp"))
        assertEquals(ProductQueryType.InApp, GodotIapHelper.parseProductQueryType("in_app"))
        assertEquals(ProductQueryType.Subs, GodotIapHelper.parseProductQueryType("subscription"))
        assertEquals(ProductQueryType.Subs, GodotIapHelper.parseProductQueryType("subscriptions"))
        assertEquals(ProductQueryType.InApp, GodotIapHelper.parseProductQueryType("inapp"))
        assertEquals(4, deprecationWarnings.size)
        assertTrue(deprecationWarnings.all { it.contains("3.0.0") })
    }

    @Test
    fun `unknown or purchase-all product query types are rejected`() {
        assertThrows(IllegalArgumentException::class.java) {
            GodotIapHelper.parseProductQueryType("subscrption")
        }
        assertThrows(IllegalArgumentException::class.java) {
            GodotIapHelper.parseProductQueryType(
                rawType = "all",
                allowAll = false,
            )
        }
    }

    @Test
    fun `canonical wire values win even when a legacy value is present`() {
        assertEquals(
            "canonical-account",
            GodotIapHelper.resolveCanonicalWireValue(
                canonicalPresent = true,
                canonicalValue = "canonical-account",
                legacyPresent = true,
                legacyValue = "legacy-account",
                legacyName = "obfuscatedAccountIdAndroid",
                canonicalName = "obfuscatedAccountId",
            ),
        )
        assertNull(
            GodotIapHelper.resolveCanonicalWireValue(
                canonicalPresent = true,
                canonicalValue = null,
                legacyPresent = true,
                legacyValue = "legacy",
                legacyName = "purchaseTokenAndroid",
                canonicalName = "purchaseToken",
            ),
        )
        assertEquals(
            "legacy",
            GodotIapHelper.resolveCanonicalWireValue(
                canonicalPresent = false,
                canonicalValue = null,
                legacyPresent = true,
                legacyValue = "legacy",
                legacyName = "replacementModeAndroid",
                canonicalName = "subscriptionProductReplacementParams",
            ),
        )
        assertEquals(3, deprecationWarnings.size)
        assertTrue(deprecationWarnings.all { it.contains("3.0.0") })
    }
}
