package dev.hyo.capacitoriap

import org.junit.Assert.assertEquals
import org.junit.Test

class PendingRequestsTest {
    @Test
    fun settlesEachWaitingRequestOnce() {
        val requests = PendingRequests<String>()
        requests.add("first")
        requests.add("second")
        val settled = mutableListOf<String>()

        requests.settleAll { settled += "result:$it" }
        // The error event that follows the result finds nothing left to reject.
        requests.settleAll { settled += "error:$it" }

        assertEquals(listOf("result:first", "result:second"), settled)
    }

    @Test
    fun aRequestAddedLaterWaitsForTheNextOutcome() {
        val requests = PendingRequests<String>()
        requests.settleAll { error("nothing is pending") }
        requests.add("next")
        val settled = mutableListOf<String>()

        requests.settleAll { settled += it }

        assertEquals(listOf("next"), settled)
    }
}
