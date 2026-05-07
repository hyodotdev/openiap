package com.margelo.nitro.iap

import dev.hyo.openiap.ProductCommon
import dev.hyo.openiap.ProductQueryType
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

internal suspend fun collectAllQueryProducts(
    skusList: List<String>,
    fetchKind: suspend (ProductQueryType) -> List<ProductCommon>,
    onFailure: (ProductQueryType, Throwable) -> Unit = { _, _ -> },
): List<ProductCommon> = coroutineScope {
    val byId = linkedMapOf<String, ProductCommon>()
    var firstFailure: Throwable? = null

    val queries = listOf(ProductQueryType.InApp, ProductQueryType.Subs).map { kind ->
        kind to async {
            runCatching {
                fetchKind(kind)
            }
        }
    }

    queries.forEach { (kind, query) ->
        query.await().onSuccess { fetched ->
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

    skusList.mapNotNull { byId[it] }
}
