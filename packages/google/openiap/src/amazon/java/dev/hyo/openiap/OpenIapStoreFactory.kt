package dev.hyo.openiap

import android.content.Context
import io.github.hyochan.openiap.BuildConfig

class OpenIapStoreFactory : OpenIapProviderFactory {
    override val storeId = "amazon"
    override val coreVersion: String get() = BuildConfig.OPENIAP_CORE_VERSION
    override val clientProtocolVersion = io.github.hyochan.openiap.core.BuildConfig.CLIENT_PROTOCOL_VERSION
    override val capabilities = setOf("pendingPurchases")
    override fun create(context: Context): OpenIapProtocol = OpenIapModule(context)
}
