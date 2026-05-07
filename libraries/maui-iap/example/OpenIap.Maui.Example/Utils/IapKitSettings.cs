using Hyo.OpenIap;
using Microsoft.Maui.Storage;

namespace OpenIap.Maui.Example.Utils;

internal static class IapKitSettings
{
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

    public static RequestVerifyPurchaseWithIapkitProps CreateVerifyProps(string token)
    {
        return new RequestVerifyPurchaseWithIapkitProps
        {
            ApiKey = ApiKey,
            Apple = new RequestVerifyPurchaseWithIapkitAppleProps { Jws = token },
            Google = new RequestVerifyPurchaseWithIapkitGoogleProps { PurchaseToken = token },
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
