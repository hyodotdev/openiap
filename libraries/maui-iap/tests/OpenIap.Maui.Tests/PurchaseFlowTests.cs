// C#-specific purchase-flow behavior the shared vectors cannot reach: event
// delivery, synchronization contexts, threads, timeouts, and typed answers.

using System.Text.Json;
using OpenIap.Maui.Tests.TestSupport;
using Xunit;

namespace OpenIap.Maui.Tests;

public class PurchaseFlowTests
{
    [Fact]
    public async Task OutcomePublished_ReachesEveryHandlerPastOneThatThrows()
    {
        using var flow = new PurchaseFlow(Flow(Answer(new PurchaseConfirmation.Entitled(false))));
        var received = 0;
        flow.OutcomePublished += (_, _) => throw new InvalidOperationException("bad handler");
        flow.OutcomePublished += (sender, _) =>
        {
            Assert.Same(flow, sender);
            received++;
        };

        await flow.ProcessPurchaseAsync(Play());

        Assert.Equal(1, received);
    }

    [Fact]
    public async Task OutcomeContext_RaisesThroughTheContextAndNothingAfterDispose()
    {
        var context = new RecordingContext();
        var flow = new PurchaseFlow(Flow(Answer(new PurchaseConfirmation.Entitled(false))) with { OutcomeContext = context });
        var published = new List<PurchaseFlowOutcome>();
        flow.OutcomePublished += (_, outcome) => published.Add(outcome);

        await flow.ProcessPurchaseAsync(Play("GPA.1"));
        Assert.Empty(published);
        context.RunPosted();
        Assert.Single(published);

        // Posted before the dispose, run after it; then a handler added after the dispose.
        await flow.ProcessPurchaseAsync(Play("GPA.2"));
        flow.Dispose();
        flow.OutcomePublished += (_, outcome) => published.Add(outcome);
        context.RunPosted();
        await flow.ProcessPurchaseAsync(Play("GPA.3"));
        context.RunPosted();
        Assert.Single(published);
    }

    [Fact]
    public async Task OutcomeContextThatThrows_StillCompletesTheDelivery()
    {
        using var flow = new PurchaseFlow(Flow(Answer(new PurchaseConfirmation.Entitled(false))) with
        {
            OutcomeContext = new ThrowingContext(),
        });

        var status = await flow.ProcessPurchaseAsync(Play()).WaitAsync(TimeSpan.FromSeconds(5));

        Assert.IsType<PurchaseFlowStatus.Entitled>(status);
    }

    [Fact]
    public void JoinedRun_PublishesAsRequestedWhenTheUserBoughtIt()
    {
        var answer = new TaskCompletionSource<PurchaseConfirmation?>();
        Action<Purchase>? deliver = null;
        var published = new List<PurchaseFlowOutcome>();
        using var flow = new PurchaseFlow(Flow((_, _) => answer.Task) with
        {
            ListenForPurchases = onPurchase =>
            {
                deliver = onPurchase;
                return new DisposableAction(() => deliver = null);
            },
        });
        flow.OutcomePublished += (_, outcome) => published.Add(outcome);

        new EventLoop().Run(async () =>
        {
            var purchase = Play();
            deliver!(purchase);
            var processed = flow.ProcessPurchaseAsync(purchase);
            answer.SetResult(new PurchaseConfirmation.Invalid("expired"));
            Assert.Equal(new PurchaseFlowStatus.Invalid("expired"), await processed);
        });

        Assert.Equal(new PurchaseFlowStatus.Invalid("expired"), Assert.Single(published).Status);
    }

    [Fact]
    public async Task ConcurrentDeliveriesFromTwoThreads_ShareOneConfirmation()
    {
        var answer = new TaskCompletionSource<PurchaseConfirmation?>(TaskCreationOptions.RunContinuationsAsynchronously);
        var confirms = 0;
        var finishes = 0;
        using var flow = new PurchaseFlow(Flow((_, _) =>
        {
            Interlocked.Increment(ref confirms);
            return answer.Task;
        }) with
        {
            FinishTransaction = (_, _) =>
            {
                Interlocked.Increment(ref finishes);
                return Task.CompletedTask;
            },
        });
        Task<PurchaseFlowStatus>? first = null;
        Task<PurchaseFlowStatus>? second = null;

        await Task.WhenAll(
            Task.Run(() => { first = flow.ProcessPurchaseAsync(Play()); }),
            Task.Run(() => { second = flow.ProcessPurchaseAsync(Play()); }));
        answer.SetResult(new PurchaseConfirmation.Entitled(false));
        await Task.WhenAll(first!, second!);

        Assert.Equal(1, confirms);
        Assert.Equal(1, finishes);
    }

    [Fact]
    public async Task IsConsumable_IsReadOnceSoFinishingConsumesWhatConfirmationGranted()
    {
        var reads = 0;
        bool? confirmedAs = null;
        bool? finishedAs = null;
        using var flow = new PurchaseFlow(Flow((_, isConsumable) =>
        {
            confirmedAs = isConsumable;
            return Task.FromResult<PurchaseConfirmation?>(new PurchaseConfirmation.Entitled(false));
        }) with
        {
            // The product config changes between confirming and finishing.
            IsConsumable = _ => ++reads == 1,
            FinishTransaction = (_, isConsumable) =>
            {
                finishedAs = isConsumable;
                return Task.CompletedTask;
            },
        });

        await flow.ProcessPurchaseAsync(Play());

        Assert.Equal(1, reads);
        Assert.True(confirmedAs);
        Assert.True(finishedAs);
    }

    [Fact]
    public async Task ConfirmTimeout_FailsAHungAnswerAndTheNextDeliveryAsksAgain()
    {
        var confirms = 0;
        using var flow = new PurchaseFlow(Flow((_, _) =>
        {
            confirms++;
            return new TaskCompletionSource<PurchaseConfirmation?>().Task;
        }) with { ConfirmTimeout = TimeSpan.FromMilliseconds(20) });

        var status = await flow.ProcessPurchaseAsync(Play());

        var failed = Assert.IsType<PurchaseFlowStatus.Failed>(status);
        Assert.Equal("ConfirmWithBackend did not answer within 20 ms", failed.Error.Message);
        await flow.ProcessPurchaseAsync(Play());
        Assert.Equal(2, confirms);
    }

    [Fact]
    public async Task ConfirmTimeout_PastWhatTaskWaitAsyncTakesStillConfirms()
    {
        using var flow = new PurchaseFlow(Flow(Answer(new PurchaseConfirmation.Entitled(false))) with
        {
            ConfirmTimeout = TimeSpan.MaxValue,
        });

        Assert.IsType<PurchaseFlowStatus.Entitled>(await flow.ProcessPurchaseAsync(Play()));
    }

    [Fact]
    public async Task TypedAnswers_FollowTheJsonRules()
    {
        async Task<PurchaseFlowStatus> Process(PurchaseConfirmation answer)
        {
            using var flow = new PurchaseFlow(Flow(Answer(answer)));
            return await flow.ProcessPurchaseAsync(Play());
        }

        Assert.IsType<PurchaseFlowStatus.Failed>(await Process(new PurchaseConfirmation.VerificationDelayed(-1)));
        Assert.IsType<PurchaseFlowStatus.Failed>(await Process(new PurchaseConfirmation.VerificationDelayed(double.NaN)));
        Assert.Equal(new PurchaseFlowStatus.Verified(), await Process(new PurchaseConfirmation.Verified(double.PositiveInfinity)));
        Assert.Equal(new PurchaseFlowStatus.Linked(), await Process(new PurchaseConfirmation.Linked(-5)));
        Assert.Equal(new PurchaseFlowStatus.Linked(1_000), await Process(new PurchaseConfirmation.Linked(1_000)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("[]")]
    [InlineData("\"entitled\"")]
    [InlineData("{\"status\":\"entitled\",\"alreadyGranted\":\"yes\"}")]
    [InlineData("{\"status\":\"verification_delayed\",\"retryAfterMs\":\"5000\"}")]
    [InlineData("{\"status\":\"verification_delayed\",\"retryAfterMs\":1e400}")]
    public void FromJson_RefusesOffContractBodies(string? json) => Assert.Null(PurchaseConfirmation.FromJson(json));

    [Fact]
    public void FromJson_DropsUnknownFieldsAndUnusableHints()
        => Assert.Equal(
            new PurchaseConfirmation.Linked(),
            PurchaseConfirmation.FromJson("{\"status\":\"linked\",\"retryAfterMs\":-1,\"extra\":true}"));

    [Fact]
    public async Task RecoverPurchases_SharesARunningPassAndStartsANewOneAfter()
    {
        var reads = 0;
        var list = new TaskCompletionSource<IReadOnlyList<Purchase>>();
        using var flow = new PurchaseFlow(Flow(Answer(new PurchaseConfirmation.Entitled(false))) with
        {
            GetAvailablePurchases = () =>
            {
                reads++;
                return list.Task;
            },
        });

        var first = flow.RecoverPurchasesAsync();
        Assert.Same(first, flow.RecoverPurchasesAsync());
        var restore = flow.RecoverPurchasesAsync(includeFinished: true);
        Assert.NotSame(first, restore);
        list.SetResult([Play() with { IsAcknowledgedAndroid = false }]);
        await Task.WhenAll(first, restore);
        await flow.RecoverPurchasesAsync();

        Assert.Equal(3, reads);
    }

    [Fact]
    public async Task Dispose_StopsARunningRecoveryPassAfterTheConfirmationInFlight()
    {
        var answer = new TaskCompletionSource<PurchaseConfirmation?>();
        var confirms = 0;
        var flow = new PurchaseFlow(Flow((_, _) =>
        {
            confirms++;
            return answer.Task;
        }) with
        {
            GetAvailablePurchases = () => Task.FromResult<IReadOnlyList<Purchase>>(
            [
                Play("GPA.1") with { IsAcknowledgedAndroid = false },
                Play("GPA.2") with { IsAcknowledgedAndroid = false },
            ]),
        });

        var pass = flow.RecoverPurchasesAsync();
        Assert.Equal(1, confirms);
        flow.Dispose();
        answer.SetResult(new PurchaseConfirmation.Entitled(false));

        Assert.Equal("GPA.1", Assert.Single(await pass).Purchase.Id);
        Assert.Equal(1, confirms);
    }

    [Fact]
    public async Task RecoverPurchases_RefusesApplePurchasesWithoutPendingTransactions()
    {
        var apple = new PurchaseIOS
        {
            Id = "tx-1", TransactionId = "tx-1", ProductId = "premium", PurchaseState = PurchaseState.Purchased,
            Quantity = 1, IsAutoRenewing = false, Store = IapStore.Apple, TransactionDate = 0,
        };
        using var flow = new PurchaseFlow(Flow(Answer(new PurchaseConfirmation.Entitled(false))) with
        {
            GetAvailablePurchases = () => Task.FromResult<IReadOnlyList<Purchase>>([apple]),
        });

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => flow.RecoverPurchasesAsync());
        Assert.Contains("needs GetPendingTransactionsIOS", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void ReadVerification_RefusesEvidenceFromAnotherCommunityStore()
    {
        // The shared vector's Play case fails while decoding; a community store id decodes, so this reaches the check.
        var purchase = Play() with { Store = IapStore.Unknown, StoreId = "amazon_example" };
        var options = new IapkitConfirmationOptions
        {
            Amazon = new IapkitAmazonOptions { Sandbox = true },
            VerifyAs = _ => IapStore.Amazon,
        };
        var result = new VerifyPurchaseWithProviderResult
        {
            Provider = PurchaseVerificationProvider.Iapkit,
            Iapkit = new RequestVerifyPurchaseWithIapkitResult
            {
                Store = IapStore.Unknown,
                StoreId = "amazon_example",
                Environment = "Sandbox",
                IsValid = true,
                State = IapkitPurchaseState.Entitled,
                ProductId = "premium",
            },
        };

        Assert.Equal(
            new PurchaseConfirmation.Entitled(false),
            IapkitConfirmation.ReadVerification(result, purchase, isConsumable: false, options));
        var other = result with { Iapkit = result.Iapkit with { StoreId = "other_example" } };
        var error = Assert.Throws<InvalidOperationException>(
            () => IapkitConfirmation.ReadVerification(other, purchase, isConsumable: false, options));
        Assert.Equal("IAPKit verified store id other_example, expected amazon_example", error.Message);
    }

    [Fact]
    public void PurchaseConfirmationRequest_SendsTheStoreEvidenceAndExpectedProduct()
    {
        var request = PurchaseConfirmationRequest.FromPurchase(Play() with { PurchaseToken = "play-token" });

        Assert.Equal(new PurchaseConfirmationRequest(IapStore.Google, "play-token", "premium"), request);
        Assert.Equal(
            """{"store":"google","purchaseToken":"play-token","productId":"premium"}""",
            JsonSerializer.Serialize(request));
    }

    [Fact]
    public void PurchaseConfirmationRequest_RefusesPurchasesItCannotConfirm()
    {
        string Refusal(Purchase purchase) =>
            Assert.Throws<InvalidOperationException>(() => PurchaseConfirmationRequest.FromPurchase(purchase)).Message;

        foreach (var purchase in new[]
        {
            Play() with { Store = IapStore.Amazon },
            Play() with { PurchaseToken = null },
            Play() with { PurchaseToken = "" },
        })
        {
            Assert.Contains("has no Apple or Google purchase token", Refusal(purchase), StringComparison.Ordinal);
        }
        Assert.Contains("single-unit", Refusal(Play() with { Quantity = 2 }), StringComparison.Ordinal);
        Assert.Contains("multi-product", Refusal(Play() with { Ids = ["premium", "coins_100"] }), StringComparison.Ordinal);
    }

    [Fact]
    public void Constructor_RequiresTheStoreFunctionsTheSdkWouldSupply()
    {
        var options = Flow(Answer(new PurchaseConfirmation.Entitled(false)));
        Assert.Throws<ArgumentException>(() => new PurchaseFlow(options with { FinishTransaction = null }));
        Assert.Throws<ArgumentException>(() => new PurchaseFlow(options with { GetAvailablePurchases = null }));
    }

    internal static PurchaseAndroid Play(string id = "GPA.1", string productId = "premium") => new()
    {
        Id = id,
        ProductId = productId,
        PurchaseState = PurchaseState.Purchased,
        PurchaseToken = "token",
        Quantity = 1,
        IsAutoRenewing = false,
        Store = IapStore.Google,
        TransactionDate = 0,
    };

    internal static PurchaseConfirmer Answer(PurchaseConfirmation confirmation) =>
        (_, _) => Task.FromResult<PurchaseConfirmation?>(confirmation);

    internal static PurchaseFlowOptions Flow(PurchaseConfirmer confirm) => new()
    {
        ConfirmWithBackend = confirm,
        IsConsumable = _ => false,
        FinishTransaction = (_, _) => Task.CompletedTask,
        GetAvailablePurchases = () => Task.FromResult<IReadOnlyList<Purchase>>([]),
    };

    private sealed class ThrowingContext : SynchronizationContext
    {
        public override void Post(SendOrPostCallback d, object? state) => throw new InvalidOperationException("context gone");
    }
}
