// End-to-end coverage of OpenIapClient.ConnectWebhookStream's SSE plumbing
// against a scripted in-memory stream: data-line accumulation, heartbeat /
// stream-control skips, parse-error reporting, per-id dedupe, and the
// transport-error callback.

using System.Net;
using Xunit;

namespace OpenIap.Maui.Tests;

public class WebhookStreamTests
{
    private static string Event(string id, string type = "subscription-started") =>
        $$"""{"id":"{{id}}","type":"{{type}}","platform":"android","environment":"sandbox","source":"google-play-real-time-developer-notifications","projectId":"proj-1","purchaseToken":"token-{{id}}","occurredAt":1720000000000,"receivedAt":1720000000500}""";

    [Fact]
    public async Task Stream_DispatchesParsesDedupesAndReportsParseErrors()
    {
        // One SSE connection: control frame, heartbeat, evt-1, duplicate
        // evt-1, malformed frame, then evt-2 split across two data lines
        // (joined with "\n" per the SSE spec — the split sits between JSON
        // tokens, where the inserted newline is legal whitespace). The
        // stream then stays open.
        var evt2 = Event("evt-2", "subscription-renewed");
        var evt2SplitAt = evt2.IndexOf("\"platform\"", StringComparison.Ordinal);
        var script =
            "data: {\"ping\":1}\n" +
            "\n" +
            "data:\n" +
            "\n" +
            $"data: {Event("evt-1")}\n" +
            "\n" +
            $"data: {Event("evt-1")}\n" +
            "\n" +
            "data: {not json\n" +
            "\n" +
            $"data: {evt2[..evt2SplitAt]}\n" +
            $"data: {evt2[evt2SplitAt..]}\n" +
            "\n";

        using var handler = new SseScriptedHandler(script);
        using var httpClient = new HttpClient(handler);

        var gate = new SemaphoreSlim(0);
        var events = new List<WebhookEvent>();
        var errors = new List<WebhookListenerError>();
        var sync = new object();

        using (var listener = OpenIapClient.ConnectWebhookStream(new WebhookListenerOptions
        {
            ApiKey = "key/1",
            BaseUrl = "https://kit.example.test/",
            HttpClient = httpClient,
            OnEvent = evt =>
            {
                lock (sync) events.Add(evt);
                gate.Release();
            },
            OnError = err =>
            {
                lock (sync) errors.Add(err);
                gate.Release();
            },
        }))
        {
            // 2 events + 1 parse error expected.
            await WaitForCallbacksAsync(gate, 3);
            listener.Close();
        }

        lock (sync)
        {
            Assert.Equal(2, events.Count);
            Assert.Equal("evt-1", events[0].Id);
            Assert.Equal(WebhookEventType.SubscriptionStarted, events[0].Type);
            Assert.Equal("evt-2", events[1].Id);
            Assert.Equal(WebhookEventType.SubscriptionRenewed, events[1].Type);

            var error = Assert.Single(errors);
            Assert.Equal("PARSE_ERROR", error.Code);
        }

        // The connection targeted the escaped stream endpoint.
        var uri = Assert.Single(handler.RequestUris);
        Assert.Equal("https://kit.example.test/v1/webhooks/stream/key%2F1", uri);
    }

    [Fact]
    public async Task Stream_ReportsTransportErrorsAndKeepsListenerAlive()
    {
        using var handler = new ThrowingHandler();
        using var httpClient = new HttpClient(handler);

        var gate = new SemaphoreSlim(0);
        var errors = new List<WebhookListenerError>();
        var sync = new object();

        using var listener = OpenIapClient.ConnectWebhookStream(new WebhookListenerOptions
        {
            ApiKey = "key",
            HttpClient = httpClient,
            OnEvent = _ => { },
            OnError = err =>
            {
                lock (sync) errors.Add(err);
                gate.Release();
            },
        });

        await WaitForCallbacksAsync(gate, 1);
        listener.Close();

        lock (sync)
        {
            Assert.NotEmpty(errors);
            Assert.Equal("TRANSPORT_ERROR", errors[0].Code);
            Assert.NotNull(errors[0].Cause);
        }
    }

    private static async Task WaitForCallbacksAsync(SemaphoreSlim gate, int count)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        for (var i = 0; i < count; i++)
        {
            await gate.WaitAsync(timeout.Token);
        }
    }

    private sealed class ThrowingHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
            => Task.FromException<HttpResponseMessage>(new HttpRequestException("connection refused"));
    }

    private sealed class SseScriptedHandler : HttpMessageHandler
    {
        private readonly string _script;

        public SseScriptedHandler(string script) => _script = script;

        public List<string> RequestUris { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            lock (RequestUris)
            {
                RequestUris.Add(
                    request.RequestUri?.AbsoluteUri
                    ?? throw new InvalidOperationException("Request URI was null."));
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new SseContent(_script),
            });
        }
    }

    /// <summary>
    /// HttpContent whose read stream yields the scripted SSE bytes and then
    /// blocks until cancellation instead of signaling end-of-stream, keeping
    /// the listener on its first connection (no reconnect loop).
    /// </summary>
    private sealed class SseContent : HttpContent
    {
        private readonly byte[] _payload;

        public SseContent(string script) => _payload = System.Text.Encoding.UTF8.GetBytes(script);

        protected override Task<Stream> CreateContentReadStreamAsync()
            => Task.FromResult<Stream>(new BlockingTailStream(_payload));

        protected override Task SerializeToStreamAsync(Stream stream, System.Net.TransportContext? context)
            => stream.WriteAsync(_payload, 0, _payload.Length);

        protected override bool TryComputeLength(out long length)
        {
            length = -1;
            return false;
        }
    }

    private sealed class BlockingTailStream : Stream
    {
        private readonly byte[] _data;
        private int _position;

        public BlockingTailStream(byte[] data) => _data = data;

        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();

        public override long Position
        {
            get => throw new NotSupportedException();
            set => throw new NotSupportedException();
        }

        public override async ValueTask<int> ReadAsync(
            Memory<byte> buffer,
            CancellationToken cancellationToken = default)
        {
            if (_position < _data.Length)
            {
                var count = Math.Min(buffer.Length, _data.Length - _position);
                _data.AsMemory(_position, count).CopyTo(buffer);
                _position += count;
                return count;
            }

            // Keep the connection "open" until the listener cancels the read.
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken).ConfigureAwait(false);
            return 0;
        }

        public override Task<int> ReadAsync(
            byte[] buffer,
            int offset,
            int count,
            CancellationToken cancellationToken)
            => ReadAsync(buffer.AsMemory(offset, count), cancellationToken).AsTask();

        public override int Read(byte[] buffer, int offset, int count)
            => ReadAsync(buffer.AsMemory(offset, count), CancellationToken.None)
                .AsTask().GetAwaiter().GetResult();

        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
