package com.margelo.nitro.iap

import com.margelo.nitro.core.NullType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class PurchaseSerializationTest {
    @Test
    fun `unknown renewal uses the native null variant rather than an absent value`() {
        val renewal: Boolean? = null
        val variant = renewal.toNitroNullableBoolean()

        assertNotNull(variant)
        assertEquals(NullType.NULL, variant.asFirstOrNull())
    }

    @Test
    fun `disabled renewal remains a present false value`() {
        assertEquals(false, false.toNitroNullableBoolean().asSecondOrNull())
    }

    @Test
    fun `enabled renewal remains a present true value`() {
        assertEquals(true, true.toNitroNullableBoolean().asSecondOrNull())
    }
}
