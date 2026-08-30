package com.margelo.nitro.iap

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AvailablePurchasesTypeTest {
    @Test
    fun `maps generated purchase types to native query values`() {
        assertEquals(
            "in-app",
            normalizeAvailablePurchasesType(NitroAvailablePurchasesAndroidType.IN_APP),
        )
        assertEquals(
            "subs",
            normalizeAvailablePurchasesType(NitroAvailablePurchasesAndroidType.SUBS),
        )
        assertNull(normalizeAvailablePurchasesType(null))
    }
}
