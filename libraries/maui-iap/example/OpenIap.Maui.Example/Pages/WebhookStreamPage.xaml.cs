using System.Text;
using System.Text.Json;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/webhook-stream.tsx — connects to the
// IAPKit SSE webhook stream and renders incoming events. Uses an explicit
// HttpClient because MAUI's HttpClient defaults to buffered responses.
public partial class WebhookStreamPage : ContentPage
{
    private CancellationTokenSource? _cts;
    private readonly HttpClient _http = new() { Timeout = Timeout.InfiniteTimeSpan };
    private bool _testing;

    public WebhookStreamPage()
    {
        InitializeComponent();
        BaseUrlEntry.Text = Environment.GetEnvironmentVariable("EXPO_PUBLIC_IAPKIT_BASE_URL")
            ?? Environment.GetEnvironmentVariable("IAPKIT_BASE_URL")
            ?? "https://kit.openiap.dev";
        ApiKeyEntry.Text = Environment.GetEnvironmentVariable("EXPO_PUBLIC_IAPKIT_API_KEY")
            ?? Environment.GetEnvironmentVariable("IAPKIT_API_KEY")
            ?? string.Empty;
        UpdateEndpointHint();
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        _cts?.Cancel();
        _cts = null;
    }

    private async void OnConnectClicked(object sender, EventArgs e)
    {
        OnDisconnectClicked(this, EventArgs.Empty);
        var apiKey = ApiKeyEntry.Text?.Trim();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            SetStatus("error", "IAPKit API key not configured. Set the API key before connecting.");
            return;
        }

        var url = GetStreamUrl(apiKey);
        _cts = new CancellationTokenSource();
        SetStatus("connecting", null);
        ResetEmptyLog();
        Append($"→ Connecting {url}");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Accept.ParseAdd("text/event-stream");

            using var response = await _http.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                _cts.Token);
            response.EnsureSuccessStatusCode();
            SetStatus("connected", null);

            using var stream = await response.Content.ReadAsStreamAsync(_cts.Token);
            using var reader = new StreamReader(stream, Encoding.UTF8);

            Append("✔ Connected. Waiting for events...");

            while (!_cts.Token.IsCancellationRequested)
            {
                var line = await reader.ReadLineAsync(_cts.Token);
                if (line is null) break;
                if (line.StartsWith("data:", StringComparison.Ordinal))
                {
                    Append(FormatEventData(line[5..].Trim()));
                }
                else if (line.StartsWith("event:", StringComparison.Ordinal))
                {
                    Append($"[event] {line[6..].Trim()}");
                }
            }
        }
        catch (OperationCanceledException) { /* expected on disconnect */ }
        catch (Exception ex)
        {
            SetStatus("error", ex.Message);
            Append($"⚠ {ex.Message}");
        }
    }

    private void OnDisconnectClicked(object sender, EventArgs e)
    {
        if (_cts is null) return;
        _cts.Cancel();
        _cts = null;
        SetStatus("idle", null);
        Append("→ Disconnected");
    }

    private void OnClearClicked(object sender, EventArgs e)
    {
        LogEditor.Text = string.Empty;
    }

    private async void OnTriggerTestClicked(object sender, EventArgs e)
    {
        if (_testing) return;
        var apiKey = ApiKeyEntry.Text?.Trim();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            SetStatus("error", "Cannot trigger test: API key missing.");
            return;
        }

        _testing = true;
        TriggerButton.Text = "Testing...";
        TriggerButton.IsEnabled = false;

        try
        {
            var dataJson = JsonSerializer.Serialize(new
            {
                version = "1.0",
                packageName = "com.example.app",
                eventTimeMillis = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(),
                testNotification = new { version = "1.0" },
            });
            var payload = new
            {
                message = new
                {
                    data = Convert.ToBase64String(Encoding.UTF8.GetBytes(dataJson)),
                    messageId = $"maui-test-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
                    publishTime = DateTimeOffset.UtcNow.ToString("o"),
                },
                subscription = "projects/example/subscriptions/iapkit-rtdn",
            };

            var url = $"{TrimTrailingSlash(BaseUrlEntry.Text)}/v1/webhooks/{Uri.EscapeDataString(apiKey)}";
            using var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            using var response = await _http.PostAsync(url, content);
            var text = await response.Content.ReadAsStringAsync();
            SetStatus(StatusName(), response.IsSuccessStatusCode
                ? "Test notification accepted (200)."
                : $"Test POST returned {(int)response.StatusCode}: {text}");
        }
        catch (Exception ex)
        {
            SetStatus("error", $"Test POST failed: {ex.Message}");
        }
        finally
        {
            _testing = false;
            TriggerButton.Text = "Trigger test notification";
            TriggerButton.IsEnabled = true;
        }
    }

    private void Append(string text)
    {
        MainThread.BeginInvokeOnMainThread(() =>
        {
            LogEditor.Text = string.IsNullOrWhiteSpace(LogEditor.Text)
                ? text
                : $"{LogEditor.Text}\n{text}";
        });
    }

    private string GetStreamUrl(string apiKey)
    {
        var url = $"{TrimTrailingSlash(BaseUrlEntry.Text)}/v1/webhooks/stream/{Uri.EscapeDataString(apiKey)}";
        EndpointLabel.Text = $"base: {TrimTrailingSlash(BaseUrlEntry.Text)}\napi key: {apiKey[..Math.Min(apiKey.Length, 8)]}...";
        return url;
    }

    private static string TrimTrailingSlash(string? baseUrl)
    {
        var value = string.IsNullOrWhiteSpace(baseUrl) ? "https://kit.openiap.dev" : baseUrl.Trim();
        return value.TrimEnd('/');
    }

    private void UpdateEndpointHint()
    {
        var apiKey = ApiKeyEntry.Text?.Trim();
        EndpointLabel.Text = $"base: {TrimTrailingSlash(BaseUrlEntry.Text)}\napi key: {(string.IsNullOrWhiteSpace(apiKey) ? "MISSING" : $"{apiKey[..Math.Min(apiKey.Length, 8)]}...")}";
    }

    private void SetStatus(string status, string? message)
    {
        MainThread.BeginInvokeOnMainThread(() =>
        {
            StatusLabel.Text = $"Status: {status}";
            StatusMessageLabel.Text = message ?? string.Empty;
            StatusMessageLabel.IsVisible = !string.IsNullOrWhiteSpace(message);
            StatusPanel.BackgroundColor = status switch
            {
                "connected" => Color.FromArgb("#E5F7EA"),
                "connecting" => Color.FromArgb("#FFF6E0"),
                "error" => Color.FromArgb("#FDECEC"),
                _ => Color.FromArgb("#F0F0F0"),
            };
            UpdateEndpointHint();
        });
    }

    private string StatusName()
    {
        var text = StatusLabel.Text ?? "Status: idle";
        return text.Replace("Status: ", string.Empty, StringComparison.Ordinal);
    }

    private void ResetEmptyLog()
    {
        if (LogEditor.Text?.StartsWith("No events yet.", StringComparison.Ordinal) == true)
        {
            LogEditor.Text = string.Empty;
        }
    }

    private static string FormatEventData(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            var type = GetString(root, "type") ?? "webhook-event";
            var source = GetString(root, "source") ?? "-";
            var platform = GetString(root, "platform") ?? "-";
            var environment = GetString(root, "environment") ?? "-";
            var productId = GetString(root, "productId") ?? "-";
            var state = GetString(root, "subscriptionState") ?? "-";
            var receivedAt = GetString(root, "receivedAt") ?? "-";
            return $"{type}\nsource: {source} · platform: {platform} · env: {environment}\nproductId: {productId}\nsubscriptionState: {state}\nreceivedAt: {receivedAt}";
        }
        catch
        {
            return raw;
        }
    }

    private static string? GetString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property)) return null;
        return property.ValueKind == JsonValueKind.String ? property.GetString() : property.ToString();
    }
}
