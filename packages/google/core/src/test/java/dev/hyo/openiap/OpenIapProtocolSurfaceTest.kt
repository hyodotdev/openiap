package dev.hyo.openiap

import org.junit.Assert.assertEquals
import org.junit.Test
import java.lang.reflect.Modifier

class OpenIapProtocolSurfaceTest {
    @Test fun `new members ship with defaults so the abstract surface never grows`() {
        val abstract = OpenIapProtocol::class.java.declaredMethods
            .filter { !it.isSynthetic && Modifier.isAbstract(it.modifiers) }
            .map { method ->
                "${method.name}(${method.parameterTypes.joinToString(",") { it.name }}):${method.returnType.name}"
            }
            .sorted()
        assertEquals(
            "A new OpenIapProtocol member must ship with a default implementation, so the abstract surface never grows.",
            EXPECTED_ABSTRACT_MEMBERS,
            abstract,
        )
    }

    companion object {
        private val EXPECTED_ABSTRACT_MEMBERS = listOf(
            "addConnectionStateListener(dev.hyo.openiap.listener.OpenIapConnectionStateListener):void",
            "addDeveloperProvidedBillingListener(dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener):void",
            "addPurchaseErrorListener(dev.hyo.openiap.listener.OpenIapPurchaseErrorListener):void",
            "addPurchaseUpdateListener(dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener):void",
            "addSubscriptionBillingIssueListener(dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener):void",
            "addUserChoiceBillingListener(dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener):void",
            "createBillingProgramReportingDetails(dev.hyo.openiap.BillingProgramAndroid,dev.hyo.openiap.DeveloperBillingTypeAndroid,kotlin.coroutines.Continuation):java.lang.Object",
            "getAcknowledgePurchaseAndroid():kotlin.jvm.functions.Function2",
            "getBillingChoiceInfo(dev.hyo.openiap.GetBillingChoiceInfoParamsAndroid,kotlin.coroutines.Continuation):java.lang.Object",
            "getConsumePurchaseAndroid():kotlin.jvm.functions.Function2",
            "getDeepLinkToSubscriptions():kotlin.jvm.functions.Function2",
            "getEndConnection():kotlin.jvm.functions.Function1",
            "getFetchProducts():kotlin.jvm.functions.Function2",
            "getFinishTransaction():kotlin.jvm.functions.Function3",
            "getGetActiveSubscriptions():kotlin.jvm.functions.Function2",
            "getGetAvailablePurchases():kotlin.jvm.functions.Function2",
            "getHasActiveSubscriptions():kotlin.jvm.functions.Function2",
            "getInitConnection():kotlin.jvm.functions.Function2",
            "getMutationHandlers():dev.hyo.openiap.MutationHandlers",
            "getQueryHandlers():dev.hyo.openiap.QueryHandlers",
            "getRequestPurchase():kotlin.jvm.functions.Function2",
            "getRestorePurchases():kotlin.jvm.functions.Function1",
            "getSubscriptionHandlers():dev.hyo.openiap.SubscriptionHandlers",
            "getVerifyPurchase():kotlin.jvm.functions.Function2",
            "getVerifyPurchaseWithProvider():kotlin.jvm.functions.Function2",
            "isBillingProgramAvailable(dev.hyo.openiap.BillingProgramAndroid,kotlin.coroutines.Continuation):java.lang.Object",
            "launchExternalLink(android.app.Activity,dev.hyo.openiap.LaunchExternalLinkParamsAndroid,kotlin.coroutines.Continuation):java.lang.Object",
            "openRedeemOfferCode(android.app.Activity,kotlin.coroutines.Continuation):java.lang.Object",
            "removeConnectionStateListener(dev.hyo.openiap.listener.OpenIapConnectionStateListener):void",
            "removeDeveloperProvidedBillingListener(dev.hyo.openiap.listener.OpenIapDeveloperProvidedBillingListener):void",
            "removePurchaseErrorListener(dev.hyo.openiap.listener.OpenIapPurchaseErrorListener):void",
            "removePurchaseUpdateListener(dev.hyo.openiap.listener.OpenIapPurchaseUpdateListener):void",
            "removeSubscriptionBillingIssueListener(dev.hyo.openiap.listener.OpenIapSubscriptionBillingIssueListener):void",
            "removeUserChoiceBillingListener(dev.hyo.openiap.listener.OpenIapUserChoiceBillingListener):void",
            "setActivity(android.app.Activity):void",
            "showBillingProgramInformationDialog(android.app.Activity,dev.hyo.openiap.BillingProgramInformationDialogParamsAndroid,kotlin.coroutines.Continuation):java.lang.Object",
            "showInAppMessages(android.app.Activity,dev.hyo.openiap.InAppMessageParamsAndroid,kotlin.coroutines.Continuation):java.lang.Object",
        )
    }
}
