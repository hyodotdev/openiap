using Xunit;

namespace OpenIap.Maui.Tests;

public class CallQueueTests
{
    [Fact]
    public async Task RunAsync_RunsCallsOneAtATimeInCallOrder()
    {
        var queue = new CallQueue();
        var first = new TaskCompletionSource<bool>();
        var started = new List<string>();

        var connect = queue.RunAsync(() =>
        {
            started.Add("connect");
            return first.Task;
        });
        var disconnect = queue.RunAsync(() =>
        {
            started.Add("disconnect");
            return Task.FromResult(true);
        });
        Assert.Equal(["connect"], started);

        first.SetException(new InvalidOperationException("store down"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => connect);
        Assert.True(await disconnect);
        Assert.Equal(["connect", "disconnect"], started);
    }
}
