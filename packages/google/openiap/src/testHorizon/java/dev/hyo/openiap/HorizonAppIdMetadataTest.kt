package dev.hyo.openiap

import android.os.Bundle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class HorizonAppIdMetadataTest {

    @Test
    fun `canonical Horizon 2 key takes precedence over legacy metadata`() {
        val metaData = Bundle().apply {
            putString("com.meta.horizon.platform.HORIZON_APP_ID", "canonical")
            putString("com.meta.horizon.platform.ovr.OCULUS_APP_ID", "legacy")
        }

        assertEquals("canonical", resolveHorizonAppId(metaData))
    }

    @Test
    fun `blank canonical key falls back through every historical key`() {
        val legacyKeys = listOf(
            "com.meta.horizon.platform.ovr.OCULUS_APP_ID",
            "com.meta.horizon.platform.ovr.HORIZON_APP_ID",
            "com.oculus.vr.APP_ID"
        )

        legacyKeys.forEach { legacyKey ->
            val metaData = Bundle().apply {
                putString("com.meta.horizon.platform.HORIZON_APP_ID", "")
                putString(legacyKey, legacyKey)
            }

            assertEquals(legacyKey, resolveHorizonAppId(metaData))
        }
    }

    @Test
    fun `missing or blank Horizon metadata resolves to null`() {
        assertNull(resolveHorizonAppId(null))
        assertNull(
            resolveHorizonAppId(
                Bundle().apply {
                    putString("com.meta.horizon.platform.HORIZON_APP_ID", "")
                }
            )
        )
    }
}
