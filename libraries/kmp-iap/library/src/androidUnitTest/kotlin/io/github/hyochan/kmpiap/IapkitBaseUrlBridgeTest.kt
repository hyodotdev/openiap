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
}
