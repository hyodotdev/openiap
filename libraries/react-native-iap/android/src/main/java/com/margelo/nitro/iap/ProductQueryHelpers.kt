package com.margelo.nitro.iap

import dev.hyo.openiap.ProductCommon
import dev.hyo.openiap.ProductQueryType
import kotlin.coroutines.cancellation.CancellationException

internal suspend fun collectAllQueryProducts(
    skusList: List<String>,
    fetchKind: suspend (ProductQueryType) -> List<ProductCommon>,
    onFailure: (ProductQueryType, Throwable) -> Unit = { _, _ -> },
): List<ProductCommon> {
    val byId = linkedMapOf<String, ProductCommon>()
    var firstFailure: Throwable? = null

    listOf(ProductQueryType.InApp, ProductQueryType.Subs).forEach { kind ->
        runCatching {
            fetchKind(kind)
        }.onSuccess { fetched ->
            fetched.forEach { product ->
                byId.putIfAbsent(product.id, product)
            }
        }.onFailure { error ->
            if (error is CancellationException) throw error
            onFailure(kind, error)
            if (firstFailure == null) firstFailure = error
        }
    }

    if (byId.isEmpty()) {
        firstFailure?.let { throw it }
    }

    return skusList.mapNotNull { byId[it] }
}
