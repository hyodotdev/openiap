package dev.hyo.openiap.maui

import android.content.Context
import android.os.Bundle
import android.os.Looper
import com.google.gson.JsonParser
import dev.hyo.openiap.MutationFinishTransactionHandler
import dev.hyo.openiap.OpenIapProtocol
import dev.hyo.openiap.OpenIapProvider
import dev.hyo.openiap.OpenIapProviderFactory
import dev.hyo.openiap.QueryFetchProductsHandler
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.lang.reflect.Proxy

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ProviderConfigurationTest {
    private fun providerMetaData(factory: Class<out OpenIapProviderFactory>) =
        Bundle().apply { putString(OpenIapProvider.METADATA_KEY, factory.name) }

    private fun contextWith(metaData: Bundle): Context {
        val context = RuntimeEnvironment.getApplication()
        val info = context.packageManager.getApplicationInfo(context.packageName, 0)
        info.metaData = metaData
        shadowOf(context.packageManager).installPackage(
            android.content.pm.PackageInfo().apply {
                packageName = context.packageName
                applicationInfo = info
            },
        )
        return context
    }

    @Test fun `invalid provider is reported through init rather than JNI construction`() {
        val context = contextWith(Bundle())
        val module = OpenIapMauiModule(context)
        module.setActivity(null)
        val token = module.addPurchaseUpdatedListener { fail("Invalid provider must not emit a purchase") }
        var error: String? = null
        var responses = 0
        module.initConnection(null) { result, errorJson ->
            assertNull(result)
            error = errorJson
            responses++
        }
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(1, responses)
        val payload = JsonParser.parseString(error).asJsonObject
        assertEquals("developer-error", payload["code"].asString)
        assertTrue(payload["message"].asString.contains("provider", ignoreCase = true))
        module.removeListener(token)
    }

    @Test fun `malformed input is reported as a developer error`() {
        val module = OpenIapMauiModule(RuntimeEnvironment.getApplication())
        val errors = mutableListOf<String?>()
        module.fetchProducts("not json") { _, errorJson -> errors.add(errorJson) }
        module.requestPurchase("""{"type":"bogus"}""") { _, errorJson -> errors.add(errorJson) }
        module.requestPurchase("""{"requestPurchase":"not an object"}""") { _, errorJson -> errors.add(errorJson) }
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals(3, errors.size)
        errors.forEach { assertEquals("developer-error", JsonParser.parseString(it).asJsonObject["code"].asString) }
    }

    @Test fun `a store failure keeps its own code`() {
        val context = contextWith(providerMetaData(ThrowingStoreFactory::class.java))
        var error: String? = null
        OpenIapMauiModule(context).fetchProducts("""{"skus":["premium"],"type":"in-app"}""") { _, errorJson -> error = errorJson }
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals("unknown", JsonParser.parseString(error).asJsonObject["code"].asString)
    }

    @Test fun `finishing a purchase answers with its id`() {
        val context = contextWith(providerMetaData(FinishingStoreFactory::class.java))
        val purchase = """{"__typename":"PurchaseAndroid","id":"GPA.1234","productId":"premium","purchaseState":"purchased","store":"google"}"""
        var result: String? = null
        OpenIapMauiModule(context).finishTransaction(purchase, null) { json, errorJson ->
            assertNull(errorJson)
            result = json
        }
        shadowOf(Looper.getMainLooper()).idle()
        assertEquals("GPA.1234", JsonParser.parseString(result).asJsonObject["value"].asString)
    }
}

/** A provider whose store accepts every finish. */
class FinishingStoreFactory : OpenIapProviderFactory {
    override val storeId = "test_finishing_store"
    override val coreVersion get() = OpenIapProvider.coreVersion
    override val clientProtocolVersion = io.github.hyochan.openiap.core.BuildConfig.CLIENT_PROTOCOL_VERSION

    override fun create(context: Context): OpenIapProtocol {
        val finish: MutationFinishTransactionHandler = { _, _ -> }
        return Proxy.newProxyInstance(OpenIapProtocol::class.java.classLoader, arrayOf(OpenIapProtocol::class.java)) { _, method, _ ->
            if (method.name == "getFinishTransaction") finish else null
        } as OpenIapProtocol
    }
}

/** A provider whose product query fails inside the store, not in the caller's input. */
class ThrowingStoreFactory : OpenIapProviderFactory {
    override val storeId = "test_throwing_store"
    override val coreVersion get() = OpenIapProvider.coreVersion
    override val clientProtocolVersion = io.github.hyochan.openiap.core.BuildConfig.CLIENT_PROTOCOL_VERSION

    override fun create(context: Context): OpenIapProtocol {
        val fetch: QueryFetchProductsHandler = { throw IllegalArgumentException("store bug") }
        return Proxy.newProxyInstance(OpenIapProtocol::class.java.classLoader, arrayOf(OpenIapProtocol::class.java)) { _, method, _ ->
            if (method.name == "getFetchProducts") fetch else null
        } as OpenIapProtocol
    }
}
