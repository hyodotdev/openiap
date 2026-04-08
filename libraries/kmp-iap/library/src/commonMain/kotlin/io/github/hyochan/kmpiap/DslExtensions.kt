package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.PurchaseException
import io.github.hyochan.kmpiap.dsl.PurchaseRequestBuilder
import io.github.hyochan.kmpiap.dsl.ProductsRequestBuilder
import io.github.hyochan.kmpiap.openiap.FetchProductsResult
import io.github.hyochan.kmpiap.openiap.FetchProductsResultAll
import io.github.hyochan.kmpiap.openiap.FetchProductsResultProducts
import io.github.hyochan.kmpiap.openiap.FetchProductsResultSubscriptions
import io.github.hyochan.kmpiap.openiap.ProductOrSubscription
import io.github.hyochan.kmpiap.openiap.Product
import io.github.hyochan.kmpiap.openiap.ProductAndroid
import io.github.hyochan.kmpiap.openiap.ProductIOS
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.ProductRequest
import io.github.hyochan.kmpiap.openiap.ProductSubscription
import io.github.hyochan.kmpiap.openiap.ProductSubscriptionAndroid
import io.github.hyochan.kmpiap.openiap.ProductSubscriptionIOS
import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseError
import io.github.hyochan.kmpiap.openiap.PurchaseInput
import io.github.hyochan.kmpiap.openiap.QueryResolver
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResult
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResultPurchase
import io.github.hyochan.kmpiap.openiap.RequestPurchaseResultPurchases

/**
 * Fetch products using DSL
 *
 * Example:
 * ```kotlin
 * val products = kmpIapInstance.fetchProducts {
 *     skus = listOf("product1", "product2")
 *     type = ProductType.InApp
 * }
 * ```
 */
suspend fun KmpInAppPurchase.fetchProducts(
    builder: ProductsRequestBuilder.() -> Unit
): List<Product> {
    val requestBuilder = ProductsRequestBuilder().apply(builder)
    val (skus, type) = requestBuilder.build()
    val result = (this as QueryResolver).fetchProducts(ProductRequest(skus, type ?: ProductQueryType.All))
    return result.asProductList()
}

/**
 * Request purchase using DSL
 * 
 * Example:
 * ```kotlin
 * val purchase = kmpIapInstance.requestPurchase {
 *     ios {
 *         sku = "product_id"
 *         quantity = 1
 *     }
 *     android {
 *         skus = listOf("product_id")
 *     }
 * }
 * ```
 */
suspend fun KmpInAppPurchase.requestPurchase(
    builder: PurchaseRequestBuilder.() -> Unit
): Purchase {
    val requestBuilder = PurchaseRequestBuilder().apply(builder)
    val request = requestBuilder.build()
    return requestPurchase(request).extractPurchase()
}

private fun FetchProductsResult.asProductList(): List<Product> = when (this) {
    is FetchProductsResultProducts -> value.orEmpty()
    is FetchProductsResultSubscriptions -> value.orEmpty().mapNotNull(ProductSubscription::toProduct)
    is FetchProductsResultAll -> value.orEmpty().mapNotNull { productOrSubscription ->
        when (productOrSubscription) {
            is ProductOrSubscription.ProductItem -> productOrSubscription.value
            is ProductOrSubscription.ProductSubscriptionItem -> productOrSubscription.value.toProduct()
        }
    }
}

private fun RequestPurchaseResult?.extractPurchase(): Purchase {
    return when (this) {
        is RequestPurchaseResultPurchase -> value ?: failToFindPurchase()
        is RequestPurchaseResultPurchases -> value?.firstOrNull() ?: failToFindPurchase()
        null -> failToFindPurchase()
    }
}

private fun RequestPurchaseResult?.failToFindPurchase(): Nothing =
    throw PurchaseException(
        PurchaseError(
            code = io.github.hyochan.kmpiap.openiap.ErrorCode.Unknown,
            message = "Request purchase returned no purchase result"
        )
    )

fun Purchase.toPurchaseInput(): PurchaseInput = this

private fun ProductSubscription.toProduct(): Product = when (this) {
    is ProductSubscriptionAndroid -> ProductAndroid(
        currency = currency,
        debugDescription = debugDescription,
        description = description,
        displayName = displayName,
        displayPrice = displayPrice,
        id = id,
        nameAndroid = nameAndroid,
        oneTimePurchaseOfferDetailsAndroid = oneTimePurchaseOfferDetailsAndroid,
        platform = platform,
        price = price,
        subscriptionOfferDetailsAndroid = subscriptionOfferDetailsAndroid,
        title = title,
        type = type
    )
    is ProductSubscriptionIOS -> ProductIOS(
        currency = currency,
        debugDescription = debugDescription,
        description = description,
        displayName = displayName,
        displayNameIOS = displayNameIOS,
        displayPrice = displayPrice,
        id = id,
        isFamilyShareableIOS = isFamilyShareableIOS,
        jsonRepresentationIOS = jsonRepresentationIOS,
        platform = platform,
        price = price,
        subscriptionInfoIOS = subscriptionInfoIOS,
        title = title,
        type = type,
        typeIOS = typeIOS
    )
}
