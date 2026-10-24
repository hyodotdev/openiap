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

    [Fact]
    public async Task RunAsync_ReportsARefusedRebuildAndKeepsServingCalls()
    {
        var queue = new CallQueue();
        var refused = OpenIapErrorMapper.Wrap(
            ErrorCode.DeveloperError,
            "initConnection cannot change the billing program while a purchase is in progress");

        // Native keeps the live client; the caller only learns why its config did not apply.
        var error = await Assert.ThrowsAsync<OpenIapException>(
            () => queue.RunAsync<bool>(() => Task.FromException<bool>(refused)));
        Assert.Same(refused, error);
        Assert.True(await queue.RunAsync(() => Task.FromResult(true)));
    }
}
