package dev.hyo.openiap

import android.content.Context
import io.github.hyochan.openiap.BuildConfig

class OpenIapStoreFactory : OpenIapProviderFactory {
    override val storeId = "play"
    override val coreVersion: String get() = BuildConfig.OPENIAP_CORE_VERSION
    override val capabilities = setOf("pendingPurchases", "subscriptionBillingIssue", "offerCodeRedemption")
    override fun create(context: Context): OpenIapProtocol = OpenIapModule(context)
}
