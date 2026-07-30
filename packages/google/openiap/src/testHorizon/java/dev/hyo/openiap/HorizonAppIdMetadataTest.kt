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
    fun `canonical Horizon metadata resolves the app id`() {
        val metaData = Bundle().apply {
            putString("com.meta.horizon.platform.HORIZON_APP_ID", "canonical")
        }

        assertEquals("canonical", resolveHorizonAppId(metaData))
    }

    @Test
    fun `missing or blank Horizon metadata resolves to null`() {
        assertNull(resolveHorizonAppId(null))
        assertNull(
            resolveHorizonAppId(
                Bundle().apply {
                    putString("com.meta.horizon.platform.HORIZON_APP_ID", "")
                },
            ),
        )
    }

    @Test
    fun `historical Horizon metadata is ignored`() {
        val metaData = Bundle().apply {
            putString("com.oculus.vr.APP_ID", "legacy")
        }

        assertNull(resolveHorizonAppId(metaData))
    }
}
