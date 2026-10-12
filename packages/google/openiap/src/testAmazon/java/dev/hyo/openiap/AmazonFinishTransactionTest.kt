package dev.hyo.openiap

import android.content.ContextWrapper
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Test

class AmazonFinishTransactionTest {

    @Test
    fun `a fulfillment failure surfaces as an OpenIapError like the other stores`() = runBlocking {
        // A context without a base makes Appstore SDK registration throw.
        val module = OpenIapModule(ContextWrapper(null))

        val thrown = runCatching {
            module.finishTransaction(
                buildAmazonPurchase(
                    packageName = "dev.hyo.martie",
                    receiptId = "receipt-1",
                    receiptSku = "coins",
                    isSubscription = false,
                    purchaseDateMillis = 1_700_000_000_000.0,
                    isCanceled = false,
                    isDeferred = false,
                ),
                true,
            )
        }.exceptionOrNull()

        assertTrue("finishTransaction must throw OpenIapError, got $thrown", thrown is OpenIapError)
    }
}
