package dev.hyo.openiap

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.viewModelScope
import dev.hyo.openiap.store.OpenIapStore
import dev.hyo.openiap.utils.activityBindingState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Android ViewModel wrapper around OpenIapStore for easy integration
 */
class OpenIapViewModel(app: Application) : AndroidViewModel(app) {
    private val store = OpenIapStore(app.applicationContext)
    private var activityBindingOwner: Any? = null
    private var activityLifecycleOwner: LifecycleOwner? = null
    private var activityLifecycleObserver: LifecycleEventObserver? = null
    private val cleanupScope = CoroutineScope(Dispatchers.Main.immediate + SupervisorJob())

    val isConnected: StateFlow<Boolean> = store.isConnected
    val products = store.products
    val availablePurchases = store.availablePurchases
    val status = store.status

    /** Supplies the foreground Activity required by Horizon billing. */
    fun setActivity(activity: Activity?) {
        if (activity == null) {
            clearActivityBinding()
        } else {
            bindActivity(activity)
        }
    }

    /**
     * Initializes without an Activity. This remains valid for Play and Amazon;
     * Horizon callers must use [initConnection] with an Activity.
     */
    @Deprecated("Horizon callers must use initConnection(activity, config)")
    fun initConnection(config: InitConnectionConfig? = null) {
        viewModelScope.launch { runCatching { store.initConnection(config) } }
    }

    /** Supplies the foreground Activity and initializes the store connection. */
    fun initConnection(activity: Activity, config: InitConnectionConfig? = null) {
        if (!bindActivity(activity)) return
        viewModelScope.launch { runCatching { store.initConnection(config) } }
    }

    private fun bindActivity(activity: Activity): Boolean {
        clearActivityBinding()

        val lifecycleOwner = activity as? LifecycleOwner
        if (lifecycleOwner?.lifecycle?.currentState == Lifecycle.State.DESTROYED) {
            return false
        }

        val bindingOwner = Any()
        activityBindingOwner = bindingOwner
        store.bindActivity(bindingOwner, activity)

        if (lifecycleOwner != null) {
            val observer = LifecycleEventObserver { _, event ->
                if (activityBindingOwner === bindingOwner) {
                    when (event.activityBindingState()) {
                        true -> store.bindActivity(bindingOwner, activity)
                        false -> store.unbindActivity(bindingOwner)
                        null -> Unit
                    }
                    if (event == Lifecycle.Event.ON_DESTROY) {
                        clearActivityBinding()
                    }
                }
            }
            activityLifecycleOwner = lifecycleOwner
            activityLifecycleObserver = observer
            lifecycleOwner.lifecycle.addObserver(observer)
        }
        return true
    }

    private fun clearActivityBinding() {
        val bindingOwner = activityBindingOwner
        activityLifecycleObserver?.let { observer ->
            activityLifecycleOwner?.lifecycle?.removeObserver(observer)
        }
        activityLifecycleObserver = null
        activityLifecycleOwner = null
        activityBindingOwner = null
        if (bindingOwner != null) {
            store.unbindActivity(bindingOwner)
        }
    }

    override fun onCleared() {
        clearActivityBinding()
        store.clear()
        cleanupScope.launch {
            runCatching { store.endConnection() }
            cleanupScope.cancel()
        }
        super.onCleared()
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
                            obfuscatedAccountId = null,
                            obfuscatedProfileId = null,
                            skus = skus
                        )
                        RequestPurchaseProps(
                            request = RequestPurchaseProps.Request.Purchase(
                                RequestPurchasePropsByPlatforms(google = android)
                            ),
                            type = type
                        )
                    }
                    ProductQueryType.Subs -> {
                        val android = RequestSubscriptionAndroidProps(
                            isOfferPersonalized = null,
                            obfuscatedAccountId = null,
                            obfuscatedProfileId = null,
                            purchaseToken = null,
                            skus = skus,
                            subscriptionOffers = null
                        )
                        RequestPurchaseProps(
                            request = RequestPurchaseProps.Request.Subscription(
                                RequestSubscriptionPropsByPlatforms(google = android)
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
