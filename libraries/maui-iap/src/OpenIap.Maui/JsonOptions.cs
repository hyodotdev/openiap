// Shared JsonSerializerOptions used to (de)serialize every generated record.
// The codegen plugin emits per-enum JsonConverters and [JsonPolymorphic]
// discriminators on every union, so the only options we need to set globally
// are case-insensitive matching (the wire is camelCase but C# ignores case
// anyway via [JsonPropertyName]) and to NOT write nulls (matches the module
// shape that omits null fields).

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
        // The generated polymorphic types use __typename for discrimination;
        // STJ matches the property name verbatim so no casing tweak is needed.
    };
}
