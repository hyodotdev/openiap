package io.github.hyochan.flutter_inapp_purchase

import dev.hyo.openiap.InAppMessageCategoryAndroid
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class InAppMessageParamsValidationTest {
    @Test
    fun `known message categories are accepted`() {
        val params = validateFlutterInAppMessageParams(listOf("transactional"))

        assertEquals(InAppMessageCategoryAndroid.Transactional, params.categories?.single())
    }

    @Test
    fun `malformed message categories are rejected atomically`() {
        listOf(
            listOf("future-category"),
            listOf(999),
            "transactional",
        ).forEach { categories ->
            assertThrows(IllegalArgumentException::class.java) {
                validateFlutterInAppMessageParams(categories)
            }
        }
    }
}
