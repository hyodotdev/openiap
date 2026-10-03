package community.fixture.host

import android.app.Activity
import android.os.Bundle
import android.widget.TextView
import dev.hyo.openiap.*
import dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener
import kotlinx.coroutines.*

class MainActivity : Activity() {
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        val output = TextView(this)
        setContentView(output)
        val provider = OpenIapProvider.create(this)
        provider.addPurchaseUpdateListener(OpenIapPurchaseUpdateListener { purchase ->
            val message = "store=${purchase.store.rawValue} storeId=${purchase.storeId} productId=${purchase.productId}"
            output.text = message
            android.util.Log.i("ProviderFixture", message)
        })
        CoroutineScope(Dispatchers.Main).launch {
            provider.initConnection(null)
            provider.requestPurchase(RequestPurchaseProps.fromJson(mapOf("type" to "in-app", "requestPurchase" to mapOf("google" to mapOf("skus" to listOf("conformance.product"))))))
        }
    }
}
