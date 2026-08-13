#nullable enable

using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using OpenIap;

namespace OpenIap.Maui;

/// <summary>
/// Options for the OpenIAP kit HTTP API. Mirrors the JavaScript
/// <c>kitApi({ apiKey, baseUrl })</c> helper.
/// </summary>
public sealed record KitApiOptions
{
    public required string ApiKey { get; init; }
    public string? BaseUrl { get; init; }
    public HttpClient? HttpClient { get; init; }
}

internal static class TolerantJson
{
    public static T? Deserialize<T>(JsonElement element, JsonSerializerOptions options)
        where T : class
    {
        try
        {
            return element.Deserialize<T>(options);
        }
        catch (JsonException)
        {
            return null;
        }
        catch (InvalidOperationException)
        {
            return null;
        }
        catch (NotSupportedException)
        {
            return null;
        }
    }
}

internal sealed class TolerantJsonObjectConverter<T> : JsonConverter<T?>
    where T : class
{
    public override T? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var document = JsonDocument.ParseValue(ref reader);
        return TolerantJson.Deserialize<T>(document.RootElement, options);
    }

    public override void Write(Utf8JsonWriter writer, T? value, JsonSerializerOptions options)
        => JsonSerializer.Serialize(writer, value, options);
}

internal sealed class TolerantJsonListConverter<T> : JsonConverter<IReadOnlyList<T>>
    where T : class
{
    public override IReadOnlyList<T> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var document = JsonDocument.ParseValue(ref reader);
        if (document.RootElement.ValueKind != JsonValueKind.Array)
        {
            throw new JsonException($"Expected an array of {typeof(T).Name} values.");
        }

        var values = new List<T>();
        foreach (var element in document.RootElement.EnumerateArray())
        {
            var value = TolerantJson.Deserialize<T>(element, options);
            if (value is not null) values.Add(value);
        }
        return values;
    }

    public override void Write(Utf8JsonWriter writer, IReadOnlyList<T> value, JsonSerializerOptions options)
        => JsonSerializer.Serialize(writer, value, options);
}

public sealed record KitSubscription
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("productId")]
    public required string ProductId { get; init; }
    [JsonPropertyName("platform")]
    public required IapPlatform Platform { get; init; }
    [JsonPropertyName("state")]
    public required string State { get; init; }
    [JsonPropertyName("expiresAt")]
    public double? ExpiresAt { get; init; }
    [JsonPropertyName("renewsAt")]
    public double? RenewsAt { get; init; }
    [JsonPropertyName("willRenew")]
    public bool? WillRenew { get; init; }
    [JsonPropertyName("cancellationReason")]
    public string? CancellationReason { get; init; }
    [JsonPropertyName("currency")]
    public string? Currency { get; init; }
    [JsonPropertyName("priceAmountMicros")]
    public double? PriceAmountMicros { get; init; }
    [JsonPropertyName("startedAt")]
    public required double StartedAt { get; init; }
    [JsonPropertyName("updatedAt")]
    public required double UpdatedAt { get; init; }
    [JsonPropertyName("purchaseToken")]
    public required string PurchaseToken { get; init; }
    [JsonPropertyName("userId")]
    public string? UserId { get; init; }
}

public sealed record EntitlementsResponse
{
    [JsonPropertyName("userId")]
    public required string UserId { get; init; }
    [JsonPropertyName("productIds")]
    public required IReadOnlyList<string> ProductIds { get; init; }
    [JsonPropertyName("subscriptions")]
    [JsonConverter(typeof(TolerantJsonListConverter<KitSubscription>))]
    public required IReadOnlyList<KitSubscription> Subscriptions { get; init; }
}

public sealed record StatusResponse
{
    [JsonPropertyName("active")]
    public required bool Active { get; init; }
    [JsonPropertyName("subscription")]
    [JsonConverter(typeof(TolerantJsonObjectConverter<KitSubscription>))]
    public KitSubscription? Subscription { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum KitProductPlatform
{
    IOS,
    Android,
}

public sealed record KitProductClientPayload
{
    [JsonPropertyName("format")]
    public required string Format { get; init; }
    [JsonPropertyName("body")]
    public required string Body { get; init; }
    [JsonPropertyName("version")]
    public required double Version { get; init; }
    [JsonPropertyName("updatedAt")]
    public required double UpdatedAt { get; init; }
}

public sealed record KitProductOffer
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }
    [JsonPropertyName("kind")]
    public required string Kind { get; init; }
    [JsonPropertyName("duration")]
    public string? Duration { get; init; }
    [JsonPropertyName("numberOfPeriods")]
    public double? NumberOfPeriods { get; init; }
    [JsonPropertyName("priceAmountMicros")]
    public double? PriceAmountMicros { get; init; }
    [JsonPropertyName("currency")]
    public string? Currency { get; init; }
}

public sealed record KitProduct
{
    [JsonPropertyName("productId")]
    public required string ProductId { get; init; }
    [JsonPropertyName("platform")]
    public required KitProductPlatform Platform { get; init; }
    [JsonPropertyName("type")]
    public required string Type { get; init; }
    [JsonPropertyName("title")]
    public required string Title { get; init; }
    [JsonPropertyName("description")]
    public string? Description { get; init; }
    [JsonPropertyName("priceAmountMicros")]
    public double? PriceAmountMicros { get; init; }
    [JsonPropertyName("currency")]
    public string? Currency { get; init; }
    [JsonPropertyName("state")]
    public required string State { get; init; }
    [JsonPropertyName("storeRef")]
    public string? StoreRef { get; init; }
    [JsonPropertyName("subscriptionGroupId")]
    public string? SubscriptionGroupId { get; init; }
    [JsonPropertyName("subscriptionGroupName")]
    public string? SubscriptionGroupName { get; init; }
    [JsonPropertyName("billingPeriod")]
    public string? BillingPeriod { get; init; }
    [JsonPropertyName("offers")]
    [JsonConverter(typeof(TolerantJsonListConverter<KitProductOffer>))]
    public IReadOnlyList<KitProductOffer>? Offers { get; init; }
    [JsonPropertyName("updatedAt")]
    public required double UpdatedAt { get; init; }
    [JsonPropertyName("clientPayload")]
    public KitProductClientPayload? ClientPayload { get; init; }
}

public sealed record KitProductsOptions
{
    public KitProductPlatform? Platform { get; init; }
    public bool? IncludeClientPayload { get; init; }
    public int? Limit { get; init; }
    public string? Cursor { get; init; }
}

public sealed record KitProductsResponse
{
    [JsonPropertyName("products")]
    [JsonConverter(typeof(TolerantJsonListConverter<KitProduct>))]
    public required IReadOnlyList<KitProduct> Products { get; init; }
    [JsonPropertyName("hasMore")]
    public bool? HasMore { get; init; }
    [JsonPropertyName("nextCursor")]
    public string? NextCursor { get; init; }
}

public sealed record KitClientPayloadResponse
{
    [JsonPropertyName("clientPayload")]
    public required KitProductClientPayload ClientPayload { get; init; }
}

public sealed record BindUserResponse
{
    [JsonPropertyName("ok")]
    public required bool Ok { get; init; }
    [JsonPropertyName("bound")]
    public required bool Bound { get; init; }
}

public sealed class KitApiError : Exception
{
    public KitApiError(int status, object? body, string message)
        : base(message)
    {
        Status = status;
        Body = body;
    }

    public int Status { get; }
    public object? Body { get; }
}

public sealed class KitApiClient
{
    private const string DefaultBaseUrl = "https://kit.openiap.dev";
    private readonly HttpClient _http;

    internal KitApiClient(KitApiOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
        {
            throw new ArgumentException("kitApi requires a non-empty apiKey.", nameof(options));
        }

        ApiKey = options.ApiKey;
        BaseUrl = TrimTrailingSlash(options.BaseUrl ?? DefaultBaseUrl);
        _http = options.HttpClient ?? new HttpClient();
    }

    public string ApiKey { get; }
    public string BaseUrl { get; }

    /// <summary>
    /// GET /v1/subscriptions/status/{apiKey}?userId=...
    /// </summary>
    public Task<StatusResponse> StatusAsync(string userId, CancellationToken cancellationToken = default)
        => CallAsync<StatusResponse>(
            $"/v1/subscriptions/status/{Uri.EscapeDataString(ApiKey)}?userId={Uri.EscapeDataString(userId)}",
            null,
            cancellationToken);

    /// <summary>
    /// GET /v1/subscriptions/entitlements/{apiKey}?userId=...
    /// </summary>
    public Task<EntitlementsResponse> EntitlementsAsync(string userId, CancellationToken cancellationToken = default)
        => CallAsync<EntitlementsResponse>(
            $"/v1/subscriptions/entitlements/{Uri.EscapeDataString(ApiKey)}?userId={Uri.EscapeDataString(userId)}",
            null,
            cancellationToken);

    /// <summary>
    /// GET /v1/products/{apiKey}. Client payload bodies are opt-in.
    /// </summary>
    public Task<KitProductsResponse> ProductsAsync(
        KitProductsOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        if (options?.IncludeClientPayload == true && options.Platform is null)
        {
            throw new ArgumentException(
                "ProductsAsync requires Platform when IncludeClientPayload is true.",
                nameof(options));
        }
        var query = new List<string>();
        if (options?.Platform is { } platform)
        {
            query.Add($"platform={Uri.EscapeDataString(platform.ToString())}");
        }
        if (options?.IncludeClientPayload is { } includeClientPayload)
        {
            query.Add($"includeClientPayload={includeClientPayload.ToString().ToLowerInvariant()}");
        }
        if (options?.Limit is { } limit)
        {
            query.Add($"limit={limit}");
        }
        if (options?.Cursor is { } cursor)
        {
            query.Add($"cursor={Uri.EscapeDataString(cursor)}");
        }
        var suffix = query.Count == 0 ? string.Empty : $"?{string.Join("&", query)}";
        return CallAsync<KitProductsResponse>(
            $"/v1/products/{Uri.EscapeDataString(ApiKey)}{suffix}",
            null,
            cancellationToken);
    }

    /// <summary>
    /// GET one public client payload by (platform, productId).
    /// </summary>
    public Task<KitClientPayloadResponse> ClientPayloadAsync(
        string productId,
        KitProductPlatform platform,
        CancellationToken cancellationToken = default)
        => CallAsync<KitClientPayloadResponse>(
            $"/v1/products/{Uri.EscapeDataString(ApiKey)}/{Uri.EscapeDataString(productId)}/client-payload?platform={Uri.EscapeDataString(platform.ToString())}",
            null,
            cancellationToken);

    /// <summary>
    /// POST /v1/subscriptions/bind-user/{apiKey}
    /// </summary>
    public Task<BindUserResponse> BindUserAsync(
        string purchaseToken,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var body = JsonSerializer.Serialize(new { purchaseToken, userId }, JsonOptions.Default);
        return CallAsync<BindUserResponse>(
            $"/v1/subscriptions/bind-user/{Uri.EscapeDataString(ApiKey)}",
            new StringContent(body, Encoding.UTF8, "application/json"),
            cancellationToken);
    }

    private async Task<T> CallAsync<T>(
        string path,
        HttpContent? content,
        CancellationToken cancellationToken)
    {
        var normalizedPath = path.StartsWith("/", StringComparison.Ordinal) ? path : $"/{path}";
        using var request = new HttpRequestMessage(
            content is null ? HttpMethod.Get : HttpMethod.Post,
            $"{BaseUrl}{normalizedPath}")
        {
            Content = content,
        };
        request.Headers.Accept.ParseAdd("application/json");

        using var response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        var parsed = ParseBody(text, out var parseError);

        if (!response.IsSuccessStatusCode)
        {
            throw new KitApiError(
                (int)response.StatusCode,
                parsed ?? text,
                $"kit {path} returned {(int)response.StatusCode}");
        }

        if (parseError is not null)
        {
            throw new KitApiError(
                (int)response.StatusCode,
                text,
                $"kit {path} returned a non-JSON {(int)response.StatusCode} body ({parseError.Message})");
        }

        if (parsed is null)
        {
            throw new KitApiError(
                (int)response.StatusCode,
                null,
                $"kit {path} returned an empty {(int)response.StatusCode} body");
        }

        return parsed.Deserialize<T>(JsonOptions.Default)
            ?? throw new KitApiError(
                (int)response.StatusCode,
                parsed,
                $"kit {path} returned an unexpected body");
    }

    private static JsonNode? ParseBody(string text, out JsonException? parseError)
    {
        parseError = null;
        if (string.IsNullOrEmpty(text)) return null;
        try
        {
            return JsonNode.Parse(text);
        }
        catch (JsonException ex)
        {
            parseError = ex;
            return null;
        }
    }

    internal static string TrimTrailingSlash(string url)
        => url.EndsWith("/", StringComparison.Ordinal) ? url[..^1] : url;
}
