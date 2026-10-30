package io.github.hyochan.kmpiap

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class IapkitAmazonCompatibilityTest {
    @Test
    fun retainsPublishedConstructorsAndCallForms() {
        val constructors = IapkitConfirmationOptions.Amazon::class.java.constructors
            .map { constructor -> constructor.parameterTypes.map { it.name } }
        // Published 4.2.0 JVM descriptors, including Kotlin's default bridge.
        assertTrue(emptyList<String>() in constructors)
        assertTrue(listOf("boolean", "kotlin.jvm.functions.Function1") in constructors)
        assertTrue(listOf(
            "boolean", "kotlin.jvm.functions.Function1", "int",
            "kotlin.jvm.internal.DefaultConstructorMarker",
        ) in constructors)

        val defaults = IapkitConfirmationOptions.Amazon()
        val positional = IapkitConfirmationOptions.Amazon(true, { "base:$it" })
        val trailing = IapkitConfirmationOptions.Amazon { "base:$it" }
        val named = IapkitConfirmationOptions.Amazon(verifiedProductId = { "base:$it" })
        assertEquals(false, defaults.sandbox)
        assertEquals(null, defaults.expectedEnvironment)
        assertEquals(true, positional.sandbox)
        for (option in listOf(positional, trailing, named)) {
            assertEquals("base:term", option.verifiedProductId("term"))
        }
        val lat = IapkitConfirmationOptions.Amazon(expectedEnvironment = "Sandbox")
        assertEquals(false, lat.sandbox)
        assertEquals("Sandbox", lat.expectedEnvironment)
    }
}
