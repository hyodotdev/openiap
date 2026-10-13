// Shared JsonSerializerOptions for every generated record. The generated types
// carry their own enum converters and [JsonPolymorphic] discriminators.

#nullable enable

using System.Text.Json;
using System.Text.Json.Serialization;

namespace OpenIap.Maui;

internal static class JsonOptions
{
    public static readonly JsonSerializerOptions Default = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        // Native encoders do not promise key order, so __typename may come last.
        AllowOutOfOrderMetadataProperties = true,
    };
}
