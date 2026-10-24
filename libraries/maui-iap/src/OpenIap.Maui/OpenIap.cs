// ============================================================================
// OpenIAP — public API surface for .NET MAUI
// ============================================================================
//
// The static `OpenIapClient` class is the recommended entry point. It
// delegates to a platform implementation that is selected at compile time (see
// the Platforms/ folder). Mirrors the API surface of:
//   - react-native-iap / expo-iap (TypeScript)
//   - flutter_inapp_purchase (Dart)
//   - kmp-iap (Kotlin)
//   - godot-iap (GDScript)
// All concrete behaviour comes from the OpenIAP native packages
// (`packages/apple` and `packages/google`) — this library is a thin .NET
// projection of that contract, generated from the GraphQL schema in
// `specs/client`.
//
// Every `IOpenIap` implementation, including the unsupported-platform
// fallback, also implements the generated QueryResolver and MutationResolver.

#nullable enable

using System;
using System.Threading;
using System.Threading.Tasks;
using OpenIap;

namespace OpenIap.Maui;

/// <summary>
/// The unified OpenIAP listener contract. Subscription-style events
/// (purchase updates, errors, promoted products) are surfaced as
/// <see cref="IObservable{T}"/> streams instead of GraphQL subscription
/// fields. The full operation surface comes from the generated
/// <c>QueryResolver</c> and <c>MutationResolver</c> interfaces in
/// <c>OpenIap.Types.cs</c> — concrete platform implementations should
/// implement those too.
/// </summary>
public interface IOpenIap
{
    /// <summary>
    /// Stream of successful purchase updates. Mirrors
    /// <c>SubscriptionResolver.purchaseUpdated</c> from the GraphQL schema.
    /// </summary>
    IObservable<Purchase> PurchaseUpdated { get; }

    /// <summary>
    /// Stream of successful purchase updates with listener options. On iOS,
    /// set <see cref="PurchaseUpdatedListenerOptions.DedupeTransactionIOS"/>
    /// to false to also emit StoreKit replay events for transaction IDs already
    /// delivered during the current connection session. Android ignores this flag.
    /// </summary>
    IObservable<Purchase> PurchaseUpdatedWithOptions(PurchaseUpdatedListenerOptions? options = null);

    /// <summary>
    /// Stream of purchase failures. Mirrors
    /// <c>SubscriptionResolver.purchaseError</c>.
    /// </summary>
    IObservable<PurchaseError> PurchaseError { get; }

    /// <summary>
    /// Stream of promoted products surfaced by the App Store (iOS only).
    /// Empty stream on Android / unsupported platforms.
    /// </summary>
    IObservable<string> PromotedProductIOS { get; }

    /// <summary>
    /// Stream of active subscriptions that entered a billing-issue state
    /// (payment failed, card expired). iOS 18+ via StoreKit Message;
    /// Android Play Billing 8.1+ via Purchase.isSuspended. Horizon flavor
    /// never emits.
    /// </summary>
    IObservable<Purchase> SubscriptionBillingIssue { get; }

    /// <summary>
    /// Stream of user-choice-billing selections (Android Play Billing 7.0+).
    /// Empty stream on iOS.
    /// </summary>
    IObservable<UserChoiceBillingDetails> UserChoiceBillingAndroid { get; }

    /// <summary>
    /// Stream of developer-provided-billing selections (Android Play Billing 8.3+).
    /// Empty stream on iOS.
    /// </summary>
    IObservable<DeveloperProvidedBillingDetailsAndroid> DeveloperProvidedBillingAndroid { get; }
}

/// <summary>
/// Static convenience facade. Call operations through <see cref="Query"/> and
/// <see cref="Mutation"/>, for example
/// <c>await OpenIapClient.Query.FetchProductsAsync(request)</c>.
/// </summary>
public static class OpenIapClient
{
    // One store client per process: Meta Horizon ends the app when a second billing client
    // queries purchases. Creation and replacement share this lock so neither can overlap.
    private static readonly object InstanceLock = new();
    private static IOpenIap? _instance;

    /// <summary>
    /// The platform implementation, created on first use. A failed creation is
    /// not cached, so the next read tries again.
    /// </summary>
    public static IOpenIap Instance
    {
        get
        {
            lock (InstanceLock) return _instance ??= OpenIapPlatform.Create();
        }
    }

    /// <summary>
    /// Replace the instance with a test or DI fake. The replaced instance is
    /// disposed, and on Android its store connection ends asynchronously, so
    /// never pass an instance that opens a store connection of its own.
    /// </summary>
    public static void OverrideInstance(IOpenIap instance)
    {
        ArgumentNullException.ThrowIfNull(instance);
        lock (InstanceLock)
        {
            var previous = _instance;
            _instance = instance;
            if (!ReferenceEquals(previous, instance) && previous is IDisposable disposable)
            {
                disposable.Dispose();
            }
        }
    }

    /// <summary>The query operations of <see cref="Instance"/>.</summary>
    public static QueryResolver Query => Resolver<QueryResolver>(Instance);

    /// <summary>The mutation operations of <see cref="Instance"/>.</summary>
    public static MutationResolver Mutation => Resolver<MutationResolver>(Instance);

    /// <summary>Writes iOS and Mac Catalyst bridge call traces to the console. Off by default.</summary>
    public static bool DebugLogging { get; set; }

    /// <summary>
    /// Create a client for OpenIAP kit's HTTP API. Mirrors the JavaScript
    /// <c>kitApi(...)</c> helper.
    /// </summary>
    public static KitApiClient KitApi(KitApiOptions options) => new(options);

    /// <summary>
    /// Creates the app's purchase flow over <see cref="Instance"/>. It confirms
    /// and finishes every purchase the store delivers, and recovers unfinished
    /// ones; each store function left null uses this library's, and outcomes
    /// arrive on the synchronization context current here (the UI thread's
    /// when created from UI code). Create one per signed-in account and dispose
    /// it when the account changes.
    /// See: https://kit.openiap.dev/docs/purchase-flow
    /// </summary>
    public static PurchaseFlow CreatePurchaseFlow(PurchaseFlowOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var instance = Instance;
        // iOS replays reach the flow, which deduplicates itself; a redelivery retries a failed confirmation.
        var listen = options.ListenForPurchases ?? (onPurchase => instance
            .PurchaseUpdatedWithOptions(new PurchaseUpdatedListenerOptions { DedupeTransactionIOS = false })
            .Subscribe(onPurchase));
        return new PurchaseFlow(options with
        {
            FinishTransaction = options.FinishTransaction
                ?? ((purchase, isConsumable) =>
                    Resolver<MutationResolver>(instance).FinishTransactionAsync(new PurchaseInput(purchase), isConsumable)),
            GetAvailablePurchases = options.GetAvailablePurchases
                ?? (() => Resolver<QueryResolver>(instance).GetAvailablePurchasesAsync()),
#if IOS || MACCATALYST
            GetPendingTransactionsIOS = options.GetPendingTransactionsIOS
                ?? (async () => await Resolver<QueryResolver>(instance).GetPendingTransactionsIOSAsync()),
#endif
            ListenForPurchases = onPurchase =>
            {
                var updates = listen(onPurchase);
                // Whatever listens, a failed or cancelled request ends what the user asked for, and disposing ends them all.
                var errors = instance.PurchaseError.Subscribe(_ => PurchaseRequests.Clear());
                return new DisposableAction(() =>
                {
                    updates.Dispose();
                    errors.Dispose();
                    PurchaseRequests.Clear();
                });
            },
            WasRequested = options.WasRequested ?? PurchaseRequests.Take,
            OutcomeContext = options.OutcomeContext ?? SynchronizationContext.Current,
        });
    }

    /// <summary>
    /// Confirms purchases with IAPKit from the app, for apps without a backend:
    /// pass it as <see cref="PurchaseFlowOptions.ConfirmWithBackend"/> with a
    /// publishable key. Credit consumables in
    /// <see cref="IapkitConfirmationOptions.Grant"/>, which runs before the
    /// purchase is consumed.
    /// </summary>
    public static PurchaseConfirmer ConfirmWithIapkit(IapkitConfirmationOptions options)
    {
        var instance = Instance;
        return IapkitConfirmationImplementation.Create(
            props => Resolver<MutationResolver>(instance).VerifyPurchaseWithProviderAsync(props),
            options);
    }

    /// <summary>
    /// Confirms App Store purchases on the device, for apps with neither a
    /// backend nor IAPKit: StoreKit must still list the transaction as
    /// unfinished and valid. Credit consumables in <paramref name="grant"/>.
    /// </summary>
    public static PurchaseConfirmer ConfirmOnDeviceIOS(PurchaseGranter? grant = null)
    {
        var instance = Instance;
        return DeviceConfirmationIOSImplementation.Create(
            () => Resolver<QueryResolver>(instance).GetPendingTransactionsIOSAsync(),
            grant);
    }

    private static T Resolver<T>(IOpenIap instance) where T : class =>
        instance as T ?? throw new InvalidOperationException($"{instance.GetType().Name} does not implement {typeof(T).Name}");
}

/// <summary>
/// Platform factory. The actual implementation is provided by the
/// per-platform <c>OpenIapPlatform.&lt;platform&gt;.cs</c> file. The
/// non-platform target falls through to <see cref="UnsupportedOpenIap"/>
/// so that purely shared MAUI code can be authored against the type
/// without pulling in StoreKit / Billing references.
/// </summary>
internal static class OpenIapPlatform
{
    public static IOpenIap Create()
    {
#if ANDROID
        return new Platforms.Android.OpenIapAndroid();
#elif IOS
        return new Platforms.iOS.OpenIapIOS();
#elif MACCATALYST
        return new Platforms.MacCatalyst.OpenIapMacCatalyst();
#else
        return new UnsupportedOpenIap();
#endif
    }
}
