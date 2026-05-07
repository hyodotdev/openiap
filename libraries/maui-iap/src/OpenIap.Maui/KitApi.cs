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
    public required IReadOnlyList<KitSubscription> Subscriptions { get; init; }
}

public sealed record StatusResponse
{
    [JsonPropertyName("active")]
    public required bool Active { get; init; }
    [JsonPropertyName("subscription")]
    public KitSubscription? Subscription { get; init; }
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
