package community.fixture

import android.content.Context
import dev.hyo.openiap.OpenIapProvider
import dev.hyo.openiap.OpenIapProviderFactory
import dev.hyo.openiap.OpenIapProtocol

class DiscoveryFactory : OpenIapProviderFactory {
    override val storeId = "fixture"
    override val coreVersion get() = OpenIapProvider.coreVersion
    override fun create(context: Context): OpenIapProtocol = throw UnsupportedOperationException("Discovery only")
}

class NoDefaultConstructor(private val name: String) : OpenIapProviderFactory {
    override val storeId = "fixture"
    override val coreVersion get() = OpenIapProvider.coreVersion
    override fun create(context: Context): OpenIapProtocol = throw UnsupportedOperationException(name)
}
