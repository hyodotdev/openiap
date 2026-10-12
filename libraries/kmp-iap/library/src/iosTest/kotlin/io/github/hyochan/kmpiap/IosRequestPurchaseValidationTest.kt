package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ErrorCode
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import io.github.hyochan.kmpiap.openiap.RequestPurchaseAndroidProps
import io.github.hyochan.kmpiap.openiap.RequestPurchaseProps
import io.github.hyochan.kmpiap.openiap.RequestPurchasePropsByPlatforms
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class IosRequestPurchaseValidationTest {
    @Test
    fun `a request without an iOS SKU fails with a typed error it also reports`() = runTest {
        val iap = InAppPurchaseIOS()
        val reported = async(start = CoroutineStart.UNDISPATCHED) { iap.purchaseErrorListener.first() }

        val failure = assertFailsWith<PurchaseException> {
            iap.requestPurchase(
                RequestPurchaseProps(
                    request = RequestPurchaseProps.Request.Purchase(
                        RequestPurchasePropsByPlatforms(google = RequestPurchaseAndroidProps(skus = listOf("premium")))
                    ),
                    type = ProductQueryType.InApp,
                )
            )
        }

        assertEquals(ErrorCode.EmptySkuList, failure.error.code)
        assertEquals(failure.error, reported.await())
    }
}
