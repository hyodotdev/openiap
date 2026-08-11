using OpenIap;
using Microsoft.Maui.Storage;

namespace OpenIap.Maui.Example.Utils;

internal static class IapKitSettings
{
    // Mobile verification must use an openiap-kit_pk_ publishable key. Never
    // place an openiap-kit_sk_ secret admin key in this app configuration.
    private const string ApiKeyPreferenceKey = "openiap.example.iapkit.apiKey";
    private const string BaseUrlPreferenceKey = "openiap.example.iapkit.baseUrl";
    private const string DefaultBaseUrl = "https://kit.openiap.dev";

    public static string? ApiKey =>
        FirstNonBlank(
            Environment.GetEnvironmentVariable("EXPO_PUBLIC_IAPKIT_API_KEY"),
            Environment.GetEnvironmentVariable("IAPKIT_API_KEY"),
            Preferences.Default.Get(ApiKeyPreferenceKey, string.Empty));

    public static string BaseUrl =>
        FirstNonBlank(
            Environment.GetEnvironmentVariable("EXPO_PUBLIC_IAPKIT_BASE_URL"),
            Environment.GetEnvironmentVariable("IAPKIT_BASE_URL"),
            Preferences.Default.Get(BaseUrlPreferenceKey, string.Empty))
        ?? DefaultBaseUrl;

    public static void Save(string? apiKey, string? baseUrl)
    {
        SavePreference(ApiKeyPreferenceKey, apiKey);
        SavePreference(BaseUrlPreferenceKey, baseUrl);
    }

    public static RequestVerifyPurchaseWithIapkitProps CreateVerifyProps(Purchase purchase)
    {
        var common = (PurchaseCommon)purchase;
        var token = common.PurchaseToken?.Trim();
        if (string.IsNullOrEmpty(token))
        {
            throw new InvalidOperationException("No purchase token available for IAPKit verification");
        }

        return common.Store switch
        {
            IapStore.Apple => new RequestVerifyPurchaseWithIapkitProps
            {
                ApiKey = ApiKey,
                BaseUrl = BaseUrl,
                Apple = new RequestVerifyPurchaseWithIapkitAppleProps { Jws = token },
            },
            IapStore.Google => new RequestVerifyPurchaseWithIapkitProps
            {
                ApiKey = ApiKey,
                BaseUrl = BaseUrl,
                Google = new RequestVerifyPurchaseWithIapkitGoogleProps { PurchaseToken = token },
            },
            IapStore.Amazon => new RequestVerifyPurchaseWithIapkitProps
            {
                ApiKey = ApiKey,
                BaseUrl = BaseUrl,
                Amazon = new RequestVerifyPurchaseWithIapkitAmazonProps
                {
                    ExpectedProductId = common.ProductId,
                    ReceiptId = token,
                    UserId = (purchase as PurchaseAndroid)?.UserIdAmazon,
                    // The example catalog is exercised with Amazon App Tester.
                    Sandbox = true,
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

    private static void SavePreference(string key, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            Preferences.Default.Remove(key);
        }
        else
        {
            Preferences.Default.Set(key, value.Trim());
        }
    }
}
