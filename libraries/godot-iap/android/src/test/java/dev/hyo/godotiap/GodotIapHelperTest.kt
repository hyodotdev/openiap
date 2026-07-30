package dev.hyo.godotiap

import dev.hyo.openiap.ProductQueryType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class GodotIapHelperTest {
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
    }

    @Test
    fun `removed aliases unknown values and purchase-all are rejected`() {
        listOf("inapp", "in_app", "subscription", "subscriptions").forEach { removed ->
            assertThrows(IllegalArgumentException::class.java) {
                GodotIapHelper.parseProductQueryType(removed)
            }
        }
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

}
