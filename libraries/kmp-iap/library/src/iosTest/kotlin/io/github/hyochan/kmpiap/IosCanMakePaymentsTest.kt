package io.github.hyochan.kmpiap

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlin.test.Test
import kotlin.test.assertFalse

@OptIn(ExperimentalCoroutinesApi::class)
class IosCanMakePaymentsTest {
    // Screen Time restrictions cannot be set on the simulator; this covers the connection half.
    @Test
    fun `payments are unavailable before the store connects`() = runTest {
        Dispatchers.setMain(UnconfinedTestDispatcher(testScheduler))
        try {
            assertFalse(InAppPurchaseIOS().canMakePayments())
        } finally {
            Dispatchers.resetMain()
        }
    }
}
