// Translate Foundation values (NSDictionary / NSArray / NSString / NSNumber)
// returned by the OpenIapModule ObjC bridge into System.Text.Json nodes so
// the resolver layer can deserialize them into the typed C# records.

#nullable enable

using System;
using System.Text.Json.Nodes;
using Foundation;

namespace OpenIap.Maui.Platforms.iOS;

internal static class NSObjectJsonBridge
{
    public static JsonNode? ToJsonNode(NSObject? value)
    {
        return value switch
        {
            null => null,
            NSNull => null,
            NSString s => JsonValue.Create((string)s),
            NSNumber n => NumberToNode(n),
            NSArray a => ArrayToNode(a),
            NSDictionary d => DictToNode(d),
            NSDate d => JsonValue.Create((long)(d.SecondsSince1970 * 1000)),
            _ => JsonValue.Create(value.ToString()),
        };
    }

    public static JsonObject? DictToObject(NSDictionary? dict)
    {
        if (dict is null) return null;
        var json = new JsonObject();
        foreach (var key in dict.Keys)
        {
            if (key?.ToString() != "__typename") continue;
            json["__typename"] = ToJsonNode(dict.ObjectForKey(key));
            break;
        }

        foreach (var key in dict.Keys)
        {
            if (key is null) continue;
            var k = key.ToString();
            if (k is null) continue;
            if (k == "__typename") continue;
            var v = dict.ObjectForKey(key);
            json[k] = ToJsonNode(v);
        }
        return json;
    }

    public static JsonArray? ArrayToArray(NSArray? array)
    {
        if (array is null) return null;
        var arr = new JsonArray();
        for (nuint i = 0; i < array.Count; i++)
        {
            var item = array.GetItem<NSObject>(i);
            arr.Add(ToJsonNode(item));
        }
        return arr;
    }

    private static JsonNode? DictToNode(NSDictionary dict) => DictToObject(dict);

    private static JsonNode? ArrayToNode(NSArray array) => ArrayToArray(array);

    private static JsonNode? NumberToNode(NSNumber n)
    {
        // ObjCType encodes the underlying primitive: 'c' = char/BOOL, 'i' = int,
        // 'q' = long, 'f' = float, 'd' = double, etc. We coerce booleans first
        // (so true/false don't surface as 1/0) and fall back to double for the
        // numeric range that JSON natively supports.
        var t = n.ObjCType;
        if (t == "c" || t == "B") return JsonValue.Create(n.BoolValue);
        if (t == "i" || t == "s" || t == "l") return JsonValue.Create(n.Int32Value);
        if (t == "q" || t == "Q") return JsonValue.Create(n.Int64Value);
        if (t == "f") return JsonValue.Create((double)n.FloatValue);
        return JsonValue.Create(n.DoubleValue);
    }
}
