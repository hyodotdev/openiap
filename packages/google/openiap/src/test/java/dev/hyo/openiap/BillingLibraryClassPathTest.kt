package dev.hyo.openiap

import com.android.billingclient.api.BillingClient
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.util.Locale

/**
 * Tests to verify that reflection-based class paths still used in OpenIapModule
 * match the actual Google Play Billing Library class structure.
 *
 * IMPORTANT: Every Class.forName() and getMethod() call in OpenIapModule.kt
 * should have a corresponding test here to catch API changes early.
 */
class BillingLibraryClassPathTest {

    // ============================================================================
    // MARK: - SubscriptionUpdateParams (legacy)
    // Used for backwards compatibility
    // ============================================================================

    @Test
    fun `SubscriptionUpdateParams class exists for legacy support`() {
        assertClassExists(
            "com.android.billingclient.api.BillingFlowParams\$SubscriptionUpdateParams",
            "any version"
        )
    }

    @Test
    fun `SubscriptionUpdateParams Builder supports external transaction replacement`() {
        assertClassHasMethod(
            "com.android.billingclient.api.BillingFlowParams\$SubscriptionUpdateParams\$Builder",
            "setOriginalExternalTransactionId",
            String::class.java
        )
    }

    // ============================================================================
    // MARK: - AlternativeBillingOnlyAvailabilityListener (Billing Library 6.0+)
    // Used in: OpenIapModule.checkAlternativeBillingAvailability()
    // ============================================================================

    @Test
    fun `AlternativeBillingOnlyAvailabilityListener class exists`() {
        assertClassExists(
            "com.android.billingclient.api.AlternativeBillingOnlyAvailabilityListener",
            "6.0+"
        )
    }

    @Test
    fun `AlternativeBillingOnlyAvailabilityListener has callback method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.AlternativeBillingOnlyAvailabilityListener",
            "onAlternativeBillingOnlyAvailabilityResponse",
            com.android.billingclient.api.BillingResult::class.java
        )
    }

    // ============================================================================
    // MARK: - AlternativeBillingOnlyInformationDialogListener (Billing Library 6.0+)
    // Used in: OpenIapModule.showAlternativeBillingInformationDialog()
    // ============================================================================

    @Test
    fun `AlternativeBillingOnlyInformationDialogListener class exists`() {
        assertClassExists(
            "com.android.billingclient.api.AlternativeBillingOnlyInformationDialogListener",
            "6.0+"
        )
    }

    @Test
    fun `AlternativeBillingOnlyInformationDialogListener has callback method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.AlternativeBillingOnlyInformationDialogListener",
            "onAlternativeBillingOnlyInformationDialogResponse",
            com.android.billingclient.api.BillingResult::class.java
        )
    }

    // ============================================================================
    // MARK: - AlternativeBillingOnlyReportingDetailsListener (Billing Library 6.0+)
    // Used in: OpenIapModule.createAlternativeBillingReportingToken()
    // ============================================================================

    @Test
    fun `AlternativeBillingOnlyReportingDetailsListener class exists`() {
        assertClassExists(
            "com.android.billingclient.api.AlternativeBillingOnlyReportingDetailsListener",
            "6.0+"
        )
    }

    @Test
    fun `AlternativeBillingOnlyReportingDetailsListener has callback method`() {
        // The callback receives BillingResult and AlternativeBillingOnlyReportingDetails
        val listenerClass = Class.forName("com.android.billingclient.api.AlternativeBillingOnlyReportingDetailsListener")
        val methods = listenerClass.methods.filter { it.name == "onAlternativeBillingOnlyTokenResponse" }
        assertTrue(
            "onAlternativeBillingOnlyTokenResponse method should exist",
            methods.isNotEmpty()
        )
    }

    // ============================================================================
    // MARK: - BillingProgramAvailabilityListener (Billing Library 7.0+/8.2.0+)
    // Used in: OpenIapModule.isBillingProgramAvailable()
    // ============================================================================

    @Test
    fun `BillingProgramAvailabilityListener class exists`() {
        assertClassExists(
            "com.android.billingclient.api.BillingProgramAvailabilityListener",
            "7.0+"
        )
    }

    @Test
    fun `BillingProgramAvailabilityListener has callback method`() {
        // Callback receives (BillingResult, BillingProgramAvailabilityDetails)
        val listenerClass = Class.forName("com.android.billingclient.api.BillingProgramAvailabilityListener")
        val methods = listenerClass.declaredMethods.filter { it.name == "onBillingProgramAvailabilityResponse" }
        assertTrue(
            "onBillingProgramAvailabilityResponse method should exist",
            methods.isNotEmpty()
        )
        // Verify it has 2 parameters
        val method = methods.first()
        assertTrue(
            "onBillingProgramAvailabilityResponse should have 2 parameters (BillingResult, BillingProgramAvailabilityDetails)",
            method.parameterTypes.size == 2
        )
    }

    @Test
    fun `BillingProgramAvailabilityDetails exposes Billing Choice details`() {
        assertClassHasMethod(
            "com.android.billingclient.api.BillingProgramAvailabilityDetails",
            "getBillingChoiceAvailabilityDetails"
        )
        assertClassHasMethod(
            "com.android.billingclient.api.BillingProgramAvailabilityDetails\$BillingChoiceAvailabilityDetails",
            "getChoiceScreenType"
        )
        assertClassHasMethod(
            "com.android.billingclient.api.BillingProgramAvailabilityDetails\$BillingChoiceAvailabilityDetails",
            "isExternalLinkAvailable"
        )
        assertClassExists(
            "com.android.billingclient.api.BillingProgramAvailabilityDetails\$BillingChoiceAvailabilityDetails\$ChoiceScreenType",
            "9.1.0+"
        )
    }

    // ============================================================================
    // MARK: - BillingProgramReportingDetailsListener (Billing Library 8.3.0+)
    // Used in: OpenIapModule.createBillingProgramReportingDetails()
    // Note: Requires BillingProgramReportingDetailsParams in 8.3.0+
    // ============================================================================

    @Test
    fun `BillingProgramReportingDetailsListener class exists`() {
        assertClassExists(
            "com.android.billingclient.api.BillingProgramReportingDetailsListener",
            "8.3.0+"
        )
    }

    @Test
    fun `BillingProgramReportingDetailsListener has callback method`() {
        // The callback receives (BillingResult, BillingProgramReportingDetails)
        // Note: Actual method name is onCreateBillingProgramReportingDetailsResponse
        val listenerClass = Class.forName("com.android.billingclient.api.BillingProgramReportingDetailsListener")
        val methods = listenerClass.declaredMethods.filter { it.name == "onCreateBillingProgramReportingDetailsResponse" }
        assertTrue(
            "onCreateBillingProgramReportingDetailsResponse method should exist",
            methods.isNotEmpty()
        )
    }

    @Test
    fun `BillingProgramReportingDetailsParams class exists`() {
        // Required parameter for createBillingProgramReportingDetailsAsync in 8.3.0+
        assertClassExists(
            "com.android.billingclient.api.BillingProgramReportingDetailsParams",
            "8.3.0+"
        )
    }

    @Test
    fun `BillingProgramReportingDetailsParams Builder class exists`() {
        assertClassExists(
            "com.android.billingclient.api.BillingProgramReportingDetailsParams\$Builder",
            "8.3.0+"
        )
    }

    @Test
    fun `BillingProgramReportingDetailsParams has newBuilder method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.BillingProgramReportingDetailsParams",
            "newBuilder"
        )
    }

    @Test
    fun `BillingProgramReportingDetailsParams Builder has setBillingProgram method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.BillingProgramReportingDetailsParams\$Builder",
            "setBillingProgram",
            Int::class.javaPrimitiveType!!
        )
    }

    @Test
    fun `BillingProgramReportingDetailsParams Builder has setDeveloperBillingType method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.BillingProgramReportingDetailsParams\$Builder",
            "setDeveloperBillingType",
            Int::class.javaPrimitiveType!!
        )
    }

    @Test
    fun `BillingProgramReportingDetailsParams DeveloperBillingType annotation exists`() {
        assertClassExists(
            "com.android.billingclient.api.BillingProgramReportingDetailsParams\$DeveloperBillingType",
            "9.1.0+"
        )
    }

    @Test
    fun `BillingProgramReportingDetailsParams Builder has build method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.BillingProgramReportingDetailsParams\$Builder",
            "build"
        )
    }

    // ============================================================================
    // MARK: - LaunchExternalLinkParams (Billing Library 6.0+/8.2.0+)
    // Used in: OpenIapModule.launchExternalLink()
    // ============================================================================

    @Test
    fun `LaunchExternalLinkParams class exists`() {
        assertClassExists(
            "com.android.billingclient.api.LaunchExternalLinkParams",
            "6.0+"
        )
    }

    @Test
    fun `LaunchExternalLinkParams Builder class exists`() {
        assertClassExists(
            "com.android.billingclient.api.LaunchExternalLinkParams\$Builder",
            "6.0+"
        )
    }

    @Test
    fun `LaunchExternalLinkParams has newBuilder method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.LaunchExternalLinkParams",
            "newBuilder"
        )
    }

    @Test
    fun `LaunchExternalLinkParams Builder has setBillingProgram method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.LaunchExternalLinkParams\$Builder",
            "setBillingProgram",
            Int::class.javaPrimitiveType!!
        )
    }

    @Test
    fun `LaunchExternalLinkParams Builder has setLaunchMode method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.LaunchExternalLinkParams\$Builder",
            "setLaunchMode",
            Int::class.javaPrimitiveType!!
        )
    }

    @Test
    fun `LaunchExternalLinkParams Builder has setLinkType method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.LaunchExternalLinkParams\$Builder",
            "setLinkType",
            Int::class.javaPrimitiveType!!
        )
    }

    @Test
    fun `LaunchExternalLinkParams Builder has setLinkUri method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.LaunchExternalLinkParams\$Builder",
            "setLinkUri",
            android.net.Uri::class.java
        )
    }

    @Test
    fun `LaunchExternalLinkParams Builder supports Billing Choice transaction token`() {
        assertClassHasMethod(
            "com.android.billingclient.api.LaunchExternalLinkParams\$Builder",
            "setExternalTransactionToken",
            String::class.java
        )
    }

    @Test
    fun `LaunchExternalLinkParams Builder has build method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.LaunchExternalLinkParams\$Builder",
            "build"
        )
    }

    // ============================================================================
    // MARK: - LaunchExternalLinkResponseListener (Billing Library 6.0+)
    // Used in: OpenIapModule.launchExternalLink()
    // ============================================================================

    @Test
    fun `LaunchExternalLinkResponseListener class exists`() {
        assertClassExists(
            "com.android.billingclient.api.LaunchExternalLinkResponseListener",
            "6.0+"
        )
    }

    @Test
    fun `LaunchExternalLinkResponseListener has callback method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.LaunchExternalLinkResponseListener",
            "onLaunchExternalLinkResponse",
            com.android.billingclient.api.BillingResult::class.java
        )
    }

    // ============================================================================
    // MARK: - Billing Choice info and information dialog (Billing Library 9.1.0+)
    // Used in: OpenIapModule.getBillingChoiceInfo() and showBillingProgramInformationDialog()
    // ============================================================================

    @Test
    fun `GetBillingChoiceInfoParams class path and builder methods exist`() {
        assertClassExists("com.android.billingclient.api.GetBillingChoiceInfoParams", "9.1.0+")
        assertClassExists("com.android.billingclient.api.GetBillingChoiceInfoParams\$Builder", "9.1.0+")
        assertClassExists("com.android.billingclient.api.GetBillingChoiceInfoParams\$ImageLayout", "9.1.0+")
        assertClassHasMethod("com.android.billingclient.api.GetBillingChoiceInfoParams", "newBuilder")
        assertClassHasMethod(
            "com.android.billingclient.api.GetBillingChoiceInfoParams\$Builder",
            "setBillingProgram",
            Int::class.javaPrimitiveType!!
        )
        assertClassHasMethod(
            "com.android.billingclient.api.GetBillingChoiceInfoParams\$Builder",
            "setPlayBillingChoiceImageLayout",
            String::class.java
        )
        assertClassHasMethod(
            "com.android.billingclient.api.GetBillingChoiceInfoParams\$Builder",
            "setUserLocale",
            Locale::class.java
        )
        assertClassHasMethod("com.android.billingclient.api.GetBillingChoiceInfoParams\$Builder", "build")
    }

    @Test
    fun `BillingChoiceInfo and listener methods exist`() {
        assertClassHasMethod(
            "com.android.billingclient.api.BillingChoiceInfo",
            "getPlayBillingChoiceImageUrl"
        )
        assertClassHasMethod(
            "com.android.billingclient.api.BillingChoiceInfo",
            "getPlayBillingLoyaltyInfo"
        )

        val listenerClass = Class.forName("com.android.billingclient.api.BillingChoiceInfoResponseListener")
        val methods = listenerClass.declaredMethods.filter { it.name == "onBillingChoiceInfoResponse" }
        assertTrue(
            "onBillingChoiceInfoResponse method should exist",
            methods.isNotEmpty()
        )
        assertTrue(
            "onBillingChoiceInfoResponse should have 2 parameters",
            methods.first().parameterTypes.size == 2
        )
    }

    @Test
    fun `EnableBillingProgramParams allows developer-rendered Billing Choice without listener`() {
        val paramsClass = Class.forName("com.android.billingclient.api.EnableBillingProgramParams")
        val builderClass = Class.forName("com.android.billingclient.api.EnableBillingProgramParams\$Builder")
        val builder = paramsClass.getMethod("newBuilder").invoke(null)

        builderClass.getMethod("setBillingProgram", Int::class.javaPrimitiveType)
            .invoke(builder, BillingClient.BillingProgram.BILLING_CHOICE)

        assertNotNull(builderClass.getMethod("build").invoke(builder))
    }

    @Test
    fun `BillingProgramInformationDialogParams class path and builder methods exist`() {
        assertClassExists("com.android.billingclient.api.BillingProgramInformationDialogParams", "9.1.0+")
        assertClassExists("com.android.billingclient.api.BillingProgramInformationDialogParams\$Builder", "9.1.0+")
        assertClassHasMethod("com.android.billingclient.api.BillingProgramInformationDialogParams", "newBuilder")
        assertClassHasMethod(
            "com.android.billingclient.api.BillingProgramInformationDialogParams\$Builder",
            "setBillingProgram",
            Int::class.javaPrimitiveType!!
        )
        assertClassHasMethod(
            "com.android.billingclient.api.BillingProgramInformationDialogParams\$Builder",
            "setExternalTransactionToken",
            String::class.java
        )
        assertClassHasMethod("com.android.billingclient.api.BillingProgramInformationDialogParams\$Builder", "build")
    }

    @Test
    fun `BillingProgramInformationDialogListener callback exists`() {
        assertClassHasMethod(
            "com.android.billingclient.api.BillingProgramInformationDialogListener",
            "onBillingProgramInformationDialogResponse",
            com.android.billingclient.api.BillingResult::class.java
        )
    }

    // ============================================================================
    // MARK: - In-app messages (Billing Library 4.1.0+)
    // Used in: OpenIapModule.showInAppMessages()
    // ============================================================================

    @Test
    fun `InAppMessageParams class path and builder methods exist`() {
        assertClassExists("com.android.billingclient.api.InAppMessageParams", "4.1.0+")
        assertClassExists("com.android.billingclient.api.InAppMessageParams\$Builder", "4.1.0+")
        assertClassHasMethod(
            "com.android.billingclient.api.InAppMessageParams\$Builder",
            "addInAppMessageCategoryToShow",
            Int::class.javaPrimitiveType!!
        )
        assertClassHasMethod(
            "com.android.billingclient.api.InAppMessageParams\$Builder",
            "addAllInAppMessageCategoriesToShow"
        )
        assertClassHasMethod("com.android.billingclient.api.InAppMessageParams\$Builder", "build")
    }

    @Test
    fun `InAppMessageResponseListener and result methods exist`() {
        assertClassHasMethod(
            "com.android.billingclient.api.InAppMessageResponseListener",
            "onInAppMessageResponse",
            com.android.billingclient.api.InAppMessageResult::class.java
        )
        assertClassHasMethod("com.android.billingclient.api.InAppMessageResult", "getResponseCode")
        assertClassHasMethod("com.android.billingclient.api.InAppMessageResult", "getPurchaseToken")
        assertClassExists(
            "com.android.billingclient.api.InAppMessageResult\$InAppMessageResponseCode",
            "4.1.0+"
        )
    }

    // ============================================================================
    // MARK: - UserChoiceBillingListener (Billing Library 5.0+)
    // Used in: OpenIapModule alternative billing mode USER_CHOICE
    // ============================================================================

    @Test
    fun `UserChoiceBillingListener class exists`() {
        assertClassExists(
            "com.android.billingclient.api.UserChoiceBillingListener",
            "5.0+"
        )
    }

    @Test
    fun `UserChoiceBillingListener has callback method`() {
        // The callback receives UserChoiceDetails
        val listenerClass = Class.forName("com.android.billingclient.api.UserChoiceBillingListener")
        val methods = listenerClass.methods.filter { it.name == "userSelectedAlternativeBilling" }
        assertTrue(
            "userSelectedAlternativeBilling method should exist",
            methods.isNotEmpty()
        )
    }

    // ============================================================================
    // MARK: - DeveloperProvidedBillingListener (Billing Library 8.3.0+)
    // Used in: OpenIapModule.enableExternalPaymentsProgram()
    // ============================================================================

    @Test
    fun `DeveloperProvidedBillingListener class exists`() {
        assertClassExists(
            "com.android.billingclient.api.DeveloperProvidedBillingListener",
            "8.3.0+"
        )
    }

    @Test
    fun `DeveloperProvidedBillingListener has callback method`() {
        // The callback receives DeveloperProvidedBillingDetails
        val listenerClass = Class.forName("com.android.billingclient.api.DeveloperProvidedBillingListener")
        val methods = listenerClass.methods.filter { it.name == "onUserSelectedDeveloperBilling" }
        assertTrue(
            "onUserSelectedDeveloperBilling method should exist",
            methods.isNotEmpty()
        )
    }

    @Test
    fun `DeveloperProvidedBillingDetails exposes Billing Choice fields`() {
        val className = "com.android.billingclient.api.DeveloperProvidedBillingDetails"
        assertClassHasMethod(className, "getExternalTransactionToken")
        assertClassHasMethod(className, "getLinkUri")
        assertClassHasMethod(className, "getOriginalExternalTransactionId")
        assertClassHasMethod(className, "getProducts")

        val productClassName =
            "com.android.billingclient.api.DeveloperProvidedBillingDetails\$Product"
        assertClassHasMethod(productClassName, "getId")
        assertClassHasMethod(productClassName, "getType")
        assertClassHasMethod(productClassName, "getOfferToken")
    }

    // ============================================================================
    // MARK: - EnableBillingProgramParams (Billing Library 8.3.0+)
    // Used in: OpenIapModule.enableExternalPaymentsProgram()
    // ============================================================================

    @Test
    fun `EnableBillingProgramParams class exists`() {
        assertClassExists(
            "com.android.billingclient.api.EnableBillingProgramParams",
            "8.3.0+"
        )
    }

    @Test
    fun `EnableBillingProgramParams Builder class exists`() {
        assertClassExists(
            "com.android.billingclient.api.EnableBillingProgramParams\$Builder",
            "8.3.0+"
        )
    }

    @Test
    fun `EnableBillingProgramParams has newBuilder method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.EnableBillingProgramParams",
            "newBuilder"
        )
    }

    @Test
    fun `EnableBillingProgramParams Builder has setBillingProgram method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.EnableBillingProgramParams\$Builder",
            "setBillingProgram",
            Int::class.javaPrimitiveType!!
        )
    }

    @Test
    fun `EnableBillingProgramParams Builder has setDeveloperProvidedBillingListener method`() {
        val builderClassName = "com.android.billingclient.api.EnableBillingProgramParams\$Builder"
        val listenerClassName = "com.android.billingclient.api.DeveloperProvidedBillingListener"

        try {
            val builderClass = Class.forName(builderClassName)
            val listenerClass = Class.forName(listenerClassName)
            val method = builderClass.getMethod("setDeveloperProvidedBillingListener", listenerClass)
            assertNotNull("setDeveloperProvidedBillingListener method should exist", method)
        } catch (e: ClassNotFoundException) {
            fail("Class not found: ${e.message}")
        } catch (e: NoSuchMethodException) {
            fail("setDeveloperProvidedBillingListener method not found. Requires Billing Library 8.3.0+")
        }
    }

    @Test
    fun `EnableBillingProgramParams Builder has build method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.EnableBillingProgramParams\$Builder",
            "build"
        )
    }

    // ============================================================================
    // MARK: - DeveloperBillingOptionParams (Billing Library 8.3.0+)
    // Used in: OpenIapModule.applyDeveloperBillingOption()
    // ============================================================================

    @Test
    fun `DeveloperBillingOptionParams class exists`() {
        assertClassExists(
            "com.android.billingclient.api.DeveloperBillingOptionParams",
            "8.3.0+"
        )
    }

    @Test
    fun `DeveloperBillingOptionParams Builder class exists`() {
        assertClassExists(
            "com.android.billingclient.api.DeveloperBillingOptionParams\$Builder",
            "8.3.0+"
        )
    }

    @Test
    fun `DeveloperBillingOptionParams has newBuilder method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.DeveloperBillingOptionParams",
            "newBuilder"
        )
    }

    @Test
    fun `DeveloperBillingOptionParams Builder has setBillingProgram method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.DeveloperBillingOptionParams\$Builder",
            "setBillingProgram",
            Int::class.javaPrimitiveType!!
        )
    }

    @Test
    fun `DeveloperBillingOptionParams Builder has setLinkUri method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.DeveloperBillingOptionParams\$Builder",
            "setLinkUri",
            android.net.Uri::class.java
        )
    }

    @Test
    fun `DeveloperBillingOptionParams Builder has setLaunchMode method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.DeveloperBillingOptionParams\$Builder",
            "setLaunchMode",
            Int::class.javaPrimitiveType!!
        )
    }

    @Test
    fun `DeveloperBillingOptionParams Builder has setExternalTransactionToken method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.DeveloperBillingOptionParams\$Builder",
            "setExternalTransactionToken",
            String::class.java
        )
    }

    @Test
    fun `DeveloperBillingOptionParams Builder has build method`() {
        assertClassHasMethod(
            "com.android.billingclient.api.DeveloperBillingOptionParams\$Builder",
            "build"
        )
    }

    // ============================================================================
    // MARK: - BillingFlowParams.Builder (for enableDeveloperBillingOption)
    // Used in: OpenIapModule.applyDeveloperBillingOption()
    // ============================================================================

    @Test
    fun `BillingFlowParams Builder has enableDeveloperBillingOption method`() {
        val builderClassName = "com.android.billingclient.api.BillingFlowParams\$Builder"
        val paramsClassName = "com.android.billingclient.api.DeveloperBillingOptionParams"

        try {
            val builderClass = Class.forName(builderClassName)
            val paramsClass = Class.forName(paramsClassName)
            val method = builderClass.getMethod("enableDeveloperBillingOption", paramsClass)
            assertNotNull("enableDeveloperBillingOption method should exist", method)
        } catch (e: ClassNotFoundException) {
            fail("Class not found: ${e.message}")
        } catch (e: NoSuchMethodException) {
            fail("enableDeveloperBillingOption method not found. Requires Billing Library 8.3.0+")
        }
    }

    // ============================================================================
    // MARK: - BillingClient.Builder (for enableUserChoiceBilling and enableBillingProgram)
    // Used in: OpenIapModule connection setup
    // ============================================================================

    @Test
    fun `BillingClient Builder class exists`() {
        assertClassExists(
            "com.android.billingclient.api.BillingClient\$Builder",
            "any version"
        )
    }

    @Test
    fun `BillingClient Builder has enableUserChoiceBilling method`() {
        val builderClassName = "com.android.billingclient.api.BillingClient\$Builder"
        val listenerClassName = "com.android.billingclient.api.UserChoiceBillingListener"

        try {
            val builderClass = Class.forName(builderClassName)
            val listenerClass = Class.forName(listenerClassName)
            val method = builderClass.getMethod("enableUserChoiceBilling", listenerClass)
            assertNotNull("enableUserChoiceBilling method should exist", method)
        } catch (e: ClassNotFoundException) {
            fail("Class not found: ${e.message}")
        } catch (e: NoSuchMethodException) {
            fail("enableUserChoiceBilling method not found. Requires Billing Library 5.0+")
        }
    }

    @Test
    fun `BillingClient Builder has enableBillingProgram method`() {
        val builderClassName = "com.android.billingclient.api.BillingClient\$Builder"
        val paramsClassName = "com.android.billingclient.api.EnableBillingProgramParams"

        try {
            val builderClass = Class.forName(builderClassName)
            val paramsClass = Class.forName(paramsClassName)
            val method = builderClass.getMethod("enableBillingProgram", paramsClass)
            assertNotNull("enableBillingProgram method should exist", method)
        } catch (e: ClassNotFoundException) {
            fail("Class not found: ${e.message}")
        } catch (e: NoSuchMethodException) {
            fail("enableBillingProgram method not found. Requires Billing Library 8.3.0+")
        }
    }

    // ============================================================================
    // MARK: - BillingClient methods (called via reflection)
    // ============================================================================

    @Test
    fun `BillingClient has isBillingProgramAvailableAsync method`() {
        val clientClassName = "com.android.billingclient.api.BillingClient"
        val listenerClassName = "com.android.billingclient.api.BillingProgramAvailabilityListener"

        try {
            val clientClass = Class.forName(clientClassName)
            val listenerClass = Class.forName(listenerClassName)
            val method = clientClass.getMethod(
                "isBillingProgramAvailableAsync",
                Int::class.javaPrimitiveType,
                listenerClass
            )
            assertNotNull("isBillingProgramAvailableAsync method should exist", method)
        } catch (e: ClassNotFoundException) {
            fail("Class not found: ${e.message}")
        } catch (e: NoSuchMethodException) {
            fail("isBillingProgramAvailableAsync method not found. Requires Billing Library 8.2.0+")
        }
    }

    @Test
    fun `BillingClient has createBillingProgramReportingDetailsAsync method`() {
        // Billing Library 8.3.0+: Takes (BillingProgramReportingDetailsParams, Listener)
        val clientClassName = "com.android.billingclient.api.BillingClient"
        val paramsClassName = "com.android.billingclient.api.BillingProgramReportingDetailsParams"
        val listenerClassName = "com.android.billingclient.api.BillingProgramReportingDetailsListener"

        try {
            val clientClass = Class.forName(clientClassName)
            val paramsClass = Class.forName(paramsClassName)
            val listenerClass = Class.forName(listenerClassName)
            val method = clientClass.getMethod(
                "createBillingProgramReportingDetailsAsync",
                paramsClass,
                listenerClass
            )
            assertNotNull("createBillingProgramReportingDetailsAsync method should exist", method)
        } catch (e: ClassNotFoundException) {
            fail("Class not found: ${e.message}")
        } catch (e: NoSuchMethodException) {
            fail("createBillingProgramReportingDetailsAsync(BillingProgramReportingDetailsParams, Listener) not found. Requires Billing Library 8.3.0+")
        }
    }

    @Test
    fun `BillingClient has getBillingChoiceInfoAsync method`() {
        val clientClassName = "com.android.billingclient.api.BillingClient"
        val paramsClassName = "com.android.billingclient.api.GetBillingChoiceInfoParams"
        val listenerClassName = "com.android.billingclient.api.BillingChoiceInfoResponseListener"

        try {
            val clientClass = Class.forName(clientClassName)
            val paramsClass = Class.forName(paramsClassName)
            val listenerClass = Class.forName(listenerClassName)
            val method = clientClass.getMethod("getBillingChoiceInfoAsync", paramsClass, listenerClass)
            assertNotNull("getBillingChoiceInfoAsync method should exist", method)
        } catch (e: ClassNotFoundException) {
            fail("Class not found: ${e.message}")
        } catch (e: NoSuchMethodException) {
            fail("getBillingChoiceInfoAsync(GetBillingChoiceInfoParams, Listener) not found. Requires Billing Library 9.1.0+")
        }
    }

    @Test
    fun `BillingClient has showBillingProgramInformationDialog method`() {
        val clientClassName = "com.android.billingclient.api.BillingClient"
        val paramsClassName = "com.android.billingclient.api.BillingProgramInformationDialogParams"
        val listenerClassName = "com.android.billingclient.api.BillingProgramInformationDialogListener"

        try {
            val clientClass = Class.forName(clientClassName)
            val paramsClass = Class.forName(paramsClassName)
            val listenerClass = Class.forName(listenerClassName)
            val method = clientClass.getMethod(
                "showBillingProgramInformationDialog",
                android.app.Activity::class.java,
                paramsClass,
                listenerClass
            )
            assertNotNull("showBillingProgramInformationDialog method should exist", method)
            assertEquals(Void.TYPE, method.returnType)
        } catch (e: ClassNotFoundException) {
            fail("Class not found: ${e.message}")
        } catch (e: NoSuchMethodException) {
            fail("showBillingProgramInformationDialog method not found. Requires Billing Library 9.1.0+")
        }
    }

    @Test
    fun `BillingClient has showInAppMessages method`() {
        val clientClassName = "com.android.billingclient.api.BillingClient"
        val paramsClassName = "com.android.billingclient.api.InAppMessageParams"
        val listenerClassName = "com.android.billingclient.api.InAppMessageResponseListener"

        try {
            val clientClass = Class.forName(clientClassName)
            val paramsClass = Class.forName(paramsClassName)
            val listenerClass = Class.forName(listenerClassName)
            val method = clientClass.getMethod(
                "showInAppMessages",
                android.app.Activity::class.java,
                paramsClass,
                listenerClass
            )
            assertNotNull("showInAppMessages method should exist", method)
            assertEquals(com.android.billingclient.api.BillingResult::class.java, method.returnType)
        } catch (e: ClassNotFoundException) {
            fail("Class not found: ${e.message}")
        } catch (e: NoSuchMethodException) {
            fail("showInAppMessages method not found. Requires Billing Library 4.1.0+")
        }
    }

    @Test
    fun `BillingClient has launchExternalLink method`() {
        val clientClassName = "com.android.billingclient.api.BillingClient"
        val paramsClassName = "com.android.billingclient.api.LaunchExternalLinkParams"
        val listenerClassName = "com.android.billingclient.api.LaunchExternalLinkResponseListener"

        try {
            val clientClass = Class.forName(clientClassName)
            val paramsClass = Class.forName(paramsClassName)
            val listenerClass = Class.forName(listenerClassName)
            val method = clientClass.getMethod(
                "launchExternalLink",
                android.app.Activity::class.java,
                paramsClass,
                listenerClass
            )
            assertNotNull("launchExternalLink method should exist", method)
        } catch (e: ClassNotFoundException) {
            fail("Class not found: ${e.message}")
        } catch (e: NoSuchMethodException) {
            fail("launchExternalLink method not found. Requires Billing Library 8.2.0+")
        }
    }

    // ============================================================================
    // MARK: - Core Billing Classes
    // ============================================================================

    @Test
    fun `BillingClient class exists`() {
        assertClassExists("com.android.billingclient.api.BillingClient", "any version")
    }

    @Test
    fun `BillingFlowParams class exists`() {
        assertClassExists("com.android.billingclient.api.BillingFlowParams", "any version")
    }

    @Test
    fun `BillingResult class exists`() {
        assertClassExists("com.android.billingclient.api.BillingResult", "any version")
    }

    // ============================================================================
    // MARK: - Helper Methods
    // ============================================================================

    private fun assertClassExists(className: String, minVersion: String) {
        try {
            val clazz = Class.forName(className)
            assertNotNull("$className should exist", clazz)
        } catch (e: ClassNotFoundException) {
            fail("$className not found. Requires Billing Library $minVersion")
        }
    }

    private fun assertClassHasMethod(
        className: String,
        methodName: String,
        vararg paramTypes: Class<*>
    ) {
        try {
            val clazz = Class.forName(className)
            val method = clazz.getMethod(methodName, *paramTypes)
            assertNotNull("$className.$methodName should exist", method)
        } catch (e: ClassNotFoundException) {
            fail("Class not found: $className")
        } catch (e: NoSuchMethodException) {
            val params = paramTypes.joinToString(", ") { it.simpleName }
            fail("Method not found: $className.$methodName($params)")
        }
    }
}
