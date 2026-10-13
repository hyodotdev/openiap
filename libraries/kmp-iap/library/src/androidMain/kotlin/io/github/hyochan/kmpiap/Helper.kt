package io.github.hyochan.kmpiap

import android.app.Activity
import android.app.Application
import android.content.Context
import dev.hyo.openiap.RequestVerifyPurchaseWithIapkitResult as AndroidRequestVerifyPurchaseWithIapkitResult
import io.github.hyochan.kmpiap.openiap.IapStore
import io.github.hyochan.kmpiap.openiap.IapkitClientPayloadFormat
import io.github.hyochan.kmpiap.openiap.IapkitProductClientPayload
import io.github.hyochan.kmpiap.openiap.IapkitPurchaseState
import io.github.hyochan.kmpiap.openiap.RequestVerifyPurchaseWithIapkitResult

internal fun authoritativeStorefrontCountryOrNull(countryCode: String?): String? =
    countryCode?.trim()?.takeIf { it.isNotEmpty() }

internal fun tryCaptureApplication(
    callback: Application.ActivityLifecycleCallbacks,
    onContextAvailable: (Context?) -> Unit,
    onActivityFound: (Activity?) -> Unit
): (() -> Unit)? {
    var disposer: (() -> Unit)? = null

    runCatching {
        val activityThreadClass = Class.forName("android.app.ActivityThread")
        val currentActivityThread = activityThreadClass.getMethod("currentActivityThread").invoke(null)
        val getApplication = activityThreadClass.getMethod("getApplication")
        val app = getApplication.invoke(currentActivityThread) as? Application
        onContextAvailable(app?.applicationContext)
        app?.registerActivityLifecycleCallbacks(callback)
        disposer = app?.let { application ->
            { application.unregisterActivityLifecycleCallbacks(callback) }
        }

        val activitiesField = activityThreadClass.getDeclaredField("mActivities")
        activitiesField.isAccessible = true
        val activities = activitiesField.get(currentActivityThread) as? Map<*, *>
        activities?.values?.forEach { value ->
            val recordClass = value?.javaClass
            val activityField = recordClass?.getDeclaredField("activity")
            activityField?.isAccessible = true
            val activity = activityField?.get(value) as? Activity
            if (activity != null && !activity.isFinishing) {
                onActivityFound(activity)
                return@forEach
            }
        }
    }

    return disposer
}

/**
 * Re-shapes an openiap-google IAPKit result into this module's generated types.
 * State and store degrade to Unknown when the two versions drift, but the
 * store identity fails closed: the constructor throws on an id it cannot
 * represent, and callers report that as PurchaseVerificationFailed.
 */
internal fun AndroidRequestVerifyPurchaseWithIapkitResult.toKmpIapkitResult(): RequestVerifyPurchaseWithIapkitResult =
    RequestVerifyPurchaseWithIapkitResult(
        clientPayload = clientPayload?.let { payload ->
            IapkitClientPayloadFormat.entries
                .firstOrNull { it.rawValue == payload.format.toJson() }
                ?.let { format ->
                    IapkitProductClientPayload(
                        body = payload.body,
                        format = format,
                        updatedAt = payload.updatedAt,
                        version = payload.version
                    )
                }
        },
        environment = environment,
        isValid = isValid,
        productId = productId,
        state = runCatching {
            IapkitPurchaseState.fromJson(state.toJson())
        }.getOrDefault(IapkitPurchaseState.Unknown),
        store = runCatching {
            IapStore.fromJson(store.toJson())
        }.getOrDefault(IapStore.Unknown),
        storeId = storeId
    )
