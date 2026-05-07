#nullable enable

using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Hyo.OpenIap;

namespace Hyo.OpenIap.Maui;

public sealed record WebhookListenerOptions
{
    public required string ApiKey { get; init; }
    public string? BaseUrl { get; init; }
    public required Action<WebhookEvent> OnEvent { get; init; }
    public Action<WebhookListenerError>? OnError { get; init; }
    public HttpClient? HttpClient { get; init; }
}

public interface WebhookListener : IDisposable
{
    void Close();
}

public sealed record WebhookListenerError
{
    public required string Code { get; init; }
    public required string Message { get; init; }
    public Exception? Cause { get; init; }
}

public enum ParsedWebhookEventKind
{
    Ok,
    Skip,
    Error
}

public sealed record ParsedWebhookEventResult
{
    public required ParsedWebhookEventKind Kind { get; init; }
    public WebhookEvent? Event { get; init; }
    public string? Reason { get; init; }
    public string? Message { get; init; }
}

public static class WebhookClient
{
    private const string DefaultBaseUrl = "https://kit.openiap.dev";

    public static readonly IReadOnlyList<WebhookEventType> WebhookEventTypes =
        new[]
        {
            WebhookEventType.SubscriptionStarted,
            WebhookEventType.SubscriptionRenewed,
            WebhookEventType.SubscriptionExpired,
            WebhookEventType.SubscriptionInGracePeriod,
            WebhookEventType.SubscriptionInBillingRetry,
            WebhookEventType.SubscriptionRecovered,
            WebhookEventType.SubscriptionCanceled,
            WebhookEventType.SubscriptionUncanceled,
            WebhookEventType.SubscriptionRevoked,
            WebhookEventType.SubscriptionPriceChange,
            WebhookEventType.SubscriptionProductChanged,
            WebhookEventType.SubscriptionPaused,
            WebhookEventType.SubscriptionResumed,
            WebhookEventType.PurchaseRefunded,
            WebhookEventType.PurchaseConsumptionRequest,
            WebhookEventType.TestNotification,
        };

    public static WebhookListener ConnectWebhookStream(WebhookListenerOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey))
        {
            throw new ArgumentException("connectWebhookStream requires a non-empty apiKey.", nameof(options));
        }

        if (options.OnEvent is null)
        {
            throw new ArgumentException("connectWebhookStream requires an onEvent callback.", nameof(options));
        }

        return new HttpWebhookListener(options);
    }

    public static ParsedWebhookEventResult ParseWebhookEventData(string raw)
    {
        if (string.IsNullOrEmpty(raw))
        {
            return new ParsedWebhookEventResult
            {
                Kind = ParsedWebhookEventKind.Skip,
                Reason = "heartbeat",
            };
        }

        WebhookEvent? webhookEvent;
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (!root.TryGetProperty("type", out var typeProp) ||
                typeProp.ValueKind != JsonValueKind.String)
            {
                return new ParsedWebhookEventResult
                {
                    Kind = ParsedWebhookEventKind.Skip,
                    Reason = "stream-control",
                };
            }

            if (!HasString(root, "id") || !HasNumber(root, "occurredAt") || !HasNumber(root, "receivedAt"))
            {
                return new ParsedWebhookEventResult
                {
                    Kind = ParsedWebhookEventKind.Error,
                    Message = "WebhookEvent missing required fields (id/occurredAt/receivedAt)",
                };
            }

            webhookEvent = JsonSerializer.Deserialize<WebhookEvent>(raw, JsonOptions.Default);
        }
        catch (JsonException ex)
        {
            return new ParsedWebhookEventResult
            {
                Kind = ParsedWebhookEventKind.Error,
                Message = $"Failed to parse SSE payload: {ex.Message}",
            };
        }

        if (webhookEvent is null)
        {
            return new ParsedWebhookEventResult
            {
                Kind = ParsedWebhookEventKind.Error,
                Message = "WebhookEvent missing required fields (id/occurredAt/receivedAt)",
            };
        }

        if (webhookEvent.Type != WebhookEventType.TestNotification &&
            string.IsNullOrEmpty(webhookEvent.PurchaseToken))
        {
            return new ParsedWebhookEventResult
            {
                Kind = ParsedWebhookEventKind.Error,
                Message = "WebhookEvent missing required field purchaseToken",
            };
        }

        return new ParsedWebhookEventResult
        {
            Kind = ParsedWebhookEventKind.Ok,
            Event = webhookEvent,
        };
    }

    private static bool HasString(JsonElement element, string propertyName)
        => element.TryGetProperty(propertyName, out var property) &&
           property.ValueKind == JsonValueKind.String;

    private static bool HasNumber(JsonElement element, string propertyName)
        => element.TryGetProperty(propertyName, out var property) &&
           property.ValueKind == JsonValueKind.Number;

    private sealed class HttpWebhookListener : WebhookListener
    {
        private readonly WebhookListenerOptions _options;
        private readonly HttpClient _http;
        private readonly bool _ownsHttpClient;
        private readonly CancellationTokenSource _cts = new();
        private readonly HashSet<string> _seenIds = new(StringComparer.Ordinal);
        private readonly Queue<string> _seenOrder = new();
        public HttpWebhookListener(WebhookListenerOptions options)
        {
            _options = options;
            _ownsHttpClient = options.HttpClient is null;
            _http = options.HttpClient ?? new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
            _ = Task.Run(RunAsync);
        }

        public void Close()
        {
            if (!_cts.IsCancellationRequested)
            {
                _cts.Cancel();
            }
        }

        public void Dispose()
        {
            Close();
            _cts.Dispose();
            if (_ownsHttpClient)
            {
                _http.Dispose();
            }
        }

        private async Task RunAsync()
        {
            while (!_cts.Token.IsCancellationRequested)
            {
                try
                {
                    await ConnectOnceAsync(_cts.Token).ConfigureAwait(false);
                }
                catch (OperationCanceledException) when (_cts.Token.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    if (_cts.Token.IsCancellationRequested)
                    {
                        return;
                    }

                    _options.OnError?.Invoke(new WebhookListenerError
                    {
                        Code = "TRANSPORT_ERROR",
                        Message = "SSE transport error (auto-reconnecting)",
                        Cause = ex,
                    });
                }

                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(1), _cts.Token).ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }

        private async Task ConnectOnceAsync(CancellationToken cancellationToken)
        {
            var baseUrl = KitApiClient.TrimTrailingSlash(_options.BaseUrl ?? DefaultBaseUrl);
            var url = $"{baseUrl}/v1/webhooks/stream/{Uri.EscapeDataString(_options.ApiKey)}";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Accept.ParseAdd("text/event-stream");

            using var response = await _http.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
            using var reader = new StreamReader(stream, Encoding.UTF8);
            var data = new StringBuilder();

            while (!cancellationToken.IsCancellationRequested)
            {
                var line = await reader.ReadLineAsync(cancellationToken).ConfigureAwait(false);
                if (line is null)
                {
                    return;
                }

                if (line.Length == 0)
                {
                    Dispatch(data.ToString());
                    data.Clear();
                    continue;
                }

                if (line.StartsWith("data:", StringComparison.Ordinal))
                {
                    if (data.Length > 0)
                    {
                        data.Append('\n');
                    }

                    data.Append(line[5..].TrimStart());
                }
            }
        }

        private void Dispatch(string raw)
        {
            var parsed = ParseWebhookEventData(raw);
            if (parsed.Kind == ParsedWebhookEventKind.Skip)
            {
                return;
            }

            if (parsed.Kind == ParsedWebhookEventKind.Error)
            {
                _options.OnError?.Invoke(new WebhookListenerError
                {
                    Code = "PARSE_ERROR",
                    Message = parsed.Message ?? "Failed to parse webhook event",
                });
                return;
            }

            if (parsed.Event is null || MarkSeen(parsed.Event.Id))
            {
                return;
            }

            _options.OnEvent(parsed.Event);
        }

        private bool MarkSeen(string id)
        {
            if (_seenIds.Contains(id))
            {
                return true;
            }

            _seenIds.Add(id);
            _seenOrder.Enqueue(id);
            if (_seenOrder.Count > 1024)
            {
                var evicted = _seenOrder.Dequeue();
                _seenIds.Remove(evicted);
            }

            return false;
        }
    }
}
