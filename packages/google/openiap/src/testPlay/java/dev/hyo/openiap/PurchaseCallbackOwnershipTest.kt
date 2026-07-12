package dev.hyo.openiap

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class PurchaseCallbackOwnershipTest {
    private data class PendingPurchase(val client: Any)

    @Test
    fun `stale client cannot claim a replacement client purchase`() {
        val lock = Any()
        val staleClient = Any()
        val currentClient = Any()
        val owner = PendingPurchase(currentClient)
        var pending: PendingPurchase? = owner

        val staleClaim = claimPendingPurchaseIfOwned(
            lock,
            current = { pending },
            owns = { it.client === staleClient },
            clear = { pending = null },
        )

        assertNull(staleClaim)
        assertSame(owner, pending)
        assertSame(
            owner,
            claimPendingPurchaseIfOwned(
                lock,
                current = { pending },
                owns = { it.client === currentClient },
                clear = { pending = null },
            ),
        )
        assertNull(pending)
    }

    @Test
    fun `concurrent terminal claims have one winner`() {
        val lock = Any()
        val client = Any()
        var pending: PendingPurchase? = PendingPurchase(client)
        val start = CountDownLatch(1)
        val done = CountDownLatch(2)
        val winners = AtomicInteger(0)

        repeat(2) {
            thread {
                start.await()
                if (claimPendingPurchaseIfOwned(
                        lock,
                        current = { pending },
                        owns = { it.client === client },
                        clear = { pending = null },
                    ) != null
                ) {
                    winners.incrementAndGet()
                }
                done.countDown()
            }
        }

        start.countDown()
        assertTrue(done.await(5, TimeUnit.SECONDS))
        assertEquals(1, winners.get())
        assertNull(pending)
    }
}
