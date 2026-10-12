package io.github.hyochan.kmpiap

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class IosVersionGuardTest {
    @Test
    fun `the guard compares against the running system version`() {
        assertTrue(isAtLeastIOS(15))
        assertTrue(isAtLeastIOS(1, 0))
        assertFalse(isAtLeastIOS(999))
    }
}
