package io.github.hyochan.kmpiap

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SubscriptionIdsNormalizerTestIOS {
    @Test
    fun `empty subscription list normalizes to null`() {
        assertNull(emptyList<String>().normalizeSubscriptionIdsIOS())
        val missing: List<String>? = null
        assertNull(missing.normalizeSubscriptionIdsIOS())
    }

    @Test
    fun `non-empty subscription list passes through`() {
        val ids = listOf("premium.monthly", "premium.yearly")
        assertEquals(ids, ids.normalizeSubscriptionIdsIOS())
    }
}
