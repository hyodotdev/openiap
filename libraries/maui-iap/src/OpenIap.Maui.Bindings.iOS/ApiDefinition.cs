// Hand-written Xamarin.iOS / .NET-for-iOS API definition for the
// OpenIAP.xcframework Objective-C surface declared in
// `packages/apple/Sources/OpenIapModule+ObjC.swift`.
//
// Binds only the selectors `OpenIap.Maui/Platforms/iOS/OpenIapIOS.cs` calls;
// add a stub here together with the resolver code that uses it.

#nullable enable

using System;
using Foundation;
using ObjCRuntime;

namespace OpenIap.Maui.Bindings.iOS;

[BaseType(typeof(NSObject), Name = "OpenIapModule")]
[DisableDefaultCtor]
interface OpenIapModule
{
    [Static]
    [Export("sharedInstance")]
    OpenIapModule SharedInstance();

    // -- Connection ---------------------------------------------------------

    [Export("initConnectionWithCompletion:")]
    [Async]
    void InitConnection(Action<bool, NSError?> completion);

    [Export("endConnectionWithCompletion:")]
    [Async]
    void EndConnection(Action<bool, NSError?> completion);

    // -- Products / Promoted ------------------------------------------------

    [Export("fetchProductsWithSkus:type:completion:")]
    [Async]
    void FetchProducts(string[] skus, [NullAllowed] string type, Action<NSArray?, NSError?> completion);

    [Export("getPromotedProductIOSWithCompletion:")]
    [Async]
    void GetPromotedProductIOS(Action<NSObject?, NSError?> completion);

    // -- Purchase ----------------------------------------------------------

    [Export("requestPurchaseWithPayload:completion:")]
    [Async]
    void RequestPurchaseWithPayload(NSDictionary payload, Action<NSObject?, NSError?> completion);

    [Export("restorePurchasesWithCompletion:")]
    [Async]
    void RestorePurchases(Action<NSError?> completion);

    [Export("getAvailablePurchasesWithOptions:completion:")]
    [Async]
    void GetAvailablePurchasesWithOptions([NullAllowed] NSDictionary options, Action<NSArray?, NSError?> completion);

    [Export("getAllTransactionsIOSWithCompletion:")]
    [Async]
    void GetAllTransactionsIOS(Action<NSArray?, NSError?> completion);

    [Export("syncIOSWithCompletion:")]
    [Async]
    void SyncIOS(Action<bool, NSError?> completion);

    [Export("deepLinkToSubscriptionsWithCompletion:")]
    [Async]
    void DeepLinkToSubscriptions(Action<NSError?> completion);

    [Export("finishTransactionWithPurchaseJSON:isConsumable:completion:")]
    [Async]
    void FinishTransactionWithPurchaseJSON(string purchaseJSON, bool isConsumable, Action<NSError?> completion);

    [Export("getPendingTransactionsIOSWithCompletion:")]
    [Async]
    void GetPendingTransactionsIOS(Action<NSArray?, NSError?> completion);

    [Export("clearTransactionIOSWithCompletion:")]
    [Async]
    void ClearTransactionIOS(Action<bool, NSError?> completion);

    [Export("getReceiptDataIOSWithCompletion:")]
    [Async]
    void GetReceiptDataIOS(Action<string?, NSError?> completion);

    // -- Verification ------------------------------------------------------

    [Export("verifyAppOwnershipWithOptions:completion:")]
    [Async]
    void VerifyAppOwnership([NullAllowed] NSDictionary options, Action<NSObject?, NSError?> completion);

    [Export("verifyPurchaseWithSku:completion:")]
    [Async]
    void VerifyPurchase(string sku, Action<NSDictionary?, NSError?> completion);

    [Export("verifyPurchaseWithProviderObjCWithPayload:completion:")]
    [Async]
    void VerifyPurchaseWithProviderPayload(
        NSDictionary payload,
        Action<NSDictionary?, NSError?> completion);

    // -- Storefront / Subscriptions ----------------------------------------

    [Export("getStorefrontWithCompletion:")]
    [Async]
    void GetStorefront(Action<string?, NSError?> completion);

    [Export("getActiveSubscriptionsWithSubscriptionIds:completion:")]
    [Async]
    void GetActiveSubscriptions([NullAllowed] string[] subscriptionIds, Action<NSArray?, NSError?> completion);

    [Export("hasActiveSubscriptionsWithSubscriptionIds:completion:")]
    [Async]
    void HasActiveSubscriptions([NullAllowed] string[] subscriptionIds, Action<bool, NSError?> completion);

    [Export("subscriptionStatusIOSWithSku:completion:")]
    [Async]
    void SubscriptionStatusIOS(string sku, Action<NSArray?, NSError?> completion);

    [Export("currentEntitlementIOSWithSku:completion:")]
    [Async]
    void CurrentEntitlementIOS(string sku, Action<NSObject?, NSError?> completion);

    [Export("latestTransactionIOSWithSku:completion:")]
    [Async]
    void LatestTransactionIOS(string sku, Action<NSObject?, NSError?> completion);

    [Export("beginRefundRequestIOSWithSku:completion:")]
    [Async]
    void BeginRefundRequestIOS(string sku, Action<string?, NSError?> completion);

    [Export("isEligibleForIntroOfferIOSWithGroupID:completion:")]
    [Async]
    void IsEligibleForIntroOfferIOS(string groupId, Action<bool, NSError?> completion);

    [Export("isTransactionVerifiedIOSWithSku:completion:")]
    [Async]
    void IsTransactionVerifiedIOS(string sku, Action<bool, NSError?> completion);

    [Export("getTransactionJwsIOSWithSku:completion:")]
    [Async]
    void GetTransactionJwsIOS(string sku, Action<string?, NSError?> completion);

    [Export("getAppTransactionIOSWithCompletion:")]
    [Async]
    [Introduced(PlatformName.iOS, 16, 0)]
    [Introduced(PlatformName.MacCatalyst, 16, 0)]
    void GetAppTransactionIOS(Action<NSObject?, NSError?> completion);

    [Export("openRedeemOfferCodeWithCompletion:")]
    [Async]
    void OpenRedeemOfferCode(Action<NSObject?, NSError?> completion);

    [Export("showManageSubscriptionsIOSWithCompletion:")]
    [Async]
    void ShowManageSubscriptionsIOS(Action<NSArray?, NSError?> completion);

    [Export("presentExternalPurchaseLinkIOSWithUrl:completion:")]
    [Async]
    [Introduced(PlatformName.iOS, 16, 0)]
    [Introduced(PlatformName.MacCatalyst, 16, 0)]
    void PresentExternalPurchaseLinkIOS(string url, Action<NSObject?, NSError?> completion);

    [Export("presentExternalPurchaseNoticeSheetIOSWithCompletion:")]
    [Async]
    [Introduced(PlatformName.iOS, 17, 4)]
    [Introduced(PlatformName.MacCatalyst, 17, 4)]
    void PresentExternalPurchaseNoticeSheetIOS(Action<NSObject?, NSError?> completion);

    [Export("canPresentExternalPurchaseNoticeIOSWithCompletion:")]
    [Async]
    [Introduced(PlatformName.iOS, 17, 4)]
    [Introduced(PlatformName.MacCatalyst, 17, 4)]
    void CanPresentExternalPurchaseNoticeIOS(Action<bool, NSError?> completion);

    [Export("isEligibleForExternalPurchaseCustomLinkIOSWithCompletion:")]
    [Async]
    [Introduced(PlatformName.iOS, 18, 1)]
    [Introduced(PlatformName.MacCatalyst, 18, 1)]
    void IsEligibleForExternalPurchaseCustomLinkIOS(Action<bool, NSError?> completion);

    [Export("getExternalPurchaseCustomLinkTokenIOSWithTokenType:completion:")]
    [Async]
    [Introduced(PlatformName.iOS, 18, 1)]
    [Introduced(PlatformName.MacCatalyst, 18, 1)]
    void GetExternalPurchaseCustomLinkTokenIOS(string tokenType, Action<NSObject?, NSError?> completion);

    [Export("showExternalPurchaseCustomLinkNoticeIOSWithNoticeType:completion:")]
    [Async]
    [Introduced(PlatformName.iOS, 18, 1)]
    [Introduced(PlatformName.MacCatalyst, 18, 1)]
    void ShowExternalPurchaseCustomLinkNoticeIOS(string noticeType, Action<NSObject?, NSError?> completion);

    // -- Listeners ---------------------------------------------------------

    [Export("addPurchaseUpdatedListener:")]
    NSObject AddPurchaseUpdatedListener(Action<NSDictionary> callback);

    [Export("addPurchaseUpdatedListener:dedupeTransactionIOS:")]
    NSObject AddPurchaseUpdatedListener(
        Action<NSDictionary> callback,
        bool dedupeTransactionIOS);

    [Export("addPurchaseErrorListener:")]
    NSObject AddPurchaseErrorListener(Action<NSDictionary> callback);

    [Export("addPromotedProductListener:")]
    NSObject AddPromotedProductListener(Action<NSString?> callback);

    [Export("addSubscriptionBillingIssueListener:")]
    NSObject AddSubscriptionBillingIssueListener(Action<NSDictionary> callback);

    [Export("removeListener:")]
    void RemoveListener(NSObject subscription);
}
