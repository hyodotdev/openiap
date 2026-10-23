using OpenIap;
using OpenIap.Maui;

namespace OpenIap.Maui.Example.Utils;

internal enum VerificationMethod { Ignore, Local, IapkitLocal, Iapkit }

// The store connection and the app's one purchase flow, shared by every page.
internal static class IapLifecycle
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    // Bulbs are credited once per purchase id; a real app keeps both on its server.
    private static readonly HashSet<string> CreditedPurchaseIds = new(StringComparer.Ordinal);

    // Mirrors the other examples: no key skips, a local origin prefers it.
    public static VerificationMethod Verification { get; set; } =
        string.IsNullOrWhiteSpace(IapKitSettings.ApiKey) ? VerificationMethod.Ignore
        : string.IsNullOrWhiteSpace(IapKitSettings.LocalBaseUrl) ? VerificationMethod.Iapkit
        : VerificationMethod.IapkitLocal;

    public static int Bulbs { get; private set; }

    private static PurchaseFlow? _flow;

    public static PurchaseFlow Flow => _flow ?? throw new InvalidOperationException("App creates the purchase flow at startup.");

    /// <summary>Creates the app's one purchase flow; App calls it on the UI thread so outcomes arrive there.</summary>
    public static void StartPurchaseFlow() => _flow ??= OpenIapClient.CreatePurchaseFlow(new PurchaseFlowOptions
    {
        ConfirmWithBackend = ConfirmAsync,
        IsConsumable = Constants.ConsumableProductIdSet.Contains,
    });

    public static async Task<bool> InitConnectionAsync(InitConnectionConfig? config = null)
    {
        await Gate.WaitAsync();
        try
        {
            return await OpenIapClient.Mutation.InitConnectionAsync(config).WaitAsync(TimeSpan.FromSeconds(15));
        }
        finally
        {
            Gate.Release();
        }
    }

    public static async Task EndConnectionQuietlyAsync(string owner)
    {
        await Gate.WaitAsync();
        try
        {
            await OpenIapClient.Mutation.EndConnectionAsync().WaitAsync(TimeSpan.FromSeconds(5));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[{owner}] endConnection failed: {ErrorUtils.ExtractErrorMessage(ex)}");
        }
        finally
        {
            Gate.Release();
        }
    }

    public static string Label(VerificationMethod method) => method switch
    {
        VerificationMethod.Local => "📱 Local (Device)",
        VerificationMethod.IapkitLocal => "🖥️ Local (IAPKit)",
        VerificationMethod.Iapkit => "☁️ IAPKit (Server)",
        _ => "❌ None (Skip)",
    };

    /// <summary>Asks for the method the flow confirms with; false when the user cancels.</summary>
    public static async Task<bool> ChooseVerificationAsync(Page page)
    {
        var methods = Enum.GetValues<VerificationMethod>();
        var choice = await page.DisplayActionSheetAsync(
            "Select verification method", "Cancel", null, methods.Select(Label).ToArray());
        var selected = Array.FindIndex(methods, method => Label(method) == choice);
        if (selected < 0) return false;
        Verification = methods[selected];
        return true;
    }

    /// <summary>The result line for an outcome, from the flow's store-neutral guidance.</summary>
    public static string Describe(PurchaseFlowOutcome outcome, string noun)
    {
        var (purchase, status) = outcome;
        var guidance = status.Describe();
        var text = guidance.Key switch
        {
            PurchaseFlowGuidanceKey.AccessGranted => $"{noun} completed and finished successfully.",
            PurchaseFlowGuidanceKey.ChangePending =>
                $"Plan change to {string.Join(", ", (purchase as PurchaseAndroid)?.PendingPurchaseUpdateAndroid?.Products ?? [])} is pending. " +
                $"{purchase.ProductId} stays active until it applies.",
            PurchaseFlowGuidanceKey.PaymentPending => $"{noun} is waiting for payment; access starts once the store completes it.",
            PurchaseFlowGuidanceKey.VerificationDelayed or PurchaseFlowGuidanceKey.AccessPending =>
                $"{noun} received; access is not granted yet. It is checked again later.",
            PurchaseFlowGuidanceKey.OwnedByAnotherAccount => $"This {noun.ToLowerInvariant()} belongs to another account.",
            PurchaseFlowGuidanceKey.TestPurchaseNotAccepted => "Test purchases are not accepted for this account.",
            PurchaseFlowGuidanceKey.PurchaseNotValid => guidance.OfferPurchase
                ? $"{noun} is not valid. You can buy it again."
                : $"{noun} is no longer valid.",
            _ => $"{noun} verification failed; the transaction was not finalized.\n" +
                ErrorUtils.ExtractErrorMessage((status as PurchaseFlowStatus.Failed)?.Error),
        };
        return status is PurchaseFlowStatus.Entitled { FinishError: { } finishError }
            ? $"{noun} verified, but finishing it failed: {finishError.Message}"
            : text;
    }

    // Switches on the current method, so changing it never recreates the flow.
    private static Task<PurchaseConfirmation?> ConfirmAsync(Purchase purchase, bool isConsumable) => Verification switch
    {
        VerificationMethod.Iapkit => ConfirmWithIapkit(baseUrl: null)(purchase, isConsumable),
        VerificationMethod.IapkitLocal => ConfirmWithIapkit(IapKitSettings.LocalBaseUrl
            ?? throw new InvalidOperationException("IAPKit base URL not configured for Local (IAPKit)"))(purchase, isConsumable),
        VerificationMethod.Local => ConfirmOnDeviceAsync(purchase, isConsumable),
        _ => throw new InvalidOperationException("Receipt retained. Choose verification to retry this receipt."),
    };

    private static PurchaseConfirmer ConfirmWithIapkit(string? baseUrl) =>
        OpenIapClient.ConfirmWithIapkit(IapKitSettings.ConfirmationOptions(baseUrl) with { Grant = GrantAsync });

#if IOS || MACCATALYST
    // StoreKit verified the transaction on the device; nothing checks it on a server.
    private static async Task<PurchaseConfirmation?> ConfirmOnDeviceAsync(Purchase purchase, bool isConsumable)
    {
        var pending = await OpenIapClient.Query.GetPendingTransactionsIOSAsync();
        if (!IapKitSettings.MatchesVerifiedPendingPurchase(purchase, pending))
        {
            throw new InvalidOperationException("StoreKit lists no verified, unfinished transaction for this purchase.");
        }
        await GrantAsync(purchase, isConsumable);
        return new PurchaseConfirmation.Entitled(AlreadyGranted: false);
    }
#else
    private static Task<PurchaseConfirmation?> ConfirmOnDeviceAsync(Purchase purchase, bool isConsumable) =>
        throw new NotSupportedException("Local (Device) verification is unavailable here. Choose Local (IAPKit).");
#endif

    private static Task GrantAsync(Purchase purchase, bool isConsumable)
    {
        lock (CreditedPurchaseIds)
        {
            if (isConsumable && CreditedPurchaseIds.Add(purchase.Id))
            {
                Bulbs += Constants.ConsumableBulbs[purchase.ProductId];
            }
        }
        return Task.CompletedTask;
    }
}
