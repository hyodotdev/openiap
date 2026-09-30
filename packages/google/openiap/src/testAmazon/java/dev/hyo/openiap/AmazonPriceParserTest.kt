package dev.hyo.openiap

import java.util.Locale
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class AmazonPriceParserTest {
    private lateinit var defaultLocale: Locale

    @Before
    fun setUp() {
        defaultLocale = Locale.getDefault()
        Locale.setDefault(Locale.US)
    }

    @After
    fun tearDown() {
        Locale.setDefault(defaultLocale)
    }

    @Test
    fun parsesInternationalFormattedPrices() {
        val cases = mapOf(
            "\$1,234.56" to 1234.56,
            "\$1,234" to 1234.0,
            "1.234,56 €" to 1234.56,
            "1 234,56 руб" to 1234.56,
            "JPY 1,000" to 1000.0,
            "¥1000" to 1000.0,
            "TND 1.234" to 1.234
        )

        for ((displayPrice, expected) in cases) {
            assertEquals(
                displayPrice,
                expected,
                AmazonPriceParser.toPriceAmount(displayPrice),
                0.0001
            )
        }
    }

    @Test
    fun readsThePriceWhateverTheDeviceLocale() {
        // The store formats a price for its marketplace, not for the device.
        val locales = listOf("en-US", "de-DE", "es-CL", "en-IE").map(Locale::forLanguageTag)
        for (locale in locales) {
            Locale.setDefault(locale)
            for ((displayPrice, expected) in mapOf(
                "9,99 €" to 9.99,
                "€9,99" to 9.99,
                "\$9.99" to 9.99,
                "12.50" to 12.5,
            )) {
                assertEquals(
                    "$locale $displayPrice",
                    expected,
                    AmazonPriceParser.toPriceAmount(displayPrice),
                    0.0001
                )
            }
        }
    }
}
