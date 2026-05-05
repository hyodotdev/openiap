// Mirrors libraries/expo-iap/example/src/utils/constants.ts so the MAUI
// example exercises the same SKUs as the React Native / Expo / Flutter / KMP
// reference apps.

namespace OpenIap.Maui.Example;

public static class Constants
{
    // One-time purchase product IDs split by consumption behavior.
    public static readonly string[] ConsumableProductIds = new[]
    {
        "dev.hyo.martie.10bulbs",
        "dev.hyo.martie.30bulbs",
    };

    public static readonly string[] NonConsumableProductIds = new[]
    {
        "dev.hyo.martie.certified",
    };

    public static readonly string[] ProductIds =
        ConsumableProductIds.Concat(NonConsumableProductIds).ToArray();

    // Subscription product IDs.
    public static readonly string[] SubscriptionProductIds = new[]
    {
        "dev.hyo.martie.premium",
        "dev.hyo.martie.premium_year",
    };

    public static readonly string DefaultSubscriptionProductId =
        SubscriptionProductIds[0];

    public static readonly HashSet<string> ConsumableProductIdSet =
        new(ConsumableProductIds, StringComparer.Ordinal);

    public static readonly HashSet<string> NonConsumableProductIdSet =
        new(NonConsumableProductIds, StringComparer.Ordinal);
}
