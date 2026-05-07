using System.Text;
using System.Text.Json;
using Hyo.OpenIap;
using OpenIap.Maui;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/webhook-stream.tsx — connects to the
// IAPKit SSE webhook stream through OpenIap.Maui.ConnectWebhookStream and
// renders incoming events.
public partial class WebhookStreamPage : ContentPage
{
    private WebhookListener? _listener;
    private readonly HttpClient _http = new() { Timeout = Timeout.InfiniteTimeSpan };
    private bool _testing;

    public WebhookStreamPage()
    {
        InitializeComponent();
        BaseUrlEntry.Text = IapKitSettings.BaseUrl;
        ApiKeyEntry.Text = IapKitSettings.ApiKey ?? string.Empty;
        UpdateEndpointHint();
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        _listener?.Close();
        _listener = null;
    }

    private void OnConnectClicked(object sender, EventArgs e)
    {
        OnDisconnectClicked(this, EventArgs.Empty);
        var apiKey = ApiKeyEntry.Text?.Trim();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            SetStatus("error", "IAPKit API key not configured. Set the API key before connecting.");
            return;
        }

        var url = GetStreamUrl(apiKey);
        IapKitSettings.Save(apiKey, BaseUrlEntry.Text);
        SetStatus("connecting", null);
        ResetEmptyLog();
        Append($"→ Connecting {url}");

        _listener = Iap.ConnectWebhookStream(new WebhookListenerOptions
        {
            ApiKey = apiKey,
            BaseUrl = BaseUrlEntry.Text,
            OnEvent = webhookEvent =>
            {
                SetStatus("connected", null);
                Append(FormatEventData(webhookEvent));
            },
            OnError = error =>
            {
                SetStatus("error", $"{error.Code}: {error.Message}");
                Append($"⚠ {error.Code}: {error.Message}");
            },
        });
        SetStatus("connected", null);
        Append("✔ Connected. Waiting for events...");
    }

    private void OnDisconnectClicked(object sender, EventArgs e)
    {
        if (_listener is null) return;
        _listener.Close();
        _listener = null;
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
        IapKitSettings.Save(apiKey, BaseUrlEntry.Text);
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

    private static string FormatEventData(WebhookEvent webhookEvent)
    {
        return $"{webhookEvent.Type.ToJson()}\n" +
               $"source: {webhookEvent.Source.ToJson()} · platform: {webhookEvent.Platform.ToJson()} · env: {webhookEvent.Environment.ToJson()}\n" +
               $"productId: {webhookEvent.ProductId ?? "-"}\n" +
               $"subscriptionState: {webhookEvent.SubscriptionState?.ToJson() ?? "-"}\n" +
               $"receivedAt: {webhookEvent.ReceivedAt}";
    }
}
