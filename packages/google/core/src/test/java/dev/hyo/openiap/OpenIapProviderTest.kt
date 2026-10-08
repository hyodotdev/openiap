package dev.hyo.openiap

import android.content.Context
import android.os.Bundle
import androidx.test.core.app.ApplicationProvider
import io.github.hyochan.openiap.core.BuildConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
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
        shadowOf(context.packageManager).installPackage(
            android.content.pm.PackageInfo().apply {
                packageName = context.packageName
                applicationInfo = info
            },
        )
    }

    @Test fun `published Kotlin default argument bridges remain linkable`() {
        val defaults = Class.forName("dev.hyo.openiap.OpenIapProtocol\$DefaultImpls")
        defaults.getDeclaredMethod(
            "showInAppMessages\$default",
            OpenIapProtocol::class.java,
            android.app.Activity::class.java,
            InAppMessageParamsAndroid::class.java,
            kotlin.coroutines.Continuation::class.java,
            Int::class.javaPrimitiveType,
            Any::class.java,
        )
        defaults.getDeclaredMethod(
            "createBillingProgramReportingDetails\$default",
            OpenIapProtocol::class.java,
            BillingProgramAndroid::class.java,
            DeveloperBillingTypeAndroid::class.java,
            kotlin.coroutines.Continuation::class.java,
            Int::class.javaPrimitiveType,
            Any::class.java,
        )
    }

    @Test fun `stable provider works on newer core in its major`() {
        OpenIapProvider.validate("fake_store", "3.6.2", "3.7.0")
        OpenIapProvider.validate("play", "3.6.2", "3.6.2")
    }

    @Test fun `invalid ids and incompatible cores fail with a developer error`() {
        for ((id, built, runtime) in listOf(
            Triple("auto", "3.6.2", "3.6.2"),
            Triple("google", "3.6.2", "3.6.2"),
            Triple("Bad Store", "3.6.2", "3.6.2"),
            Triple("fake", "4.0.0", "3.6.2"),
            Triple("fake", "3.7.0", "3.6.2"),
            Triple("fake", "bad", "3.6.2"),
            Triple("fake", "3.6.2-rc.1", "3.6.2"),
        )) {
            val error =
                assertThrows(OpenIapError.ProviderConfiguration::class.java) {
                    OpenIapProvider.validate(id, built, runtime)
                }
            assertEquals(ErrorCode.DeveloperError.rawValue, error.code)
        }
    }

    @Test fun `descriptor validates the native and protocol contracts separately`() {
        val descriptor = community.fixture.DiscoveryFactory().descriptor
        OpenIapProvider.validate(descriptor)
        assertEquals(IapPlatform.Android, descriptor.platform)
        for (invalid in listOf(
            descriptor.copy(platform = IapPlatform.Ios),
            descriptor.copy(clientProtocolVersion = "0.1.1"),
            descriptor.copy(clientProtocolVersion = "0.3.0"),
            descriptor.copy(clientProtocolVersion = "bad"),
            descriptor.copy(coreVersion = "999.0.0"),
        )) {
            assertThrows(OpenIapError.ProviderConfiguration::class.java) { OpenIapProvider.validate(invalid) }
        }
    }

    @Test fun `descriptor mismatch messages name the failing contract`() {
        val descriptor = community.fixture.DiscoveryFactory().descriptor
        fun messageFor(invalid: StoreProviderDescriptor): String =
            assertThrows(OpenIapError.ProviderConfiguration::class.java) { OpenIapProvider.validate(invalid) }.message
        assertEquals(
            "Provider 'fixture' requires Client Protocol 0.3.0; this app links ${BuildConfig.CLIENT_PROTOCOL_VERSION}. Update the provider or the OpenIAP runtime to a matching protocol.",
            messageFor(descriptor.copy(clientProtocolVersion = "0.3.0")),
        )
        assertEquals(
            "Invalid Client Protocol version 'bad' for provider 'fixture'. Use a complete semantic version.",
            messageFor(descriptor.copy(clientProtocolVersion = "bad")),
        )
        assertEquals(
            "Provider 'fixture' requires openiap-core 999.0.0; this app links ${OpenIapProvider.coreVersion}. Use a compatible provider or core version.",
            messageFor(descriptor.copy(coreVersion = "999.0.0")),
        )
    }

    @Test fun `core mismatch messages keep the core wording`() {
        val tooNew = assertThrows(OpenIapError.ProviderConfiguration::class.java) {
            OpenIapProvider.validate("fake", "3.7.0", "3.6.2")
        }
        assertEquals(
            "Provider 'fake' requires openiap-core 3.7.0; this app links 3.6.2. Use a compatible provider or core version.",
            tooNew.message,
        )
        val malformed = assertThrows(OpenIapError.ProviderConfiguration::class.java) {
            OpenIapProvider.validate("fake", "bad", "3.6.2")
        }
        assertEquals(
            "Invalid core version 'bad' for provider 'fake'. Use a complete semantic version.",
            malformed.message,
        )
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
