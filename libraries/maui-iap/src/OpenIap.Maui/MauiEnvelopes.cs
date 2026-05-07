// Wrapper records that match the JSON envelopes emitted by:
//   • OpenIapMauiModule (Android)
//   • the C# resolver code on iOS, which builds the same shape from
//     NSDictionary results returned by the OpenIapModule ObjC bridge.
//
// Keeping the envelope shape uniform across both platforms means the
// resolver impls can share input/output marshaling helpers.

#nullable enable

using System.Collections.Generic;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Hyo.OpenIap.Maui;

/// <summary>{ "value": T } envelope for primitives.</summary>
internal sealed class ValueEnvelope<T>
{
    [JsonPropertyName("value")] public T? Value { get; set; }
}

/// <summary>{ "items": [...] } envelope for list-of-typed-records.</summary>
internal sealed class ItemsEnvelope<T>
{
    [JsonPropertyName("items")] public List<T>? Items { get; set; }
}

/// <summary>
/// Tagged-union envelope for FetchProductsResult.
/// <c>kind</c> is one of <c>"products" | "subscriptions" | "all"</c>;
/// <c>items</c> carries the matching shape.
/// </summary>
internal sealed class FetchProductsEnvelope
{
    [JsonPropertyName("kind")] public string? Kind { get; set; }
    [JsonPropertyName("items")] public JsonArray? Items { get; set; }
}

/// <summary>
/// Tagged-union envelope for RequestPurchaseResult.
/// <c>kind</c> is one of <c>"purchase" | "purchases" | "none"</c>.
/// </summary>
internal sealed class RequestPurchaseEnvelope
{
    [JsonPropertyName("kind")] public string? Kind { get; set; }
    [JsonPropertyName("value")] public JsonNode? Value { get; set; }
    [JsonPropertyName("items")] public JsonArray? Items { get; set; }
}
