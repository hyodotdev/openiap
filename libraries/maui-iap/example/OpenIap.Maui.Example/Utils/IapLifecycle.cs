using OpenIap;
using OpenIap.Maui;

namespace OpenIap.Maui.Example.Utils;

internal enum VerificationMethod { Ignore, Local, IapkitLocal, Iapkit }

// The app's one purchase flow, shared by every page.
internal static class IapLifecycle
{
    // Bulbs are credited once per purchase id; a real app keeps both in its own store.
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
        VerificationMethod.Local => OpenIapClient.ConfirmOnDeviceIOS(GrantAsync)(purchase, isConsumable),
        _ => throw new InvalidOperationException("Receipt retained. Choose verification to retry this receipt."),
    };

    private static PurchaseConfirmer ConfirmWithIapkit(string? baseUrl) =>
        OpenIapClient.ConfirmWithIapkit(IapKitSettings.ConfirmationOptions(baseUrl) with { Grant = GrantAsync });

    private static Task GrantAsync(Purchase purchase, bool isConsumable)
    {
        if (!isConsumable) return Task.CompletedTask;
        lock (CreditedPurchaseIds)
        {
            if (CreditedPurchaseIds.Add(purchase.Id)) Bulbs += Constants.ConsumableBulbs[purchase.ProductId];
            else Console.WriteLine($"[IapLifecycle] {purchase.Id} was already credited");
        }
        return Task.CompletedTask;
    }
}
