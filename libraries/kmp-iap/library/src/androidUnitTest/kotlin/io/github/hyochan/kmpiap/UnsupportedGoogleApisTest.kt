package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.ErrorCode
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class UnsupportedGoogleApisTest {
    @Test
    fun `non-Play stores reject Google in-app messages and unsupported event resolvers without waiting`() = runTest {
        for ((storeName, store) in listOf(
            "amazon" to Store.AMAZON,
            "horizon" to Store.PLAY_STORE,
        )) {
            val implementation = AmazonInAppPurchaseAndroid(
                storeName = storeName,
                store = store,
                versionPlatform = "Android $storeName",
            )

            val operations: List<suspend () -> Any?> = listOf(
                { implementation.showInAppMessagesAndroid(null) },
                { implementation.userChoiceBillingAndroid() },
                { implementation.developerProvidedBillingAndroid() },
                { implementation.subscriptionBillingIssue() },
            )

            for (operation in operations) {
                val error = assertFailsWith<PurchaseException> {
                    operation()
                }
                assertEquals(ErrorCode.FeatureNotSupported, error.error.code)
            }
        }
    }
}
