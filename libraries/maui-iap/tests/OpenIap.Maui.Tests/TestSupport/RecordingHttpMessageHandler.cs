// Fake HttpMessageHandler used by the KitApi contract tests. Same technique as
// the original tests/OpenIap.Maui.ContractTests harness: queue scripted JSON
// bodies, record every request URI (and body) for assertion.

using System.Net;
using System.Text;

namespace OpenIap.Maui.Tests.TestSupport;

internal sealed class RecordingHttpMessageHandler : HttpMessageHandler
{
    private readonly Queue<(HttpStatusCode Status, string Body, string MediaType)> _responses = new();

    public RecordingHttpMessageHandler(params string[] jsonBodies)
    {
        foreach (var body in jsonBodies)
        {
            _responses.Enqueue((HttpStatusCode.OK, body, "application/json"));
        }
    }

    public List<string> RequestUris { get; } = [];
    public List<string?> RequestBodies { get; } = [];
    public List<HttpMethod> RequestMethods { get; } = [];

    public void EnqueueResponse(HttpStatusCode status, string body, string mediaType = "application/json")
        => _responses.Enqueue((status, body, mediaType));

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        RequestUris.Add(
            request.RequestUri?.AbsoluteUri
            ?? throw new InvalidOperationException("Request URI was null."));
        RequestMethods.Add(request.Method);
        RequestBodies.Add(request.Content is null
            ? null
            : await request.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));

        if (_responses.Count == 0)
        {
            throw new InvalidOperationException("No fake HTTP response was configured.");
        }

        var (status, body, mediaType) = _responses.Dequeue();
        return new HttpResponseMessage(status)
        {
            Content = new StringContent(body, Encoding.UTF8, mediaType),
        };
    }
}
