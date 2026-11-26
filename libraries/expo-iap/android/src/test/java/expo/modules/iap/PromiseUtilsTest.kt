package expo.modules.iap

import expo.modules.kotlin.Promise
import org.junit.Assert.assertEquals
import org.junit.Test

class PromiseUtilsTest {
    private class RecordingPromise : Promise {
        val outcomes = mutableListOf<String>()

        override fun resolve(value: Any?) {
            outcomes += "resolved"
        }

        override fun reject(
            code: String?,
            message: String?,
            cause: Throwable?,
        ) {
            outcomes += "rejected:$code"
        }
    }

    @Test
    fun `a refused double tap rejects only its own promise`() {
        val inFlight = RecordingPromise()
        val refused = RecordingPromise()
        ExpoIapHelper.addPurchasePromise(inFlight)
        ExpoIapHelper.addPurchasePromise(refused)

        ExpoIapHelper.rejectPurchasePromise(refused, "purchase-in-progress", "Another purchase is already in progress")
        ExpoIapHelper.resolvePurchasePromises(emptyList())

        assertEquals(listOf("resolved"), inFlight.outcomes)
        assertEquals(listOf("rejected:purchase-in-progress"), refused.outcomes)
    }

    @Test
    fun `only a refused double tap leaves pending purchases alone`() {
        val inFlight = RecordingPromise()
        ExpoIapHelper.addPurchasePromise(inFlight)

        ExpoIapHelper.rejectPendingPurchases(mapOf("code" to "purchase-in-progress", "message" to "Another purchase is already in progress"))
        assertEquals(emptyList<String>(), inFlight.outcomes)

        ExpoIapHelper.rejectPendingPurchases(mapOf("code" to "user-cancelled", "message" to "Cancelled"))
        assertEquals(listOf("rejected:user-cancelled"), inFlight.outcomes)
    }
}
