package dev.hyo.openiap

import android.os.Bundle
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [29])
class HorizonAppIdMetadataTest {

    @Test
    fun `canonical Horizon 2 key takes precedence over legacy metadata`() {
        val warnedKeys = mutableListOf<String>()
        val metaData = Bundle().apply {
            putString("com.meta.horizon.platform.HORIZON_APP_ID", "canonical")
            putString("com.meta.horizon.platform.ovr.OCULUS_APP_ID", "legacy")
        }

        assertEquals("canonical", resolveHorizonAppId(metaData, warnedKeys::add))
        assertEquals(emptyList<String>(), warnedKeys)
    }

    @Test
    fun `blank canonical key warns for the selected historical key`() {
        val legacyKeys = listOf(
            "com.meta.horizon.platform.ovr.OCULUS_APP_ID",
            "com.meta.horizon.platform.ovr.HORIZON_APP_ID",
            "com.oculus.vr.APP_ID"
        )

        legacyKeys.forEach { legacyKey ->
            val warnedKeys = mutableListOf<String>()
            val metaData = Bundle().apply {
                putString("com.meta.horizon.platform.HORIZON_APP_ID", "")
                putString(legacyKey, legacyKey)
            }

            assertEquals(legacyKey, resolveHorizonAppId(metaData, warnedKeys::add))
            assertEquals(listOf(legacyKey), warnedKeys)
        }
    }

    @Test
    fun `only the first resolved historical key warns`() {
        val warnedKeys = mutableListOf<String>()
        val metaData = Bundle().apply {
            putString("com.meta.horizon.platform.ovr.OCULUS_APP_ID", "first")
            putString("com.meta.horizon.platform.ovr.HORIZON_APP_ID", "second")
            putString("com.oculus.vr.APP_ID", "third")
        }

        assertEquals("first", resolveHorizonAppId(metaData, warnedKeys::add))
        assertEquals(
            listOf("com.meta.horizon.platform.ovr.OCULUS_APP_ID"),
            warnedKeys
        )
    }

    @Test
    fun `historical metadata logs its OpenIAP 3_0 removal deadline`() {
        val warnings = mutableListOf<String>()
        OpenIapLog.enable(true)
        OpenIapLog.setHandler { level, message, _ ->
            if (level == OpenIapLog.Level.Warn) {
                warnings.add(message)
            }
        }

        try {
            assertEquals(
                "legacy",
                resolveHorizonAppId(
                    Bundle().apply {
                        putString("com.oculus.vr.APP_ID", "legacy")
                    }
                )
            )
            assertEquals(1, warnings.size)
            assertTrue(warnings.single().contains("com.oculus.vr.APP_ID"))
            assertTrue(warnings.single().contains("OpenIAP 3.0"))
            assertTrue(
                warnings.single().contains("com.meta.horizon.platform.HORIZON_APP_ID")
            )
        } finally {
            OpenIapLog.setHandler(null)
            OpenIapLog.enable(false)
        }
    }

    @Test
    fun `missing or blank Horizon metadata resolves to null`() {
        val warnedKeys = mutableListOf<String>()

        assertNull(resolveHorizonAppId(null, warnedKeys::add))
        assertNull(
            resolveHorizonAppId(
                Bundle().apply {
                    putString("com.meta.horizon.platform.HORIZON_APP_ID", "")
                },
                warnedKeys::add
            )
        )
        assertEquals(emptyList<String>(), warnedKeys)
    }
}
