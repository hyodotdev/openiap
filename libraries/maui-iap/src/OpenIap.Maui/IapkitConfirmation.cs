// IAPKit confirmation for apps without a backend, ported from
// specs/client/src/purchase-flow-confirmers.ts. It uses only the flow's public
// contract, as any other verification service's confirmer would.

#nullable enable

using System;
using System.Linq;
using System.Threading.Tasks;
using OpenIap;

namespace OpenIap.Maui;

/// <summary>How an app without its own backend confirms purchases with IAPKit.</summary>
public sealed record IapkitConfirmationOptions
{
    /// <summary>A publishable key (<c>openiap-kit_pk_...</c>), which is safe to ship in an app. Null sends no key.</summary>
    public string? ApiKey { get; init; }

    /// <summary>A self-hosted or local IAPKit origin. Defaults to https://kit.openiap.dev.</summary>
    public string? BaseUrl { get; init; }

    public IapkitAmazonOptions? Amazon { get; init; }

    /// <summary>The IAPKit store that verifies a community store's evidence, such as an Amazon RVS adapter.</summary>
    public Func<Purchase, IapStore?>? VerifyAs { get; init; }

    /// <summary>
    /// Gives the user what they bought, before the flow finishes (and so
    /// consumes) the purchase. Required for consumables. Must be idempotent per purchase id: after a
    /// crash the same purchase is confirmed again. Access read from ownership,
    /// such as an active subscription, needs nothing here.
    /// </summary>
    public PurchaseGranter? Grant { get; init; }
}

public sealed record IapkitAmazonOptions
{
    /// <summary>Verify App Tester receipts with the Amazon RVS Cloud Sandbox.</summary>
    public bool Sandbox { get; init; }

    /// <summary>Expected verdict environment; null keeps the routing-based default.</summary>
    public string? ExpectedEnvironment { get; init; }

    /// <summary>RVS reports a subscription term under its parent SKU; maps one to the other.</summary>
    public Func<string, string>? VerifiedProductId { get; init; }
}

internal static class IapkitConfirmationImplementation
{
    private const double UnknownRetryMs = 30_000;

    /// <summary>
    /// <see cref="OpenIapClient.ConfirmWithIapkit"/>, given a
    /// <c>VerifyPurchaseWithProviderAsync</c>: verifies the purchase with
    /// IAPKit, then runs <see cref="IapkitConfirmationOptions.Grant"/> before
    /// the flow finishes it.
    /// </summary>
    internal static PurchaseConfirmer Create(
        Func<VerifyPurchaseWithProviderProps, Task<VerifyPurchaseWithProviderResult>> verifyPurchaseWithProvider,
        IapkitConfirmationOptions options)
    {
        ArgumentNullException.ThrowIfNull(verifyPurchaseWithProvider);
        ArgumentNullException.ThrowIfNull(options);
        return async (purchase, isConsumable) =>
        {
            RequireGrant("ConfirmWithIapkit", purchase, isConsumable, options.Grant);
            var confirmation = ReadVerification(
                await verifyPurchaseWithProvider(ToVerificationProps(purchase, options)).ConfigureAwait(false),
                purchase,
                isConsumable,
                options);
            if (confirmation is PurchaseConfirmation.Entitled { AlreadyGranted: false } && options.Grant is { } grant)
            {
                await grant(purchase, isConsumable).ConfigureAwait(false);
            }
            return confirmation;
        };
    }

    /// <summary>Builds the IAPKit request for a purchase; throws for a store IAPKit cannot verify.</summary>
    internal static VerifyPurchaseWithProviderProps ToVerificationProps(Purchase purchase, IapkitConfirmationOptions options)
    {
        ArgumentNullException.ThrowIfNull(purchase);
        ArgumentNullException.ThrowIfNull(options);
        var apiKey = options.ApiKey?.Trim();
        // An unset environment variable, not a deliberate fallback to the SDK's key.
        if (apiKey == "") throw new ArgumentException("IAPKit ApiKey is empty", nameof(options));
        var baseUrl = options.BaseUrl?.Trim();
        var iapkit = new RequestVerifyPurchaseWithIapkitProps
        {
            ApiKey = apiKey,
            BaseUrl = string.IsNullOrEmpty(baseUrl) ? null : baseUrl,
        };
        string Token() => string.IsNullOrEmpty(purchase.PurchaseToken)
            ? throw new InvalidOperationException($"Purchase {purchase.ProductId} has no purchase token to verify")
            : purchase.PurchaseToken;
        var store = VerifyingStore(purchase, options);
        if (store == IapStore.Amazon) AmazonExpectedEnvironment(options.Amazon);
        iapkit = store switch
        {
            IapStore.Apple => iapkit with { Apple = new() { Jws = Token() } },
            IapStore.Google => iapkit with { Google = new() { PurchaseToken = Token() } },
            IapStore.Amazon => iapkit with
            {
                Amazon = new()
                {
                    ReceiptId = Token(),
                    ExpectedProductId = AmazonProductId(purchase, options),
                    Sandbox = options.Amazon?.Sandbox ?? false,
                    // The Amazon user the receipt belongs to, which Amazon RVS checks.
                    UserId = (purchase as PurchaseAndroid)?.UserIdAmazon is { Length: > 0 } userId ? userId : null,
                },
            },
            IapStore.Horizon => iapkit with { Horizon = new() { Sku = purchase.ProductId } },
            _ => throw new InvalidOperationException($"IAPKit cannot verify store {purchase.Store.ToJson()}"),
        };
        return new VerifyPurchaseWithProviderProps { Provider = PurchaseVerificationProvider.Iapkit, Iapkit = iapkit };
    }

    /// <summary>
    /// Turns IAPKit's answer into the flow's confirmation. Anything that may be
    /// a configuration error rather than a rejected payment throws, so the flow
    /// reports failed and leaves the purchase unfinished: evidence for another
    /// store, product, or environment, <c>inauthentic</c> (IAPKit's answer to a
    /// product or package mismatch, and to every Horizon rejection), and a valid
    /// state this product type cannot be granted from.
    /// </summary>
    internal static PurchaseConfirmation ReadVerification(
        VerifyPurchaseWithProviderResult result,
        Purchase purchase,
        bool isConsumable,
        IapkitConfirmationOptions? options = null)
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(purchase);
        options ??= new IapkitConfirmationOptions();
        var verified = result.Iapkit;
        if (verified is null)
        {
            var errors = string.Join("\n", (result.Errors ?? []).Select(error =>
                string.IsNullOrEmpty(error.Code) ? error.Message : $"[{error.Code}] {error.Message}"));
            throw new InvalidOperationException(errors.Length > 0 ? errors : "IAPKit returned no verification result");
        }
        switch (verified.State)
        {
            case IapkitPurchaseState.Pending:
                return new PurchaseConfirmation.StorePending();
            // The store gave no usable answer: retry instead of rejecting a payment.
            case IapkitPurchaseState.Unknown:
                return new PurchaseConfirmation.VerificationDelayed(UnknownRetryMs);
        }
        var store = VerifyingStore(purchase, options);
        var expectedProductId = store == IapStore.Amazon ? AmazonProductId(purchase, options) : purchase.ProductId;
        var mismatch =
            verified.Store != purchase.Store ? $"store {verified.Store.ToJson()}, expected {purchase.Store.ToJson()}"
            : verified.StoreId != purchase.StoreId ? $"store id {verified.StoreId}, expected {purchase.StoreId}"
            : verified.ProductId != expectedProductId ? $"product {verified.ProductId ?? "(none)"}, expected {expectedProductId}"
            : EnvironmentMismatch(verified.Environment, store, purchase, options);
        if (mismatch is not null) throw new InvalidOperationException($"IAPKit verified {mismatch}");
        if (!verified.IsValid)
        {
            return verified.State switch
            {
                IapkitPurchaseState.Canceled or IapkitPurchaseState.Expired => new PurchaseConfirmation.Invalid(verified.State.ToJson()),
                // Only a granted purchase is consumed; the flow grants before finishing.
                IapkitPurchaseState.Consumed => new PurchaseConfirmation.Entitled(AlreadyGranted: true),
                _ => throw new InvalidOperationException($"IAPKit rejected the purchase: {verified.State.ToJson()}"),
            };
        }
        if (!GrantsAccess(store, verified.State, isConsumable))
        {
            var kind = isConsumable ? "consumable" : "non-consumable";
            throw new InvalidOperationException(
                $"IAPKit state {verified.State.ToJson()} cannot grant this {kind} {purchase.Store.ToJson()} purchase");
        }
        return new PurchaseConfirmation.Entitled(AlreadyGranted: false);
    }

    // Checked before verifying: a consumable must never pass without a way to credit it.
    internal static void RequireGrant(string name, Purchase purchase, bool isConsumable, PurchaseGranter? grant)
    {
        if (isConsumable && grant is null)
        {
            throw new InvalidOperationException(
                $"{name} needs Grant to credit consumable {purchase.ProductId} before it is consumed");
        }
    }

    private static IapStore VerifyingStore(Purchase purchase, IapkitConfirmationOptions options) =>
        options.VerifyAs?.Invoke(purchase) ?? purchase.Store;

    private static string AmazonProductId(Purchase purchase, IapkitConfirmationOptions options) =>
        options.Amazon?.VerifiedProductId?.Invoke(purchase.ProductId) ?? purchase.ProductId;

    private static string AmazonExpectedEnvironment(IapkitAmazonOptions? amazon)
    {
        var expected = amazon?.ExpectedEnvironment ?? (amazon?.Sandbox == true ? "Sandbox" : "Production");
        if (expected is not ("Sandbox" or "Production"))
            throw new ArgumentException("Amazon expectedEnvironment must be Sandbox or Production", nameof(amazon));
        if (amazon?.Sandbox == true && expected == "Production")
            throw new ArgumentException("Amazon Cloud Sandbox requires expectedEnvironment Sandbox", nameof(amazon));
        return expected;
    }

    private static string? EnvironmentMismatch(
        string? environment,
        IapStore store,
        Purchase purchase,
        IapkitConfirmationOptions options)
    {
        var expected = store switch
        {
            IapStore.Amazon => AmazonExpectedEnvironment(options.Amazon),
            IapStore.Apple => (purchase as PurchaseIOS)?.EnvironmentIOS,
            _ => null,
        };
        return !string.IsNullOrEmpty(expected) && environment != expected
            ? $"environment {environment ?? "(none)"}, expected {expected}"
            : null;
    }

    // Apple and Amazon keep a consumable at ready-to-consume until it is finished;
    // Google reports a granted purchase as pending-acknowledgment until then.
    private static bool GrantsAccess(IapStore store, IapkitPurchaseState state, bool isConsumable) => store switch
    {
        IapStore.Apple or IapStore.Amazon =>
            state == (isConsumable ? IapkitPurchaseState.ReadyToConsume : IapkitPurchaseState.Entitled),
        IapStore.Google => state is IapkitPurchaseState.Entitled or IapkitPurchaseState.PendingAcknowledgment
            || (isConsumable && state == IapkitPurchaseState.ReadyToConsume),
        IapStore.Horizon => state == IapkitPurchaseState.Entitled,
        _ => false,
    };
}


[Obsolete("Use OpenIapClient.ConfirmWithIapkit. Removed in the next major release.")]
public static class IapkitConfirmation
{
    public static PurchaseConfirmer Create(
        Func<VerifyPurchaseWithProviderProps, Task<VerifyPurchaseWithProviderResult>> verifyPurchaseWithProvider,
        IapkitConfirmationOptions options) =>
        IapkitConfirmationImplementation.Create(verifyPurchaseWithProvider, options);

    public static VerifyPurchaseWithProviderProps ToVerificationProps(Purchase purchase, IapkitConfirmationOptions options) =>
        IapkitConfirmationImplementation.ToVerificationProps(purchase, options);

    public static PurchaseConfirmation ReadVerification(
        VerifyPurchaseWithProviderResult result, Purchase purchase, bool isConsumable,
        IapkitConfirmationOptions? options = null) =>
        IapkitConfirmationImplementation.ReadVerification(result, purchase, isConsumable, options);
}
