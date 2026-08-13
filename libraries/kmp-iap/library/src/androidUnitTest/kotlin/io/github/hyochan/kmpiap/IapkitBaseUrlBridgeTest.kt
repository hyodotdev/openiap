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

        val helperSource = File(
            "src/androidMain/kotlin/io/github/hyochan/kmpiap/Helper.kt"
        ).readText()

        assertTrue(androidSource.contains("expectedProductId = amazon.expectedProductId"))
        assertTrue(androidSource.contains("androidResult.toKmpIapkitResult()"))
        assertTrue(helperSource.contains("environment = environment"))
        // Unknown values degrade; openiap-google already decoded them safely.
        assertTrue(helperSource.contains("getOrDefault(IapkitPurchaseState.Unknown)"))
        assertTrue(iosSource.contains("environment = environment"))
        // Forwarded opaquely: `environment` is String in the spec.
        assertTrue(iosSource.contains("map[\"environment\"] as? String"))
    }
}
