package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ErrorCode
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class UnsupportedGoogleApisTest {
    @Test
    fun `non-Play stores reject Google in-app messages`() = runTest {
        for ((storeName, store) in listOf(
            "amazon" to Store.AMAZON,
            "horizon" to Store.PLAY_STORE,
        )) {
            val implementation = AmazonInAppPurchaseAndroid(
                storeName = storeName,
                store = store,
                versionPlatform = "Android $storeName",
            )

            val error = assertFailsWith<PurchaseException> {
                implementation.showInAppMessagesAndroid(null)
            }

            assertEquals(ErrorCode.FeatureNotSupported, error.error.code)
        }
    }
}
