// Mirrors libraries/expo-iap/example/src/utils/buildPurchaseRows.ts —
// flattens a Purchase (PurchaseIOS / PurchaseAndroid) into a label/value list
// for the details modal. Walking only the publicly-typed fields keeps the
// helper deterministic across the platform branches.

using OpenIap;

namespace OpenIap.Maui.Example.Utils;

public sealed record PurchaseDetailRow(string Label, string Value);

public static class BuildPurchaseRows
{
    public static IReadOnlyList<PurchaseDetailRow> From(Purchase purchase)
    {
        var rows = new List<PurchaseDetailRow>();

        // Common fields are declared on PurchaseCommon, which both PurchaseIOS
        // and PurchaseAndroid implement. The abstract `Purchase` union type
        // intentionally exposes no fields directly.
        var common = (PurchaseCommon)purchase;
        var transactionId = ResolveTransactionId(purchase);
        Push(rows, "id", common.Id);
        Push(rows, "transactionId", transactionId);
        Push(rows, "productId", common.ProductId);
        Push(rows, "platform", common.Platform.ToJson());
        Push(rows, "ids", FormatList(common.Ids));
        Push(rows, "transactionDate", FormatDate(common.TransactionDate));
        Push(rows, "purchaseState", Capitalize(common.PurchaseState.ToJson()));
        Push(rows, "quantity", common.Quantity.ToString());
        Push(rows, "isAutoRenewing", FormatBoolean(common.IsAutoRenewing));

        switch (purchase)
        {
            case PurchaseIOS ios:
                Push(rows, "quantityIOS", ios.QuantityIOS.ToString());
                Push(rows, "appAccountToken", RedactedIfPresent(ios.AppAccountToken));
                Push(rows, "appBundleIdIOS", ios.AppBundleIdIOS);
                Push(rows, "countryCodeIOS", ios.CountryCodeIOS);
                Push(rows, "currencyCodeIOS", ios.CurrencyCodeIOS);
                Push(rows, "currencySymbolIOS", ios.CurrencySymbolIOS);
                Push(rows, "environmentIOS", ios.EnvironmentIOS);
                Push(rows, "subscriptionGroupIdIOS", ios.SubscriptionGroupIdIOS);
                Push(rows, "originalTransactionIdentifierIOS",
                    ios.OriginalTransactionIdentifierIOS);
                Push(rows, "originalTransactionDateIOS",
                    FormatDate(ios.OriginalTransactionDateIOS));
                Push(rows, "expirationDateIOS", FormatDate(ios.ExpirationDateIOS));
                Push(rows, "isUpgradedIOS", FormatBoolean(ios.IsUpgradedIOS));
                Push(rows, "ownershipTypeIOS", ios.OwnershipTypeIOS);
                Push(rows, "reasonIOS", ios.ReasonIOS);
                Push(rows, "reasonStringRepresentationIOS",
                    ios.ReasonStringRepresentationIOS);
                Push(rows, "transactionReasonIOS", ios.TransactionReasonIOS);
                Push(rows, "revocationDateIOS", FormatDate(ios.RevocationDateIOS));
                Push(rows, "revocationReasonIOS", ios.RevocationReasonIOS);
                Push(rows, "webOrderLineItemIdIOS", ios.WebOrderLineItemIdIOS);
                if (ios.OfferIOS is not null)
                {
                    Push(rows, "offerIOS.id", ios.OfferIOS.Id);
                    Push(rows, "offerIOS.type", ios.OfferIOS.Type);
                    Push(rows, "offerIOS.paymentMode", ios.OfferIOS.PaymentMode);
                }
                break;
            case PurchaseAndroid android:
                Push(rows, "signatureAndroid", RedactedIfPresent(android.SignatureAndroid));
                Push(rows, "packageNameAndroid", android.PackageNameAndroid);
                Push(rows, "developerPayloadAndroid", android.DeveloperPayloadAndroid);
                Push(rows, "obfuscatedAccountIdAndroid",
                    android.ObfuscatedAccountIdAndroid);
                Push(rows, "obfuscatedProfileIdAndroid",
                    android.ObfuscatedProfileIdAndroid);
                Push(rows, "isAcknowledgedAndroid",
                    FormatBoolean(android.IsAcknowledgedAndroid));
                Push(rows, "autoRenewingAndroid",
                    FormatBoolean(android.AutoRenewingAndroid));
                Push(rows, "dataAndroid", RedactedIfPresent(android.DataAndroid));
                break;
        }

        Push(rows, "purchaseToken",
            string.IsNullOrEmpty(common.PurchaseToken) ? null : "<redacted>");
        return rows;
    }

    public static string ResolveTransactionId(Purchase purchase) =>
        purchase switch
        {
            PurchaseIOS ios when !string.IsNullOrEmpty(ios.TransactionId) => ios.TransactionId,
            PurchaseAndroid android when !string.IsNullOrEmpty(android.TransactionId) => android.TransactionId,
            _ => ((PurchaseCommon)purchase).Id,
        };

    private static void Push(List<PurchaseDetailRow> rows, string label, object? value)
    {
        if (value is null) return;
        var s = value.ToString();
        if (string.IsNullOrEmpty(s)) return;
        rows.Add(new PurchaseDetailRow(label, s!));
    }

    private static string? RedactedIfPresent(string? value) =>
        string.IsNullOrEmpty(value) ? null : "<redacted>";

    private static string? FormatBoolean(bool? value) =>
        value.HasValue ? (value.Value ? "Yes" : "No") : null;

    private static string? FormatDate(double? timestamp)
    {
        if (!timestamp.HasValue) return null;
        try
        {
            return DateTimeOffset.FromUnixTimeMilliseconds((long)timestamp.Value)
                .UtcDateTime.ToString("o");
        }
        catch
        {
            return null;
        }
    }

    private static string? FormatList(IReadOnlyList<string>? value) =>
        value is null || value.Count == 0 ? null : string.Join(", ", value);

    private static string Capitalize(string s) =>
        string.IsNullOrEmpty(s) ? s : char.ToUpper(s[0]) + s[1..];
}
