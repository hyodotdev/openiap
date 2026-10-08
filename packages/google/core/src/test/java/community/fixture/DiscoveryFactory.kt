package community.fixture

import android.content.Context
import dev.hyo.openiap.OpenIapProvider
import dev.hyo.openiap.OpenIapProviderFactory
import dev.hyo.openiap.OpenIapProtocol
import io.github.hyochan.openiap.core.BuildConfig

class DiscoveryFactory : OpenIapProviderFactory {
    override val storeId = "fixture"
    override val coreVersion get() = OpenIapProvider.coreVersion
    override val clientProtocolVersion = BuildConfig.CLIENT_PROTOCOL_VERSION
    override fun create(context: Context): OpenIapProtocol = throw UnsupportedOperationException("Discovery only")
}

class NoDefaultConstructor(private val name: String) : OpenIapProviderFactory {
    override val storeId = "fixture"
    override val coreVersion get() = OpenIapProvider.coreVersion
    override val clientProtocolVersion = BuildConfig.CLIENT_PROTOCOL_VERSION
    override fun create(context: Context): OpenIapProtocol = throw UnsupportedOperationException(name)
}
