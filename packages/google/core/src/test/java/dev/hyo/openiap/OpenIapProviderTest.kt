package dev.hyo.openiap

import android.content.Context
import android.os.Bundle
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class OpenIapProviderTest {
    private val context: Context = ApplicationProvider.getApplicationContext()

    private fun metadata(className: String?) {
        val info = context.packageManager.getApplicationInfo(context.packageName, 0)
        info.metaData = Bundle().apply { className?.let { putString(OpenIapProvider.METADATA_KEY, it) } }
        shadowOf(context.packageManager).installPackage(android.content.pm.PackageInfo().apply {
            packageName = context.packageName
            applicationInfo = info
        })
    }

    @Test fun `stable provider works on newer core in its major`() {
        OpenIapProvider.validate("fake-store", "3.6.2", "3.7.0")
        OpenIapProvider.validate("play", "3.6.2", "3.6.2")
    }

    @Test fun `invalid ids and incompatible cores fail with a developer error`() {
        for ((id, built, runtime) in listOf(
            Triple("auto", "3.6.2", "3.6.2"), Triple("Bad Store", "3.6.2", "3.6.2"),
            Triple("fake", "4.0.0", "3.6.2"), Triple("fake", "3.7.0", "3.6.2"),
            Triple("fake", "bad", "3.6.2"), Triple("fake", "3.6.2-rc.1", "3.6.2"),
        )) {
            val error = assertThrows(OpenIapError.ProviderConfiguration::class.java) {
                OpenIapProvider.validate(id, built, runtime)
            }
            assertEquals(ErrorCode.DeveloperError.rawValue, error.code)
        }
    }

    @Test fun `factory is discovered outside the core package`() {
        metadata("community.fixture.DiscoveryFactory")
        assertEquals("fixture", OpenIapProvider.factory(context).storeId)
    }

    @Test fun `missing incorrect and uninstantiable factory classes fail clearly`() {
        for (name in listOf(null, "community.missing.Factory", "java.lang.String", "community.fixture.NoDefaultConstructor")) {
            metadata(name)
            val error = assertThrows(OpenIapError.ProviderConfiguration::class.java) { OpenIapProvider.factory(context) }
            assertTrue(error.message.isNotBlank())
        }
    }
}
