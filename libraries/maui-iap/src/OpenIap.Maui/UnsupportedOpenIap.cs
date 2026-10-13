// Fallback for targets without a store (the shared net10.0 build). Listener
// streams stay empty so cross-platform initializers can subscribe; every
// operation throws FeatureNotSupported instead of an InvalidCastException.

#nullable enable

using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using OpenIap;

namespace OpenIap.Maui;

internal sealed class UnsupportedOpenIap : IOpenIap, QueryResolver, MutationResolver
{
    public IObservable<Purchase> PurchaseUpdated => EmptyObservable<Purchase>.Instance;
    public IObservable<Purchase> PurchaseUpdatedWithOptions(PurchaseUpdatedListenerOptions? options = null) => PurchaseUpdated;
    public IObservable<PurchaseError> PurchaseError => EmptyObservable<PurchaseError>.Instance;
    public IObservable<string> PromotedProductIOS => EmptyObservable<string>.Instance;
    public IObservable<Purchase> SubscriptionBillingIssue => EmptyObservable<Purchase>.Instance;
    public IObservable<UserChoiceBillingDetails> UserChoiceBillingAndroid => EmptyObservable<UserChoiceBillingDetails>.Instance;
    public IObservable<DeveloperProvidedBillingDetailsAndroid> DeveloperProvidedBillingAndroid => EmptyObservable<DeveloperProvidedBillingDetailsAndroid>.Instance;

    private static Task<T> Unsupported<T>([CallerMemberName] string operation = "")
        => Task.FromException<T>(OpenIapErrorMapper.Wrap(
            ErrorCode.FeatureNotSupported,
            $"{operation} needs an iOS, Mac Catalyst, or Android target"));

    // MutationResolver
    public Task<bool> AcknowledgePurchaseAndroidAsync(string purchaseToken) => Unsupported<bool>();
    public Task<string?> BeginRefundRequestIOSAsync(string sku) => Unsupported<string?>();
    public Task<bool> ClearTransactionIOSAsync() => Unsupported<bool>();
    public Task<bool> ConsumePurchaseAndroidAsync(string purchaseToken) => Unsupported<bool>();
    public Task<BillingProgramReportingDetailsAndroid> CreateBillingProgramReportingDetailsAndroidAsync(BillingProgramAndroid program, DeveloperBillingTypeAndroid? developerBillingType = null) => Unsupported<BillingProgramReportingDetailsAndroid>();
    public Task<string> DeepLinkToSubscriptionsAsync(DeepLinkOptions? options = null) => Unsupported<string>();
    public Task<bool> EndConnectionAsync() => Unsupported<bool>();
    public Task<string> FinishTransactionAsync(PurchaseInput purchase, bool? isConsumable = null) => Unsupported<string>();
    public Task<bool> InitConnectionAsync(InitConnectionConfig? config = null) => Unsupported<bool>();
    public Task<BillingProgramAvailabilityResultAndroid> IsBillingProgramAvailableAndroidAsync(BillingProgramAndroid program) => Unsupported<BillingProgramAvailabilityResultAndroid>();
    public Task<bool> LaunchExternalLinkAndroidAsync(LaunchExternalLinkParamsAndroid @params) => Unsupported<bool>();
    public Task<Purchase?> OpenRedeemOfferCodeAsync() => Unsupported<Purchase?>();
    public Task<ExternalPurchaseLinkResultIOS> PresentExternalPurchaseLinkIOSAsync(string url) => Unsupported<ExternalPurchaseLinkResultIOS>();
    public Task<ExternalPurchaseNoticeResultIOS> PresentExternalPurchaseNoticeSheetIOSAsync() => Unsupported<ExternalPurchaseNoticeResultIOS>();
    public Task<RequestPurchaseResult?> RequestPurchaseAsync(RequestPurchaseProps @params) => Unsupported<RequestPurchaseResult?>();
    public Task<string> RestorePurchasesAsync() => Unsupported<string>();
    public Task<BillingResultAndroid> ShowBillingProgramInformationDialogAndroidAsync(BillingProgramInformationDialogParamsAndroid @params) => Unsupported<BillingResultAndroid>();
    public Task<ExternalPurchaseCustomLinkNoticeResultIOS> ShowExternalPurchaseCustomLinkNoticeIOSAsync(ExternalPurchaseCustomLinkNoticeTypeIOS noticeType) => Unsupported<ExternalPurchaseCustomLinkNoticeResultIOS>();
    public Task<InAppMessageResultAndroid> ShowInAppMessagesAndroidAsync(InAppMessageParamsAndroid? @params = null) => Unsupported<InAppMessageResultAndroid>();
    public Task<IReadOnlyList<PurchaseIOS>> ShowManageSubscriptionsIOSAsync() => Unsupported<IReadOnlyList<PurchaseIOS>>();
    public Task<bool> SyncIOSAsync() => Unsupported<bool>();
    public Task<VerifyPurchaseResult> VerifyPurchaseAsync(VerifyPurchaseProps options) => Unsupported<VerifyPurchaseResult>();
    public Task<VerifyPurchaseWithProviderResult> VerifyPurchaseWithProviderAsync(VerifyPurchaseWithProviderProps options) => Unsupported<VerifyPurchaseWithProviderResult>();

    // QueryResolver
    public Task<bool> CanPresentExternalPurchaseNoticeIOSAsync() => Unsupported<bool>();
    public Task<PurchaseIOS?> CurrentEntitlementIOSAsync(string sku) => Unsupported<PurchaseIOS?>();
    public Task<FetchProductsResult> FetchProductsAsync(ProductRequest @params) => Unsupported<FetchProductsResult>();
    public Task<IReadOnlyList<ActiveSubscription>> GetActiveSubscriptionsAsync(IReadOnlyList<string>? subscriptionIds = null) => Unsupported<IReadOnlyList<ActiveSubscription>>();
    public Task<IReadOnlyList<PurchaseIOS>> GetAllTransactionsIOSAsync() => Unsupported<IReadOnlyList<PurchaseIOS>>();
    public Task<AppTransaction?> GetAppTransactionIOSAsync() => Unsupported<AppTransaction?>();
    public Task<IReadOnlyList<Purchase>> GetAvailablePurchasesAsync(PurchaseOptions? options = null) => Unsupported<IReadOnlyList<Purchase>>();
    public Task<BillingChoiceInfoAndroid> GetBillingChoiceInfoAndroidAsync(GetBillingChoiceInfoParamsAndroid @params) => Unsupported<BillingChoiceInfoAndroid>();
    public Task<ExternalPurchaseCustomLinkTokenResultIOS> GetExternalPurchaseCustomLinkTokenIOSAsync(ExternalPurchaseCustomLinkTokenTypeIOS tokenType) => Unsupported<ExternalPurchaseCustomLinkTokenResultIOS>();
    public Task<IReadOnlyList<PurchaseIOS>> GetPendingTransactionsIOSAsync() => Unsupported<IReadOnlyList<PurchaseIOS>>();
    public Task<ProductIOS?> GetPromotedProductIOSAsync() => Unsupported<ProductIOS?>();
    public Task<string?> GetReceiptDataIOSAsync() => Unsupported<string?>();
    public Task<string> GetStorefrontAsync() => Unsupported<string>();
    public Task<string?> GetTransactionJwsIOSAsync(string sku) => Unsupported<string?>();
    public Task<bool> HasActiveSubscriptionsAsync(IReadOnlyList<string>? subscriptionIds = null) => Unsupported<bool>();
    public Task<bool> IsEligibleForExternalPurchaseCustomLinkIOSAsync() => Unsupported<bool>();
    public Task<bool> IsEligibleForIntroOfferIOSAsync(string groupId) => Unsupported<bool>();
    public Task<bool> IsTransactionVerifiedIOSAsync(string sku) => Unsupported<bool>();
    public Task<PurchaseIOS?> LatestTransactionIOSAsync(string sku) => Unsupported<PurchaseIOS?>();
    public Task<IReadOnlyList<SubscriptionStatusIOS>> SubscriptionStatusIOSAsync(string sku) => Unsupported<IReadOnlyList<SubscriptionStatusIOS>>();
    public Task<AppOwnershipVerificationResult> VerifyAppOwnershipAsync(VerifyAppOwnershipProps? options = null) => Unsupported<AppOwnershipVerificationResult>();
}

internal sealed class EmptyObservable<T> : IObservable<T>
{
    public static readonly EmptyObservable<T> Instance = new();
    public IDisposable Subscribe(IObserver<T> observer) => NoopDisposable.Instance;
}

internal sealed class NoopDisposable : IDisposable
{
    public static readonly NoopDisposable Instance = new();
    public void Dispose() { }
}
