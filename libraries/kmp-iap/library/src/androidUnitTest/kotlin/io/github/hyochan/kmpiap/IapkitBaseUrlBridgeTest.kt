package io.github.hyochan.kmpiap

import java.io.File
import kotlin.test.Test
import kotlin.test.assertTrue

class IapkitBaseUrlBridgeTest {
    @Test
    fun playBridgeForwardsBaseUrlToOpenIap() {
        val source = File(
            "src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt"
        ).readText()

        assertTrue(source.contains("baseUrl = iapkitOptions.baseUrl"))
    }

    @Test
    fun platformBridgesPreserveAmazonVerificationFields() {
        val androidSource = File(
            "src/androidMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseAndroid.kt"
        ).readText()
        val iosSource = File(
            "src/iosMain/kotlin/io/github/hyochan/kmpiap/InAppPurchaseIOS.kt"
        ).readText()

        assertTrue(androidSource.contains("expectedProductId = amazon.expectedProductId"))
        assertTrue(androidSource.contains("environment = androidResult.environment"))
        assertTrue(iosSource.contains("environment = environment"))
        assertTrue(iosSource.contains("\"Sandbox\", \"Production\""))
    }
}
