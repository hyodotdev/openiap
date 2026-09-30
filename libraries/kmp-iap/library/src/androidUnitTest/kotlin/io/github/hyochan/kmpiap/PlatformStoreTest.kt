package io.github.hyochan.kmpiap

import kotlin.test.Test
import kotlin.test.assertEquals

class PlatformStoreTest {
    // Each flavor links one store's openiap-google; getStore() has to name that store.
    @Test
    fun `the factory reports the store of the flavor it was built for`() {
        val expected = mapOf(
            "play" to Store.PLAY_STORE,
            "horizon" to Store.HORIZON,
            "amazon" to Store.AMAZON,
        ).getValue(BuildConfig.OPENIAP_STORE)

        assertEquals(expected, createPlatformInAppPurchase().getStore())
    }
}
