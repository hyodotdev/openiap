// Nothing here may throw: a native iOS callback thread has no managed handler.

#nullable enable

using System;
using System.Text.Json;
using System.Text.Json.Nodes;
using OpenIap;

namespace OpenIap.Maui;

internal static class PurchaseEvents
{
    /// <summary>Decodes one event and delivers it; a failed decode or a throwing listener is logged and dropped.</summary>
    internal static void Deliver(Func<JsonNode?> read, Action<Purchase> deliver, string listener)
    {
        try
        {
            var purchase = read()?.Deserialize<Purchase>(JsonOptions.Default);
            if (purchase is not null) deliver(purchase);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[OpenIapIOS] {listener} listener failed: {ex.Message}");
        }
    }
}
