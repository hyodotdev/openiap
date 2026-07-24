package dev.hyo.openiap

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class OpenIapLogCompatibilityTest {
    private val entries = mutableListOf<Triple<OpenIapLog.Level, String, Throwable?>>()

    @Before
    fun setUp() {
        OpenIapLog.enable(true)
        OpenIapLog.setHandler { level, message, throwable ->
            entries += Triple(level, message, throwable)
        }
    }

    @After
    fun tearDown() {
        OpenIapLog.setHandler(null)
        OpenIapLog.enable(false)
    }

    @Suppress("DEPRECATION")
    @Test
    fun `Android Log aliases delegate to canonical levels`() {
        val throwable = IllegalStateException("boom")

        OpenIapLog.d("debug", "Test")
        OpenIapLog.i("info", "Test")
        OpenIapLog.w("warn", "Test")
        OpenIapLog.e("error", throwable, "Test")

        assertEquals(
            listOf(
                Triple(OpenIapLog.Level.Debug, "debug", null),
                Triple(OpenIapLog.Level.Info, "info", null),
                Triple(OpenIapLog.Level.Warn, "warn", null),
                Triple(OpenIapLog.Level.Error, "error", throwable),
            ),
            entries,
        )
    }
}
