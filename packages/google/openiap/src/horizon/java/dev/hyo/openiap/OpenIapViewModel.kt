package dev.hyo.openiap

import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import android.app.Application
import dev.hyo.openiap.store.OpenIapStore
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Android ViewModel wrapper around OpenIapStore for easy integration
 */
class OpenIapViewModel(app: Application) : AndroidViewModel(app) {
    private val store = OpenIapStore(app.applicationContext)

    val isConnected: StateFlow<Boolean> = store.isConnected
    val products = store.products
    val availablePurchases = store.availablePurchases
    val status = store.status

    fun initConnection(config: InitConnectionConfig? = null) {
        viewModelScope.launch { runCatching { store.initConnection(config) } }
    }
    fun endConnection() { viewModelScope.launch { runCatching { store.endConnection() } } }

    fun fetchProducts(skus: List<String>, type: ProductQueryType = ProductQueryType.All) {
        viewModelScope.launch {
            runCatching {
                val request = ProductRequest(skus = skus, type = type)
                store.fetchProducts(request)
            }
        }
    }

    fun restorePurchases() {
        viewModelScope.launch {
            runCatching {
                store.getAvailablePurchases(null)
            }
        }
    }

    fun requestPurchase(skus: List<String>, type: ProductQueryType = ProductQueryType.InApp) {
        viewModelScope.launch {
            runCatching {
                val props = when (type) {
                    ProductQueryType.InApp -> {
                        val android = RequestPurchaseAndroidProps(
                            isOfferPersonalized = null,
                            obfuscatedAccountIdAndroid = null,
                            obfuscatedProfileIdAndroid = null,
                            skus = skus
                        )
                        RequestPurchaseProps(
                            request = RequestPurchaseProps.Request.Purchase(
                                RequestPurchasePropsByPlatforms(android = android)
                            ),
                            type = type
                        )
                    }
                    ProductQueryType.Subs -> {
                        val android = RequestSubscriptionAndroidProps(
                            isOfferPersonalized = null,
                            obfuscatedAccountIdAndroid = null,
                            obfuscatedProfileIdAndroid = null,
                            purchaseTokenAndroid = null,
                            replacementModeAndroid = null,
                            skus = skus,
                            subscriptionOffers = null
                        )
                        RequestPurchaseProps(
                            request = RequestPurchaseProps.Request.Subscription(
                                RequestSubscriptionPropsByPlatforms(android = android)
                            ),
                            type = type
                        )
                    }
                    else -> throw IllegalArgumentException("type must be InApp or Subs")
                }
                store.requestPurchase(props)
            }
        }
    }
}
