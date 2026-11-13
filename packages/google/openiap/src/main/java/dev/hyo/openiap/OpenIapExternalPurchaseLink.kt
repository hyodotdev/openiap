package dev.hyo.openiap

import android.app.Activity

// Shared external purchase link flow on Play's external offers program. Play shows
// its own disclosure inside launchExternalLink, so the link cannot open without it.

internal suspend fun OpenIapProtocol.externalPurchaseLinkAvailable(): Boolean =
    try {
        isBillingProgramAvailable(BillingProgramAndroid.ExternalOffer).isAvailable
    } catch (_: OpenIapError.FeatureNotSupported) {
        false
    }

internal suspend fun OpenIapProtocol.openExternalPurchaseLinkFlow(
    activity: Activity,
    request: ExternalPurchaseLinkRequest,
): ExternalPurchaseLinkResult {
    if (!externalPurchaseLinkAvailable()) {
        return ExternalPurchaseLinkResult(platform = IapPlatform.Android, status = ExternalPurchaseLinkStatus.Unavailable)
    }
    val token = createBillingProgramReportingDetails(BillingProgramAndroid.ExternalOffer).externalTransactionToken
    val params = LaunchExternalLinkParamsAndroid(
        billingProgram = BillingProgramAndroid.ExternalOffer,
        launchMode = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
        linkType = request.google?.linkType ?: ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
        linkUri = request.url,
    )
    val opened = try {
        launchExternalLink(activity, params)
    } catch (_: OpenIapError.UserCancelled) {
        false
    }
    return if (opened) {
        ExternalPurchaseLinkResult(platform = IapPlatform.Android, reportToken = token, status = ExternalPurchaseLinkStatus.Opened)
    } else {
        ExternalPurchaseLinkResult(platform = IapPlatform.Android, status = ExternalPurchaseLinkStatus.Cancelled)
    }
}
