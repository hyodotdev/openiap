using System.Reflection;
using OpenIap;

namespace OpenIap.Maui.Example.Utils;

internal static class IapKitSettings
{
    // Mobile verification must use an openiap-kit_pk_ publishable key. Never
    // place an openiap-kit_sk_ secret admin key in this app configuration.

    // Baked in from iapkit.props at build time; a device has no environment.
    private static readonly IReadOnlyDictionary<string, string> BuildMetadata =
        typeof(IapKitSettings).Assembly
            .GetCustomAttributes<AssemblyMetadataAttribute>()
            .Where(attribute => attribute.Value is not null)
            .GroupBy(attribute => attribute.Key, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First().Value!, StringComparer.Ordinal);

    private static string? FromBuild(string key) =>
        BuildMetadata.TryGetValue(key, out var value) ? value : null;

    public static string? ApiKey =>
        RejectSecretKey(
            FirstNonBlank(
                Environment.GetEnvironmentVariable("IAPKIT_API_KEY"),
                FromBuild("IapkitApiKey")));

    /// <summary>Refuses a secret key rather than sending it. The key is still baked
    /// into assembly metadata, so keep it out of iapkit.props in the first place.</summary>
    private static string? RejectSecretKey(string? apiKey)
    {
        if (apiKey is null || !apiKey.StartsWith("openiap-kit_sk_", StringComparison.Ordinal))
        {
            return apiKey;
        }

        Console.WriteLine("[IapKitSettings] api key is a secret sk_ key; use an openiap-kit_pk_ key");
        return null;
    }

    /// <summary>Configured local origin, or null when none is set.</summary>
    public static string? LocalBaseUrl =>
        FirstNonBlank(
            Environment.GetEnvironmentVariable("IAPKIT_BASE_URL"),
            FromBuild("IapkitBaseUrl"));

    /// <summary>App Tester receipts only verify against Amazon's RVS Cloud Sandbox.</summary>
    public static bool AmazonRvsSandbox =>
        string.Equals(
            FirstNonBlank(
                Environment.GetEnvironmentVariable("AMAZON_RVS_SANDBOX"),
                FromBuild("AmazonRvsSandbox")),
            "true",
            StringComparison.OrdinalIgnoreCase);

    /// <param name="baseUrl">Local origin for Local (IAPKit); null uses the hosted server.</param>
    public static IapkitConfirmationOptions ConfirmationOptions(string? baseUrl) => new()
    {
        ApiKey = ApiKey,
        BaseUrl = baseUrl,
        Amazon = new IapkitAmazonOptions
        {
            Sandbox = AmazonRvsSandbox,
            ExpectedEnvironment = Environment.GetEnvironmentVariable("AMAZON_EXPECTED_ENVIRONMENT")
                ?? FromBuild("AmazonExpectedEnvironment"),
            // These term-to-base IDs belong to Martie's Amazon catalog.
            VerifiedProductId = productId =>
                Constants.SubscriptionProductIds.Contains(productId) ? AmazonSubscriptionBaseId : productId,
        },
        VerifyAs = purchase => IsAmazonExample(purchase) ? IapStore.Amazon : null,
    };

    private const string AmazonSubscriptionBaseId = "dev.hyo.martie.premium.base";
    public static IReadOnlyList<string> SubscriptionQueryIds { get; } =
        [.. Constants.SubscriptionProductIds, AmazonSubscriptionBaseId];

    public static string? SubscriptionProductId(string productId, string? currentPlanId) =>
        Constants.SubscriptionProductIds.Contains(productId) ? productId :
        productId == AmazonSubscriptionBaseId && currentPlanId is not null &&
        Constants.SubscriptionProductIds.Contains(currentPlanId) ? currentPlanId : null;

    public static string? SubscriptionProductId(Purchase purchase) =>
        Constants.SubscriptionProductIds.Contains(purchase.ProductId) ||
        purchase.Store == IapStore.Amazon || IsAmazonExample(purchase)
            ? SubscriptionProductId(purchase.ProductId, purchase.CurrentPlanId) : null;

    // Only this known community adapter uses Amazon's server verification.
    private static bool IsAmazonExample(Purchase purchase) =>
        purchase.Store == IapStore.Unknown && purchase.StoreId == "amazon_example";

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
