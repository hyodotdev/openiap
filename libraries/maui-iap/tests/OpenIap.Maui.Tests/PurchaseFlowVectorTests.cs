// The purchase-flow cases every port runs (see the fixture's $comment),
// compared exactly as specs/client/src/purchase-flow.test.ts compares them.

using System.Text.Json;
using System.Text.Json.Nodes;
using OpenIap.Maui.Tests.TestSupport;
using Xunit;

namespace OpenIap.Maui.Tests;

public class PurchaseFlowVectorTests
{
    private static readonly JsonObject Vectors = JsonNode.Parse(File.ReadAllText(
        Path.Combine(AppContext.BaseDirectory, "Fixtures", "purchase-flow.vectors.json")))!.AsObject();

    public static TheoryData<string> ProcessCases => Names("process");
    public static TheoryData<string> IapkitCases => Names("iapkit");
    public static TheoryData<string> SequenceCases => Names("sequences");

    [Theory]
    [MemberData(nameof(ProcessCases))]
    public async Task Process(string name)
    {
        var vector = Case("process", name);
        var item = ToPurchase(vector["purchase"]!);
        var isConsumable = (bool)vector["isConsumable"]!;
        var confirms = 0;
        var finishes = new List<(Purchase Purchase, bool IsConsumable)>();
        using var flow = new PurchaseFlow(new PurchaseFlowOptions
        {
            ConfirmWithBackend = (_, _) =>
            {
                confirms++;
                if (vector["confirmThrows"] is not null)
                {
                    return Task.FromException<PurchaseConfirmation?>(new InvalidOperationException("backend down"));
                }
                // Raw JSON on purpose: the flow must reject malformed answers itself.
                return Task.FromResult(PurchaseConfirmation.FromJson(vector["confirmation"]?.ToJsonString()));
            },
            FinishTransaction = (purchase, consumable) =>
            {
                finishes.Add((purchase, consumable));
                return vector["finishThrows"] is null ? Task.CompletedTask : Task.FromException(new InvalidOperationException("store down"));
            },
            IsConsumable = _ => isConsumable,
            GetAvailablePurchases = () => Task.FromResult<IReadOnlyList<Purchase>>([]),
        });

        var status = await flow.ProcessPurchaseAsync(item);

        Assert.Equal((bool?)vector["confirms"] == false ? 0 : 1, confirms);
        if ((bool)vector["finishes"]!)
        {
            var finish = Assert.Single(finishes);
            Assert.Same(item, finish.Purchase);
            Assert.Equal(isConsumable, finish.IsConsumable);
        }
        else
        {
            Assert.Empty(finishes);
        }
        AssertJson(vector["status"], Comparable(status));
        AssertJson(vector["guidance"], Comparable(status.Describe()));
    }

    [Theory]
    [MemberData(nameof(IapkitCases))]
    public async Task Iapkit(string name)
    {
        var vector = Case("iapkit", name);
        var item = ToPurchase(vector["purchase"]!);
        var isConsumable = (bool)vector["isConsumable"]!;
        var productIds = vector["amazon"]?["verifiedProductIds"]?.AsObject();
        var stores = vector["verifyAs"]?.AsObject();
        var grants = 0;
        var options = new IapkitConfirmationOptions
        {
            // Absent: "pk"; null: no key passed.
            ApiKey = vector.TryGetPropertyValue("apiKey", out var apiKey) ? (string?)apiKey : "pk",
            BaseUrl = (string?)vector["baseUrl"],
            Amazon = vector["amazon"] is JsonObject amazon
                ? new IapkitAmazonOptions
                {
                    Sandbox = (bool)amazon["sandbox"]!,
                    VerifiedProductId = id => (string?)productIds?[id] ?? id,
                }
                : null,
            VerifyAs = purchase => stores?[purchase.StoreId] is { } store ? IapStoreExtensions.FromJson((string)store!) : null,
            Grant = vector["noGrant"] is null
                ? (_, _) =>
                {
                    grants++;
                    return Task.CompletedTask;
                }
                : null,
        };
        var calls = new List<VerifyPurchaseWithProviderProps>();
        Task<VerifyPurchaseWithProviderResult> Verify(VerifyPurchaseWithProviderProps props)
        {
            calls.Add(props);
            // Decoded like the native bridge's answer, so evidence the SDK types refuse fails the call.
            var result = vector["result"]?.DeepClone() as JsonObject ?? new JsonObject();
            result["provider"] ??= "iapkit";
            try
            {
                return Task.FromResult(result.Deserialize<VerifyPurchaseWithProviderResult>(JsonOptions.Default)!);
            }
            catch (JsonException error)
            {
                return Task.FromException<VerifyPurchaseWithProviderResult>(error);
            }
        }
        var confirm = IapkitConfirmation.Create(Verify, options);

        var answer = confirm(item, isConsumable);

        if (vector["error"] is not null)
        {
            await Assert.ThrowsAnyAsync<Exception>(() => answer);
        }
        else
        {
            AssertJson(vector["confirmation"], Comparable((await answer)!));
        }
        if (vector["props"] is null || (bool?)vector["verifies"] == false)
        {
            Assert.Empty(calls);
        }
        else
        {
            AssertJson(vector["props"], JsonSerializer.SerializeToNode(Assert.Single(calls), JsonOptions.Default));
        }
        Assert.Equal((bool)vector["granted"]! ? 1 : 0, grants);
    }

    [Theory]
    [MemberData(nameof(SequenceCases))]
    public void Sequence(string name)
    {
        var vector = Case("sequences", name);
        var purchases = vector["purchases"]!.AsObject().ToDictionary(entry => entry.Key, entry => ToPurchase(entry.Value!));
        var answers = vector["answers"]!.AsObject();
        var pendingIOS = vector["pendingIOS"];
        var consumables = Strings(vector["consumables"]).ToHashSet();
        var requested = Strings(vector["requested"]).ToHashSet();
        var confirms = new Dictionary<string, int>();
        var finishes = new Dictionary<string, int>();
        var published = new List<PurchaseFlowOutcome>();
        Action<Purchase>? deliver = null;
        var loop = new EventLoop();
        IReadOnlyList<Purchase> Listed(JsonNode? keys) => Strings(keys).Select(key => purchases[key]).ToList();
        var flow = new PurchaseFlow(new PurchaseFlowOptions
        {
            ConfirmWithBackend = async (purchase, _) =>
            {
                var count = confirms[purchase.Id] = confirms.GetValueOrDefault(purchase.Id) + 1;
                var list = (answers[purchase.Id] ?? answers["*"])!.AsArray();
                var answer = list[Math.Min(count, list.Count) - 1]!;
                // Answers on a later turn, as the JavaScript runner's async function does.
                await loop.Yield();
                if (answer.GetValueKind() == JsonValueKind.String) throw new InvalidOperationException("backend down");
                return PurchaseConfirmation.FromJson(answer.ToJsonString());
            },
            FinishTransaction = (purchase, _) =>
            {
                finishes[purchase.Id] = finishes.GetValueOrDefault(purchase.Id) + 1;
                return Task.CompletedTask;
            },
            IsConsumable = consumables.Contains,
            GetAvailablePurchases = () => Task.FromResult(Listed(vector["available"])),
            GetPendingTransactionsIOS = pendingIOS is null
                ? null
                : () => pendingIOS.GetValueKind() == JsonValueKind.String
                    ? Task.FromException<IReadOnlyList<Purchase>>(new InvalidOperationException("unverified"))
                    : Task.FromResult(Listed(pendingIOS)),
            ListenForPurchases = onPurchase =>
            {
                deliver = onPurchase;
                return new DisposableAction(() => deliver = null);
            },
            WasRequested = purchase => requested.Contains(purchase.Id),
        });
        flow.OutcomePublished += (_, outcome) => published.Add(outcome);

        // Each step's deliveries start together and settle before the next step.
        foreach (var step in vector["steps"]!.AsArray())
        {
            loop.Run(async () =>
            {
                if ((bool?)step!["dispose"] == true) flow.Dispose();
                foreach (var key in Strings(step["listener"])) deliver?.Invoke(purchases[key]);
                var processed = Strings(step["process"]).Select(key => flow.ProcessPurchaseAsync(purchases[key])).ToList();
                var recovered = step["recover"] is JsonObject recover
                    ? flow.RecoverPurchasesAsync((bool?)recover["includeFinished"] ?? false)
                    : null;
                await Task.WhenAll(processed);
                if (recovered is not null) AssertJson(step["outcomes"], ById(await recovered));
            });
        }

        AssertJson(vector["confirms"], JsonSerializer.SerializeToNode(confirms));
        AssertJson(vector["finishes"], JsonSerializer.SerializeToNode(finishes));
        if (vector["published"] is { } expected) AssertJson(expected, ById(published));
    }

    internal static Purchase ToPurchase(JsonNode vector)
    {
        var json = vector.DeepClone().AsObject();
        var apple = (string?)json["store"] == "apple";
        json["__typename"] = apple ? "PurchaseIOS" : "PurchaseAndroid";
        if (apple) json["transactionId"] ??= (string?)json["id"];
        json["quantity"] ??= 1;
        json["isAutoRenewing"] ??= false;
        json["transactionDate"] ??= 0;
        if (json["pendingPurchaseUpdateAndroid"] is JsonObject pending) pending["purchaseToken"] ??= "";
        return json.Deserialize<Purchase>(JsonOptions.Default)!;
    }

    internal static JsonObject Comparable(PurchaseFlowStatus status)
    {
        JsonObject json = status switch
        {
            PurchaseFlowStatus.StorePending => new() { ["status"] = "store_pending" },
            PurchaseFlowStatus.VerificationDelayed delayed => new() { ["status"] = "verification_delayed", ["retryAfterMs"] = delayed.RetryAfterMs },
            PurchaseFlowStatus.OwnershipConflict conflict => new() { ["status"] = "ownership_conflict", ["alreadyGranted"] = conflict.AlreadyGranted },
            PurchaseFlowStatus.TestAccountRestricted => new() { ["status"] = "test_account_restricted" },
            PurchaseFlowStatus.Invalid invalid => new() { ["status"] = "invalid", ["reason"] = invalid.Reason },
            PurchaseFlowStatus.Verified verified => new() { ["status"] = "verified", ["retryAfterMs"] = verified.RetryAfterMs },
            PurchaseFlowStatus.Linked linked => new() { ["status"] = "linked", ["retryAfterMs"] = linked.RetryAfterMs },
            PurchaseFlowStatus.Entitled entitled => new() { ["status"] = "entitled", ["alreadyGranted"] = entitled.AlreadyGranted },
            PurchaseFlowStatus.Failed => new() { ["status"] = "failed", ["error"] = true },
            _ => throw new ArgumentOutOfRangeException(nameof(status)),
        };
        if (status is PurchaseFlowStatus.Entitled { ChangePending: true }) json["changePending"] = true;
        if (status is PurchaseFlowStatus.Invalid { Recovered: true }) json["recovered"] = true;
        var finishError = status switch
        {
            PurchaseFlowStatus.Entitled entitled => entitled.FinishError,
            PurchaseFlowStatus.OwnershipConflict conflict => conflict.FinishError,
            PurchaseFlowStatus.TestAccountRestricted restricted => restricted.FinishError,
            PurchaseFlowStatus.Invalid invalid => invalid.FinishError,
            _ => null,
        };
        if (finishError is not null) json["finishError"] = true;
        return WithoutNulls(json);
    }

    internal static JsonObject Comparable(PurchaseConfirmation confirmation) => WithoutNulls(confirmation switch
    {
        PurchaseConfirmation.StorePending => new() { ["status"] = "store_pending" },
        PurchaseConfirmation.VerificationDelayed delayed => new() { ["status"] = "verification_delayed", ["retryAfterMs"] = delayed.RetryAfterMs },
        PurchaseConfirmation.OwnershipConflict conflict => new() { ["status"] = "ownership_conflict", ["alreadyGranted"] = conflict.AlreadyGranted },
        PurchaseConfirmation.TestAccountRestricted => new() { ["status"] = "test_account_restricted" },
        PurchaseConfirmation.Invalid invalid => new() { ["status"] = "invalid", ["reason"] = invalid.Reason },
        PurchaseConfirmation.Verified verified => new() { ["status"] = "verified", ["retryAfterMs"] = verified.RetryAfterMs },
        PurchaseConfirmation.Linked linked => new() { ["status"] = "linked", ["retryAfterMs"] = linked.RetryAfterMs },
        PurchaseConfirmation.Entitled entitled => new() { ["status"] = "entitled", ["alreadyGranted"] = entitled.AlreadyGranted },
        _ => throw new ArgumentOutOfRangeException(nameof(confirmation)),
    });

    private static JsonObject Comparable(PurchaseFlowGuidance guidance) => WithoutNulls(new()
    {
        ["key"] = JsonNamingPolicy.SnakeCaseLower.ConvertName(guidance.Key.ToString()),
        ["offerPurchase"] = guidance.OfferPurchase,
        ["retryAfterMs"] = guidance.RetryAfterMs,
    });

    private static JsonArray ById(IEnumerable<PurchaseFlowOutcome> outcomes) =>
        new(outcomes.Select(outcome => (JsonNode)new JsonObject
        {
            ["id"] = outcome.Purchase.Id,
            ["status"] = Comparable(outcome.Status),
        }).ToArray());

    // Reparsed so numbers compare by value whatever type built them.
    private static void AssertJson(JsonNode? expected, JsonNode? actual)
    {
        var normalized = JsonNode.Parse(actual?.ToJsonString() ?? "null");
        Assert.True(
            JsonNode.DeepEquals(expected, normalized),
            $"expected {expected?.ToJsonString()}\n  actual {normalized?.ToJsonString()}");
    }

    // An absent field compares as absent, as in the JavaScript runner.
    private static JsonObject WithoutNulls(JsonObject json)
    {
        foreach (var key in json.Where(entry => entry.Value is null).Select(entry => entry.Key).ToList()) json.Remove(key);
        return json;
    }

    private static JsonObject Case(string group, string name) =>
        Vectors[group]!.AsArray().Single(vector => (string?)vector!["name"] == name)!.AsObject();

    private static TheoryData<string> Names(string group) =>
        new(Vectors[group]!.AsArray().Select(vector => (string)vector!["name"]!));

    private static IEnumerable<string> Strings(JsonNode? keys) =>
        keys?.AsArray().Select(key => (string)key!) ?? [];
}
