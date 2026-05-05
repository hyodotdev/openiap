using System.Net.Http.Headers;
using System.Text;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/webhook-stream.tsx — connects to the
// IAPKit SSE webhook stream and renders incoming events. Uses an explicit
// HttpClient because MAUI's HttpClient defaults to buffered responses.
public partial class WebhookStreamPage : ContentPage
{
    private CancellationTokenSource? _cts;
    private readonly HttpClient _http = new() { Timeout = Timeout.InfiniteTimeSpan };

    public WebhookStreamPage()
    {
        InitializeComponent();
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
        var url = UrlEntry.Text;
        if (string.IsNullOrWhiteSpace(url))
        {
            Append("⚠ URL is empty.");
            return;
        }

        _cts = new CancellationTokenSource();
        Append($"→ Connecting {url}");

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Accept.ParseAdd("text/event-stream");
            if (!string.IsNullOrWhiteSpace(TokenEntry.Text))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TokenEntry.Text!.Trim());
            }

            using var response = await _http.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                _cts.Token);
            response.EnsureSuccessStatusCode();

            using var stream = await response.Content.ReadAsStreamAsync(_cts.Token);
            using var reader = new StreamReader(stream, Encoding.UTF8);

            Append("✔ Connected. Waiting for events…");

            while (!_cts.Token.IsCancellationRequested)
            {
                var line = await reader.ReadLineAsync(_cts.Token);
                if (line is null) break;
                if (line.StartsWith("data:", StringComparison.Ordinal))
                {
                    Append(line[5..].Trim());
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
            Append($"⚠ {ex.Message}");
        }
    }

    private void OnDisconnectClicked(object sender, EventArgs e)
    {
        if (_cts is null) return;
        _cts.Cancel();
        _cts = null;
        Append("→ Disconnected");
    }

    private void OnClearClicked(object sender, EventArgs e)
    {
        LogEditor.Text = string.Empty;
    }

    private void Append(string text)
    {
        MainThread.BeginInvokeOnMainThread(() =>
        {
            LogEditor.Text = string.IsNullOrEmpty(LogEditor.Text)
                ? text
                : $"{LogEditor.Text}\n{text}";
        });
    }
}
