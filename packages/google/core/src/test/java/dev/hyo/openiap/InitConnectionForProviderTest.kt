package dev.hyo.openiap

import android.content.Context
import android.os.Bundle
import androidx.test.core.app.ApplicationProvider
import io.github.hyochan.openiap.core.BuildConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

class PlayDiscoveryFactory : OpenIapProviderFactory {
    override val storeId = "play"
    override val coreVersion get() = OpenIapProvider.coreVersion
    override val clientProtocolVersion = BuildConfig.CLIENT_PROTOCOL_VERSION
    override fun create(context: Context): OpenIapProtocol = throw UnsupportedOperationException("Discovery only")
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class InitConnectionForProviderTest {
    private val context: Context = ApplicationProvider.getApplicationContext()

    private fun metadata(className: String?) {
        val info = context.packageManager.getApplicationInfo(context.packageName, 0)
        info.metaData = Bundle().apply { className?.let { putString(OpenIapProvider.METADATA_KEY, it) } }
        shadowOf(context.packageManager).installPackage(
            android.content.pm.PackageInfo().apply {
                packageName = context.packageName
                applicationInfo = info
            },
        )
    }

    @Test fun `non-Play provider failure names its store`() {
        metadata("community.fixture.DiscoveryFactory")

        val error = OpenIapError.InitConnection.forProvider(context)

        assertEquals(OpenIapError.InitConnection.CODE, error.code)
        assertTrue(error.message.contains("fixture"))
    }

    @Test fun `Play provider failure keeps the plain message`() {
        metadata(PlayDiscoveryFactory::class.java.name)

        val error = OpenIapError.InitConnection.forProvider(context)

        assertSame(OpenIapError.InitConnection, error)
    }

    @Test fun `unreadable provider keeps the plain message`() {
        metadata(null)

        val error = OpenIapError.InitConnection.forProvider(context)

        assertSame(OpenIapError.InitConnection, error)
    }
}
