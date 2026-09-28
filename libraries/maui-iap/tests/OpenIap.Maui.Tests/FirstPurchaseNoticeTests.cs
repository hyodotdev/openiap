// The first-purchase notice gates. The Android resolver supplies the host
// app's debuggable flag and the openiap-google claim; these tests inject both.

using Xunit;

namespace OpenIap.Maui.Tests;

public class FirstPurchaseNoticeTests
{
    private readonly List<string> _writes = new();
    private int _claims;

    [Fact]
    public async Task WritesTheFourLinesInOneCallAfterAPurchasedFinishInADebugHost()
    {
        var result = await Notice().AfterFinish(AndroidPurchase(), Finished);

        Assert.Equal("finished", result);
        var text = Assert.Single(_writes);
        Assert.Equal(FirstPurchaseNotice.Text, text);
        var lines = text.Split('\n');
        Assert.Equal(4, lines.Length);
        // An escape here catches a source file decoded with the wrong encoding.
        Assert.EndsWith(" \U0001F389", lines[0], StringComparison.Ordinal);
    }

    [Fact]
    public async Task StaysSilentInAReleaseHost()
    {
        await Notice(isHostDebuggable: false).AfterFinish(AndroidPurchase(), Finished);

        Assert.Equal(0, _claims);
        Assert.Empty(_writes);
    }

    [Fact]
    public async Task StaysSilentUnderATestRunner()
    {
        await Notice(isTestRunner: true).AfterFinish(AndroidPurchase(), Finished);

        Assert.Equal(0, _claims);
        Assert.Empty(_writes);
    }

    [Fact]
    public async Task StaysSilentAndKeepsTheErrorWhenTheFinishFails()
    {
        var failure = new InvalidOperationException("finish failed");

        var thrown = await Assert.ThrowsAsync<InvalidOperationException>(
            () => Notice().AfterFinish(AndroidPurchase(), () => Task.FromException<string>(failure)));

        Assert.Same(failure, thrown);
        Assert.Equal(0, _claims);
    }

    [Fact]
    public async Task StaysSilentForAPendingPurchaseAndKeepsTheClaimForALaterOne()
    {
        var notice = Notice();

        await notice.AfterFinish(AndroidPurchase(PurchaseState.Pending), Finished);
        Assert.Equal(0, _claims);

        await notice.AfterFinish(AndroidPurchase(), Finished);
        Assert.Single(_writes);
    }

    [Fact]
    public async Task StaysSilentWhenThisInstallAlreadyShowedTheNotice()
    {
        await Notice(claimed: false).AfterFinish(AndroidPurchase(), Finished);

        Assert.Equal(1, _claims);
        Assert.Empty(_writes);
    }

    [Fact]
    public async Task LaterFinishesInTheProcessSkipTheNativeClaim()
    {
        var notice = Notice(claimed: false);

        await notice.AfterFinish(AndroidPurchase(), Finished);
        await notice.AfterFinish(AndroidPurchase(), Finished);

        Assert.Equal(1, _claims);
    }

    [Fact]
    public async Task DetectsTheTestRunnerByDefault()
    {
        Assert.True(FirstPurchaseNotice.IsTestFrameworkLoaded());

        var notice = new FirstPurchaseNotice(
            isHostDebuggable: () => true,
            claim: Claim(claimed: true),
            write: _writes.Add,
            runInBackground: work => work());
        await notice.AfterFinish(AndroidPurchase(), Finished);

        Assert.Equal(0, _claims);
    }

    [Fact]
    public async Task ClaimsOffTheCallersThread()
    {
        using var release = new ManualResetEventSlim();
        var written = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var notice = new FirstPurchaseNotice(
            isHostDebuggable: () => true,
            claim: () =>
            {
                release.Wait(TimeSpan.FromSeconds(2));
                return true;
            },
            isTestRunner: () => false,
            write: text => written.TrySetResult(text));

        await notice.AfterFinish(AndroidPurchase(), Finished);

        Assert.False(written.Task.IsCompleted);
        release.Set();
        Assert.Equal(FirstPurchaseNotice.Text, await written.Task.WaitAsync(TimeSpan.FromSeconds(2)));
    }

    [Fact]
    public async Task AFailingDebugCheckNeverReachesTheCaller()
    {
        var notice = new FirstPurchaseNotice(
            isHostDebuggable: () => throw new InvalidOperationException("no application info"),
            claim: Claim(claimed: true),
            isTestRunner: () => false,
            write: _writes.Add,
            runInBackground: work => work());

        Assert.Equal("finished", await notice.AfterFinish(AndroidPurchase(), Finished));
        Assert.Empty(_writes);
    }

    [Fact]
    public async Task AFailingClaimNeverEscapesTheBackgroundWork()
    {
        Exception? escaped = null;
        var notice = new FirstPurchaseNotice(
            isHostDebuggable: () => true,
            claim: () => throw new InvalidOperationException("flag store unavailable"),
            isTestRunner: () => false,
            write: _writes.Add,
            runInBackground: work =>
            {
                try { work(); }
                catch (Exception exception) { escaped = exception; }
            });

        await notice.AfterFinish(AndroidPurchase(), Finished);

        Assert.Null(escaped);
        Assert.Empty(_writes);
    }

    private FirstPurchaseNotice Notice(bool isTestRunner = false, bool isHostDebuggable = true, bool claimed = true) =>
        new(
            isHostDebuggable: () => isHostDebuggable,
            claim: Claim(claimed),
            isTestRunner: () => isTestRunner,
            write: _writes.Add,
            runInBackground: work => work());

    private Func<bool> Claim(bool claimed) => () =>
    {
        _claims++;
        return claimed;
    };

    private static Task<string> Finished() => Task.FromResult("finished");

    private static PurchaseAndroid AndroidPurchase(PurchaseState state = PurchaseState.Purchased) => new()
    {
        Id = "order-1",
        IsAutoRenewing = false,
        ProductId = "dev.hyo.martie.10bulbs",
        PurchaseState = state,
        PurchaseToken = "purchase-token",
        Quantity = 1,
        Store = IapStore.Google,
        TransactionDate = 0,
    };
}
