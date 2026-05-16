// Translate Foundation values (NSDictionary / NSArray / NSString / NSNumber)
// returned by the OpenIapModule ObjC bridge into System.Text.Json nodes so
// the resolver layer can deserialize them into the typed C# records.

#nullable enable

using System;
using System.Collections.Generic;
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

    public static NSDictionary JsonObjectToDictionary(JsonObject json)
    {
        var keys = new List<NSObject>();
        var values = new List<NSObject>();

        foreach (var (key, node) in json)
        {
            var value = JsonToNSObject(node);
            if (value is null) continue;
            keys.Add(new NSString(key));
            values.Add(value);
        }

        return NSDictionary.FromObjectsAndKeys(values.ToArray(), keys.ToArray());
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

    private static NSObject? JsonToNSObject(JsonNode? node)
    {
        return node switch
        {
            null => null,
            JsonObject obj => JsonObjectToDictionary(obj),
            JsonArray array => JsonArrayToNSArray(array),
            JsonValue value => JsonValueToNSObject(value),
            _ => null,
        };
    }

    private static NSArray JsonArrayToNSArray(JsonArray array)
    {
        var values = new List<NSObject>();
        foreach (var item in array)
        {
            var value = JsonToNSObject(item);
            if (value is not null) values.Add(value);
        }
        return NSArray.FromNSObjects(values.ToArray());
    }

    private static NSObject JsonValueToNSObject(JsonValue value)
    {
        if (value.TryGetValue<bool>(out var boolValue)) return NSNumber.FromBoolean(boolValue);
        if (value.TryGetValue<int>(out var intValue)) return NSNumber.FromInt32(intValue);
        if (value.TryGetValue<long>(out var longValue)) return NSNumber.FromInt64(longValue);
        if (value.TryGetValue<double>(out var doubleValue)) return NSNumber.FromDouble(doubleValue);
        if (value.TryGetValue<string>(out var stringValue)) return new NSString(stringValue);
        return new NSString(value.ToJsonString());
    }

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
