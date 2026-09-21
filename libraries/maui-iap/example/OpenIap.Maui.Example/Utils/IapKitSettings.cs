using System.Reflection;
using OpenIap;
using Microsoft.Maui.Storage;

namespace OpenIap.Maui.Example.Utils;

internal static class IapKitSettings
{
    // Mobile verification must use an openiap-kit_pk_ publishable key. Never
    // place an openiap-kit_sk_ secret admin key in this app configuration.
    private const string ApiKeyPreferenceKey = "openiap.example.iapkit.apiKey";
    private const string BaseUrlPreferenceKey = "openiap.example.iapkit.baseUrl";

    // Baked in from iapkit.props at build time; a device has no environment.
    private static readonly IReadOnlyDictionary<string, string> BuildMetadata =
        typeof(IapKitSettings).Assembly
            .GetCustomAttributes<AssemblyMetadataAttribute>()
            .Where(attribute => !string.IsNullOrWhiteSpace(attribute.Value))
            .GroupBy(attribute => attribute.Key, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First().Value!, StringComparer.Ordinal);

    private static string? FromBuild(string key) =>
        BuildMetadata.TryGetValue(key, out var value) ? value : null;

    public static string? ApiKey =>
        FirstNonBlank(
            Environment.GetEnvironmentVariable("EXPO_PUBLIC_IAPKIT_API_KEY"),
            Environment.GetEnvironmentVariable("IAPKIT_API_KEY"),
            FromBuild("IapkitApiKey"),
            Preferences.Default.Get(ApiKeyPreferenceKey, string.Empty));

    /// <summary>Configured local origin, or null when none is set.</summary>
    public static string? LocalBaseUrl =>
        FirstNonBlank(
            Environment.GetEnvironmentVariable("EXPO_PUBLIC_IAPKIT_BASE_URL"),
            Environment.GetEnvironmentVariable("IAPKIT_BASE_URL"),
            FromBuild("IapkitBaseUrl"),
            Preferences.Default.Get(BaseUrlPreferenceKey, string.Empty));

    /// <summary>App Tester receipts only verify against Amazon's RVS Cloud Sandbox.</summary>
    public static bool AmazonRvsSandbox =>
        string.Equals(
            FirstNonBlank(
                Environment.GetEnvironmentVariable("AMAZON_RVS_SANDBOX"),
                FromBuild("AmazonRvsSandbox")),
            "true",
            StringComparison.OrdinalIgnoreCase);

    /// <param name="baseUrl">Local origin for Local (IAPKit); null uses the hosted server.</param>
    public static RequestVerifyPurchaseWithIapkitProps CreateVerifyProps(
        Purchase purchase,
        string? baseUrl = null)
    {
        var common = (PurchaseCommon)purchase;
        var token = common.PurchaseToken?.Trim();
        if (string.IsNullOrEmpty(token))
        {
            throw new InvalidOperationException("No purchase token available for IAPKit verification");
        }

        // Null leaves the SDK on its hosted default, matching the other examples.
        var endpoint = string.IsNullOrWhiteSpace(baseUrl) ? null : baseUrl.Trim();

        return common.Store switch
        {
            IapStore.Apple => new RequestVerifyPurchaseWithIapkitProps
            {
                ApiKey = ApiKey,
                BaseUrl = endpoint,
                Apple = new RequestVerifyPurchaseWithIapkitAppleProps { Jws = token },
            },
            IapStore.Google => new RequestVerifyPurchaseWithIapkitProps
            {
                ApiKey = ApiKey,
                BaseUrl = endpoint,
                Google = new RequestVerifyPurchaseWithIapkitGoogleProps { PurchaseToken = token },
            },
            IapStore.Horizon => new RequestVerifyPurchaseWithIapkitProps
            {
                ApiKey = ApiKey,
                BaseUrl = endpoint,
                Horizon = new RequestVerifyPurchaseWithIapkitHorizonProps
                {
                    Sku = common.ProductId,
                },
            },
            IapStore.Amazon => new RequestVerifyPurchaseWithIapkitProps
            {
                ApiKey = ApiKey,
                BaseUrl = endpoint,
                Amazon = new RequestVerifyPurchaseWithIapkitAmazonProps
                {
                    ExpectedProductId = common.ProductId,
                    ReceiptId = token,
                    UserId = (purchase as PurchaseAndroid)?.UserIdAmazon,
                    Sandbox = AmazonRvsSandbox,
                },
            },
            _ => throw new NotSupportedException(
                $"IAPKit verification is not supported for the {common.Store.ToJson()} store."),
        };
    }

    private static string? FirstNonBlank(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Trim();
            }
        }

        return null;
    }
}
